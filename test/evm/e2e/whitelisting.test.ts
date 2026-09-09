import { afterAll, beforeEach, describe, it, vi } from 'vitest';

// Keep unit/local runs snappy, but allow slower live RPC reads.
vi.setConfig({
  testTimeout: process.env.LIVE_TEST_ENABLED === 'true' ? 60_000 : 10_000,
});
import { type Address } from 'viem';
import {
  CHAIN_IDS,
  getAddresses,
  airlockAbi,
  streamableFeesLockerV2Abi,
  type SupportedChainId,
} from '../../../src/evm';
import { delay } from '../utils/rpc';
import { getRpcEnvVar, getTestClient, hasRpcUrl } from '../utils/clients';
import {
  dopplerHookWhitelistAbi,
  isConfiguredAddress,
  MODULE_STATE_NAMES,
  ModuleState,
  ZERO_ADDRESS,
} from '../utils/whitelisting';

// Use more conservative delay for this test file (many sequential RPC calls)
// Can be overridden via RPC_DELAY_MS env var for workflow_dispatch
const RPC_DELAY_MS = Number(process.env.RPC_DELAY_MS) || 500;

const WHITELIST_TEST_CHAIN_IDS = [
  CHAIN_IDS.MAINNET,
  CHAIN_IDS.MONAD_MAINNET,
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.BASE,
  CHAIN_IDS.BASE_SEPOLIA,
  CHAIN_IDS.ROBINHOOD,
] as const satisfies readonly SupportedChainId[];

// Chain name mapping for TEST_CHAINS env var filtering
const CHAIN_NAME_TO_ID: Record<string, SupportedChainId> = {
  base: CHAIN_IDS.BASE,
  'base-sepolia': CHAIN_IDS.BASE_SEPOLIA,
  arbitrum: CHAIN_IDS.ARBITRUM,
  mainnet: CHAIN_IDS.MAINNET,
  'monad-mainnet': CHAIN_IDS.MONAD_MAINNET,
  robinhood: CHAIN_IDS.ROBINHOOD,
};

// Parse TEST_CHAINS env var (comma-separated chain names or 'all')
function getTestChainIds(): SupportedChainId[] {
  const testChains = process.env.TEST_CHAINS?.toLowerCase().trim();
  if (!testChains || testChains === 'all') {
    return [...WHITELIST_TEST_CHAIN_IDS];
  }
  const chainNames = testChains.split(',').map((s) => s.trim());
  const unknownChainNames = chainNames.filter(
    (name) => !(name in CHAIN_NAME_TO_ID),
  );
  if (unknownChainNames.length > 0) {
    throw new Error(
      `Unknown TEST_CHAINS value(s): ${unknownChainNames.join(', ')}. ` +
        `Supported values: all, ${Object.keys(CHAIN_NAME_TO_ID).join(', ')}`,
    );
  }

  return chainNames.map((name) => CHAIN_NAME_TO_ID[name]);
}

// Track results for summary
interface TestResult {
  chain: string;
  chainId: number;
  module: string;
  address: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'RPC_ERROR';
  expected?: number | string;
  actual?: number | string;
  error?: string;
}

const testResults = new Map<string, TestResult>();

function getTestResultKey(
  result: Pick<TestResult, 'chainId' | 'module' | 'address'>,
) {
  return `${result.chainId}:${result.module}:${result.address}`;
}

function recordTestResult(result: TestResult) {
  testResults.set(getTestResultKey(result), { ...result });
}

// Chain ID to name mapping
const CHAIN_ID_NAMES: Record<number, string> = {
  1: 'Mainnet',
  42161: 'Arbitrum',
  8453: 'Base',
  84532: 'Base Sepolia',
  143: 'Monad Mainnet',
  4663: 'Robinhood',
};

type AirlockModuleCase = {
  title: string;
  module: string;
  address?: Address;
  expectedState: ModuleState;
};

type DopplerHookCase = {
  title: string;
  module: string;
  hookAddress?: Address;
  parentAddress?: Address;
};

type StreamableFeesLockerCase = {
  title: string;
  module: string;
  lockerAddress?: Address;
  migratorAddress?: Address;
};

const SKIPPED_AIRLOCK_MODULES_BY_CHAIN: Partial<
  Record<SupportedChainId, readonly string[]>
> = {
  [CHAIN_IDS.MAINNET]: [
    'DN404Factory',
    'UniswapV2MigratorSplit',
    'UniswapV4MigratorSplit',
  ],
  [CHAIN_IDS.MONAD_MAINNET]: [
    'DN404Factory',
    'UniswapV2MigratorSplit',
    'UniswapV4MigratorSplit',
  ],
  [CHAIN_IDS.BASE]: ['UniswapV2MigratorSplit', 'UniswapV4MigratorSplit'],
};

