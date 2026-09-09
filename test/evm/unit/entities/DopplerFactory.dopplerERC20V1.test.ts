import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  keccak256,
  parseEther,
  type Address,
  type Hash,
  type PublicClient,
} from 'viem';
import { DAY_SECONDS, DEAD_ADDRESS, WAD } from '../../../../src/evm/constants';
import {
  DynamicAuctionBuilder,
  MulticurveBuilder,
  OpeningAuctionBuilder,
  StaticAuctionBuilder,
} from '../../../../src/evm/builders';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';
import {
  mockAddresses,
  mockHookAddress,
  mockTimelockAddress,
} from '../../setup/fixtures/addresses';

vi.mock('../../../../src/evm/addresses', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../src/evm/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

const userAddress = '0x1234567890123456789012345678901234567890' as Address;
const beneficiary = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
const controller = '0xfedcfedcfedcfedcfedcfedcfedcfedcfedcfedc' as Address;
const excluded = '0x1111111111111111111111111111111111111111' as Address;
const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
const customTokenFactory =
  '0x2222222222222222222222222222222222222222' as Address;
const openingAuctionInitializer =
  '0x3333333333333333333333333333333333333333' as Address;

const UNISWAP_V2_PAIR_INIT_CODE_HASH =
  '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f' as const;
const UNISWAP_V3_POOL_INIT_CODE_HASH =
  '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54' as const;

function computeUniswapV2PairAddress(
  tokenA: Address,
  tokenB: Address,
): Address {
  const [token0, token1] =
    BigInt(tokenA) < BigInt(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
  const salt = keccak256(
    encodePacked(['address', 'address'], [token0, token1]),
  );
  const hash = keccak256(
    `0xff${mockAddresses.uniswapV2Factory!.slice(2)}${salt.slice(2)}${UNISWAP_V2_PAIR_INIT_CODE_HASH.slice(2)}`,
  );
  return getAddress(`0x${hash.slice(-40)}`) as Address;
}

function computeUniswapV3PoolAddress(
  tokenA: Address,
  tokenB: Address,
  fee: number,
): Address {
  const [token0, token1] =
    BigInt(tokenA) < BigInt(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
  const salt = keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }],
      [token0, token1, fee],
    ),
  );
  const hash = keccak256(
    `0xff${mockAddresses.uniswapV3Factory!.slice(2)}${salt.slice(2)}${UNISWAP_V3_POOL_INIT_CODE_HASH.slice(2)}`,
  );
  return getAddress(`0x${hash.slice(-40)}`) as Address;
}

function computeCreate2Address(args: {
  deployer: Address;
  salt: Hash;
  initCodeHash: Hash;
}): Address {
  const hash = keccak256(
    encodePacked(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', args.deployer, args.salt, args.initCodeHash],
    ),
  );
  return getAddress(`0x${hash.slice(-40)}`) as Address;
}

function computeSoladyCloneInitCodeHash(implementation: Address): Hash {
  return keccak256(
    `0x602c3d8160093d39f33d3d3d3d363d3d37363d73${implementation.slice(
      2,
    )}5af43d3d93803e602a57fd5bf3`,
  ) as Hash;
}

function computeV1TokenAddress(salt: Hash): Address {
  return computeCreate2Address({
    deployer: mockAddresses.dopplerERC20V1Factory!,
    salt,
    initCodeHash: computeSoladyCloneInitCodeHash(
      mockAddresses.dopplerERC20V1Implementation!,
    ),
  });
}

const DOPPLER_ERC20_V1_TOKEN_DATA_ABI = [
  { type: 'string' },
  { type: 'string' },
  {
    type: 'tuple[]',
    components: [
      { type: 'uint64', name: 'cliff' },
      { type: 'uint64', name: 'duration' },
    ],
  },
  { type: 'address[]' },
  { type: 'uint256[]' },
  { type: 'uint256[]' },
  { type: 'string' },
  { type: 'uint256' },
  { type: 'uint48' },
  { type: 'address' },
  { type: 'address[]' },
] as const;

