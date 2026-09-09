import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseEther, zeroAddress, type Address } from 'viem';
import {
  CHAIN_IDS,
  DopplerSDK,
  WAD,
  derc20Abi,
  getAddresses,
  rehypeDopplerHookInitializerAbi,
  computePoolId,
  weth9Abi,
} from '../../../../src/evm';
import {
  delay,
  getAnvilManager,
  getForkClients,
  getRpcEnvVar,
  hasRpcUrl,
  type ForkClients,
  isAnvilForkEnabled,
  mineToTimestamp,
} from '../../utils';
import { executeBuySwap } from '../utils';

const chainId = CHAIN_IDS.BASE_SEPOLIA;
const directSalt = `0x${'41'.repeat(32)}` as const;
const vestedSalt = `0x${'42'.repeat(32)}` as const;
const exactAmountIn = parseEther('0.001');

const feeDistributionInfo = {
  assetFeesToAssetBuybackWad: WAD / 4n,
  assetFeesToNumeraireBuybackWad: WAD / 4n,
  assetFeesToBeneficiaryWad: WAD / 4n,
  assetFeesToLpWad: WAD / 4n,
  numeraireFeesToAssetBuybackWad: WAD / 4n,
  numeraireFeesToNumeraireBuybackWad: WAD / 4n,
  numeraireFeesToBeneficiaryWad: WAD / 4n,
  numeraireFeesToLpWad: WAD / 4n,
};

const standardCurves = [
  {
    marketCap: { start: 500_000, end: 1_500_000 },
    numPositions: 10,
    shares: (WAD * 3n) / 10n,
  },
  {
    marketCap: { start: 1_000_000, end: 5_000_000 },
    numPositions: 15,
    shares: (WAD * 4n) / 10n,
  },
  {
    marketCap: { start: 4_000_000, end: 50_000_000 },
    numPositions: 10,
    shares: (WAD * 29n) / 100n,
  },
  {
    marketCap: { start: 50_000_000, end: 'max' as const },
    numPositions: 10,
    shares: WAD / 100n,
  },
];