function shouldSkipAirlockModuleCase(
  chainId: SupportedChainId,
  moduleName: string,
) {
  return Boolean(
    SKIPPED_AIRLOCK_MODULES_BY_CHAIN[chainId]?.includes(moduleName),
  );
}

function formatExpectation(value: number | string | undefined): string {
  if (value === undefined) return 'n/a';
  if (typeof value === 'number') {
    return `${MODULE_STATE_NAMES[value] || value} (${value})`;
  }
  return value;
}

describe('Airlock Module Whitelisting', () => {
  // Use filtered chain IDs from env var (defaults to all)
  const supportedChainIds = getTestChainIds();

  // Print summary after all tests
  afterAll(() => {
    const finalResults = Array.from(testResults.values());
    const failed = finalResults.filter(
      (r) => r.status === 'FAIL' || r.status === 'RPC_ERROR',
    );
    if (finalResults.length === 0) {
      throw new Error(
        'Whitelist audit ran zero module checks. Verify TEST_CHAINS and RPC configuration before release.',
      );
    }

    if (failed.length > 0 || finalResults.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('  TEST RESULTS SUMMARY');
      console.log('='.repeat(80));

      // Group by chain
      const byChain = new Map<number, TestResult[]>();
      for (const r of finalResults) {
        if (!byChain.has(r.chainId)) byChain.set(r.chainId, []);
        byChain.get(r.chainId)!.push(r);
      }

      for (const [chainId, results] of byChain) {
        const chainName = results[0]?.chain || `Chain ${chainId}`;
        const passed = results.filter((r) => r.status === 'PASS').length;
        const failedCount = results.filter(
          (r) => r.status === 'FAIL' || r.status === 'RPC_ERROR',
        ).length;
        console.log(
          `\n  ${chainName} (${chainId}): ${passed} passed, ${failedCount} failed`,
        );

        for (const r of results) {
          const icon =
            r.status === 'PASS'
              ? '[PASS]'
              : r.status === 'SKIP'
                ? '[SKIP]'
                : '[FAIL]';
          console.log(`    ${icon} ${r.module}: ${r.address}`);
          if (r.status === 'FAIL') {
            console.log(
              `           Expected: ${formatExpectation(r.expected)}`,
            );
            console.log(`           Actual:   ${formatExpectation(r.actual)}`);
          } else if (r.status === 'RPC_ERROR') {
            console.log(`           Error: ${r.error}`);
          }
        }
      }
      console.log('\n' + '='.repeat(80));
    }
  });

  for (const chainId of supportedChainIds) {
    describe(`Chain ${chainId}`, () => {
      const addresses = getAddresses(chainId);

      if (addresses.airlock === ZERO_ADDRESS) {
        it.skip(`Airlock not deployed on chain ${chainId}`);
        return;
      }

      if (!hasRpcUrl(chainId)) {
        it.skip(`requires ${getRpcEnvVar(chainId)} or ALCHEMY_API_KEY`);
        return;
      }

      const publicClient = getTestClient(chainId, {
        retryCount: 3,
        retryDelay: 1000,
      });

      // Add delay before each test to avoid rate limiting
      beforeEach(async () => {
        await delay(RPC_DELAY_MS);
      });

      const chainName = CHAIN_ID_NAMES[chainId] || `Chain ${chainId}`;

      // Helper to test and record results
      async function testModule(
        moduleName: string,
        moduleAddress: Address,
        expectedState: ModuleState,
      ) {
        const result: TestResult = {
          chain: chainName,
          chainId,
          module: moduleName,
          address: moduleAddress,
          status: 'PASS',
          expected: expectedState,
        };

        try {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [moduleAddress],
          })) as unknown as number;

          result.actual = Number(state);

          if (result.actual !== expectedState) {
            result.status = 'FAIL';
            recordTestResult(result);
            throw new Error(
              `State=${formatExpectation(result.actual)}, expected ${formatExpectation(expectedState)} | ${moduleAddress}`,
            );
          }

          recordTestResult(result);
        } catch (err) {
          if (result.status !== 'FAIL') {
            result.status = 'RPC_ERROR';
            result.error = err instanceof Error ? err.message : String(err);
            recordTestResult(result);
          }
          throw err;
        }
      }

      async function testDopplerHookEnabled(
        moduleName: string,
        hookAddress: Address,
        parentAddress: Address,
      ) {
        const result: TestResult = {
          chain: chainName,
          chainId,
          module: moduleName,
          address: hookAddress,
          status: 'PASS',
          expected: 'Enabled (> 0)',
        };

        try {
          const flag = await publicClient.readContract({
            address: parentAddress,
            abi: dopplerHookWhitelistAbi,
            functionName: 'isDopplerHookEnabled',
            args: [hookAddress],
          });

          result.actual =
            flag > 0n ? `Enabled (${flag.toString()})` : 'Disabled (0)';

          if (flag <= 0n) {
            result.status = 'FAIL';
            recordTestResult(result);
            throw new Error(
              `Hook flag=${flag.toString()}, expected a non-zero enabled flag | hook=${hookAddress} parent=${parentAddress}`,
            );
          }

          recordTestResult(result);
        } catch (err) {
          if (result.status !== 'FAIL') {
            result.status = 'RPC_ERROR';
            result.error = err instanceof Error ? err.message : String(err);
            recordTestResult(result);
          }
          throw err;
        }
      }

      async function testStreamableFeesLockerApprovedMigrator(
        moduleName: string,
        lockerAddress: Address,
        migratorAddress: Address,
      ) {
        const result: TestResult = {
          chain: chainName,
          chainId,
          module: moduleName,
          address: lockerAddress,
          status: 'PASS',
          expected: 'Approved (true)',
        };

        try {
          const approved = await publicClient.readContract({
            address: lockerAddress,
            abi: streamableFeesLockerV2Abi,
            functionName: 'approvedMigrators',
            args: [migratorAddress],
          });

          result.actual = approved ? 'Approved (true)' : 'Approved (false)';

          if (!approved) {
            result.status = 'FAIL';
            recordTestResult(result);
            throw new Error(
              `approvedMigrators=${approved} for migrator=${migratorAddress} locker=${lockerAddress}`,
            );
          }

          recordTestResult(result);
        } catch (err) {
          if (result.status !== 'FAIL') {
            result.status = 'RPC_ERROR';
            result.error = err instanceof Error ? err.message : String(err);
            recordTestResult(result);
          }
          throw err;
        }
      }

      const airlockModuleCases: AirlockModuleCase[] = [
        {
          title: `TokenFactory (${addresses.tokenFactory}) whitelisted`,
          module: 'TokenFactory',
          address: addresses.tokenFactory,
          expectedState: ModuleState.TokenFactory,
        },
        {
          title: `DopplerERC20V1Factory (${addresses.dopplerERC20V1Factory}) whitelisted`,
          module: 'DopplerERC20V1Factory',
          address: addresses.dopplerERC20V1Factory,
          expectedState: ModuleState.TokenFactory,
        },
        {
          title: `DN404Factory (${addresses.doppler404Factory}) whitelisted`,
          module: 'DN404Factory',
          address: addresses.doppler404Factory,
          expectedState: ModuleState.TokenFactory,
        },
        {
          title: `GovernanceFactory (${addresses.governanceFactory}) whitelisted`,
          module: 'GovernanceFactory',
          address: addresses.governanceFactory,
          expectedState: ModuleState.GovernanceFactory,
        },
        {
          title: `UniswapV3Initializer (${addresses.v3Initializer}) whitelisted`,
          module: 'UniswapV3Initializer',
          address: addresses.v3Initializer,
          expectedState: ModuleState.PoolInitializer,
        },
        {
          title: `UniswapV4Initializer (${addresses.v4Initializer}) whitelisted`,
          module: 'UniswapV4Initializer',
          address: addresses.v4Initializer,
          expectedState: ModuleState.PoolInitializer,
        },
        {
          title: `DopplerHookInitializer (${addresses.dopplerHookInitializer}) whitelisted`,
          module: 'DopplerHookInitializer',
          address: addresses.dopplerHookInitializer,
          expectedState: ModuleState.PoolInitializer,
        },
        {
          title: `LockableUniswapV3Initializer (${addresses.lockableV3Initializer}) whitelisted`,
          module: 'LockableUniswapV3Initializer',
          address: addresses.lockableV3Initializer,
          expectedState: ModuleState.PoolInitializer,
        },
        {
          title: `V4MulticurveInitializer (${addresses.v4MulticurveInitializer}) whitelisted`,
          module: 'V4MulticurveInitializer',
          address: addresses.v4MulticurveInitializer,
          expectedState: ModuleState.PoolInitializer,
        },
        {
          title: `V4ScheduledMulticurveInitializer (${addresses.v4ScheduledMulticurveInitializer}) whitelisted`,
          module: 'V4ScheduledMulticurveInitializer',
          address: addresses.v4ScheduledMulticurveInitializer,
          expectedState: ModuleState.PoolInitializer,
        },
        {
          title: `V4DecayMulticurveInitializer (${addresses.v4DecayMulticurveInitializer}) whitelisted`,
          module: 'V4DecayMulticurveInitializer',
          address: addresses.v4DecayMulticurveInitializer,
          expectedState: ModuleState.PoolInitializer,
        },
        {
          title: `UniswapV2Migrator (${addresses.v2Migrator}) whitelisted`,
          module: 'UniswapV2Migrator',
          address: addresses.v2Migrator,
          expectedState: ModuleState.LiquidityMigrator,
        },
        {
          title: `UniswapV2MigratorSplit (${addresses.v2MigratorSplit}) whitelisted`,
          module: 'UniswapV2MigratorSplit',
          address: addresses.v2MigratorSplit,
          expectedState: ModuleState.LiquidityMigrator,
        },
        {
          title: `UniswapV4Migrator (${addresses.v4Migrator}) whitelisted`,
          module: 'UniswapV4Migrator',
          address: addresses.v4Migrator,
          expectedState: ModuleState.LiquidityMigrator,
        },
        {
          title: `UniswapV4MigratorSplit (${addresses.v4MigratorSplit}) whitelisted`,
          module: 'UniswapV4MigratorSplit',
          address: addresses.v4MigratorSplit,
          expectedState: ModuleState.LiquidityMigrator,
        },
        {
          title: `DopplerHookMigrator (${addresses.dopplerHookMigrator}) whitelisted`,
          module: 'DopplerHookMigrator',
          address: addresses.dopplerHookMigrator,
          expectedState: ModuleState.LiquidityMigrator,
        },
        {
          title: `RehypeDopplerHookInitializer (${addresses.rehypeDopplerHookInitializer}) not whitelisted on Airlock`,
          module: 'RehypeDopplerHookInitializer on Airlock',
          address: addresses.rehypeDopplerHookInitializer,
          expectedState: ModuleState.NotWhitelisted,
        },
        {
          title: `NoOpMigrator (${addresses.noOpMigrator}) whitelisted`,
          module: 'NoOpMigrator',
          address: addresses.noOpMigrator,
          expectedState: ModuleState.LiquidityMigrator,
        },
        {
          title: `NoOpGovernanceFactory (${addresses.noOpGovernanceFactory}) whitelisted`,
          module: 'NoOpGovernanceFactory',
          address: addresses.noOpGovernanceFactory,
          expectedState: ModuleState.GovernanceFactory,
        },
        {
          title: `LaunchpadGovernanceFactory (${addresses.launchpadGovernanceFactory}) whitelisted`,
          module: 'LaunchpadGovernanceFactory',
          address: addresses.launchpadGovernanceFactory,
          expectedState: ModuleState.GovernanceFactory,
        },
      ];

      const dopplerHookCases: DopplerHookCase[] = [
        {
          title: `RehypeDopplerHookInitializer (${addresses.rehypeDopplerHookInitializer}) enabled on DopplerHookInitializer (${addresses.dopplerHookInitializer})`,
          module: 'RehypeDopplerHookInitializer on DopplerHookInitializer',
          hookAddress: addresses.rehypeDopplerHookInitializer,
          parentAddress: addresses.dopplerHookInitializer,
        },
      ];

      const streamableFeesLockerCases: StreamableFeesLockerCase[] = [
        {
          title: `DopplerHookMigrator (${addresses.dopplerHookMigrator}) approved on StreamableFeesLockerV2 (${addresses.streamableFeesLockerV2})`,
          module: 'DopplerHookMigrator on StreamableFeesLockerV2',
          lockerAddress: addresses.streamableFeesLockerV2,
          migratorAddress: addresses.dopplerHookMigrator,
        },
      ];

      for (const moduleCase of airlockModuleCases) {
        const shouldRun =
          isConfiguredAddress(moduleCase.address) &&
          !shouldSkipAirlockModuleCase(chainId, moduleCase.module);
        const testFn = shouldRun ? it : it.skip;
        testFn(moduleCase.title, () =>
          testModule(
            moduleCase.module,
            moduleCase.address as Address,
            moduleCase.expectedState,
          ),
        );
      }

      for (const hookCase of dopplerHookCases) {
        const shouldRun =
          isConfiguredAddress(hookCase.hookAddress) &&
          isConfiguredAddress(hookCase.parentAddress);
        const testFn = shouldRun ? it : it.skip;
        testFn(hookCase.title, () =>
          testDopplerHookEnabled(
            hookCase.module,
            hookCase.hookAddress as Address,
            hookCase.parentAddress as Address,
          ),
        );
      }

      for (const lockerCase of streamableFeesLockerCases) {
        const shouldRun =
          isConfiguredAddress(lockerCase.lockerAddress) &&
          isConfiguredAddress(lockerCase.migratorAddress);
        const testFn = shouldRun ? it : it.skip;
        testFn(lockerCase.title, () =>
          testStreamableFeesLockerApprovedMigrator(
            lockerCase.module,
            lockerCase.lockerAddress as Address,
            lockerCase.migratorAddress as Address,
          ),
        );
      }
    });
  }
});
