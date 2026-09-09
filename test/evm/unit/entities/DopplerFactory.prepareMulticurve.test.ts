import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  ExecutionRevertedError,
  keccak256,
  parseEther,
  type Address,
} from 'viem';
import { airlockAbi, bundlerAbi } from '../../../../src/evm/abis';
import {
  DEFAULT_CREATE_GAS_LIMIT,
  DYNAMIC_FEE_FLAG,
} from '../../../../src/evm/constants';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import { MulticurveBuilder } from '../../../../src/evm/builders/MulticurveBuilder';
import type { CreateMulticurveParams } from '../../../../src/evm/types';
import type * as AddressesModule from '../../../../src/evm/addresses';
import {
  createMockPublicClient,
  createMockCreateEventLog,
  createMockTransactionReceipt,
  createMockTransactionReceiptWithCreateEvent,
  createMockWalletClient,
  type MockedPublicClient,
} from '../../setup/fixtures/clients';
import {
  mockAddresses,
  mockGovernanceAddress,
  mockPoolAddress,
  mockTimelockAddress,
  mockTokenAddress,
  mockV2PoolAddress,
} from '../../setup/fixtures/addresses';

vi.mock('../../../../src/evm/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof AddressesModule>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

const account = '0x1234567890123456789012345678901234567890' as Address;
const explicitSalt = `0x${'11'.repeat(32)}` as const;

function multicurveParams(): CreateMulticurveParams {
  return {
    token: {
      type: 'standard',
      name: 'Prepared Token',
      symbol: 'PREP',
      tokenURI: 'https://example.com/prepared-token',
    },
    sale: {
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('400000'),
      numeraire: mockAddresses.weth,
    },
    pool: {
      fee: 3000,
      tickSpacing: 60,
      curves: [
        {
          tickLower: -120000,
          tickUpper: -60000,
          numPositions: 8,
          shares: parseEther('1'),
        },
      ],
    },
    initializer: { type: 'standard' },
    governance: { type: 'default' },
    migration: { type: 'uniswapV2' },
    userAddress: account,
    salt: explicitSalt,
  };
}

function recordedAccount(call: unknown): unknown {
  if (!call || typeof call !== 'object' || !('account' in call))
    return undefined;
  return call.account;
}

function devBuyParams(native = false): CreateMulticurveParams {
  return MulticurveBuilder.forChain(1)
    .tokenConfig({
      type: 'standard',
      name: 'Prepared Dev Buy Token',
      symbol: 'PDB',
      tokenURI: 'https://example.com/prepared-dev-buy-token',
    })
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('400000'),
      numeraire: native
        ? ('0x0000000000000000000000000000000000000000' as Address)
        : mockAddresses.weth,
    })
    .withCurves({
      numerairePrice: 3000,
      fee: 3000,
      curves: [
        {
          marketCap: { start: 500_000, end: 1_500_000 },
          numPositions: 10,
          shares: parseEther('0.3'),
        },
        {
          marketCap: { start: 1_000_000, end: 5_000_000 },
          numPositions: 15,
          shares: parseEther('0.4'),
        },
        {
          marketCap: { start: 4_000_000, end: 50_000_000 },
          numPositions: 10,
          shares: parseEther('0.29'),
        },
        {
          marketCap: { start: 50_000_000, end: 'max' },
          numPositions: 10,
          shares: parseEther('0.01'),
        },
      ],
      beneficiaries: [{ beneficiary: account, shares: parseEther('1') }],
    })
    .withDopplerHookInitializer(mockAddresses.dopplerHookInitializer!)
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account)
    .withSalt(explicitSalt)
    .withDevBuy({
      exactAmountIn: 25n,
      recipient: account,
    })
    .build();
}

function mockDevBuyRpc(
  client: MockedPublicClient,
  allowance: bigint = 0n,
  configuredBundler: Address = mockAddresses.bundler!,
  balance: bigint = 25n,
): void {
  vi.mocked(client.readContract).mockImplementation(async (call) => {
    if (call.functionName === 'bundler') return configuredBundler;
    if (call.functionName === 'allowance') return allowance;
    if (call.functionName === 'balanceOf') return balance;
    return mockPoolAddress;
  });
  vi.mocked(client.simulateContract).mockImplementation(async (call) => {
    if (call.functionName === 'simulateBundle') {
      return {
        request: call,
        result: [
          mockTokenAddress,
          {
            currency0: mockTokenAddress,
            currency1: call.args?.[0].numeraire,
            fee: 3000,
            tickSpacing: 60,
            hooks: mockAddresses.dopplerHookInitializer,
          },
          mockGovernanceAddress,
          mockTimelockAddress,
          100n,
        ],
      };
    }
    if (call.functionName === 'approve') {
      return { request: call, result: true };
    }
    return { request: call, result: undefined };
  });
}