describe('Multicurve dev buy (Base Sepolia fork)', () => {
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

  async function mineWhile<T>(operation: () => Promise<T>): Promise<T> {
    let mining = true;
    const miner = (async () => {
      while (mining) {
        try {
          await clients.testClient.mine({ blocks: 1 });
        } catch {}
        await delay(100);
      }
    })();

    try {
      return await operation();
    } finally {
      mining = false;
      await miner;
    }
  }

  async function buildPlainParams() {
    const protocolBeneficiary = await sdk.getAirlockBeneficiary(WAD / 10n);
    return sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Native Dev Buy Fork',
        symbol: 'NDBF',
        tokenURI: 'ipfs://native-dev-buy-fork',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: zeroAddress,
      })
      .withCurves({
        numerairePrice: 3000,
        fee: 3000,
        curves: standardCurves,
        beneficiaries: [
          protocolBeneficiary,
          { beneficiary: clients.account.address, shares: (WAD * 9n) / 10n },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(clients.account.address)
      .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
      .withSalt(directSalt)
      .withDevBuy({
        exactAmountIn,
        recipient: clients.account.address,
      })
      .build();
  }

  async function buildRehypeParams() {
    const protocolBeneficiary = await sdk.getAirlockBeneficiary(WAD / 10n);
    const rehypeHook = addresses.rehypeDopplerHookInitializer;
    if (!rehypeHook) {
      throw new Error('Base Sepolia Rehype hook address is required');
    }

    return sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Vested Rehype Dev Buy Fork',
        symbol: 'VRDBF',
        tokenURI: 'ipfs://vested-rehype-dev-buy-fork',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withCurves({
        numerairePrice: 3000,
        fee: 3000,
        curves: standardCurves,
        beneficiaries: [
          protocolBeneficiary,
          { beneficiary: clients.account.address, shares: (WAD * 9n) / 10n },
        ],
      })
      .withRehypeDopplerHookInitializer({
        hookAddress: rehypeHook,
        buybackDestination: clients.account.address,
        startFee: 3000,
        endFee: 3000,
        durationSeconds: 0,
        feeRoutingMode: 0,
        feeDistributionInfo,
        integratorFeeConfig: {
          feeShare: 200_000,
          automaticPayout: false,
        },
        farTick: 200_000,
      })
      .withGovernance({ type: 'noOp' })
      .withIntegrator(clients.account.address)
      .withMigration({ type: 'noOp' })
      .withUserAddress(clients.account.address)
      .withDopplerHookInitializer(addresses.dopplerHookInitializer!)
      .withSalt(vestedSalt)
      .withDevBuy({
        exactAmountIn,
        recipient: clients.account.address,
        vesting: {
          permissionlessClaim: false,
          cliffDuration: 86_400n,
          vestingDuration: 172_800n,
        },
      })
      .build();
  }

  async function balanceOf(token: Address, owner: Address): Promise<bigint> {
    return await clients.publicClient.readContract({
      address: token,
      abi: derc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    });
  }

  it(
    'executes a native exact-input dev buy and delivers the Bundled output',
    { timeout: 120_000 },
    async () => {
      const params = await buildPlainParams();
      const simulated = await sdk.factory.simulateCreateMulticurve(params);
      expect(simulated.devBuy?.simulatedAmountOut).toBeGreaterThan(0n);

      const result = await mineWhile(() => simulated.execute());
      expect(result.approvalTransactionHash).toBeUndefined();
      expect(result.devBuy?.exactAmountIn).toBe(exactAmountIn);
      expect(result.devBuy?.amountOut).toBeGreaterThan(0n);
      expect(result.devBuy?.amountOut).toBe(
        simulated.devBuy?.simulatedAmountOut,
      );
      expect(
        await balanceOf(result.tokenAddress, clients.account.address),
      ).toBe(result.devBuy?.amountOut);
    },
  );

  it(
    'executes an ERC20-funded Rehype dev buy through custody and claim',
    { timeout: 180_000 },
    async () => {
      const wrapHash = await clients.walletClient.writeContract({
        address: addresses.weth,
        abi: weth9Abi,
        functionName: 'deposit',
        value: exactAmountIn,
        chain: clients.walletClient.chain,
        account: clients.account,
      });
      await clients.publicClient.waitForTransactionReceipt({ hash: wrapHash });

      const rehypeHook = addresses.rehypeDopplerHookInitializer!;
      expect(
        await clients.publicClient.readContract({
          address: rehypeHook,
          abi: rehypeDopplerHookInitializerAbi,
          functionName: 'bundler',
        }),
      ).toBe(addresses.bundler);

      const params = await buildRehypeParams();
      const simulated = await sdk.factory.simulateCreateMulticurve(params);
      expect(simulated.devBuy?.simulatedAmountOut).toBeGreaterThan(0n);

      const result = await mineWhile(() => simulated.execute());
      expect(result.approvalTransactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.devBuy?.amountOut).toBeGreaterThan(0n);
      expect(result.devBuy?.amountOut).toBe(
        simulated.devBuy?.simulatedAmountOut,
      );

      const pool = await (
        await sdk.getMulticurvePool(result.tokenAddress)
      ).getState();
      await executeBuySwap({
        addresses,
        publicClient: clients.publicClient,
        sdk,
        walletClient: clients.walletClient,
        poolKey: pool.poolKey,
        account: clients.account,
      });
      const poolId = computePoolId(pool.poolKey);
      const routing = await clients.publicClient.readContract({
        address: rehypeHook,
        abi: rehypeDopplerHookInitializerAbi,
        functionName: 'getIntegratorRoutingConfig',
        args: [poolId],
      });
      expect(routing[0].toLowerCase()).toBe(
        clients.account.address.toLowerCase(),
      );
      expect(routing[3]).toBe(false);

      const pending = await clients.publicClient.readContract({
        address: rehypeHook,
        abi: rehypeDopplerHookInitializerAbi,
        functionName: 'getPendingIntegratorFees',
        args: [poolId],
      });
      const claimableBeforeCollection = await clients.publicClient.readContract(
        {
          address: rehypeHook,
          abi: rehypeDopplerHookInitializerAbi,
          functionName: 'getClaimableIntegratorFees',
          args: [poolId],
        },
      );
      expect(
        pending[0] > 0n ||
          pending[1] > 0n ||
          claimableBeforeCollection[0] > 0n ||
          claimableBeforeCollection[1] > 0n,
      ).toBe(true);

      const collectHash = await clients.walletClient.writeContract({
        address: rehypeHook,
        abi: rehypeDopplerHookInitializerAbi,
        functionName: 'collectFees',
        args: [result.tokenAddress],
        chain: clients.walletClient.chain,
        account: clients.account,
      });
      await clients.publicClient.waitForTransactionReceipt({
        hash: collectHash,
      });
      const claimable = await clients.publicClient.readContract({
        address: rehypeHook,
        abi: rehypeDopplerHookInitializerAbi,
        functionName: 'getClaimableIntegratorFees',
        args: [poolId],
      });
      expect(claimable[0] > 0n || claimable[1] > 0n).toBe(true);
      const claimedAssetFees =
        pool.poolKey.currency0.toLowerCase() ===
        result.tokenAddress.toLowerCase()
          ? claimable[0]
          : claimable[1];
      const assetBalanceBeforeIntegratorClaim = await balanceOf(
        result.tokenAddress,
        clients.account.address,
      );

      const integratorClaimHash = await clients.walletClient.writeContract({
        address: rehypeHook,
        abi: rehypeDopplerHookInitializerAbi,
        functionName: 'claimIntegratorFees',
        args: [result.tokenAddress, clients.account.address],
        chain: clients.walletClient.chain,
        account: clients.account,
      });
      await clients.publicClient.waitForTransactionReceipt({
        hash: integratorClaimHash,
      });
      expect(
        await clients.publicClient.readContract({
          address: rehypeHook,
          abi: rehypeDopplerHookInitializerAbi,
          functionName: 'getClaimableIntegratorFees',
          args: [poolId],
        }),
      ).toEqual([0n, 0n]);

      const bundler = sdk.getBundler(result.devBuy!.bundler);
      const vesting = await bundler.getVesting(result.tokenAddress);
      expect(vesting).toMatchObject({
        recipient: clients.account.address,
        permissionlessClaim: false,
        cliffDuration: 86_400n,
        vestingDuration: 172_800n,
        totalAmount: result.devBuy!.amountOut,
        claimedAmount: 0n,
      });
      expect(await balanceOf(result.tokenAddress, result.devBuy!.bundler)).toBe(
        result.devBuy!.amountOut,
      );
      expect(
        await balanceOf(result.tokenAddress, clients.account.address),
      ).toBe(assetBalanceBeforeIntegratorClaim + claimedAssetFees);

      await mineToTimestamp(
        clients.testClient,
        vesting.start + vesting.vestingDuration + 1n,
      );
      expect(await bundler.getClaimable(result.tokenAddress)).toBe(
        result.devBuy!.amountOut,
      );
      const claimHash = await bundler.claim(result.tokenAddress);
      await clients.testClient.mine({ blocks: 1 });
      await clients.publicClient.waitForTransactionReceipt({ hash: claimHash });

      expect(
        await balanceOf(result.tokenAddress, clients.account.address),
      ).toBe(
        assetBalanceBeforeIntegratorClaim +
          claimedAssetFees +
          result.devBuy!.amountOut,
      );
      expect(await balanceOf(result.tokenAddress, result.devBuy!.bundler)).toBe(
        0n,
      );
      expect(await bundler.getClaimable(result.tokenAddress)).toBe(0n);
    },
  );
});
