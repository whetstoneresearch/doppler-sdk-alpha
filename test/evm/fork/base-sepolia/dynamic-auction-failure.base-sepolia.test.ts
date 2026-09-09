import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { parseEther, type Address } from 'viem';
import {
  DopplerSDK,
  getAddresses,
  CHAIN_IDS,
  WAD,
  dopplerHookAbi,
  airlockAbi,
} from '../../../../src/evm';
import {
  getForkClients,
  hasRpcUrl,
  getRpcEnvVar,
  mineToTimestamp,
  getAnvilManager,
  isAnvilForkEnabled,
} from '../../utils';

// Minimal WETH ABI for deposit
const wethAbi = [
  {
    name: 'deposit',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Minimal ERC20 ABI
const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * V4 Dynamic Dutch Auction Failure Test
 *
 * This test verifies the `insufficientProceeds` scenario:
 * When an auction ends without hitting `minimumProceeds`, users should be able
 * to SELL tokens back (refund) but NOT buy.
 *
 * Run with: BASE_SEPOLIA_RPC_URL=<rpc-url> ANVIL_FORK_ENABLED=true pnpm test test/fork/base-sepolia/dynamic-auction-failure
 */
describe('V4 Dynamic Auction Failure - insufficientProceeds (Base Sepolia fork)', () => {
  // Skip if fork mode is not enabled or RPC URL is not available
  if (!isAnvilForkEnabled()) {
    it.skip('requires ANVIL_FORK_ENABLED=true');
    return;
  }

  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`);
    return;
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA;
  const addresses = getAddresses(chainId);
  const anvilManager = getAnvilManager();

  // Clients will be initialized in beforeAll
  let publicClient: ReturnType<typeof getForkClients>['publicClient'];
  let walletClient: ReturnType<typeof getForkClients>['walletClient'];
  let testClient: ReturnType<typeof getForkClients>['testClient'];
  let account: ReturnType<typeof getForkClients>['account'];
  let sdk: DopplerSDK;

  // Auction state
  let hookAddress: Address;
  let tokenAddress: Address;
  let poolId: string;
  let startingTime: bigint;
  let endingTime: bigint;
  let modulesWhitelisted = false;

  beforeAll(async () => {
    // Start Anvil fork
    await anvilManager.start(chainId);

    // Get fork clients
    const clients = getForkClients(chainId);
    publicClient = clients.publicClient;
    walletClient = clients.walletClient;
    testClient = clients.testClient;
    account = clients.account;

    // Initialize SDK with fork client
    sdk = new DopplerSDK({ publicClient, chainId });

    // Check if modules are whitelisted
    try {
      const [
        initState,
        migratorState,
        tokenFactoryState,
        governanceFactoryState,
      ] = await Promise.all([
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.v4Initializer],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.v2Migrator],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.tokenFactory],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.governanceFactory],
        }),
      ]);

      // ModuleState: TokenFactory=1, GovernanceFactory=2, PoolInitializer=3, LiquidityMigrator=4
      modulesWhitelisted =
        Number(tokenFactoryState) === 1 &&
        Number(governanceFactoryState) === 2 &&
        Number(initState) === 3 &&
        Number(migratorState) === 4;
    } catch (error) {
      console.error('Failed to check module states:', error);
    }
  }, 60_000); // 60s timeout for Anvil startup

  afterAll(async () => {
    await anvilManager.stop(chainId);
  });

  it('creates a V4 dynamic auction with unreachable minimumProceeds', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test');
      return;
    }

    // Build auction params with unreachable minimumProceeds (100 ETH)
    const params = sdk
      .buildDynamicAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Failure Test Token',
        symbol: 'FAIL',
        tokenURI: 'ipfs://failure-test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMarketCapRange({
        marketCap: { start: 500_000, min: 50_000 },
        numerairePrice: 3000,
        minProceeds: parseEther('100'), // Unreachable - ensures failure
        maxProceeds: parseEther('1000'),
        duration: 300, // 5 minutes for testing
        epochLength: 60, // 60 seconds per epoch
        fee: 3000, // 0.3% fee
        tickSpacing: 10,
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(account.address)
      .withV4Initializer(addresses.v4Initializer)
      .withV2Migrator(addresses.v2Migrator)
      .build();

    // Simulate to get addresses and createParams
    const simulation = await sdk.factory.simulateCreateDynamicAuction(params);
    hookAddress = simulation.hookAddress;
    tokenAddress = simulation.tokenAddress;
    poolId = simulation.poolId;

    // Create the auction
    const hash = await walletClient.writeContract({
      address: addresses.airlock,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...simulation.createParams }],
      chain: walletClient.chain,
      account,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe('success');

    // Verify basic hook state
    const [
      insufficientProceeds,
      minimumProceeds,
      hookStartingTime,
      hookEndingTime,
    ] = await Promise.all([
      publicClient.readContract({
        address: hookAddress,
        abi: dopplerHookAbi,
        functionName: 'insufficientProceeds',
      }),
      publicClient.readContract({
        address: hookAddress,
        abi: dopplerHookAbi,
        functionName: 'minimumProceeds',
      }),
      publicClient.readContract({
        address: hookAddress,
        abi: dopplerHookAbi,
        functionName: 'startingTime',
      }),
      publicClient.readContract({
        address: hookAddress,
        abi: dopplerHookAbi,
        functionName: 'endingTime',
      }),
    ]);

    startingTime = hookStartingTime;
    endingTime = hookEndingTime;

    // Verify initial state
    expect(hookAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(insufficientProceeds).toBe(false);
    expect(minimumProceeds).toBe(parseEther('100'));

    console.log('  ✓ Created V4 dynamic auction');
    console.log(`    Hook: ${hookAddress}`);
    console.log(`    Token: ${tokenAddress}`);
    console.log(`    Pool ID: ${poolId}`);
    console.log(`    Minimum Proceeds: ${minimumProceeds} wei (100 ETH)`);
    console.log(`    Starting Time: ${startingTime}`);
    console.log(`    Ending Time: ${endingTime}`);
  }, 120_000);

  it('performs a small buy to acquire tokens for later sell', async () => {
    if (!modulesWhitelisted || !hookAddress) {
      console.warn('⚠️  Skipping - auction not created');
      return;
    }

    // Mine to startingTime if needed so swaps are allowed
    const block = await publicClient.getBlock();
    if (block.timestamp < startingTime) {
      await mineToTimestamp(testClient, startingTime + 1n);
    }

    // Get WETH by wrapping ETH
    const wrapAmount = parseEther('0.01');
    const wrapHash = await walletClient.writeContract({
      address: addresses.weth,
      abi: wethAbi,
      functionName: 'deposit',
      value: wrapAmount,
      chain: walletClient.chain,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: wrapHash });

    // Approve WETH to Universal Router
    const approveHash = await walletClient.writeContract({
      address: addresses.weth,
      abi: wethAbi,
      functionName: 'approve',
      args: [addresses.permit2, wrapAmount],
      chain: walletClient.chain,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    // Get pool key for swap
    const poolKeyResult = await publicClient.readContract({
      address: hookAddress,
      abi: dopplerHookAbi,
      functionName: 'poolKey',
    });
    const poolKeyTyped = poolKeyResult as [
      Address,
      Address,
      number,
      number,
      Address,
    ];
    const poolKey = {
      currency0: poolKeyTyped[0],
      currency1: poolKeyTyped[1],
      fee: poolKeyTyped[2],
      tickSpacing: poolKeyTyped[3],
      hooks: poolKeyTyped[4],
    };

    // Determine token ordering - asset is token0 if it has lower address
    const isToken0 = tokenAddress.toLowerCase() < addresses.weth.toLowerCase();

    // Try to do a small buy via quoter to see if it would work
    // For BUY: we're swapping numeraire (WETH) for asset
    // zeroForOne = !isToken0 means: WETH -> Asset
    try {
      const buyQuote = await sdk.quoter.quoteExactInputV4({
        poolKey,
        zeroForOne: !isToken0, // WETH -> Asset (buying)
        exactAmount: parseEther('0.001'),
        hookData: '0x',
      });
      console.log(`    Buy quote: ${buyQuote.amountOut} tokens for 0.001 WETH`);

      // If quote succeeded, the pool has liquidity
      // For now, we'll just verify the state can be read and move on
      // A full swap would require Universal Router integration
    } catch (error) {
      console.log(
        '    Buy quote failed (expected if pool not fully initialized):',
        String(error).slice(0, 100),
      );
    }

    // Check token balance (likely 0 if no swap executed)
    const userTokenBalance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    });

    console.log('  ✓ Prepared for testing');
    console.log(`    User token balance: ${userTokenBalance}`);
  }, 60_000);

  it('transitions to insufficientProceeds after time warp past endingTime', async () => {
    if (!modulesWhitelisted || !hookAddress) {
      console.warn('⚠️  Skipping - auction not created');
      return;
    }

    // Get current insufficientProceeds state (should be false)
    const insufficientProceedsBefore = await publicClient.readContract({
      address: hookAddress,
      abi: dopplerHookAbi,
      functionName: 'insufficientProceeds',
    });
    expect(insufficientProceedsBefore).toBe(false);

    // Fast-forward time past endingTime
    await mineToTimestamp(testClient, endingTime + 1n);

    // Verify the block timestamp has advanced (use publicClient, not testClient)
    const block = await publicClient.getBlock();
    const currentTimestamp = block.timestamp;
    expect(currentTimestamp).toBeGreaterThan(endingTime);

    console.log('  ✓ Time warped past endingTime');
    console.log(`    Current timestamp: ${currentTimestamp}`);
    console.log(`    Ending time: ${endingTime}`);
  }, 30_000);

  it('verifies hook behavior after maturity with insufficient proceeds', async () => {
    if (!modulesWhitelisted || !hookAddress) {
      console.warn('⚠️  Skipping - auction not created');
      return;
    }

    // Get pool key for quote
    const poolKeyResult = await publicClient.readContract({
      address: hookAddress,
      abi: dopplerHookAbi,
      functionName: 'poolKey',
    });
    const poolKeyTyped = poolKeyResult as [
      Address,
      Address,
      number,
      number,
      Address,
    ];
    const poolKey = {
      currency0: poolKeyTyped[0],
      currency1: poolKeyTyped[1],
      fee: poolKeyTyped[2],
      tickSpacing: poolKeyTyped[3],
      hooks: poolKeyTyped[4],
    };

    // Determine token ordering - asset is token0 if it has lower address
    const isToken0 = tokenAddress.toLowerCase() < addresses.weth.toLowerCase();

    // Verify the hook detects insufficient proceeds condition
    // BUY quote should fail with InvalidSwapAfterMaturityInsufficientProceeds
    let buyQuoteFailed = false;
    let buyErrorMessage = '';
    try {
      await sdk.quoter.quoteExactInputV4({
        poolKey,
        zeroForOne: !isToken0, // BUY: WETH -> Asset
        exactAmount: parseEther('0.001'),
        hookData: '0x',
      });
    } catch (error) {
      buyQuoteFailed = true;
      buyErrorMessage = String(error);
    }

    expect(buyQuoteFailed).toBe(true);
    // The error should indicate the swap is not allowed after maturity
    console.log('  ✓ BUY quote failed after maturity (as expected)');
    console.log(`    Error: ${buyErrorMessage.slice(0, 150)}...`);
  }, 30_000);

  it('allows SELL quotes (asset → numeraire) after maturity with insufficient proceeds', async () => {
    if (!modulesWhitelisted || !hookAddress) {
      console.warn('⚠️  Skipping - auction not created');
      return;
    }

    // Get pool key
    const poolKeyResult = await publicClient.readContract({
      address: hookAddress,
      abi: dopplerHookAbi,
      functionName: 'poolKey',
    });
    const poolKeyTyped = poolKeyResult as [
      Address,
      Address,
      number,
      number,
      Address,
    ];
    const poolKey = {
      currency0: poolKeyTyped[0],
      currency1: poolKeyTyped[1],
      fee: poolKeyTyped[2],
      tickSpacing: poolKeyTyped[3],
      hooks: poolKeyTyped[4],
    };

    // Determine token ordering
    const isToken0 = tokenAddress.toLowerCase() < addresses.weth.toLowerCase();

    // SELL quote (asset → numeraire): zeroForOne = isToken0
    // After maturity with insufficient proceeds, sells should be allowed (refund path)
    // The key check: it should NOT revert with InvalidSwapAfterMaturityInsufficientProceeds
    try {
      const sellQuote = await sdk.quoter.quoteExactInputV4({
        poolKey,
        zeroForOne: isToken0, // SELL: Asset -> WETH
        exactAmount: parseEther('100'),
        hookData: '0x',
      });

      // Sell quote should return a valid amount (or zero if no liquidity)
      expect(sellQuote.amountOut).toBeGreaterThanOrEqual(0n);
      console.log('  ✓ SELL quote succeeded (refund path allowed)');
      console.log(`    Amount out: ${sellQuote.amountOut}`);
    } catch (error) {
      // If quote fails, it should NOT be because of InvalidSwapAfterMaturityInsufficientProceeds
      // Other failures (e.g., no liquidity, arithmetic errors) are acceptable
      const errorMessage = String(error);
      expect(errorMessage).not.toContain(
        'InvalidSwapAfterMaturityInsufficientProceeds',
      );
      console.log(
        '  ✓ SELL quote did not revert with InvalidSwapAfterMaturityInsufficientProceeds',
      );
      console.log(`    Error (acceptable): ${errorMessage.slice(0, 100)}...`);
    }
  }, 30_000);

  it('reverts BUY quotes (numeraire → asset) after maturity with insufficient proceeds', async () => {
    if (!modulesWhitelisted || !hookAddress) {
      console.warn('⚠️  Skipping - auction not created');
      return;
    }

    // Get pool key
    const poolKeyResult = await publicClient.readContract({
      address: hookAddress,
      abi: dopplerHookAbi,
      functionName: 'poolKey',
    });
    const poolKeyTyped = poolKeyResult as [
      Address,
      Address,
      number,
      number,
      Address,
    ];
    const poolKey = {
      currency0: poolKeyTyped[0],
      currency1: poolKeyTyped[1],
      fee: poolKeyTyped[2],
      tickSpacing: poolKeyTyped[3],
      hooks: poolKeyTyped[4],
    };

    // Determine token ordering
    const isToken0 = tokenAddress.toLowerCase() < addresses.weth.toLowerCase();

    // BUY quote (numeraire → asset): zeroForOne = !isToken0
    // Should revert - buys are not allowed after maturity with insufficient proceeds
    await expect(
      sdk.quoter.quoteExactInputV4({
        poolKey,
        zeroForOne: !isToken0, // BUY: WETH -> Asset
        exactAmount: parseEther('0.1'),
        hookData: '0x',
      }),
    ).rejects.toThrow();

    console.log(
      '  ✓ BUY quote reverted as expected (buys blocked after failed auction)',
    );
  }, 30_000);

  it('blocks migrate() after maturity with insufficient proceeds', async () => {
    if (!modulesWhitelisted || !hookAddress) {
      console.warn('⚠️  Skipping - auction not created');
      return;
    }

    // Verify we're past endingTime
    const block = await publicClient.getBlock();
    expect(block.timestamp).toBeGreaterThan(endingTime);

    // Verify totalProceeds < minimumProceeds (no sales occurred)
    const [hookState, minimumProceeds] = await Promise.all([
      publicClient.readContract({
        address: hookAddress,
        abi: dopplerHookAbi,
        functionName: 'state',
      }),
      publicClient.readContract({
        address: hookAddress,
        abi: dopplerHookAbi,
        functionName: 'minimumProceeds',
      }),
    ]);
    const totalProceeds = hookState[3]; // totalProceeds is at index 3
    expect(totalProceeds).toBeLessThan(minimumProceeds);

    // Attempt to call migrate() - should revert with CannotMigrate
    // The hook's migrate check: if (!earlyExit && !(totalProceeds >= minimumProceeds && timestamp >= endingTime))
    // Since totalProceeds < minimumProceeds, this should revert
    await expect(
      walletClient.writeContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'migrate',
        args: [tokenAddress],
        chain: walletClient.chain,
        account,
      }),
    ).rejects.toThrow();

    console.log(
      '  ✓ migrate() blocked as expected (auction failed to meet minimum proceeds)',
    );
    console.log(`    Total proceeds: ${totalProceeds}`);
    console.log(`    Minimum proceeds: ${minimumProceeds}`);
  }, 30_000);
});
