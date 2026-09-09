import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import { DynamicAuctionBuilder } from '../../../../src/evm/builders';
import {
  createMockPublicClient,
  createMockWalletClient,
  createMockTransactionReceipt,
  createMockTransactionReceiptWithCreateEvent,
} from '../../setup/fixtures/clients';
import {
  mockAddresses,
  mockHookAddress,
  mockTokenAddress,
  mockPoolAddress,
} from '../../setup/fixtures/addresses';
import type {
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  TokenConfig,
} from '../../../../src/evm/types';
import type {
  DopplerHookMigrationConfig,
  DopplerHookMigratorConfig,
} from '../../../../src/evm';
import {
  parseEther,
  decodeAbiParameters,
  encodeAbiParameters,
  getAddress,
  keccak256,
  type Address,
  type PublicClient,
} from 'viem';
import {
  MAX_TICK,
  getMaxLiquiditySafeMulticurveTickUpper,
  isToken0Expected,
} from '../../../../src/evm/utils';
import {
  DAY_SECONDS,
  DYNAMIC_FEE_FLAG,
  DECAY_MAX_START_FEE,
  ZERO_ADDRESS,
} from '../../../../src/evm/constants';

vi.mock('../../../../src/evm/addresses', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../src/evm/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

const basicMulticurvePoolInitializerAbi = [
  {
    type: 'tuple',
    components: [
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      {
        name: 'curves',
        type: 'tuple[]',
        components: [
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'numPositions', type: 'uint16' },
          { name: 'shares', type: 'uint256' },
        ],
      },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        components: [
          { name: 'beneficiary', type: 'address' },
          { name: 'shares', type: 'uint96' },
        ],
      },
    ],
  },
] as const;

function decodeBasicMulticurvePoolInitializerData(data: `0x${string}`) {
  const [poolInitData] = decodeAbiParameters(
    basicMulticurvePoolInitializerAbi,
    data,
  );
  return poolInitData;
}