function decodeV1TokenFactoryData(data: `0x${string}`) {
  return decodeAbiParameters(
    DOPPLER_ERC20_V1_TOKEN_DATA_ABI,
    data,
  ) as readonly [
    string,
    string,
    readonly { cliff: bigint; duration: bigint }[],
    readonly Address[],
    readonly bigint[],
    readonly bigint[],
    string,
    bigint,
    number,
    Address,
    readonly Address[],
  ];
}

describe('DopplerFactory DopplerERC20V1 token routing', () => {
  let factory: DopplerFactory;
  let publicClient: PublicClient;

  beforeEach(() => {
    publicClient = createMockPublicClient() as PublicClient;
    factory = new DopplerFactory(publicClient, createMockWalletClient(), 1);
  });

  it('routes static auctions with balance-limit fields through DopplerERC20V1Factory', async () => {
    const balanceLimitEnd = Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS;
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        name: 'Static Token',
        symbol: 'SV1',
        tokenURI: 'ipfs://static-token',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd,
        controller,
        excludedFromBalanceLimit: [excluded],
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withVesting({
        duration: 180n * BigInt(DAY_SECONDS),
        recipients: [beneficiary],
        amounts: [parseEther('100000')],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const tokenAddress = computeV1TokenAddress(createParams.salt);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.dopplerERC20V1Factory);
    expect(decoded[0]).toBe('Static Token');
    expect(decoded[1]).toBe('SV1');
    expect(decoded[2]).toEqual([
      { cliff: 0n, duration: 180n * BigInt(DAY_SECONDS) },
    ]);
    expect(decoded[3]).toEqual([getAddress(beneficiary)]);
    expect(decoded[4]).toEqual([0n]);
    expect(decoded[5]).toEqual([parseEther('100000')]);
    expect(decoded[6]).toBe('ipfs://static-token');
    expect(decoded[7]).toBe(parseEther('10000'));
    expect(decoded[8]).toBe(balanceLimitEnd);
    expect(decoded[9]).toBe(getAddress(controller));
    expect(decoded[10]).toEqual([
      getAddress(excluded),
      mockAddresses.v3Initializer,
      mockAddresses.v2Migrator,
      DEAD_ADDRESS,
      computeUniswapV3PoolAddress(tokenAddress, mockAddresses.weth, 3000),
      computeUniswapV2PairAddress(mockAddresses.weth, tokenAddress),
    ]);
    expect(decoded).toHaveLength(11);
    expect(decoded).not.toContain(20_000_000_000_000_000n);
  });

  it('adds the Uniswap V2 pair exclusion for V2 split migrations', async () => {
    const balanceLimitEnd = Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS;
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Split Token',
        symbol: 'SPV1',
        tokenURI: 'ipfs://split-token',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({
        type: 'uniswapV2Split',
        proceedsSplit: {
          recipient: beneficiary,
          share: parseEther('0.1'),
        },
      })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const tokenAddress = computeV1TokenAddress(createParams.salt);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.liquidityMigrator).toBe(mockAddresses.v2MigratorSplit);
    expect(decoded[10]).toContain(
      computeUniswapV2PairAddress(mockAddresses.weth, tokenAddress),
    );
  });

  it('adds PoolManager to active static exclusions for Uniswap V4 migration', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Static Token V4 Migration',
        symbol: 'SV1V4',
        tokenURI: 'ipfs://static-token-v4',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 60 })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const tokenAddress = computeV1TokenAddress(createParams.salt);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(decoded[10]).toEqual([
      mockAddresses.v3Initializer,
      mockAddresses.v4Migrator,
      mockAddresses.poolManager,
      DEAD_ADDRESS,
      computeUniswapV3PoolAddress(tokenAddress, mockAddresses.weth, 3000),
    ]);
  });

  it('adds launchpad governance multisig to active balance-limit exclusions', async () => {
    const launchpadMultisig =
      '0x4444444444444444444444444444444444444444' as Address;
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Static Token Launchpad',
        symbol: 'SV1L',
        tokenURI: 'ipfs://static-token-launchpad',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'launchpad', multisig: launchpadMultisig })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(decoded[10]).toContain(getAddress(launchpadMultisig));
    expect(decoded[10]).not.toContain(DEAD_ADDRESS);
    expect(decoded[10]).not.toContain(mockTimelockAddress);
  });

  it('rejects standard governance when timelock tokens exceed the balance limit', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Unsafe Timelock Allocation',
        symbol: 'UTA',
        tokenURI: 'ipfs://unsafe-timelock-allocation',
        maxBalanceLimit: parseEther('50000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      /100000000000000000000000 tokens to the governance timelock.*exceeding token\.maxBalanceLimit \(50000000000000000000000\)/,
    );
  });

  it('allows no-op governance to receive tokens above the balance limit', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'No-op Timelock Allocation',
        symbol: 'NTA',
        tokenURI: 'ipfs://no-op-timelock-allocation',
        maxBalanceLimit: parseEther('50000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.governanceFactory).toBe(
      mockAddresses.noOpGovernanceFactory,
    );
    expect(decoded[10]).toContain(DEAD_ADDRESS);
  });

  it('does not use a simulated custom-governance timelock in token exclusions', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Static Token Custom Governance',
        symbol: 'SV1CGV',
        tokenURI: 'ipfs://static-token-custom-governance',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('990000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({
        type: 'custom',
        initialVotingDelay: 1,
        initialVotingPeriod: 100,
        initialProposalThreshold: parseEther('1000'),
      })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.governanceFactory).toBe(
      mockAddresses.governanceFactory,
    );
    expect(decoded[10]).not.toContain(mockTimelockAddress);
  });

  it('does not use a simulated timelock with a governance factory override', async () => {
    const customGovernanceFactory =
      '0x4444444444444444444444444444444444444444' as Address;
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Static Token Custom Governance Factory',
        symbol: 'SV1CG',
        tokenURI: 'ipfs://static-token-custom-governance-factory',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('990000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'default' })
      .withGovernanceFactory(customGovernanceFactory)
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.governanceFactory).toBe(customGovernanceFactory);
    expect(decoded[10]).not.toContain(mockTimelockAddress);
  });

  it('does not use a simulated governance timelock in dynamic token exclusions', async () => {
    const balanceLimitEnd = Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS;
    const params = DynamicAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Dynamic Token Timelock',
        symbol: 'DVT',
        tokenURI: 'ipfs://dynamic-token-timelock',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('990000'),
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
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
      .withUserAddress(userAddress)
      .build();

    const { createParams } = await factory.simulateCreateDynamicAuction(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.dopplerERC20V1Factory);
    expect(decoded[10]).not.toContain(mockTimelockAddress);
  });

  it('keeps standard cliff vesting on the DERC20 V2 route without DopplerERC20V1-specific fields', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'standard',
        name: 'Static Cliff',
        symbol: 'STCL',
        tokenURI: 'ipfs://static-cliff',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withVesting({
        duration: 180n * BigInt(DAY_SECONDS),
        cliffDuration: 90 * DAY_SECONDS,
        recipients: [beneficiary],
        amounts: [parseEther('100000')],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);

    expect(createParams.tokenFactory).toBe(mockAddresses.derc20V2Factory);
  });

  it('honors generic tokenFactory overrides on the DopplerERC20V1 path', async () => {
    const balanceLimitEnd = Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS;
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Static Token Override',
        symbol: 'SV1O',
        tokenURI: 'ipfs://static-token-override',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd,
        excludedFromBalanceLimit: [excluded],
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withTokenFactory(customTokenFactory)
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(customTokenFactory);
    expect(decoded[0]).toBe('Static Token Override');
    expect(decoded[7]).toBe(parseEther('10000'));
    expect(decoded[8]).toBe(balanceLimitEnd);
    expect(decoded[9]).toBe(zeroAddress);
    expect(decoded[10]).toEqual([getAddress(excluded)]);
  });

  it('does not inject protocol exclusions for custom tokenFactory overrides without explicit exclusions', async () => {
    const balanceLimitEnd = Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS;
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Static Token Override Empty Exclusions',
        symbol: 'SV1OE',
        tokenURI: 'ipfs://static-token-override-empty-exclusions',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withTokenFactory(customTokenFactory)
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(customTokenFactory);
    expect(decoded[0]).toBe('Static Token Override Empty Exclusions');
    expect(decoded[7]).toBe(parseEther('10000'));
    expect(decoded[8]).toBe(balanceLimitEnd);
    expect(decoded[10]).toEqual([]);
  });

  it('treats raw dopplerERC20V1Factory overrides as custom balance-limit paths', async () => {
    const balanceLimitEnd = Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS;
    const params = {
      ...StaticAuctionBuilder.forChain(1)
        .tokenConfig({
          type: 'dopplerERC20V1',
          name: 'Static Token Raw Module Override',
          symbol: 'SV1RM',
          tokenURI: 'ipfs://static-token-raw-module-override',
          maxBalanceLimit: parseEther('10000'),
          balanceLimitEnd,
        })
        .saleConfig({
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('900000'),
          numeraire: mockAddresses.weth,
        })
        .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'uniswapV2' })
        .withUserAddress(userAddress)
        .build(),
      modules: {
        dopplerERC20V1Factory: customTokenFactory,
      },
    };

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(customTokenFactory);
    expect(decoded[7]).toBe(parseEther('10000'));
    expect(decoded[8]).toBe(balanceLimitEnd);
    expect(decoded[10]).toEqual([]);
  });

  it('defaults omitted controller to the zero address on explicitly typed dynamic auctions', async () => {
    const params = DynamicAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Dynamic Token',
        symbol: 'DT',
        tokenURI: 'ipfs://dynamic-token',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
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
      .withVesting({ duration: 90n * BigInt(DAY_SECONDS) })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
      .withUserAddress(userAddress)
      .build();

    const { createParams } =
      await factory.encodeCreateDynamicAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.dopplerERC20V1Factory);
    expect(decoded[0]).toBe('Dynamic Token');
    expect(decoded[2]).toEqual([
      { cliff: 0n, duration: 90n * BigInt(DAY_SECONDS) },
    ]);
    expect(decoded[3]).toEqual([getAddress(userAddress)]);
    expect(decoded[5]).toEqual([parseEther('100000')]);
    expect(decoded[9]).toBe(zeroAddress);
  });

  it('routes dynamic auctions with exclusions through DopplerERC20V1Factory', async () => {
    const params = DynamicAuctionBuilder.forChain(1)
      .tokenConfig({
        name: 'Dynamic Inferred Token',
        symbol: 'DI',
        tokenURI: 'ipfs://dynamic-inferred-token',
        excludedFromBalanceLimit: [excluded],
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
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
      .withUserAddress(userAddress)
      .build();

    const { createParams } =
      await factory.encodeCreateDynamicAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.dopplerERC20V1Factory);
    expect(decoded[0]).toBe('Dynamic Inferred Token');
    expect(decoded[9]).toBe(zeroAddress);
    expect(decoded[10]).toEqual([getAddress(excluded)]);
  });

  it('adds the fees locker for V4 streamable-fee migrations', async () => {
    const params = DynamicAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Dynamic Streamable Fees Token',
        symbol: 'DSF',
        tokenURI: 'ipfs://dynamic-streamable-fees-token',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
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
      .withMigration({
        type: 'uniswapV4',
        fee: 3000,
        tickSpacing: 10,
        streamableFees: {
          lockDuration: 30 * DAY_SECONDS,
          beneficiaries: [{ beneficiary: userAddress, shares: WAD }],
        },
      })
      .withUserAddress(userAddress)
      .build();

    const { createParams } =
      await factory.encodeCreateDynamicAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(decoded[10]).toContain(mockAddresses.streamableFeesLocker);
  });

  it('adds the hook migrator locker for DopplerHook migrations', async () => {
    const params = DynamicAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Dynamic Hook Locker Token',
        symbol: 'DHL',
        tokenURI: 'ipfs://dynamic-hook-locker-token',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
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
      .withMigration({
        type: 'dopplerHookMigrator',
        fee: 3000,
        tickSpacing: 10,
        lockDuration: 30 * DAY_SECONDS,
        beneficiaries: [{ beneficiary: userAddress, shares: WAD }],
      })
      .withUserAddress(userAddress)
      .build();

    const { createParams } =
      await factory.encodeCreateDynamicAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(decoded[10]).toContain(mockAddresses.streamableFeesLockerV2);
  });

  it('keeps the route for shared cliff vesting on static auctions', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Static Token Cliff',
        symbol: 'SV1C',
        tokenURI: 'ipfs://static-token-cliff',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withVesting({
        duration: 90n * BigInt(DAY_SECONDS),
        cliffDuration: 30 * DAY_SECONDS,
        recipients: [beneficiary],
        amounts: [parseEther('100000')],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.dopplerERC20V1Factory);
    expect(decoded[2]).toEqual([
      { cliff: 30n * BigInt(DAY_SECONDS), duration: 90n * BigInt(DAY_SECONDS) },
    ]);
    expect(decoded[3]).toEqual([getAddress(beneficiary)]);
    expect(decoded[5]).toEqual([parseEther('100000')]);
  });

  it('routes opening auctions through DopplerERC20V1Factory', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(mockAddresses.poolManager)
      .mockResolvedValueOnce(mockAddresses.dopplerDeployer);

    const params = OpeningAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Opening Token',
        symbol: 'OT',
        tokenURI: 'ipfs://opening-token',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .openingAuctionConfig({
        auctionDuration: 3600,
        minAcceptableTickToken0: -120000,
        minAcceptableTickToken1: -120000,
        incentiveShareBps: 500,
        tickSpacing: 60,
        fee: 3000,
        minLiquidity: 1n,
        shareToAuctionBps: 8000,
      })
      .dopplerConfig({
        minProceeds: parseEther('100'),
        maxProceeds: parseEther('10000'),
        startTick: -60000,
        endTick: -120000,
        epochLength: 3600,
        duration: 7 * DAY_SECONDS,
        fee: 3000,
        tickSpacing: 10,
      })
      .withVesting({ duration: 45n * BigInt(DAY_SECONDS) })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
      .withOpeningAuctionInitializer(openingAuctionInitializer)
      .withUserAddress(userAddress)
      .build();

    const { createParams } =
      await factory.encodeCreateOpeningAuctionParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.dopplerERC20V1Factory);
    expect(decoded[0]).toBe('Opening Token');
    expect(decoded[2]).toEqual([
      { cliff: 0n, duration: 45n * BigInt(DAY_SECONDS) },
    ]);
  });

  it('does not use a simulated governance timelock in opening token exclusions', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(mockAddresses.poolManager)
      .mockResolvedValueOnce(mockAddresses.dopplerDeployer);

    const balanceLimitEnd = Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS;
    const params = OpeningAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Opening Token Timelock',
        symbol: 'OVT',
        tokenURI: 'ipfs://opening-token-timelock',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('990000'),
        numeraire: mockAddresses.weth,
      })
      .openingAuctionConfig({
        auctionDuration: 3600,
        minAcceptableTickToken0: -120000,
        minAcceptableTickToken1: -120000,
        incentiveShareBps: 500,
        tickSpacing: 60,
        fee: 3000,
        minLiquidity: 1n,
        shareToAuctionBps: 8000,
      })
      .dopplerConfig({
        minProceeds: parseEther('100'),
        maxProceeds: parseEther('10000'),
        startTick: -60000,
        endTick: -120000,
        epochLength: 3600,
        duration: 7 * DAY_SECONDS,
        fee: 3000,
        tickSpacing: 10,
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 10 })
      .withOpeningAuctionInitializer(openingAuctionInitializer)
      .withUserAddress(userAddress)
      .build();

    const { createParams } = await factory.simulateCreateOpeningAuction(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.dopplerERC20V1Factory);
    expect(decoded[10]).not.toContain(mockTimelockAddress);
  });

  it('routes multicurve auctions through DopplerERC20V1Factory', () => {
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Multicurve Token',
        symbol: 'MV1',
        tokenURI: 'ipfs://multicurve-token',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('700000'),
        numeraire: mockAddresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 80000, numPositions: 8, shares: WAD },
        ],
      })
      .withVesting({
        allocations: [
          {
            recipient: beneficiary,
            amount: parseEther('300000'),
            schedule: {
              duration: 365n * BigInt(DAY_SECONDS),
              cliffDuration: 30 * DAY_SECONDS,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = factory.encodeCreateMulticurveParams(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.dopplerERC20V1Factory);
    expect(decoded[0]).toBe('Multicurve Token');
    expect(decoded[2]).toEqual([
      {
        cliff: 30n * BigInt(DAY_SECONDS),
        duration: 365n * BigInt(DAY_SECONDS),
      },
    ]);
    expect(decoded[3]).toEqual([getAddress(beneficiary)]);
    expect(decoded[4]).toEqual([0n]);
    expect(decoded[5]).toEqual([parseEther('300000')]);
  });

  it('excludes the dev-buy recipient and active Bundler custody', () => {
    const build = (vestingDuration: bigint) =>
      MulticurveBuilder.forChain(1)
        .tokenConfig({
          type: 'dopplerERC20V1',
          name: 'Custody Token',
          symbol: 'CUST',
          tokenURI: 'ipfs://custody-token',
          maxBalanceLimit: parseEther('10000'),
          balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
        })
        .saleConfig({
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('700000'),
          numeraire: mockAddresses.weth,
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
          beneficiaries: [
            { beneficiary: userAddress, shares: parseEther('1') },
          ],
        })
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'noOp' })
        .withUserAddress(userAddress)
        .withDevBuy({
          exactAmountIn: 1n,
          recipient: beneficiary,
          ...(vestingDuration === 0n ? {} : { vesting: { vestingDuration } }),
        })
        .build();

    const vested = decodeV1TokenFactoryData(
      factory.encodeCreateMulticurveParams(build(86_400n)).tokenFactoryData,
    );
    const direct = decodeV1TokenFactoryData(
      factory.encodeCreateMulticurveParams(build(0n)).tokenFactoryData,
    );

    expect(vested[10]).toContain(getAddress(beneficiary));
    expect(vested[10]).toContain(mockAddresses.bundler);
    expect(direct[10]).toContain(getAddress(beneficiary));
    expect(direct[10]).not.toContain(mockAddresses.bundler);
  });
  it('does not use a simulated governance timelock in multicurve token exclusions', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(mockHookAddress);

    const balanceLimitEnd = Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS;
    const params = MulticurveBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Multicurve Token Timelock',
        symbol: 'MVT',
        tokenURI: 'ipfs://multicurve-token-timelock',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('990000'),
        numeraire: mockAddresses.weth,
      })
      .poolConfig({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 80000, numPositions: 8, shares: WAD },
        ],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const { createParams } = await factory.simulateCreateMulticurve(params);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(createParams.tokenFactory).toBe(mockAddresses.dopplerERC20V1Factory);
    expect(decoded[10]).not.toContain(mockTimelockAddress);
  });

  it('rejects zero beneficiary allocations', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Allocation',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-allocation',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: 1n,
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withVesting({
        allocations: [
          {
            recipient: zeroAddress,
            amount: parseEther('1'),
            schedule: {
              duration: BigInt(DAY_SECONDS),
              cliffDuration: 0,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.vesting allocations[0].beneficiary must not be the zero address',
    );
  });

  it('rejects zero amount allocations', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Allocation',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-allocation',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: 1n,
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withVesting({
        allocations: [
          {
            recipient: beneficiary,
            amount: 0n,
            schedule: {
              duration: BigInt(DAY_SECONDS),
              cliffDuration: 0,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.vesting allocations[0].amount must be greater than 0',
    );
  });

  it('rejects per-beneficiary premint cap breaches', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Allocation',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-allocation',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: 1n,
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withVesting({
        allocations: [
          {
            recipient: beneficiary,
            amount: parseEther('800000.000000000000001'),
            schedule: {
              duration: BigInt(DAY_SECONDS),
              cliffDuration: 0,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.vesting allocations[0] exceed the per-beneficiary premint cap',
    );
  });

  it('rejects mixed-case duplicate beneficiary allocations', async () => {
    const mixedCaseBeneficiary =
      '0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCd' as Address;

    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Allocation',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-allocation',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: 1n,
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withVesting({
        allocations: [
          {
            recipient: mixedCaseBeneficiary,
            amount: parseEther('500000'),
            schedule: {
              duration: BigInt(DAY_SECONDS),
              cliffDuration: 0,
            },
          },
          {
            recipient: mixedCaseBeneficiary.toLowerCase() as Address,
            amount: parseEther('300000.000000000000001'),
            schedule: {
              duration: BigInt(DAY_SECONDS),
              cliffDuration: 0,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.vesting allocations[1] exceed the per-beneficiary premint cap',
    );
  });

  it('rejects total premint cap breaches', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Allocation',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-allocation',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: 1n,
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withVesting({
        allocations: [
          {
            recipient: beneficiary,
            amount: parseEther('500000'),
            schedule: {
              duration: BigInt(DAY_SECONDS),
              cliffDuration: 0,
            },
          },
          {
            recipient: controller,
            amount: parseEther('300000.000000000000001'),
            schedule: {
              duration: BigInt(DAY_SECONDS),
              cliffDuration: 0,
            },
          },
        ],
      })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow('token.vesting allocations exceed the total premint cap');
  });

  it('rejects only maxBalanceLimit without balanceLimitEnd', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Limit',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-limit',
        maxBalanceLimit: parseEther('10000'),
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.maxBalanceLimit and token.balanceLimitEnd must both be set when balance limiting is enabled',
    );
  });

  it('allows no-op launches when timelock tokens exceed the balance limit', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Static Token Excess',
        symbol: 'SV1E',
        tokenURI: 'ipfs://static-token-excess',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 3600,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    const createParams = await factory.encodeCreateStaticAuctionParams(params);
    const tokenAddress = computeV1TokenAddress(createParams.salt);
    const decoded = decodeV1TokenFactoryData(createParams.tokenFactoryData);

    expect(decoded[10]).toEqual([
      mockAddresses.v3Initializer,
      mockAddresses.v2Migrator,
      DEAD_ADDRESS,
      computeUniswapV3PoolAddress(tokenAddress, mockAddresses.weth, 3000),
      computeUniswapV2PairAddress(mockAddresses.weth, tokenAddress),
    ]);
  });

  it('rejects only balanceLimitEnd without maxBalanceLimit', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Limit',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-limit',
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 3600,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.maxBalanceLimit and token.balanceLimitEnd must both be set when balance limiting is enabled',
    );
  });

  it('rejects zero maxBalanceLimit with future balanceLimitEnd', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Limit',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-limit',
        maxBalanceLimit: 0n,
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 3600,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.maxBalanceLimit and token.balanceLimitEnd must both be set when balance limiting is enabled',
    );
  });

  it('rejects positive maxBalanceLimit with zero balanceLimitEnd', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Limit',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-limit',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: 0,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.maxBalanceLimit and token.balanceLimitEnd must both be set when balance limiting is enabled',
    );
  });

  it('rejects maxBalanceLimit equal to initialSupply', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Limit',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-limit',
        maxBalanceLimit: parseEther('1000000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 3600,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.maxBalanceLimit must be below sale.initialSupply when balance limiting is enabled',
    );
  });

  it('rejects maxBalanceLimit greater than initialSupply', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Limit',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-limit',
        maxBalanceLimit: parseEther('1000001'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) + 3600,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.maxBalanceLimit must be below sale.initialSupply when balance limiting is enabled',
    );
  });

  it('rejects expired balanceLimitEnd with positive maxBalanceLimit', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Limit',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-limit',
        maxBalanceLimit: parseEther('10000'),
        balanceLimitEnd: Math.floor(Date.now() / 1000) - 1,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow(
      'token.balanceLimitEnd must be in the future when balance limiting is enabled',
    );
  });

  it('rejects incompatible balance limit end values', async () => {
    const params = StaticAuctionBuilder.forChain(1)
      .tokenConfig({
        type: 'dopplerERC20V1',
        name: 'Bad Limit',
        symbol: 'BAD',
        tokenURI: 'ipfs://bad-limit',
        balanceLimitEnd: Number.MAX_SAFE_INTEGER,
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('900000'),
        numeraire: mockAddresses.weth,
      })
      .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
      .withGovernance({ type: 'noOp' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(userAddress)
      .build();

    await expect(
      factory.encodeCreateStaticAuctionParams(params),
    ).rejects.toThrow('token.balanceLimitEnd must fit in uint48');
  });
});
