import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseEther } from 'viem';
import {
  CHAIN_IDS,
  DopplerSDK,
  SECONDS_PER_DAY,
  getAddresses,
} from '../../../../src/evm';
import {
  delay,
  getAnvilManager,
  getForkClients,
  getRpcEnvVar,
  hasRpcUrl,
  isAnvilForkEnabled,
  type ForkClients,
} from '../../utils';

const governorTimingAbi = [
  {
    type: 'function',
    name: 'votingDelay',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'votingPeriod',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

describe('DopplerERC20V1 governance (Base Sepolia fork)', () => {
  const chainId = CHAIN_IDS.BASE_SEPOLIA;
  if (!isAnvilForkEnabled()) {
    it.skip('requires ANVIL_FORK_ENABLED=true');
    return;
  }
  if (!hasRpcUrl(chainId)) {
    it.skip(`requires ${getRpcEnvVar(chainId)} env var`);
    return;
  }

  const addresses = getAddresses(chainId);
  const anvilManager = getAnvilManager();
  let clients: ForkClients;
  let sdk: DopplerSDK<typeof chainId>;

  beforeAll(async () => {
    await anvilManager.start(chainId);
    clients = getForkClients(chainId, 0, { timeout: 90_000 });
    sdk = new DopplerSDK({
      publicClient: clients.publicClient,
      walletClient: clients.walletClient,
      chainId,
    });
  }, 90_000);

  afterAll(async () => {
    await anvilManager.stop(chainId);
  });
  async function executeWhileMining<T>(execute: () => Promise<T>): Promise<T> {
    let mining = true;
    const miner = (async () => {
      while (mining) {
        await clients.testClient.mine({ blocks: 1 });
        await delay(100);
      }
    })();
    try {
      return await execute();
    } finally {
      mining = false;
      await miner;
    }
  }

  it('uses timestamp governance defaults without a balance limit', async () => {
    const params = sdk
      .buildStaticAuction()
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Timestamp Governance Fork',
        symbol: 'TGF',
        tokenURI: 'ipfs://timestamp-governance-fork',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: addresses.weth,
      })
      .poolByTicks({ startTick: 174960, endTick: 225000, fee: 3000 })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(clients.account.address)
      .build();

    const simulation = await sdk.factory.simulateCreateStaticAuction(params);
    const result = await executeWhileMining(() => simulation.execute());

    const token = sdk.getDopplerERC20V1(result.tokenAddress);
    const assetData = await sdk.getAirlockAssetData(result.tokenAddress);
    expect(await token.getClockMode()).toBe('mode=timestamp');
    expect(await token.isBalanceLimitActive()).toBe(false);
    expect(
      await clients.publicClient.readContract({
        address: assetData.governance,
        abi: governorTimingAbi,
        functionName: 'votingDelay',
      }),
    ).toBe(BigInt(SECONDS_PER_DAY));
    expect(
      await clients.publicClient.readContract({
        address: assetData.governance,
        abi: governorTimingAbi,
        functionName: 'votingPeriod',
      }),
    ).toBe(BigInt(7 * SECONDS_PER_DAY));
  }, 180_000);

  it('launches with a meaningful balance limit and no-op governance', async () => {
    const now = (await clients.publicClient.getBlock()).timestamp;
    const maxBalanceLimit = parseEther('50000');
    const params = sdk
      .buildStaticAuction()
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'No-op Balance Limit Fork',
        symbol: 'NBLF',
        tokenURI: 'ipfs://no-op-balance-limit-fork',
        maxBalanceLimit,
        balanceLimitEnd: Number(now) + 30 * SECONDS_PER_DAY,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: addresses.weth,
      })
      .poolByTicks({ startTick: 174960, endTick: 225000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(clients.account.address)
      .build();

    const simulation = await sdk.factory.simulateCreateStaticAuction(params);
    const result = await executeWhileMining(() => simulation.execute());

    const token = sdk.getDopplerERC20V1(result.tokenAddress);
    const assetData = await sdk.getAirlockAssetData(result.tokenAddress);
    expect(await token.getMaxBalanceLimit()).toBe(maxBalanceLimit);
    expect(await token.isBalanceLimitActive()).toBe(true);
    expect(await token.isExcludedFromBalanceLimit(assetData.timelock)).toBe(
      true,
    );
    expect(await token.isExcludedFromBalanceLimit(assetData.poolOrHook)).toBe(
      true,
    );
    expect(
      await token.isExcludedFromBalanceLimit(assetData.migrationPool),
    ).toBe(true);
  }, 180_000);
});