describe('DopplerFactory.prepareCreateMulticurve', () => {
  let publicClient: MockedPublicClient;
  let client: MockedPublicClient;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    client = publicClient;
    vi.mocked(client.readContract).mockResolvedValue(mockPoolAddress);
    vi.mocked(client.estimateContractGas).mockResolvedValue(500_000n);
  });

  it('prepares with only a public client and never reads a wallet account', async () => {
    const factory = new DopplerFactory(publicClient, undefined, 1);

    const prepared = await factory.prepareCreateMulticurve(multicurveParams(), {
      account,
    });

    expect(prepared.account).toBe(account);
    expect(
      recordedAccount(vi.mocked(client.simulateContract).mock.calls[0][0]),
    ).toBe(account);
  });

  it('returns calldata for the exact final params and complete transaction metadata', async () => {
    const override = '0x9999999999999999999999999999999999999999' as Address;
    const params = multicurveParams();
    params.modules = { airlock: override };
    const factory = new DopplerFactory(publicClient, undefined, 1);

    const prepared = await factory.prepareCreateMulticurve(params, { account });
    const decoded = decodeFunctionData({
      abi: airlockAbi,
      data: prepared.transaction.data,
    });

    expect(decoded.functionName).toBe('create');
    expect(decoded.args?.[0]).toEqual(prepared.createParams);
    expect(prepared).toMatchObject({
      chainId: 1,
      account,
      airlock: override,
      transaction: { to: override, value: 0n },
    });
  });

  it('selects one generated salt and preserves it through preparation', async () => {
    const params = multicurveParams();
    params.salt = undefined;
    params.token = {
      name: 'Limited Token',
      symbol: 'LIMIT',
      tokenURI: 'https://example.com/limited-token',
      maxBalanceLimit: parseEther('10000'),
      balanceLimitEnd: 2_000_000_000,
    };
    params.governance = { type: 'noOp' };
    const firstPassResult = [
      '0x1000000000000000000000000000000000000001',
      '0x1000000000000000000000000000000000000002',
      '0x1000000000000000000000000000000000000003',
      '0x1000000000000000000000000000000000000004',
      '0x1000000000000000000000000000000000000005',
    ] as const satisfies readonly Address[];
    vi.mocked(client.simulateContract).mockImplementationOnce(async (call) => ({
      request: call,
      result: firstPassResult,
    }));
    const entropy = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation((array) => {
        (array as Uint8Array).fill(7);
        return array;
      });
    const factory = new DopplerFactory(publicClient, undefined, 1);

    try {
      const prepared = await factory.prepareCreateMulticurve(params, {
        account,
      });
      const calls = vi.mocked(client.simulateContract).mock.calls;
      const createParams = calls[0][0].args?.[0];

      expect(entropy).toHaveBeenCalledOnce();
      expect(calls).toHaveLength(1);
      expect(createParams?.salt).toBe(prepared.createParams.salt);
      expect(createParams?.tokenFactoryData).toBe(
        prepared.createParams.tokenFactoryData,
      );
      expect(prepared.prediction).toMatchObject({
        tokenAddress: firstPassResult[0],
        poolOrHookAddress: firstPassResult[1],
        governanceAddress: firstPassResult[2],
        timelockAddress: firstPassResult[3],
        migrationPoolAddress: firstPassResult[4],
      });
    } finally {
      entropy.mockRestore();
    }
  });

  it('maps every final Airlock output and derives the complete pool identity', async () => {
    const factory = new DopplerFactory(publicClient, undefined, 1);
    const prepared = await factory.prepareCreateMulticurve(multicurveParams(), {
      account,
    });
    const expectedPoolKey = {
      currency0:
        BigInt(mockTokenAddress) < BigInt(mockAddresses.weth)
          ? mockTokenAddress
          : mockAddresses.weth,
      currency1:
        BigInt(mockTokenAddress) < BigInt(mockAddresses.weth)
          ? mockAddresses.weth
          : mockTokenAddress,
      fee: 3000,
      tickSpacing: 60,
      hooks: mockPoolAddress,
    };

    expect(prepared.prediction).toEqual({
      tokenAddress: mockTokenAddress,
      poolOrHookAddress: mockPoolAddress,
      governanceAddress: mockGovernanceAddress,
      timelockAddress: mockTimelockAddress,
      migrationPoolAddress: mockV2PoolAddress,
      poolKey: expectedPoolKey,
      poolId: keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            expectedPoolKey.currency0,
            expectedPoolKey.currency1,
            expectedPoolKey.fee,
            expectedPoolKey.tickSpacing,
            expectedPoolKey.hooks,
          ],
        ),
      ),
      tokenIsCurrency0: BigInt(mockTokenAddress) < BigInt(mockAddresses.weth),
    });
  });

  it.each([
    ['standard', { type: 'standard' } as const, 3000],
    [
      'scheduled',
      { type: 'scheduled', startTime: 2_000_000_000 } as const,
      3000,
    ],
    [
      'decay',
      {
        type: 'decay',
        startTime: 2_000_000_000,
        startFee: 10_000,
        durationSeconds: 3600,
      } as const,
      DYNAMIC_FEE_FLAG,
    ],
  ])(
    'derives %s pool key hook and fee mode',
    async (_name, initializer, fee) => {
      const params = multicurveParams();
      params.initializer = initializer;
      const factory = new DopplerFactory(publicClient, undefined, 1);

      const prepared = await factory.prepareCreateMulticurve(params, {
        account,
      });

      expect(prepared.prediction.poolKey).toMatchObject({
        fee,
        hooks: mockPoolAddress,
      });
    },
  );

  it('uses the DopplerHookInitializer and dynamic fee for Rehype identity', async () => {
    const params = multicurveParams();
    params.initializer = {
      type: 'rehype',
      config: {
        hookAddress: mockPoolAddress,
        buybackDestination: account,
        startFee: 3000,
        endFee: 3000,
        durationSeconds: 0,
        feeRoutingMode: 0,
        feeDistributionInfo: {
          assetFeesToAssetBuybackWad: parseEther('0.25'),
          assetFeesToNumeraireBuybackWad: parseEther('0.25'),
          assetFeesToBeneficiaryWad: parseEther('0.25'),
          assetFeesToLpWad: parseEther('0.25'),
          numeraireFeesToAssetBuybackWad: parseEther('0.25'),
          numeraireFeesToNumeraireBuybackWad: parseEther('0.25'),
          numeraireFeesToBeneficiaryWad: parseEther('0.25'),
          numeraireFeesToLpWad: parseEther('0.25'),
        },
      },
    };
    const factory = new DopplerFactory(publicClient, undefined, 1);

    const prepared = await factory.prepareCreateMulticurve(params, { account });

    expect(prepared.prediction.poolKey).toMatchObject({
      fee: DYNAMIC_FEE_FLAG,
      hooks: mockAddresses.dopplerHookInitializer,
    });
    expect(prepared.prediction.poolKey.hooks).not.toBe(mockPoolAddress);
  });

  it('uses simulation request gas without fallback estimation', async () => {
    vi.mocked(client.simulateContract).mockImplementationOnce(async (call) => ({
      request: { ...call, gas: 700_000n },
      result: [
        mockTokenAddress,
        mockPoolAddress,
        mockGovernanceAddress,
        mockTimelockAddress,
        mockV2PoolAddress,
      ],
    }));
    const factory = new DopplerFactory(publicClient, undefined, 1);

    const prepared = await factory.prepareCreateMulticurve(multicurveParams(), {
      account,
    });

    expect(prepared.gasEstimate).toEqual({
      status: 'estimated',
      gas: 700_000n,
    });
    expect(client.estimateContractGas).not.toHaveBeenCalled();
  });

  it('reports successful fallback estimation and unavailable transport failures', async () => {
    const factory = new DopplerFactory(publicClient, undefined, 1);
    const estimated = await factory.prepareCreateMulticurve(
      multicurveParams(),
      {
        account,
      },
    );
    expect(estimated.gasEstimate).toEqual({
      status: 'estimated',
      gas: 500_000n,
    });

    vi.mocked(client.estimateContractGas).mockRejectedValueOnce(
      new Error('provider unavailable'),
    );
    const unavailable = await factory.prepareCreateMulticurve(
      multicurveParams(),
      { account },
    );
    expect(unavailable.gasEstimate).toEqual({ status: 'unavailable' });
    expect(
      vi
        .mocked(client.estimateContractGas)
        .mock.calls.map(([call]) => recordedAccount(call)),
    ).toEqual([account, account]);
  });

  it('throws the original revert-shaped estimation failure', async () => {
    const revert = new ExecutionRevertedError({
      message: 'execution reverted',
    });
    vi.mocked(client.estimateContractGas).mockRejectedValueOnce(revert);
    const factory = new DopplerFactory(publicClient, undefined, 1);

    await expect(
      factory.prepareCreateMulticurve(multicurveParams(), { account }),
    ).rejects.toBe(revert);
  });

  it.each([
    [
      'revert-shaped',
      new ExecutionRevertedError({ message: 'execution reverted' }),
    ],
    ['transport/provider', new Error('provider unavailable')],
  ])(
    'preserves legacy %s estimation failures as an absent estimate',
    async (_label, error) => {
      vi.mocked(client.estimateContractGas).mockRejectedValue(error);
      const factory = new DopplerFactory(publicClient, undefined, 1);

      const simulated =
        await factory.simulateCreateMulticurve(multicurveParams());

      expect(simulated.gasEstimate).toBeUndefined();
    },
  );

  it('preserves simulation and estimation sender selection', async () => {
    const wallet = createMockWalletClient();
    const walletFactory = new DopplerFactory(publicClient, wallet, 1);
    await walletFactory.simulateCreateMulticurve(multicurveParams());
    expect(
      recordedAccount(vi.mocked(client.simulateContract).mock.calls[0][0]),
    ).toBe(wallet.account);
    expect(
      recordedAccount(vi.mocked(client.estimateContractGas).mock.calls[0][0]),
    ).toBe(wallet.account);

    vi.clearAllMocks();
    vi.mocked(client.readContract).mockResolvedValue(mockPoolAddress);
    vi.mocked(client.estimateContractGas).mockResolvedValue(500_000n);
    const publicFactory = new DopplerFactory(publicClient, undefined, 1);
    await publicFactory.simulateCreateMulticurve(multicurveParams());
    expect(
      recordedAccount(vi.mocked(client.simulateContract).mock.calls[0][0]),
    ).toBeUndefined();
    expect(
      recordedAccount(vi.mocked(client.estimateContractGas).mock.calls[0][0]),
    ).toBe(account);
  });

  it('preserves explicit gas and the 13.5M legacy fallback', async () => {
    const wallet = createMockWalletClient();
    const receipt = createMockTransactionReceiptWithCreateEvent(
      mockTokenAddress,
      mockPoolAddress,
      mockAddresses.weth,
      mockAddresses.v4MulticurveInitializer,
    );
    vi.mocked(client.waitForTransactionReceipt).mockResolvedValue(receipt);
    vi.mocked(wallet.writeContract).mockResolvedValue(receipt.transactionHash);
    vi.mocked(client.estimateContractGas).mockRejectedValue(
      new Error('provider unavailable'),
    );
    const factory = new DopplerFactory(publicClient, wallet, 1);

    const explicitParams = multicurveParams();
    explicitParams.gas = 900_000n;
    await factory.createMulticurve(explicitParams);
    expect(vi.mocked(wallet.writeContract).mock.calls[0][0].gas).toBe(900_000n);
    expect(
      recordedAccount(vi.mocked(client.simulateContract).mock.calls[0][0]),
    ).toBe(wallet.account);
    expect(
      recordedAccount(vi.mocked(client.estimateContractGas).mock.calls[0][0]),
    ).toBe(wallet.account);

    await factory.createMulticurve(multicurveParams());
    expect(vi.mocked(wallet.writeContract).mock.calls[1][0].gas).toBe(
      DEFAULT_CREATE_GAS_LIMIT,
    );
  });
  describe('dev-buy preparation', () => {
    it('encodes a native exact-input bundle without approval', async () => {
      mockDevBuyRpc(client);
      const factory = new DopplerFactory(publicClient, undefined, 1);
      const prepared = await factory.prepareCreateMulticurve(
        devBuyParams(true),
        { account },
      );
      const decoded = decodeFunctionData({
        abi: bundlerAbi,
        data: prepared.transaction.data,
      });

      expect(decoded.functionName).toBe('bundle');
      expect(prepared.transaction).toMatchObject({
        to: mockAddresses.bundler,
        value: 25n,
      });
      expect(prepared.approvalTransaction).toBeUndefined();
      expect(prepared.prediction.migrationPoolAddress).toBeUndefined();
      expect(prepared.prediction.poolOrHookAddress).toBe(mockTokenAddress);
      expect(prepared.devBuy).toMatchObject({
        bundler: mockAddresses.bundler,
        exactAmountIn: 25n,
        simulatedAmountOut: 100n,
      });
      expect(
        vi
          .mocked(client.readContract)
          .mock.calls.some(
            ([call]) =>
              call.functionName === 'airlock' ||
              call.functionName === 'poolManager' ||
              call.functionName === 'bundler',
          ),
      ).toBe(false);
    });

    it('rejects vesting below the deployed Bundler minimum', async () => {
      const params = devBuyParams();
      params.devBuy!.vesting.vestingDuration = 86_399n;

      await expect(
        new DopplerFactory(publicClient, undefined, 1).prepareCreateMulticurve(
          params,
          { account },
        ),
      ).rejects.toThrow('at least 86400 seconds');
      expect(client.simulateContract).not.toHaveBeenCalled();
    });

    it.each([
      ['standard', { type: 'standard' } as const],
      ['scheduled', { type: 'scheduled', startTime: 2_000_000_000 } as const],
      [
        'decay',
        {
          type: 'decay',
          startTime: 2_000_000_000,
          startFee: 3000,
          durationSeconds: 0,
        } as const,
      ],
    ])(
      'rejects the unsupported %s initializer before RPC work',
      async (_, initializer) => {
        const params = devBuyParams();
        params.initializer = initializer;
        if (params.modules) delete params.modules.dopplerHookInitializer;

        await expect(
          new DopplerFactory(
            publicClient,
            undefined,
            1,
          ).prepareCreateMulticurve(params, { account }),
        ).rejects.toThrow(
          'Dev buys require a DopplerHookInitializer or Rehype initializer',
        );
        expect(client.readContract).not.toHaveBeenCalled();
        expect(client.simulateContract).not.toHaveBeenCalled();
      },
    );

    it('checks the selected Rehype initializer Bundler wiring', async () => {
      const params = devBuyParams();
      params.initializer = {
        type: 'rehype',
        config: {
          hookAddress: mockPoolAddress,
          buybackDestination: account,
          startFee: 3000,
          endFee: 3000,
          durationSeconds: 0,
          feeDistributionInfo: {
            assetFeesToAssetBuybackWad: parseEther('0.25'),
            assetFeesToNumeraireBuybackWad: parseEther('0.25'),
            assetFeesToBeneficiaryWad: parseEther('0.25'),
            assetFeesToLpWad: parseEther('0.25'),
            numeraireFeesToAssetBuybackWad: parseEther('0.25'),
            numeraireFeesToNumeraireBuybackWad: parseEther('0.25'),
            numeraireFeesToBeneficiaryWad: parseEther('0.25'),
            numeraireFeesToLpWad: parseEther('0.25'),
          },
        },
      };
      mockDevBuyRpc(client, 25n);
      await new DopplerFactory(
        publicClient,
        undefined,
        1,
      ).prepareCreateMulticurve(params, { account });

      const bundlerRead = vi
        .mocked(client.readContract)
        .mock.calls.find(([call]) => call.functionName === 'bundler');
      expect(bundlerRead?.[0].address).toBe(mockPoolAddress);
      mockDevBuyRpc(client, 25n, mockPoolAddress);
      await expect(
        new DopplerFactory(publicClient, undefined, 1).prepareCreateMulticurve(
          params,
          { account },
        ),
      ).rejects.toThrow('configured for Bundler');
    });

    it('prepares an exact ERC20 approval only when allowance is insufficient', async () => {
      mockDevBuyRpc(client, 24n);
      const factory = new DopplerFactory(publicClient, undefined, 1);
      const prepared = await factory.prepareCreateMulticurve(devBuyParams(), {
        account,
      });
      const approval = decodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'approve',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
          },
        ] as const,
        data: prepared.approvalTransaction!.data,
      });

      expect(approval.args).toEqual([mockAddresses.bundler, 25n]);
      expect(prepared.transaction.value).toBe(0n);
      expect(prepared.gasEstimate).toEqual({ status: 'unavailable' });

      mockDevBuyRpc(client, 25n);
      const sufficient = await new DopplerFactory(
        publicClient,
        undefined,
        1,
      ).prepareCreateMulticurve(devBuyParams(), { account });
      expect(sufficient.approvalTransaction).toBeUndefined();
      expect(sufficient.gasEstimate).toEqual({
        status: 'estimated',
        gas: 500_000n,
      });
    });

    it('uses a custom Bundler for allowance and calldata', async () => {
      const customBundler =
        '0x9999999999999999999999999999999999999999' as Address;
      const params = devBuyParams();
      params.modules = { bundler: customBundler };
      mockDevBuyRpc(client, 25n);
      const prepared = await new DopplerFactory(
        publicClient,
        undefined,
        1,
      ).prepareCreateMulticurve(params, { account });

      expect(prepared.transaction.to).toBe(customBundler);
      expect(
        vi
          .mocked(client.readContract)
          .mock.calls.find(([call]) => call.functionName === 'allowance')?.[0]
          .args,
      ).toEqual([account, customBundler]);
    });

    it('executes from a dev-buy snapshot after the original params are mutated', async () => {
      const originalRecipient =
        '0x2345678901234567890123456789012345678901' as Address;
      const mutatedRecipient =
        '0x3456789012345678901234567890123456789012' as Address;
      const mutatedBundler =
        '0x4567890123456789012345678901234567890123' as Address;
      const originalVesting = {
        permissionlessClaim: false,
        vestingDuration: 86_400n,
        cliffDuration: 3_600n,
      };
      const params = devBuyParams();
      params.devBuy = {
        exactAmountIn: 25n,
        recipient: originalRecipient,
        vesting: { ...originalVesting },
      };
      params.modules = { bundler: mockAddresses.bundler! };
      const callerOwnedDevBuy = params.devBuy;
      mockDevBuyRpc(client, 1_000n);
      const wallet = createMockWalletClient();
      const bundleHash = `0x${'23'.repeat(32)}` as const;
      vi.mocked(wallet.writeContract).mockResolvedValue(bundleHash);
      const poolKey = {
        currency0: mockTokenAddress,
        currency1: mockAddresses.weth,
        fee: 3000,
        tickSpacing: 60,
        hooks: mockAddresses.dopplerHookInitializer!,
      };
      const createLog = {
        ...createMockCreateEventLog(
          mockTokenAddress,
          mockTokenAddress,
          mockAddresses.weth,
          mockAddresses.dopplerHookInitializer,
        ),
        logIndex: 1,
      };
      const bundledLog = {
        address: mockAddresses.bundler!,
        topics: encodeEventTopics({
          abi: bundlerAbi,
          eventName: 'Bundled',
          args: { recipient: originalRecipient },
        }) as `0x${string}`[],
        data: encodeAbiParameters(
          [
            { type: 'uint128' },
            { type: 'uint128' },
            {
              type: 'tuple',
              components: [
                { name: 'currency0', type: 'address' },
                { name: 'currency1', type: 'address' },
                { name: 'fee', type: 'uint24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'hooks', type: 'address' },
              ],
            },
          ],
          [25n, 120n, poolKey],
        ),
        logIndex: 2,
      };
      const vestingCreatedLog = {
        address: mockAddresses.bundler!,
        topics: encodeEventTopics({
          abi: bundlerAbi,
          eventName: 'VestingCreated',
          args: {
            asset: mockTokenAddress,
            recipient: originalRecipient,
          },
        }) as `0x${string}`[],
        data: encodeAbiParameters(
          [
            { type: 'bool' },
            { type: 'uint128' },
            { type: 'uint64' },
            { type: 'uint64' },
            { type: 'uint64' },
          ],
          [
            originalVesting.permissionlessClaim,
            120n,
            1_000n,
            originalVesting.cliffDuration,
            originalVesting.vestingDuration,
          ],
        ),
        logIndex: 3,
      };
      vi.mocked(client.waitForTransactionReceipt).mockResolvedValue({
        ...createMockTransactionReceipt([
          createLog,
          bundledLog,
          vestingCreatedLog,
        ]),
        transactionHash: bundleHash,
        from: wallet.account!.address,
        to: mockAddresses.bundler!,
      });
      const factory = new DopplerFactory(publicClient, wallet, 1);
      const simulated = await factory.simulateCreateMulticurve(params);
      const originalCreateParams = { ...simulated.createParams };

      callerOwnedDevBuy.exactAmountIn = 99n;
      callerOwnedDevBuy.recipient = mutatedRecipient;
      callerOwnedDevBuy.vesting.permissionlessClaim = true;
      callerOwnedDevBuy.vesting.vestingDuration = 172_800n;
      callerOwnedDevBuy.vesting.cliffDuration = 7_200n;
      params.devBuy = undefined;
      params.modules!.bundler = mutatedBundler;
      simulated.createParams.initialSupply = 1n;
      simulated.createParams.tokenFactoryData = '0xdead';

      const result = await simulated.execute();
      const bundleCall = vi
        .mocked(client.simulateContract)
        .mock.calls.find(([call]) => call.functionName === 'bundle')?.[0];

      expect(bundleCall?.address).toBe(mockAddresses.bundler);
      expect(bundleCall?.args).toEqual([
        originalCreateParams,
        originalVesting,
        25n,
        originalRecipient,
      ]);
      expect(
        vi
          .mocked(client.simulateContract)
          .mock.calls.some(([call]) => call.functionName === 'create'),
      ).toBe(false);
      expect(result.devBuy).toMatchObject({
        exactAmountIn: 25n,
        recipient: originalRecipient,
        vesting: originalVesting,
        bundler: mockAddresses.bundler,
      });
    });

    it('rejects an underfunded ERC20 payer before approval or bundle submission', async () => {
      mockDevBuyRpc(client, 0n, mockAddresses.bundler!, 24n);
      const wallet = createMockWalletClient();
      const factory = new DopplerFactory(publicClient, wallet, 1);

      await expect(factory.createMulticurve(devBuyParams())).rejects.toThrow(
        'Insufficient ERC20 balance for dev buy: required 25, available 24',
      );
      expect(wallet.writeContract).not.toHaveBeenCalled();
      expect(
        vi
          .mocked(client.simulateContract)
          .mock.calls.filter(
            ([call]) =>
              call.functionName === 'approve' || call.functionName === 'bundle',
          ),
      ).toEqual([]);
    });

    it('does not read an ERC20 balance for a native dev buy', async () => {
      mockDevBuyRpc(client);
      const wallet = createMockWalletClient();
      const simulation = vi
        .mocked(client.simulateContract)
        .getMockImplementation()!;
      vi.mocked(client.simulateContract).mockImplementation(async (call) => {
        if (call.functionName === 'bundle') {
          throw new Error('native bundle simulation reached');
        }
        return await simulation(call);
      });
      const factory = new DopplerFactory(publicClient, wallet, 1);

      await expect(
        factory.createMulticurve(devBuyParams(true)),
      ).rejects.toThrow('native bundle simulation reached');
      expect(
        vi
          .mocked(client.readContract)
          .mock.calls.some(([call]) => call.functionName === 'balanceOf'),
      ).toBe(false);
      expect(wallet.writeContract).not.toHaveBeenCalled();
    });

    it('stops before bundle submission when exact approval fails', async () => {
      mockDevBuyRpc(client, 0n);
      const wallet = createMockWalletClient();
      const simulation = vi
        .mocked(client.simulateContract)
        .getMockImplementation()!;
      vi.mocked(client.simulateContract).mockImplementation(async (call) => {
        if (call.functionName === 'approve') {
          throw new Error('approval rejected');
        }
        return await simulation(call);
      });
      const factory = new DopplerFactory(publicClient, wallet, 1);

      await expect(factory.createMulticurve(devBuyParams())).rejects.toThrow(
        'approval rejected',
      );
      expect(wallet.writeContract).not.toHaveBeenCalled();
    });

    it('rejects an ERC20 approval simulation that returns false', async () => {
      mockDevBuyRpc(client, 0n);
      const wallet = createMockWalletClient();
      const simulation = vi
        .mocked(client.simulateContract)
        .getMockImplementation()!;
      vi.mocked(client.simulateContract).mockImplementation(async (call) => {
        if (call.functionName === 'approve') {
          return { request: call, result: false };
        }
        return await simulation(call);
      });
      const factory = new DopplerFactory(publicClient, wallet, 1);

      await expect(factory.createMulticurve(devBuyParams())).rejects.toThrow(
        'approval simulation returned false',
      );
      expect(wallet.writeContract).not.toHaveBeenCalled();
    });

    it('stops when a mined approval leaves allowance insufficient', async () => {
      mockDevBuyRpc(client, 0n);
      const wallet = createMockWalletClient();
      const approvalHash = `0x${'20'.repeat(32)}` as const;
      vi.mocked(wallet.writeContract).mockResolvedValue(approvalHash);
      vi.mocked(client.waitForTransactionReceipt).mockResolvedValue({
        ...createMockTransactionReceipt([]),
        transactionHash: approvalHash,
      });
      const factory = new DopplerFactory(publicClient, wallet, 1);

      await expect(factory.createMulticurve(devBuyParams())).rejects.toThrow(
        'did not provide the required allowance',
      );
      expect(
        vi
          .mocked(wallet.writeContract)
          .mock.calls.map(([request]) => request.functionName),
      ).toEqual(['approve']);
    });

    it('submits approval before bundle and returns receipt-derived output', async () => {
      mockDevBuyRpc(client, 0n);
      const readContract = vi
        .mocked(client.readContract)
        .getMockImplementation()!;
      let allowanceReads = 0;
      vi.mocked(client.readContract).mockImplementation(async (call) => {
        if (call.functionName === 'allowance') {
          allowanceReads += 1;
          return allowanceReads === 1 ? 0n : 25n;
        }
        return await readContract(call);
      });
      const wallet = createMockWalletClient();
      const approvalHash = `0x${'21'.repeat(32)}` as const;
      const bundleHash = `0x${'22'.repeat(32)}` as const;
      vi.mocked(wallet.writeContract)
        .mockResolvedValueOnce(approvalHash)
        .mockResolvedValueOnce(bundleHash);

      const poolKey = {
        currency0: mockTokenAddress,
        currency1: mockAddresses.weth,
        fee: 3000,
        tickSpacing: 60,
        hooks: mockAddresses.dopplerHookInitializer!,
      };
      const createLog = {
        ...createMockCreateEventLog(
          mockTokenAddress,
          mockTokenAddress,
          mockAddresses.weth,
          mockAddresses.dopplerHookInitializer,
        ),
        logIndex: 1,
      };
      const bundledLog = {
        address: mockAddresses.bundler!,
        topics: encodeEventTopics({
          abi: bundlerAbi,
          eventName: 'Bundled',
          args: { recipient: account },
        }) as `0x${string}`[],
        data: encodeAbiParameters(
          [
            { type: 'uint128' },
            { type: 'uint128' },
            {
              type: 'tuple',
              components: [
                { name: 'currency0', type: 'address' },
                { name: 'currency1', type: 'address' },
                { name: 'fee', type: 'uint24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'hooks', type: 'address' },
              ],
            },
          ],
          [25n, 120n, poolKey],
        ),
        logIndex: 2,
      };
      const approvalReceipt = {
        ...createMockTransactionReceipt([]),
        transactionHash: approvalHash,
      };
      const launchReceipt = {
        ...createMockTransactionReceipt([createLog, bundledLog]),
        transactionHash: bundleHash,
        from: wallet.account!.address,
        to: mockAddresses.bundler!,
      };
      vi.mocked(client.waitForTransactionReceipt)
        .mockResolvedValueOnce(approvalReceipt)
        .mockResolvedValueOnce(launchReceipt);
      const factory = new DopplerFactory(publicClient, wallet, 1);

      const result = await factory.createMulticurve(devBuyParams());

      expect(
        vi
          .mocked(wallet.writeContract)
          .mock.calls.map(([request]) => request.functionName),
      ).toEqual(['approve', 'bundle']);
      expect(result.approvalTransactionHash).toBe(approvalHash);
      expect(result.devBuy?.amountOut).toBe(120n);
    });
  });
});