describe('DopplerFactory', () => {
  let factory: DopplerFactory;
  let publicClient: ReturnType<typeof createMockPublicClient>;
  let walletClient: ReturnType<typeof createMockWalletClient>;

  beforeEach(() => {
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
    factory = new DopplerFactory(publicClient, walletClient, 1); // mainnet
  });

  describe('encodeCreateMulticurveParams', () => {
    const multicurveParams = (): CreateMulticurveParams => ({
      token: {
        type: 'standard',
        name: 'MC Token',
        symbol: 'MCT',
        tokenURI: 'https://example.com/mc-token',
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
            tickLower: -140000,
            tickUpper: -70000,
            numPositions: 8,
            shares: parseEther('0.6'),
          },
          {
            tickLower: -90000,
            tickUpper: -50000,
            numPositions: 4,
            shares: parseEther('0.3'),
          },
        ],
      },
      initializer: { type: 'standard' },
      governance: { type: 'default' },
      migration: { type: 'uniswapV2' },
      userAddress: '0x1234567890123456789012345678901234567890' as Address,
    });

    const explicitSalt =
      '0x1111111111111111111111111111111111111111111111111111111111111111' as const;

    const getRecordedCreateParams = (call: unknown) => {
      if (
        typeof call !== 'object' ||
        call === null ||
        !('args' in call) ||
        !Array.isArray(call.args) ||
        typeof call.args[0] !== 'object' ||
        call.args[0] === null ||
        !('salt' in call.args[0]) ||
        !('tokenFactoryData' in call.args[0])
      ) {
        throw new Error('Expected a recorded Airlock create call');
      }
      return call.args[0];
    };

    it('encodes the same complete params for the same explicit salt', () => {
      const params = { ...multicurveParams(), salt: explicitSalt };

      const first = factory.encodeCreateMulticurveParams(params);
      const second = factory.encodeCreateMulticurveParams(params);

      expect(first).toEqual(second);
      expect(first.salt).toBe(explicitSalt);

      const zeroSalt =
        '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
      expect(
        factory.encodeCreateMulticurveParams({
          ...multicurveParams(),
          salt: zeroSalt,
        }).salt,
      ).toBe(zeroSalt);
    });

    it.each([
      ['a missing 0x prefix', '11'.repeat(32)],
      ['fewer than 32 bytes', `0x${'11'.repeat(31)}`],
      ['more than 32 bytes', `0x${'11'.repeat(33)}`],
      ['non-hex characters', `0x${'gg'.repeat(32)}`],
      ['a non-string value', 123],
    ])('rejects %s before RPC or wallet work', async (_label, salt) => {
      const params = {
        ...multicurveParams(),
        salt,
      } as unknown as CreateMulticurveParams;
      const client = publicClient as PublicClient;

      await expect(factory.simulateCreateMulticurve(params)).rejects.toThrow(
        'Multicurve salt must be exactly 32 bytes',
      );
      expect(client.simulateContract).not.toHaveBeenCalled();
      expect(walletClient.writeContract).not.toHaveBeenCalled();
    });

    it('uses the generated-salt path only when salt is omitted', () => {
      const entropy = 0x11;
      const getRandomValues = vi
        .spyOn(globalThis.crypto, 'getRandomValues')
        .mockImplementation((array) => {
          (array as Uint8Array).fill(entropy);
          return array;
        });

      try {
        const params = multicurveParams();
        const generated = factory.encodeCreateMulticurveParams(params);
        const expectedBytes = new Uint8Array(32).fill(entropy);
        const addressBytes = params.userAddress.slice(2);
        for (let i = 0; i < 20; i++) {
          expectedBytes[i] ^= Number.parseInt(
            addressBytes.slice(i * 2, (i + 1) * 2),
            16,
          );
        }
        const expectedSalt = `0x${Array.from(expectedBytes)
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')}`;

        expect(generated.salt).toBe(expectedSalt);
        expect(getRandomValues).toHaveBeenCalledOnce();

        const explicit = factory.encodeCreateMulticurveParams({
          ...params,
          salt: explicitSalt,
        });
        expect(explicit.salt).toBe(explicitSalt);
        expect(getRandomValues).toHaveBeenCalledOnce();
      } finally {
        getRandomValues.mockRestore();
      }
    });

    it('preserves explicit salt through simulation and execute', async () => {
      const params = multicurveParams();
      params.token = {
        name: 'Limited MC Token',
        symbol: 'LMCT',
        tokenURI: 'https://example.com/limited-mc-token',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 86_400,
      };
      params.governance = { type: 'noOp' };
      params.salt = explicitSalt;
      const client = publicClient as PublicClient;

      vi.mocked(client.readContract).mockResolvedValue(mockPoolAddress);
      const receipt = createMockTransactionReceiptWithCreateEvent(
        mockTokenAddress,
        mockPoolAddress,
        mockAddresses.weth,
        mockAddresses.v4MulticurveInitializer,
      );
      vi.mocked(walletClient.writeContract).mockResolvedValue(
        receipt.transactionHash,
      );
      vi.mocked(client.waitForTransactionReceipt).mockResolvedValue(receipt);

      const simulation = await factory.simulateCreateMulticurve(params);
      const initialCreateCall = vi
        .mocked(client.simulateContract)
        .mock.calls.find(([call]) => call.functionName === 'create')?.[0];
      const initialCreateParams = getRecordedCreateParams(initialCreateCall);

      expect(initialCreateParams.salt).toBe(explicitSalt);
      expect(simulation.createParams.salt).toBe(explicitSalt);
      expect(simulation.createParams.tokenFactoryData).toBe(
        initialCreateParams.tokenFactoryData,
      );

      await simulation.execute();

      const createCalls = vi
        .mocked(client.simulateContract)
        .mock.calls.filter(([call]) => call.functionName === 'create');
      const executeCreateParams = getRecordedCreateParams(createCalls[1]?.[0]);
      const submittedCreateParams = getRecordedCreateParams(
        vi.mocked(walletClient.writeContract).mock.calls[0]?.[0],
      );

      expect(createCalls).toHaveLength(2);
      expect(executeCreateParams.salt).toBe(explicitSalt);
      expect(submittedCreateParams.salt).toBe(explicitSalt);
      expect(executeCreateParams).toEqual(simulation.createParams);
      expect(submittedCreateParams).toEqual(simulation.createParams);
    });

    it('uses LTS token and multicurve initializer defaults', () => {
      const params = multicurveParams();
      params.token = {
        name: 'Default LTS Token',
        symbol: 'LTS',
        tokenURI: 'https://example.com/lts-token',
      };
      params.initializer = undefined;

      const createParams = factory.encodeCreateMulticurveParams(params);

      expect(createParams.tokenFactory).toBe(
        mockAddresses.dopplerERC20V1Factory,
      );
      expect(createParams.poolInitializer).toBe(
        mockAddresses.dopplerHookInitializer,
      );
    });

    it('rejects yearlyMintRate on the inferred DopplerERC20V1 path', () => {
      const params = multicurveParams();
      params.token = {
        name: 'Invalid LTS Token',
        symbol: 'INVALID',
        tokenURI: 'https://example.com/invalid-lts-token',
        yearlyMintRate: 0n,
      } as unknown as TokenConfig;

      expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
        "yearlyMintRate is only supported with token type 'standard'",
      );
    });

    it('accepts the legacy dopplerHook initializer discriminator', () => {
      const params = multicurveParams();
      params.initializer = { type: 'dopplerHook' };

      const createParams = factory.encodeCreateMulticurveParams(params);

      expect(createParams.poolInitializer).toBe(
        mockAddresses.dopplerHookInitializer,
      );
    });

    it('appends a fallback curve when shares total less than 100%', () => {
      const params = multicurveParams();
      const createParams = factory.encodeCreateMulticurveParams(params);

      const poolInitData = decodeBasicMulticurvePoolInitializerData(
        createParams.poolInitializerData,
      );
      const curves = poolInitData.curves;
      const tickSpacing = Number(poolInitData.tickSpacing);
      expect(curves).toHaveLength(params.pool.curves.length + 1);

      const fallback = curves[curves.length - 1];
      if (!fallback) {
        throw new Error('Expected fallback curve to be appended');
      }
      const lastCurve = params.pool.curves.at(-1);
      if (!lastCurve) {
        throw new Error('Expected source curve to derive fallback positions');
      }
      const expectedShare =
        parseEther('1') -
        params.pool.curves.reduce((acc, curve) => acc + curve.shares, 0n);
      const mostPositiveTickUpper = params.pool.curves.reduce(
        (max, curve) => Math.max(max, curve.tickUpper),
        params.pool.curves[0]?.tickUpper ?? Number.NEGATIVE_INFINITY,
      );
      const expectedTickUpper = getMaxLiquiditySafeMulticurveTickUpper({
        tickLower: mostPositiveTickUpper,
        tickUpper: Math.floor(MAX_TICK / tickSpacing) * tickSpacing,
        tickSpacing,
        numPositions: lastCurve.numPositions,
        curveSupply:
          (params.sale.numTokensToSell * expectedShare) / parseEther('1'),
      });

      expect(fallback.shares).toBe(expectedShare);
      expect(Number(fallback.tickLower)).toBe(mostPositiveTickUpper);
      expect(Number(fallback.tickUpper)).toBe(expectedTickUpper);
      expect(Number(fallback.numPositions)).toBe(lastCurve.numPositions);
    });

    it('uses a liquidity-safe fallback tick when appended fallback would reach max tick', () => {
      const params = multicurveParams();
      params.sale = {
        ...params.sale,
        initialSupply: parseEther('1000000000'),
        numTokensToSell: parseEther('900000000'),
      };
      params.pool.curves = [
        {
          tickLower: -133020,
          tickUpper: -100000,
          numPositions: 10,
          shares: parseEther('0.5'),
        },
      ];

      const createParams = factory.encodeCreateMulticurveParams(params);

      const poolInitData = decodeBasicMulticurvePoolInitializerData(
        createParams.poolInitializerData,
      );
      const fallback = poolInitData.curves[1];
      if (!fallback) {
        throw new Error('Expected fallback curve to be appended');
      }
      const sourceCurve = params.pool.curves[0];
      if (!sourceCurve) {
        throw new Error('Expected source curve to derive fallback range');
      }
      const tickSpacing = Number(poolInitData.tickSpacing);
      const rawMaxTick = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
      const expectedShare = parseEther('0.5');
      const expectedTickUpper = getMaxLiquiditySafeMulticurveTickUpper({
        tickLower: sourceCurve.tickUpper,
        tickUpper: rawMaxTick,
        tickSpacing,
        numPositions: sourceCurve.numPositions,
        curveSupply:
          (params.sale.numTokensToSell * expectedShare) / parseEther('1'),
      });

      expect(fallback.tickLower).toBe(sourceCurve.tickUpper);
      expect(fallback.shares).toBe(expectedShare);
      expect(fallback.tickUpper).toBe(expectedTickUpper);
      expect(fallback.tickUpper).toBeLessThan(rawMaxTick);
    });

    it('rejects an appended fallback when the highest user tick already reaches max tick', () => {
      const params = multicurveParams();
      const roundedMaxTick =
        Math.floor(MAX_TICK / params.pool.tickSpacing) *
        params.pool.tickSpacing;
      params.pool.curves = [
        {
          tickLower: 0,
          tickUpper: roundedMaxTick,
          numPositions: 10,
          shares: parseEther('0.5'),
        },
      ];

      expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
        'Unable to find a uint128-safe multicurve max tick',
      );
    });

    it('allows curves with non-positive ticks', () => {
      const params = multicurveParams();
      params.pool.curves = [
        {
          tickLower: -120000,
          tickUpper: 0,
          numPositions: 2,
          shares: parseEther('0.5'),
        },
      ];

      // Non-positive ticks are valid - tick sign depends on price ratio
      expect(() => factory.encodeCreateMulticurveParams(params)).not.toThrow();
    });

    it('uses the scheduled multicurve initializer contract', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'scheduled',
        startTime: 1_800_000_000,
      };

      const createParams = factory.encodeCreateMulticurveParams(params);

      expect(createParams.poolInitializer).toBe(
        mockAddresses.v4ScheduledMulticurveInitializer,
      );
    });

    it('encodes decay multicurve params with decay initializer', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: 5_000,
        durationSeconds: 86_400,
      };

      const createParams = factory.encodeCreateMulticurveParams(params);
      expect(createParams.poolInitializer).toBe(
        mockAddresses.v4DecayMulticurveInitializer,
      );

      const [decoded] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'startFee', type: 'uint24' },
              { name: 'fee', type: 'uint24' },
              { name: 'durationSeconds', type: 'uint32' },
              { name: 'tickSpacing', type: 'int24' },
              {
                name: 'curves',
                type: 'tuple[]',
                components: [
                  { name: 'tickLower', type: 'int24' },
                  { name: 'tickUpper', type: 'int24' },
                  { name: 'numPositions', type: 'uint16' },
                  { name: 'shares', type: 'uint256' },
                ],
              },
              {
                name: 'beneficiaries',
                type: 'tuple[]',
                components: [
                  { name: 'beneficiary', type: 'address' },
                  { name: 'shares', type: 'uint96' },
                ],
              },
              { name: 'startingTime', type: 'uint32' },
            ],
          },
        ],
        createParams.poolInitializerData,
      ) as any;

      expect(Number(decoded.startFee)).toBe(5_000);
      expect(Number(decoded.fee)).toBe(params.pool.fee);
      expect(Number(decoded.durationSeconds)).toBe(86_400);
      expect(Number(decoded.tickSpacing)).toBe(params.pool.tickSpacing);
      expect(Number(decoded.startingTime)).toBe(1_800_000_000);
    });

    it('computes decay multicurve poolId with dynamic fee flag', async () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: 8_000,
        durationSeconds: 10_000,
      };

      vi.mocked(publicClient.readContract).mockResolvedValueOnce(
        mockPoolAddress as any,
      );

      const result = await factory.simulateCreateMulticurve(params);

      const numeraire = params.sale.numeraire;
      const currency0 =
        BigInt(mockTokenAddress) < BigInt(numeraire)
          ? mockTokenAddress
          : numeraire;
      const currency1 =
        BigInt(mockTokenAddress) < BigInt(numeraire)
          ? numeraire
          : mockTokenAddress;
      const expectedPoolId = keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            currency0,
            currency1,
            DYNAMIC_FEE_FLAG,
            params.pool.tickSpacing,
            mockPoolAddress,
          ],
        ),
      );

      expect(result.poolId).toBe(expectedPoolId);
    });

    it('computes rehype multicurve poolId using the doppler-hook initializer as the pool hook', async () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'rehype',
        config: {
          hookAddress: mockHookAddress,
          buybackDestination:
            '0x1234567890123456789012345678901234567890' as Address,
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
      params.modules = {
        dopplerHookInitializer:
          '0x7100000000000000000000000000000000000011' as Address,
      };

      const result = await factory.simulateCreateMulticurve(params);

      const numeraire = params.sale.numeraire;
      const currency0 =
        BigInt(mockTokenAddress) < BigInt(numeraire)
          ? mockTokenAddress
          : numeraire;
      const currency1 =
        BigInt(mockTokenAddress) < BigInt(numeraire)
          ? numeraire
          : mockTokenAddress;
      const expectedPoolId = keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            currency0,
            currency1,
            DYNAMIC_FEE_FLAG,
            params.pool.tickSpacing,
            params.modules.dopplerHookInitializer,
          ],
        ),
      );

      expect(result.poolId).toBe(expectedPoolId);
      expect(publicClient.readContract).not.toHaveBeenCalled();
    });

    it('orders checksummed multicurve currencies like Solidity when computing poolId', async () => {
      // Given
      const tokenAddress = getAddress(
        '0xa000000000000000000000000000000000000000',
      );
      const numeraire = getAddress(
        '0xb000000000000000000000000000000000000000',
      );
      const dopplerHookInitializer = getAddress(
        '0x7100000000000000000000000000000000000011',
      );
      const params = multicurveParams();
      params.sale.numeraire = numeraire;
      params.modules = { dopplerHookInitializer };

      // When
      const { poolId } = await factory['computeMulticurvePoolIdentity'](
        params,
        tokenAddress,
      );

      // Then
      const expectedPoolId = keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            tokenAddress,
            numeraire,
            params.pool.fee,
            params.pool.tickSpacing,
            dopplerHookInitializer,
          ],
        ),
      );

      expect(tokenAddress).toBe('0xa000000000000000000000000000000000000000');
      expect(numeraire).toBe('0xB000000000000000000000000000000000000000');
      expect(poolId).toBe(expectedPoolId);
    });

    it('computes doppler-hook initializer poolId without a rehype hook using the static pool fee', async () => {
      const params = multicurveParams();
      params.modules = {
        dopplerHookInitializer:
          '0x7100000000000000000000000000000000000011' as Address,
      };

      const result = await factory.simulateCreateMulticurve(params);

      const numeraire = params.sale.numeraire;
      const currency0 =
        BigInt(mockTokenAddress) < BigInt(numeraire)
          ? mockTokenAddress
          : numeraire;
      const currency1 =
        BigInt(mockTokenAddress) < BigInt(numeraire)
          ? numeraire
          : mockTokenAddress;
      const expectedPoolId = keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            currency0,
            currency1,
            params.pool.fee,
            params.pool.tickSpacing,
            params.modules.dopplerHookInitializer,
          ],
        ),
      );

      expect(result.poolId).toBe(expectedPoolId);
      expect(publicClient.readContract).not.toHaveBeenCalled();
    });

    it('encodes rehype initialization calldata using the new hook InitData layout', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'rehype',
        config: {
          hookAddress: mockHookAddress,
          buybackDestination:
            '0x1234567890123456789012345678901234567890' as Address,
          startFee: 5000,
          endFee: 3000,
          durationSeconds: 3600,
          startingTime: 1_800_000_000,
          feeRoutingMode: 1,
          feeDistributionInfo: {
            assetFeesToAssetBuybackWad: parseEther('0.2'),
            assetFeesToNumeraireBuybackWad: parseEther('0.3'),
            assetFeesToBeneficiaryWad: parseEther('0.1'),
            assetFeesToLpWad: parseEther('0.4'),
            numeraireFeesToAssetBuybackWad: parseEther('0.2'),
            numeraireFeesToNumeraireBuybackWad: parseEther('0.3'),
            numeraireFeesToBeneficiaryWad: parseEther('0.1'),
            numeraireFeesToLpWad: parseEther('0.4'),
          },
          farTick: 100_000,
        },
      };
      params.modules = {
        dopplerHookInitializer:
          '0x7100000000000000000000000000000000000011' as Address,
      };

      const createParams = factory.encodeCreateMulticurveParams(params);
      const [decodedPoolInitData] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              { name: 'farTick', type: 'int24' },
              {
                name: 'curves',
                type: 'tuple[]',
                components: [
                  { name: 'tickLower', type: 'int24' },
                  { name: 'tickUpper', type: 'int24' },
                  { name: 'numPositions', type: 'uint16' },
                  { name: 'shares', type: 'uint256' },
                ],
              },
              {
                name: 'beneficiaries',
                type: 'tuple[]',
                components: [
                  { name: 'beneficiary', type: 'address' },
                  { name: 'shares', type: 'uint96' },
                ],
              },
              { name: 'dopplerHook', type: 'address' },
              { name: 'onInitializationDopplerHookCalldata', type: 'bytes' },
              { name: 'graduationDopplerHookCalldata', type: 'bytes' },
            ],
          },
        ],
        createParams.poolInitializerData,
      ) as any;

      expect(decodedPoolInitData.dopplerHook).toBe(mockHookAddress);
      expect(Number(decodedPoolInitData.farTick)).toBe(100_000);

      const [decodedHookInitData] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'numeraire', type: 'address' },
              { name: 'buybackDst', type: 'address' },
              { name: 'startFee', type: 'uint24' },
              { name: 'endFee', type: 'uint24' },
              { name: 'durationSeconds', type: 'uint32' },
              { name: 'startingTime', type: 'uint32' },
              { name: 'feeRoutingMode', type: 'uint8' },
              {
                name: 'feeDistributionInfo',
                type: 'tuple',
                components: [
                  { name: 'assetFeesToAssetBuybackWad', type: 'uint256' },
                  { name: 'assetFeesToNumeraireBuybackWad', type: 'uint256' },
                  { name: 'assetFeesToBeneficiaryWad', type: 'uint256' },
                  { name: 'assetFeesToLpWad', type: 'uint256' },
                  { name: 'numeraireFeesToAssetBuybackWad', type: 'uint256' },
                  {
                    name: 'numeraireFeesToNumeraireBuybackWad',
                    type: 'uint256',
                  },
                  { name: 'numeraireFeesToBeneficiaryWad', type: 'uint256' },
                  { name: 'numeraireFeesToLpWad', type: 'uint256' },
                ],
              },
              {
                name: 'feeBeneficiaries',
                type: 'tuple[]',
                components: [
                  { name: 'beneficiary', type: 'address' },
                  { name: 'shares', type: 'uint96' },
                ],
              },
            ],
          },
        ],
        decodedPoolInitData.onInitializationDopplerHookCalldata,
      ) as any;

      expect(decodedHookInitData.numeraire).toBe(params.sale.numeraire);
      expect(decodedHookInitData.buybackDst).toBe(
        '0x1234567890123456789012345678901234567890',
      );
      expect(Number(decodedHookInitData.startFee)).toBe(5000);
      expect(Number(decodedHookInitData.endFee)).toBe(3000);
      expect(Number(decodedHookInitData.durationSeconds)).toBe(3600);
      expect(Number(decodedHookInitData.startingTime)).toBe(1_800_000_000);
      expect(Number(decodedHookInitData.feeRoutingMode)).toBe(1);
      expect(decodedHookInitData.feeBeneficiaries).toEqual([]);
      expect(
        decodedHookInitData.feeDistributionInfo.assetFeesToNumeraireBuybackWad,
      ).toBe(parseEther('0.3'));
      expect(decodedHookInitData.feeDistributionInfo.numeraireFeesToLpWad).toBe(
        parseEther('0.4'),
      );
    });

    it('uses an interior farTick when DopplerHookInitializer is selected without hook config', () => {
      const params = multicurveParams();
      params.modules = {
        dopplerHookInitializer:
          '0x7100000000000000000000000000000000000011' as Address,
      };

      const createParams = factory.encodeCreateMulticurveParams(params);
      const [decodedPoolInitData] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              { name: 'farTick', type: 'int24' },
              {
                name: 'curves',
                type: 'tuple[]',
                components: [
                  { name: 'tickLower', type: 'int24' },
                  { name: 'tickUpper', type: 'int24' },
                  { name: 'numPositions', type: 'uint16' },
                  { name: 'shares', type: 'uint256' },
                ],
              },
              {
                name: 'beneficiaries',
                type: 'tuple[]',
                components: [
                  { name: 'beneficiary', type: 'address' },
                  { name: 'shares', type: 'uint96' },
                ],
              },
              { name: 'dopplerHook', type: 'address' },
              { name: 'onInitializationDopplerHookCalldata', type: 'bytes' },
              { name: 'graduationDopplerHookCalldata', type: 'bytes' },
            ],
          },
        ],
        createParams.poolInitializerData,
      ) as any;

      const decodedCurves = decodedPoolInitData.curves as Array<{
        tickUpper: bigint;
      }>;
      const expectedFarTick =
        Math.max(...decodedCurves.map((curve) => Number(curve.tickUpper))) -
        params.pool.tickSpacing;

      expect(Number(decodedPoolInitData.farTick)).toBe(expectedFarTick);
      expect(decodedPoolInitData.dopplerHook).toBe(ZERO_ADDRESS);
      expect(decodedPoolInitData.onInitializationDopplerHookCalldata).toBe(
        '0x',
      );
      expect(decodedPoolInitData.graduationDopplerHookCalldata).toBe('0x');
    });

    it('computes rehype multicurve poolId with zero hook when no hook config is set', async () => {
      const params = multicurveParams();
      params.modules = {
        dopplerHookInitializer:
          '0x7100000000000000000000000000000000000011' as Address,
      };

      const result = await factory.simulateCreateMulticurve(params);

      const numeraire = params.sale.numeraire;
      const currency0 =
        BigInt(mockTokenAddress) < BigInt(numeraire)
          ? mockTokenAddress
          : numeraire;
      const currency1 =
        BigInt(mockTokenAddress) < BigInt(numeraire)
          ? numeraire
          : mockTokenAddress;
      const expectedPoolId = keccak256(
        encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'address' },
          ],
          [
            currency0,
            currency1,
            params.pool.fee,
            params.pool.tickSpacing,
            params.modules.dopplerHookInitializer,
          ],
        ),
      );

      expect(result.poolId).toBe(expectedPoolId);
      expect(publicClient.readContract).not.toHaveBeenCalled();
    });

    it('rejects conflicting decay initializer and legacy schedule fields', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: 6_000,
        durationSeconds: 1_000,
      };
      params.schedule = { startTime: 1_800_000_000 };

      expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
        "Initializer type 'decay' cannot be combined with legacy schedule/dopplerHook fields",
      );
    });

    it('rejects dopplerHookMigrator migration for multicurve auctions', () => {
      const params = multicurveParams();
      params.migration = {
        type: 'dopplerHookMigrator',
        fee: 3000,
        tickSpacing: 60,
        lockDuration: 30 * DAY_SECONDS,
        beneficiaries: [
          {
            beneficiary:
              '0x1234567890123456789012345678901234567890' as Address,
            shares: parseEther('1'),
          },
        ],
      };

      expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
        'dopplerHookMigrator migration is only supported for dynamic auctions',
      );
    });

    it('rejects duplicate pool beneficiary addresses', () => {
      // The pool contract requires strictly ascending beneficiary addresses and
      // reverts with UnorderedBeneficiaries() on duplicates. The encode layer
      // should surface this as a readable error before broadcasting.
      const duplicate = '0x0000000000000000000000000000000000000001' as Address;
      const params = multicurveParams();
      params.pool.beneficiaries = [
        { beneficiary: duplicate, shares: parseEther('0.5') },
        { beneficiary: duplicate, shares: parseEther('0.5') },
      ];

      expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
        /Duplicate beneficiary address/,
      );
    });

    it('accepts decay startFee up to 80%', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: DECAY_MAX_START_FEE,
        durationSeconds: 1_000,
      };

      expect(() => factory.encodeCreateMulticurveParams(params)).not.toThrow();
    });

    it('rejects decay startFee above 80%', () => {
      const params = multicurveParams();
      params.initializer = {
        type: 'decay',
        startTime: 1_800_000_000,
        startFee: DECAY_MAX_START_FEE + 1,
        durationSeconds: 1_000,
      };

      expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
        `Decay multicurve startFee must be between 0 and ${DECAY_MAX_START_FEE}`,
      );
    });
  });

  describe('createStaticAuction', () => {
    const validParams: CreateStaticAuctionParams = {
      token: {
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'https://example.com/token',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: mockAddresses.weth,
      },
      pool: {
        startTick: 174960,
        endTick: 225000,
        fee: 3000,
      },
      governance: { type: 'noOp' },
      migration: {
        type: 'uniswapV2',
      },
      userAddress: '0x1234567890123456789012345678901234567890',
    };

    it('should validate parameters', async () => {
      const invalidParams = {
        ...validParams,
        sale: {
          ...validParams.sale,
          numTokensToSell: parseEther('2000000'), // More than initial supply
        },
      };

      await expect(factory.createStaticAuction(invalidParams)).rejects.toThrow(
        'Cannot sell more tokens than initial supply',
      );
    });

    it('rejects dopplerHookMigrator migration for static auctions', async () => {
      const invalidParams = {
        ...validParams,
        migration: {
          type: 'dopplerHookMigrator' as const,
          fee: 3000,
          tickSpacing: 60,
          lockDuration: 30 * DAY_SECONDS,
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            },
          ],
        },
      };

      await expect(factory.createStaticAuction(invalidParams)).rejects.toThrow(
        'dopplerHookMigrator migration is only supported for dynamic auctions',
      );
    });

    it('should validate tick spacing alignment when ticks provided manually', async () => {
      const invalidParams = {
        ...validParams,
        pool: {
          ...validParams.pool,
          startTick: validParams.pool.startTick + 30, // Not divisible by 60
        },
      };

      await expect(factory.createStaticAuction(invalidParams)).rejects.toThrow(
        'Pool ticks must be multiples of tick spacing 60 for fee tier 3000',
      );
    });

    it('should create a static auction successfully', async () => {
      const mockTxHash =
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      // Mock the contract calls
      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 9_500_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );

      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      const result = await factory.createStaticAuction(validParams);

      expect(result).toEqual({
        poolAddress: mockPoolAddress,
        tokenAddress: mockTokenAddress,
        transactionHash: mockTxHash,
      });

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 13_500_000n }),
      );

      expect(publicClient.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.airlock,
          functionName: 'create',
        }),
      );
    });

    it('should honor explicit gas override when creating a static auction', async () => {
      const mockTxHash =
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';

      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 9_500_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      await factory.createStaticAuction({ ...validParams, gas: 21_000_000n });

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 21_000_000n }),
      );
    });

    it('should encode migration data correctly for V2', async () => {
      const params = {
        ...validParams,
        migration: { type: 'uniswapV2' as const },
      };
      const mockTxHash =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      await factory.createStaticAuction(params);

      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0];
      expect((call as any).args[0].liquidityMigrator).toBe(
        mockAddresses.v2Migrator,
      );
      expect((call as any).args[0].liquidityMigratorData).toBe('0x');
    });

    it('should include gas estimate when simulating static auction', async () => {
      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 11_000_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {},
        result: [mockTokenAddress, mockPoolAddress],
      } as any);

      const result = await factory.simulateCreateStaticAuction(validParams);

      expect(result.gasEstimate).toBe(11_000_000n);
      expect(result.asset).toBe(mockTokenAddress);
      expect(result.pool).toBe(mockPoolAddress);
    });
  });

  describe('createDynamicAuction', () => {
    const validParams: CreateDynamicAuctionParams = {
      token: {
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'https://example.com/token',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: mockAddresses.weth,
      },
      auction: {
        duration: 7 * DAY_SECONDS,
        epochLength: 3600, // 1 hour
        startTick: isToken0Expected(mockAddresses.weth) ? 92103 : -92103, // ~0.0001 ETH per token
        endTick: isToken0Expected(mockAddresses.weth) ? 69080 : -69080, // ~0.001 ETH per token
        minProceeds: parseEther('100'),
        maxProceeds: parseEther('10000'),
      },
      pool: {
        fee: 3000,
        tickSpacing: 10, // Must be <= 30 for dynamic auctions (Doppler.sol MAX_TICK_SPACING)
      },
      governance: { type: 'noOp' },
      migration: {
        type: 'uniswapV4',
        fee: 3000,
        tickSpacing: 10, // Must be <= 30 for dynamic auctions (Doppler.sol MAX_TICK_SPACING)
        streamableFees: {
          lockDuration: 365 * 24 * 60 * 60, // 1 year
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            }, // 100%
          ],
        },
      },
      userAddress: '0x1234567890123456789012345678901234567890',
    };

    it('should validate descending ticks for token0', async () => {
      const invalidParams = {
        ...validParams,
        auction: {
          ...validParams.auction,
          startTick: -92103,
          endTick: -69080,
        },
        sale: {
          ...validParams.sale,
          numeraire: '0xffffffffffffffffffffffffffffffffffffffff' as Address,
        },
      };

      await expect(factory.createDynamicAuction(invalidParams)).rejects.toThrow(
        'Start tick must be greater than end tick if base token is currency0',
      );
    });

    it('should validate ascending ticks for token1', async () => {
      const invalidParams = {
        ...validParams,
        auction: {
          ...validParams.auction,
          startTick: 92103,
          endTick: 69080,
        },
        sale: {
          ...validParams.sale,
          numeraire: '0x0000000000000000000000000000000000000000' as Address,
        },
      };

      await expect(factory.createDynamicAuction(invalidParams)).rejects.toThrow(
        'Start tick must be less than end tick if base token is currency1',
      );
    });

    it('should validate duration', async () => {
      const invalidParams = {
        ...validParams,
        auction: {
          ...validParams.auction,
          duration: -1, // Negative duration
        },
      };

      await expect(factory.createDynamicAuction(invalidParams)).rejects.toThrow(
        'Auction duration must be positive',
      );
    });

    it('should calculate gamma if not provided', async () => {
      const mockTxHash =
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      await factory.createDynamicAuction(validParams);

      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0];
      const poolInitializerData = (call as any).args[0].poolInitializerData;

      // Should contain encoded data with calculated gamma
      expect(poolInitializerData).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(poolInitializerData.length).toBeGreaterThan(2);
    });

    it('should create a dynamic auction successfully', async () => {
      const mockTxHash =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      const result = await factory.createDynamicAuction(validParams);

      expect(result).toEqual({
        hookAddress: mockPoolAddress,
        tokenAddress: mockTokenAddress,
        poolId: expect.any(String),
        transactionHash: mockTxHash,
      });

      expect(publicClient.estimateContractGas).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'create' }),
      );
      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 13_500_000n }),
      );
    });

    it('should simulate dynamic auction creation and compute poolId', async () => {
      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 12_250_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {},
        result: [mockTokenAddress, mockPoolAddress],
      } as any);

      const { createParams, hookAddress, tokenAddress, poolId, gasEstimate } =
        await factory.simulateCreateDynamicAuction(validParams);

      expect(createParams).toBeDefined();
      expect(hookAddress).toBe(mockPoolAddress);
      expect(tokenAddress).toBe(mockTokenAddress);
      expect(typeof poolId).toBe('string');
      expect(poolId.startsWith('0x')).toBe(true);
      expect(gasEstimate).toBe(12_250_000n);
    });

    it('encodes dopplerHookMigrator migration with generic hook + proceeds split', async () => {
      const genericHook =
        '0x9999999999999999999999999999999999999999' as Address;
      const proceedsRecipient =
        '0x1111111111111111111111111111111111111111' as Address;

      const marketCapParams = DynamicAuctionBuilder.forChain(1)
        .tokenConfig({
          name: 'Test Token',
          symbol: 'TEST',
          tokenURI: 'https://example.com/token',
        })
        .saleConfig({
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: mockAddresses.weth,
        })
        .withMarketCapRange({
          marketCap: { start: 500_000, min: 50_000 },
          numerairePrice: 3000,
          minProceeds: parseEther('100'),
          maxProceeds: parseEther('10000'),
          fee: 3000,
          tickSpacing: 10,
          duration: 7 * DAY_SECONDS,
          epochLength: 3600,
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
        .withUserAddress(
          '0x1234567890123456789012345678901234567890' as Address,
        )
        .build();

      const params: CreateDynamicAuctionParams = {
        ...marketCapParams,
        migration: {
          type: 'dopplerHookMigrator',
          fee: 500,
          useDynamicFee: true,
          tickSpacing: 20,
          lockDuration: DAY_SECONDS,
          beneficiaries: [
            {
              beneficiary:
                '0x1234567890123456789012345678901234567890' as Address,
              shares: parseEther('1'),
            },
          ],
          hook: {
            hookAddress: genericHook,
            onInitializationCalldata: '0x1234',
          },
          proceedsSplit: {
            recipient: proceedsRecipient,
            share: parseEther('0.1'),
          },
        },
      };

      const { createParams } =
        await factory.encodeCreateDynamicAuctionParams(params);

      const decoded = decodeAbiParameters(
        [
          { type: 'uint24' },
          { type: 'bool' },
          { type: 'int24' },
          { type: 'uint32' },
          {
            type: 'tuple[]',
            components: [
              { type: 'address', name: 'beneficiary' },
              { type: 'uint96', name: 'shares' },
            ],
          },
          { type: 'address' },
          { type: 'bytes' },
          { type: 'address' },
          { type: 'uint256' },
        ],
        createParams.liquidityMigratorData,
      ) as readonly [
        number,
        boolean,
        number,
        number,
        readonly { beneficiary: Address; shares: bigint }[],
        Address,
        `0x${string}`,
        Address,
        bigint,
      ];

      expect(decoded[0]).toBe(500);
      expect(decoded[1]).toBe(true);
      expect(decoded[2]).toBe(20);
      expect(decoded[3]).toBe(DAY_SECONDS);
      expect(decoded[5]).toBe(genericHook);
      expect(decoded[6]).toBe('0x1234');
      expect(decoded[7]).toBe(proceedsRecipient);
      expect(decoded[8]).toBe(parseEther('0.1'));
    });

    it('should allow overriding gas when creating a dynamic auction', async () => {
      const mockTxHash =
        '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed';

      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(
        async () => 10_000_000n,
      );
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceiptWithCreateEvent(),
      );

      await factory.createDynamicAuction({ ...validParams, gas: 18_000_000n });

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 18_000_000n }),
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle missing wallet client', async () => {
      factory = new DopplerFactory(publicClient, undefined, 1);

      const params: CreateStaticAuctionParams = {
        token: {
          name: 'Test',
          symbol: 'TEST',
          tokenURI: 'https://example.com',
        },
        sale: {
          initialSupply: parseEther('1000'),
          numTokensToSell: parseEther('500'),
          numeraire: mockAddresses.weth,
        },
        pool: { startTick: 174960, endTick: 225000, fee: 3000 },
        governance: { type: 'noOp' },
        migration: { type: 'uniswapV2' },
        userAddress: '0x1234567890123456789012345678901234567890',
      };

      await expect(factory.createStaticAuction(params)).rejects.toThrow(
        'Wallet client required for write operations',
      );
    });

    it('should throw error when transaction receipt has no Create event', async () => {
      const mockTxHash =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any);
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        mockTxHash as `0x${string}`,
      );
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceipt([]), // No logs
      );

      const params: CreateStaticAuctionParams = {
        token: {
          name: 'Test',
          symbol: 'TEST',
          tokenURI: 'https://example.com',
        },
        sale: {
          initialSupply: parseEther('1000'),
          numTokensToSell: parseEther('500'),
          numeraire: mockAddresses.weth,
        },
        pool: { startTick: 174960, endTick: 225000, fee: 3000 },
        governance: { type: 'noOp' },
        migration: { type: 'uniswapV2' },
        userAddress: '0x1234567890123456789012345678901234567890',
      };

      // Should throw error when Create event is missing (no more fallback to simulation)
      await expect(factory.createStaticAuction(params)).rejects.toThrow(
        'Failed to extract addresses from Create event in transaction logs',
      );
    });
  });
});
