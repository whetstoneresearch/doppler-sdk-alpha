import { beforeEach, describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeAbiParameters, parseEther, type Address, type Hex } from 'viem';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import { CHAIN_IDS, getAddresses } from '../../../../src/evm/addresses';
import type {
  SupportedPublicClient,
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  CreateOpeningAuctionParams,
  GovernanceOption,
  SupportedChainId,
  VestingConfig,
} from '../../../../src/evm/types';
import { isToken0Expected } from '../../../../src/evm/utils';

describe('DopplerFactory governance encoding', () => {
  let factory: DopplerFactory;
  let publicClient: SupportedPublicClient;
  let simulateContractMock: ReturnType<typeof vi.fn>;
  let getBlockMock: ReturnType<typeof vi.fn>;
  let readContractMock: ReturnType<typeof vi.fn>;
  const account = privateKeyToAccount(
    '0x1234567890123456789012345678901234567890123456789012345678901234',
  );
  const launchpadMultisig =
    '0x1234567890123456789012345678901234567890' as Address;
  const expectedLaunchpadFactory = getAddresses(
    CHAIN_IDS.BASE_SEPOLIA,
  ).launchpadGovernanceFactory;
  const expectedLaunchpadFactoryData = encodeAbiParameters(
    [{ type: 'address' }],
    [launchpadMultisig],
  );
  const governanceAbi = [
    { type: 'string' },
    { type: 'uint48' },
    { type: 'uint32' },
    { type: 'uint256' },
  ] as const;
  const governanceCases: {
    label: string;
    tokenType?: 'standard' | 'dopplerERC20V1';
    vesting?: VestingConfig;
    governance: GovernanceOption<SupportedChainId>;
    expected: readonly [number, number, bigint] | Hex;
  }[] = [
    {
      label: 'launchpad',
      governance: { type: 'launchpad', multisig: launchpadMultisig },
      expected: expectedLaunchpadFactoryData,
    },
    {
      label: 'inferred timestamp defaults',
      governance: { type: 'default' },
      expected: [86_400, 604_800, 0n],
    },
    {
      label: 'explicit timestamp defaults',
      tokenType: 'dopplerERC20V1',
      governance: { type: 'default' },
      expected: [86_400, 604_800, 0n],
    },
    {
      label: 'legacy block defaults',
      tokenType: 'standard',
      governance: { type: 'default' },
      expected: [43_200, 302_400, 0n],
    },
    {
      label: 'DERC20V2 block defaults with timestamp vesting',
      tokenType: 'standard',
      vesting: {
        duration: 604_800,
        cliffDuration: 86_400,
        recipients: [account.address],
        amounts: [parseEther('1000')],
      },
      governance: { type: 'default' },
      expected: [43_200, 302_400, 0n],
    },
    ...(['standard', 'dopplerERC20V1'] as const).map((tokenType) => ({
      label: `${tokenType} custom values`,
      tokenType,
      governance: {
        type: 'custom' as const,
        initialVotingDelay: 123,
        initialVotingPeriod: 456,
        initialProposalThreshold: 789n,
      },
      expected: [123, 456, 789n] as const,
    })),
  ];

  beforeEach(() => {
    simulateContractMock = vi.fn().mockResolvedValue({
      result: [
        '0xffffffffffffffffffffffffffffffffffffffff',
        '0x0000000000000000000000000000000000000001',
      ],
    });
    getBlockMock = vi.fn().mockResolvedValue({ timestamp: 1n });
    readContractMock = vi.fn();

    publicClient = {
      simulateContract: simulateContractMock,
      getBlock: getBlockMock,
      readContract: readContractMock,
    } as unknown as SupportedPublicClient;

    factory = new DopplerFactory(
      publicClient,
      undefined,
      CHAIN_IDS.BASE_SEPOLIA,
    );
  });

  it('omits governance payload for static auctions with noOp governance', async () => {
    const params: CreateStaticAuctionParams = {
      token: {
        name: 'NoOp Token',
        symbol: 'NOP',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: '0x4200000000000000000000000000000000000006' as Address,
      },
      pool: {
        startTick: -276400,
        endTick: -276200,
        fee: 10000,
      },
      governance: { type: 'noOp' },
      migration: {
        type: 'uniswapV2',
      },
      userAddress: account.address,
    };

    const result = await factory.encodeCreateStaticAuctionParams(params);

    expect(result.governanceFactoryData).toBe('0x');
  });

  it.each(governanceCases)(
    'encodes $label governance for static auctions',
    async ({ tokenType, vesting, governance, expected }) => {
      const params: CreateStaticAuctionParams = {
        token: {
          type: tokenType,
          name: 'Launchpad Token',
          symbol: 'LCH',
          tokenURI: 'https://example.com/token.json',
        },
        sale: {
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: '0x4200000000000000000000000000000000000006' as Address,
        },
        pool: {
          startTick: -276400,
          endTick: -276200,
          fee: 10000,
        },
        governance,
        vesting,
        migration: {
          type: 'uniswapV2',
        },
        userAddress: account.address,
      };

      const result = await factory.encodeCreateStaticAuctionParams(params);

      expect(result.governanceFactory).toBe(
        governance.type === 'launchpad'
          ? expectedLaunchpadFactory
          : getAddresses(CHAIN_IDS.BASE_SEPOLIA).governanceFactory,
      );
      expect(result.governanceFactoryData).toBe(
        typeof expected === 'string'
          ? expected
          : encodeAbiParameters(governanceAbi, [
              params.token.name,
              ...expected,
            ]),
      );
    },
  );

  it('omits governance payload for dynamic auctions with noOp governance', async () => {
    const numeraire = '0x4200000000000000000000000000000000000006' as Address;
    const token0Expected = isToken0Expected(numeraire);

    const params: CreateDynamicAuctionParams = {
      token: {
        name: 'NoOp Dynamic Token',
        symbol: 'NOD',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('2000000'),
        numTokensToSell: parseEther('750000'),
        numeraire,
      },
      auction: {
        duration: 7 * 24 * 60 * 60,
        epochLength: 3600,
        startTick: token0Expected ? 92103 : -92103,
        endTick: token0Expected ? 69080 : -69080,
        gamma: 1200,
        minProceeds: parseEther('100'),
        maxProceeds: parseEther('5000'),
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
          lockDuration: 7 * 24 * 60 * 60,
          beneficiaries: [
            { beneficiary: account.address, shares: parseEther('1') },
          ],
        },
      },
      userAddress: account.address,
      startTimeOffset: 45,
      blockTimestamp: 1,
    };

    const { createParams } =
      await factory.encodeCreateDynamicAuctionParams(params);

    expect(createParams.governanceFactoryData).toBe('0x');
  });

  it.each(governanceCases)(
    'encodes $label governance for dynamic auctions',
    async ({ tokenType, vesting, governance, expected }) => {
      const numeraire = '0x4200000000000000000000000000000000000006' as Address;
      const token0Expected = isToken0Expected(numeraire);
      vi.spyOn(
        factory as unknown as {
          mineHookAddress: () => readonly [Hex, Address, Address, Hex, Hex];
        },
        'mineHookAddress',
      ).mockReturnValue([
        `0x${'00'.repeat(32)}`,
        '0x9200000000000000000000000000000000000003',
        '0x0100000000000000000000000000000000000003',
        '0x',
        '0x',
      ]);

      const params: CreateDynamicAuctionParams = {
        token: {
          name: 'Launchpad Dynamic Token',
          type: tokenType,
          symbol: 'LDY',
          tokenURI: 'https://example.com/token.json',
        },
        sale: {
          initialSupply: parseEther('2000000'),
          numTokensToSell: parseEther('750000'),
          numeraire,
        },
        auction: {
          duration: 7 * 24 * 60 * 60,
          epochLength: 3600,
          startTick: token0Expected ? 92103 : -92103,
          endTick: token0Expected ? 69080 : -69080,
          gamma: 1200,
          minProceeds: parseEther('100'),
          maxProceeds: parseEther('5000'),
        },
        pool: {
          fee: 3000,
          tickSpacing: 10,
        },
        governance,
        vesting,
        migration: {
          type: 'uniswapV4',
          fee: 3000,
          tickSpacing: 10,
          streamableFees: {
            lockDuration: 7 * 24 * 60 * 60,
            beneficiaries: [
              { beneficiary: account.address, shares: parseEther('1') },
            ],
          },
        },
        userAddress: account.address,
        startTimeOffset: 45,
        blockTimestamp: 1,
      };

      const { createParams } =
        await factory.encodeCreateDynamicAuctionParams(params);

      expect(createParams.governanceFactory).toBe(
        governance.type === 'launchpad'
          ? expectedLaunchpadFactory
          : getAddresses(CHAIN_IDS.BASE_SEPOLIA).governanceFactory,
      );
      expect(createParams.governanceFactoryData).toBe(
        typeof expected === 'string'
          ? expected
          : encodeAbiParameters(governanceAbi, [
              params.token.name,
              ...expected,
            ]),
      );
    },
  );

  it('omits governance payload for multicurve auctions with noOp governance', () => {
    const params: CreateMulticurveParams = {
      token: {
        name: 'NoOp Multi Token',
        symbol: 'NOM',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('3000000'),
        numTokensToSell: parseEther('1000000'),
        numeraire: '0x4200000000000000000000000000000000000006' as Address,
      },
      pool: {
        fee: 3000,
        tickSpacing: 60,
        curves: [
          {
            tickLower: 1000,
            tickUpper: 5000,
            numPositions: 4,
            shares: parseEther('0.5'),
          },
          {
            tickLower: 5000,
            tickUpper: 9000,
            numPositions: 4,
            shares: parseEther('0.5'),
          },
        ],
      },
      governance: { type: 'noOp' },
      migration: { type: 'uniswapV2' },
      userAddress: account.address,
    };

    const createParams = factory.encodeCreateMulticurveParams(params);

    expect(createParams.governanceFactoryData).toBe('0x');
  });

  it.each(governanceCases)(
    'encodes $label governance for multicurve auctions',
    ({ tokenType, vesting, governance, expected }) => {
      const params: CreateMulticurveParams = {
        token: {
          type: tokenType,
          name: 'Launchpad Multi Token',
          symbol: 'LMT',
          tokenURI: 'https://example.com/token.json',
        },
        sale: {
          initialSupply: parseEther('3000000'),
          numTokensToSell: parseEther('1000000'),
          numeraire: '0x4200000000000000000000000000000000000006' as Address,
        },
        pool: {
          fee: 3000,
          tickSpacing: 60,
          curves: [
            {
              tickLower: 1000,
              tickUpper: 5000,
              numPositions: 4,
              shares: parseEther('0.5'),
            },
            {
              tickLower: 5000,
              tickUpper: 9000,
              numPositions: 4,
              shares: parseEther('0.5'),
            },
          ],
        },
        governance,
        vesting,
        migration: { type: 'uniswapV2' },
        userAddress: account.address,
      };

      const createParams = factory.encodeCreateMulticurveParams(params);

      expect(createParams.governanceFactory).toBe(
        governance.type === 'launchpad'
          ? expectedLaunchpadFactory
          : getAddresses(CHAIN_IDS.BASE_SEPOLIA).governanceFactory,
      );
      expect(createParams.governanceFactoryData).toBe(
        typeof expected === 'string'
          ? expected
          : encodeAbiParameters(governanceAbi, [
              params.token.name,
              ...expected,
            ]),
      );
    },
  );

  it.each(governanceCases)(
    'encodes $label governance for opening auctions',
    async ({ tokenType, vesting, governance, expected }) => {
      const openingAuctionInitializer =
        '0x9100000000000000000000000000000000000001' as Address;
      const poolManager =
        '0x9100000000000000000000000000000000000002' as Address;
      const auctionDeployer =
        '0x9100000000000000000000000000000000000003' as Address;
      const minedSalt =
        '0x00000000000000000000000000000000000000000000000000000000000000ac' as const;
      const minedHook = '0x9200000000000000000000000000000000000003' as Address;
      const minedToken =
        '0x0100000000000000000000000000000000000003' as Address;
      const encodedTokenFactoryData = '0xfeedbeef' as const;

      readContractMock
        .mockResolvedValueOnce(poolManager)
        .mockResolvedValueOnce(auctionDeployer);

      vi.spyOn(
        factory as unknown as {
          mineOpeningAuctionHookAddress: () => readonly [
            `0x${string}`,
            Address,
            Address,
            `0x${string}`,
          ];
        },
        'mineOpeningAuctionHookAddress',
      ).mockReturnValue([
        minedSalt,
        minedHook,
        minedToken,
        encodedTokenFactoryData,
      ]);

      const params: CreateOpeningAuctionParams = {
        token: {
          type: tokenType,
          name: 'Launchpad Opening Token',
          symbol: 'LOT',
          tokenURI: 'https://example.com/token.json',
        },
        sale: {
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: '0x4200000000000000000000000000000000000006' as Address,
        },
        openingAuction: {
          auctionDuration: 3600,
          minAcceptableTickToken0: -1200,
          minAcceptableTickToken1: 1200,
          incentiveShareBps: 500,
          tickSpacing: 60,
          fee: 3000,
          minLiquidity: 1n,
          shareToAuctionBps: 2000,
        },
        doppler: {
          minProceeds: parseEther('100'),
          maxProceeds: parseEther('10000'),
          startTick: 900,
          endTick: 1000,
          epochLength: 3600,
          duration: 24 * 3600,
          fee: 3000,
          tickSpacing: 10,
        },
        governance,
        vesting,
        migration: { type: 'uniswapV2' },
        userAddress: account.address,
        blockTimestamp: 1_700_000_000,
        modules: {
          openingAuctionInitializer,
        },
      };

      const result = await factory.encodeCreateOpeningAuctionParams(params);

      expect(result.createParams.governanceFactory).toBe(
        governance.type === 'launchpad'
          ? expectedLaunchpadFactory
          : getAddresses(CHAIN_IDS.BASE_SEPOLIA).governanceFactory,
      );
      expect(result.createParams.governanceFactoryData).toBe(
        typeof expected === 'string'
          ? expected
          : encodeAbiParameters(governanceAbi, [
              params.token.name,
              ...expected,
            ]),
      );
    },
  );

  it.each([
    [CHAIN_IDS.MAINNET, 7_200, 50_400],
    [CHAIN_IDS.ARBITRUM, 7_200, 50_400],
    [CHAIN_IDS.BASE, 43_200, 302_400],
    [CHAIN_IDS.BASE_SEPOLIA, 43_200, 302_400],
    [CHAIN_IDS.INK, 86_400, 604_800],
    [CHAIN_IDS.UNICHAIN, 86_400, 604_800],
    [CHAIN_IDS.UNICHAIN_SEPOLIA, 86_400, 604_800],
    [CHAIN_IDS.MONAD_MAINNET, 216_000, 1_512_000],
    [CHAIN_IDS.MONAD_TESTNET, 216_000, 1_512_000],
    [CHAIN_IDS.ROBINHOOD, undefined, undefined],
  ] as const)(
    'uses the legacy token clock cadence on chain %s',
    async (chainId, delay, period) => {
      const chainFactory = new DopplerFactory(publicClient, undefined, chainId);
      const addresses = getAddresses(CHAIN_IDS.BASE_SEPOLIA);
      const params: CreateStaticAuctionParams = {
        token: {
          type: 'standard',
          name: 'Legacy Clock Token',
          symbol: 'CLK',
          tokenURI: 'https://example.com/token.json',
        },
        sale: {
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: addresses.weth,
        },
        pool: { startTick: -276400, endTick: -276200, fee: 10000 },
        governance: { type: 'default' },
        migration: { type: 'uniswapV2' },
        userAddress: account.address,
        // Supply missing legacy modules without changing the token clock.
        modules: {
          tokenFactory: addresses.tokenFactory,
          v3Initializer: addresses.v3Initializer,
          v2Migrator: addresses.v2Migrator,
          governanceFactory: addresses.governanceFactory,
        },
      };

      if (delay === undefined || period === undefined) {
        await expect(
          chainFactory.encodeCreateStaticAuctionParams(params),
        ).rejects.toThrow(/custom governance/i);
        params.governance = {
          type: 'custom',
          initialVotingDelay: 123,
          initialVotingPeriod: 456,
          initialProposalThreshold: 789n,
        };
      }

      const result = await chainFactory.encodeCreateStaticAuctionParams(params);
      expect(result.governanceFactoryData).toBe(
        encodeAbiParameters(governanceAbi, [
          params.token.name,
          delay ?? 123,
          period ?? 456,
          delay === undefined ? 789n : 0n,
        ]),
      );
    },
  );
});
