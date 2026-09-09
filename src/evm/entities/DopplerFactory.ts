import {
  BaseError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  type Address,
  type Hex,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Account,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  keccak256,
  getAddress,
  decodeEventLog,
  decodeAbiParameters,
  toHex,
  erc20Abi,
} from 'viem';
import type {
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateOpeningAuctionParams,
  CreateMulticurveParams,
  DopplerHookMigratorConfig,
  DopplerHookMigrationConfig,
  MigrationConfig,
  SupportedPublicClient,
  TokenConfig,
  Doppler404TokenConfig,
  DopplerERC20V1TokenConfig,
  InferredDopplerERC20V1TokenConfig,
  StandardTokenConfig,
  SaleConfig,
  VestingConfig,
  SupportedChainId,
  CreateParams,
  V4PoolKey,
  MulticurveCreateResult,
  MulticurveDevBuyConfig,
  PreparedMulticurveDevBuy,
  SimulatedMulticurveCreate,
  RehypeDopplerHookInitializerConfig,
  OpeningAuctionState,
  OpeningAuctionCreateResult,
  OpeningAuctionCompleteResult,
  GovernanceOption,
  ProceedsSplitConfig,
  StreamableFeesConfig,
} from '../types';
import type {
  MulticurveCreateGasEstimate,
  MulticurveCreatePrediction,
  PrepareCreateMulticurveOptions,
  PreparedMulticurveCreate,
} from '../types';
import type { ModuleAddressOverrides } from '../types';
import { assertTokenConfigSupportsYearlyMintRate } from '../builders/shared';
import { CHAIN_IDS, getAddresses } from '../addresses';
import {
  ZERO_ADDRESS,
  DEAD_ADDRESS,
  WAD,
  DEFAULT_PD_SLUGS,
  FLAG_MASK,
  DOPPLER_FLAGS,
  OPENING_AUCTION_FLAGS,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DEFAULT_V3_INITIAL_VOTING_DELAY,
  DEFAULT_V3_INITIAL_VOTING_PERIOD,
  DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_CREATE_GAS_LIMIT,
  TICK_SPACINGS,
  DOPPLER_MAX_TICK_SPACING,
  DYNAMIC_FEE_FLAG,
  DECAY_MAX_START_FEE,
  V4_MAX_FEE,
  OPENING_AUCTION_PHASE_SETTLED,
  OPENING_AUCTION_STATUS_ACTIVE,
  INT24_MIN,
  INT24_MAX,
  MAX_UINT64,
  MAX_UINT128,
  MIN_BUNDLER_VESTING_DURATION,
} from '../constants';
import {
  computeOptimalGamma,
  getMaxLiquiditySafeMulticurveTickUpper,
  MIN_TICK,
  MAX_TICK,
  isToken0Expected,
  sortBeneficiaries,
  verifyPreparedCreateReceipt,
  encodeRehypeDopplerHookInitializerData,
  normalizeRehypeDopplerHookInitializerConfig,
} from '../utils';
import {
  airlockAbi,
  bundlerAbi,
  DERC20Bytecode,
  DERC2080Bytecode,
  DopplerBytecode,
  OpeningAuctionBytecode,
  v4MulticurveInitializerAbi,
  openingAuctionAbi,
  openingAuctionInitializerAbi,
  rehypeDopplerHookInitializerAbi,
} from '../abis';
import { getDopplerDN404Bytecode } from '../utils/tokenAddressMiner';

// Type definition for the custom migration encoder function
export type MigrationEncoder = (config: MigrationConfig) => Hex;

const MAX_PROCEEDS_SPLIT_SHARE = WAD / 2n;

function isDopplerHookMigratorConfig(
  config: MigrationConfig,
): config is DopplerHookMigratorConfig | DopplerHookMigrationConfig {
  return config.type === 'dopplerHookMigrator' || config.type === 'dopplerHook';
}
const DERC20_V1_MAX_PREMINT_WAD = (WAD * 8n) / 10n;
const ONE_MILLION = 1_000_000n;
// Auto-mined completion can race with on-chain state changes; keep retries bounded.
const MAX_COMPLETION_ATTEMPTS = 3;
const UNISWAP_V2_PAIR_INIT_CODE_HASH =
  '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f' as const;
const UNISWAP_V3_POOL_INIT_CODE_HASH =
  '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54' as const;

const erc20BalanceOfAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
  },
] as const;

// TokenFactory80 has the same deterministic CREATE2 address across all chains
const TOKEN_FACTORY_80_ADDRESS =
  '0xf0b5141dd9096254b2ca624dff26024f46087229' as const;

type ResolvedMulticurveInitializerMode =
  | { type: 'standard' }
  | { type: 'scheduled'; startTime: number }
  | {
      type: 'decay';
      startTime: number;
      startFee: number;
      durationSeconds: number;
    }
  | {
      type: 'dopplerHook';
      hookConfig?: RehypeDopplerHookInitializerConfig;
    };

type StandardTokenFactoryMode = 'legacy' | 'v2';

type InternalCreateGasEstimate =
  | { status: 'estimated'; gas: bigint }
  | { status: 'unavailable' }
  | { status: 'reverted'; error: unknown };
type TokenFactoryVariant =
  | 'standard'
  | 'standard-v2'
  | 'dopplerERC20V1'
  | 'doppler404';

type LegacyStandardTokenFactoryData = {
  kind: 'legacy';
  name: string;
  symbol: string;
  initialSupply: bigint;
  airlock: Address;
  yearlyMintRate: bigint;
  vestingDuration: bigint;
  recipients: Address[];
  amounts: bigint[];
  tokenURI: string;
};

type V2VestingSchedule = {
  cliff: bigint;
  duration: bigint;
};

type V2StandardTokenFactoryData = {
  kind: 'v2';
  name: string;
  symbol: string;
  initialSupply: bigint;
  airlock: Address;
  yearlyMintRate: bigint;
  schedules: V2VestingSchedule[];
  beneficiaries: Address[];
  scheduleIds: bigint[];
  amounts: bigint[];
  tokenURI: string;
  implementation: Address;
};

type StandardTokenFactoryData =
  | LegacyStandardTokenFactoryData
  | V2StandardTokenFactoryData;

type DopplerERC20V1TokenFactoryData = {
  kind: 'dopplerERC20V1';
  name: string;
  symbol: string;
  schedules: V2VestingSchedule[];
  beneficiaries: Address[];
  scheduleIds: bigint[];
  amounts: bigint[];
  tokenURI: string;
  maxBalanceLimit: bigint;
  balanceLimitEnd: number;
  controller: Address;
  excludedFromBalanceLimit: Address[];
  implementation: Address;
};

const DERC20_V2_MIN_VESTING_DURATION = 24 * 60 * 60;
const MAX_UINT48 = (1n << 48n) - 1n;

export class DopplerFactory<C extends SupportedChainId = SupportedChainId> {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  private chainId: C;
  private customMigrationEncoder?: MigrationEncoder;

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    chainId: C,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.chainId = chainId;
  }

  private hasCustomV2Schedules(vesting?: VestingConfig): boolean {
    return (vesting?.allocations?.length ?? 0) > 0;
  }

  private usesDerc20V2Vesting(vesting?: VestingConfig): boolean {
    if (!vesting) {
      return false;
    }

    return (
      this.hasCustomV2Schedules(vesting) || (vesting.cliffDuration ?? 0) > 0
    );
  }

  private resolveVestingAllocations(args: {
    sale: SaleConfig;
    vesting?: VestingConfig;
    userAddress: Address;
  }): { recipients: Address[]; amounts: bigint[] } {
    if (!args.vesting) {
      return { recipients: [], amounts: [] };
    }

    if (args.vesting.allocations) {
      return {
        recipients: args.vesting.allocations.map(
          (allocation) => allocation.recipient,
        ),
        amounts: args.vesting.allocations.map(
          (allocation) => allocation.amount,
        ),
      };
    }

    if (args.vesting.recipients && args.vesting.amounts) {
      return {
        recipients: args.vesting.recipients,
        amounts: args.vesting.amounts,
      };
    }

    return {
      recipients: [args.userAddress],
      amounts: [args.sale.initialSupply - args.sale.numTokensToSell],
    };
  }

  private validateDopplerERC20V1TokenFactoryData(args: {
    sale: SaleConfig;
    recipients: Address[];
    amounts: bigint[];
    schedules: V2VestingSchedule[];
    scheduleIds: bigint[];
  }): void {
    if (
      args.recipients.length !== args.amounts.length ||
      args.recipients.length !== args.scheduleIds.length
    ) {
      throw new Error(
        'token.vesting allocations, amounts, and scheduleIds arrays must ' +
          'have the same length',
      );
    }

    for (const [index, schedule] of args.schedules.entries()) {
      if (
        (schedule.duration !== 0n &&
          schedule.duration < BigInt(DERC20_V2_MIN_VESTING_DURATION)) ||
        schedule.cliff > schedule.duration
      ) {
        throw new Error(
          `token.vesting schedules[${index}] must have duration 0 or ` +
            `at least ${DERC20_V2_MIN_VESTING_DURATION} seconds, with cliff ` +
            `less than or equal to duration`,
        );
      }
    }

    const premintCap =
      (args.sale.initialSupply * DERC20_V1_MAX_PREMINT_WAD) / WAD;
    const allocatedTotals = new Map<string, bigint>();
    let totalVested = 0n;

    for (const [index, beneficiary] of args.recipients.entries()) {
      const amount = args.amounts[index];
      const scheduleId = args.scheduleIds[index];

      if (beneficiary === ZERO_ADDRESS) {
        throw new Error(
          `token.vesting allocations[${index}].beneficiary must not be the ` +
            'zero address',
        );
      }

      if (amount <= 0n) {
        throw new Error(
          `token.vesting allocations[${index}].amount must be greater than ` +
            '0',
        );
      }

      if (scheduleId >= BigInt(args.schedules.length)) {
        throw new Error(
          `token.vesting allocations[${index}].scheduleId must reference ` +
            'an existing schedule',
        );
      }

      const beneficiaryKey = beneficiary.toLowerCase();
      const totalAllocated =
        (allocatedTotals.get(beneficiaryKey) ?? 0n) + amount;
      allocatedTotals.set(beneficiaryKey, totalAllocated);

      if (totalAllocated > premintCap) {
        throw new Error(
          `token.vesting allocations[${index}] exceed the per-beneficiary ` +
            'premint cap',
        );
      }

      totalVested += amount;
    }

    if (totalVested > premintCap) {
      throw new Error('token.vesting allocations exceed the total premint cap');
    }

    if (totalVested > args.sale.initialSupply) {
      throw new Error('token.vesting allocations exceed sale.initialSupply');
    }
  }

  private validateUint64LikeNumber(
    value: number,
    fieldPath: string,
    options: { allowZero?: boolean } = {},
  ): void {
    const { allowZero = true } = options;
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`${fieldPath} must be a finite integer`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${fieldPath} must be a safe integer`);
    }
    if (value < 0) {
      throw new Error(`${fieldPath} cannot be negative`);
    }
    if (!allowZero && value === 0) {
      throw new Error(`${fieldPath} must be greater than zero`);
    }
    if (BigInt(value) > MAX_UINT64) {
      throw new Error(`${fieldPath} must fit in uint64`);
    }
  }

  private validateUint48LikeNumber(value: number, fieldPath: string): void {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`${fieldPath} must be a finite integer`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${fieldPath} must be a safe integer`);
    }
    if (value < 0) {
      throw new Error(`${fieldPath} cannot be negative`);
    }
    if (BigInt(value) > MAX_UINT48) {
      throw new Error(`${fieldPath} must fit in uint48`);
    }
  }

  private resolveDopplerERC20V1TokenFactoryData(args: {
    token: DopplerERC20V1TokenConfig | InferredDopplerERC20V1TokenConfig;
    sale: SaleConfig;
    vesting?: VestingConfig;
    userAddress: Address;
    addresses: ReturnType<typeof getAddresses>;
    modules?: ModuleAddressOverrides;
    governance: GovernanceOption<C>;
    protocolBalanceLimitExclusions?: (Address | undefined)[];
  }): DopplerERC20V1TokenFactoryData {
    const implementation = args.addresses.dopplerERC20V1Implementation;
    if (!implementation || implementation === ZERO_ADDRESS) {
      throw new Error(
        'DopplerERC20V1 implementation address not configured for this chain.',
      );
    }

    const maxBalanceLimit = args.token.maxBalanceLimit ?? 0n;
    const balanceLimitEnd = args.token.balanceLimitEnd ?? 0;
    this.validateUint48LikeNumber(balanceLimitEnd, 'token.balanceLimitEnd');

    const balanceLimitEnabled = maxBalanceLimit > 0n || balanceLimitEnd > 0;
    if (
      balanceLimitEnabled &&
      (maxBalanceLimit === 0n || balanceLimitEnd === 0)
    ) {
      throw new Error(
        'token.maxBalanceLimit and token.balanceLimitEnd must both be set when balance limiting is enabled',
      );
    }

    if (balanceLimitEnabled && maxBalanceLimit >= args.sale.initialSupply) {
      throw new Error(
        'token.maxBalanceLimit must be below sale.initialSupply when balance limiting is enabled',
      );
    }

    if (
      balanceLimitEnabled &&
      balanceLimitEnd <= Math.floor(Date.now() / 1000)
    ) {
      throw new Error(
        'token.balanceLimitEnd must be in the future when balance limiting is enabled',
      );
    }

    const { recipients, amounts } = this.resolveVestingAllocations(args);
    const { schedules, scheduleIds } = this.resolveV2VestingSchedules({
      vesting: args.vesting,
      recipientCount: recipients.length,
    });

    this.validateDopplerERC20V1TokenFactoryData({
      sale: args.sale,
      recipients,
      amounts,
      schedules,
      scheduleIds,
    });
    if (
      balanceLimitEnabled &&
      args.governance.type !== 'noOp' &&
      args.governance.type !== 'launchpad'
    ) {
      const allocatedTokens = amounts.reduce(
        (total, amount) => total + amount,
        0n,
      );
      const timelockTokens =
        args.sale.initialSupply - args.sale.numTokensToSell - allocatedTokens;
      if (timelockTokens > maxBalanceLimit) {
        throw new Error(
          `Standard governance would transfer ${timelockTokens} tokens to ` +
            `the governance timelock at creation, exceeding ` +
            `token.maxBalanceLimit (${maxBalanceLimit}). Increase ` +
            `sale.numTokensToSell, add vesting allocations, increase the ` +
            `balance limit, or use no-op or launchpad governance.`,
        );
      }
    }

    return {
      kind: 'dopplerERC20V1',
      name: args.token.name,
      symbol: args.token.symbol,
      schedules,
      beneficiaries: recipients,
      scheduleIds,
      amounts,
      tokenURI: args.token.tokenURI,
      maxBalanceLimit,
      balanceLimitEnd,
      controller: args.token.controller ?? ZERO_ADDRESS,
      excludedFromBalanceLimit: this.mergeDopplerERC20V1BalanceLimitExclusions(
        args.token.excludedFromBalanceLimit,
        balanceLimitEnabled ? args.protocolBalanceLimitExclusions : undefined,
      ),
      implementation,
    };
  }

  private isDopplerERC20V1BalanceLimitActive(
    tokenFactoryData: Pick<
      DopplerERC20V1TokenFactoryData,
      'maxBalanceLimit' | 'balanceLimitEnd'
    >,
  ): boolean {
    return (
      tokenFactoryData.maxBalanceLimit > 0n ||
      tokenFactoryData.balanceLimitEnd > 0
    );
  }

  private usesDefaultDopplerERC20V1Integration(
    modules?: ModuleAddressOverrides,
  ): boolean {
    return !modules?.tokenFactory && !modules?.dopplerERC20V1Factory;
  }

  private resolveGovernanceBalanceLimitExclusions(
    governance: GovernanceOption<C>,
  ): Address[] {
    if (governance.type === 'noOp') {
      return [DEAD_ADDRESS];
    }
    if (governance.type === 'launchpad') {
      return [governance.multisig];
    }
    return [];
  }

  private governanceDuration(token: TokenConfig, seconds: number): number {
    // DERC20 and DERC20V2 use block.number; DopplerERC20V1 uses timestamps.
    // Nominal clock cadence only; custom deployments/cadence changes must use
    // explicit custom governance values rather than relying on this estimate.
    if (token.type !== 'standard') {
      return seconds;
    }

    switch (this.chainId) {
      case CHAIN_IDS.MAINNET:
      case CHAIN_IDS.ARBITRUM: // Solidity block.number follows L1, not L2 blocks.
        return Math.ceil(seconds / 12);
      case CHAIN_IDS.BASE:
      case CHAIN_IDS.BASE_SEPOLIA:
        return Math.ceil(seconds / 2);
      case CHAIN_IDS.INK:
      case CHAIN_IDS.UNICHAIN:
      case CHAIN_IDS.UNICHAIN_SEPOLIA:
        // Canonical 1s blocks, not Flashblock/preconfirmation intervals.
        return seconds;
      case CHAIN_IDS.MONAD_MAINNET:
      case CHAIN_IDS.MONAD_TESTNET:
        return Math.ceil((seconds * 1_000) / 400);
      default:
        throw new Error(
          'Legacy token governance clock cadence is unknown on this chain. Use custom governance with explicit token-clock voting delay and period.',
        );
    }
  }

  private resolveGovernanceFactoryAddress(args: {
    governance: GovernanceOption<C>;
    modules?: ModuleAddressOverrides;
    addresses: ReturnType<typeof getAddresses>;
    noOpError: string;
    launchpadError: string;
    standardError: string;
  }): Address {
    if (args.governance.type === 'noOp') {
      const resolved =
        args.modules?.governanceFactory ??
        args.addresses.noOpGovernanceFactory ??
        ZERO_ADDRESS;
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error(args.noOpError);
      }
      return resolved;
    }

    if (args.governance.type === 'launchpad') {
      const resolved =
        args.modules?.governanceFactory ??
        args.addresses.launchpadGovernanceFactory ??
        ZERO_ADDRESS;
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error(args.launchpadError);
      }
      return resolved;
    }

    const resolved =
      args.modules?.governanceFactory ?? args.addresses.governanceFactory;
    if (!resolved || resolved === ZERO_ADDRESS) {
      throw new Error(args.standardError);
    }
    return resolved;
  }

  private resolveMigrationLockerBalanceLimitExclusions(
    migration: MigrationConfig,
    addresses: ReturnType<typeof getAddresses>,
  ): (Address | undefined)[] {
    if (
      (migration.type === 'uniswapV4' || migration.type === 'uniswapV4Split') &&
      migration.streamableFees
    ) {
      return [addresses.streamableFeesLocker];
    }

    if (isDopplerHookMigratorConfig(migration)) {
      return [
        addresses.streamableFeesLockerV2 ?? addresses.streamableFeesLocker,
      ];
    }

    return [];
  }

  private withDopplerERC20V1BalanceLimitExclusions(
    tokenFactoryData: DopplerERC20V1TokenFactoryData,
    exclusions: readonly (Address | undefined)[],
  ): DopplerERC20V1TokenFactoryData {
    if (!this.isDopplerERC20V1BalanceLimitActive(tokenFactoryData)) {
      return { ...tokenFactoryData };
    }

    return {
      ...tokenFactoryData,
      excludedFromBalanceLimit: this.mergeDopplerERC20V1BalanceLimitExclusions(
        tokenFactoryData.excludedFromBalanceLimit,
        exclusions,
      ),
    };
  }

  private deriveCreate2Address(args: {
    deployer: Address;
    salt: Hex;
    initCodeHash: Hash;
  }): Address {
    const hash = keccak256(
      `0xff${args.deployer.slice(2)}${args.salt.slice(2)}${args.initCodeHash.slice(
        2,
      )}` as Hex,
    );
    return getAddress(`0x${hash.slice(-40)}`) as Address;
  }

  private predictDopplerERC20V1TokenAddress(args: {
    tokenFactory: Address;
    salt: Hex;
    implementation: Address;
  }): Address {
    return this.deriveCreate2Address({
      deployer: args.tokenFactory,
      salt: args.salt,
      initCodeHash: this.computeSoladyCloneInitCodeHash(args.implementation),
    });
  }

  private computeUniswapV2PairAddress(args: {
    factory: Address;
    tokenA: Address;
    tokenB: Address;
  }): Address {
    const [token0, token1] =
      BigInt(args.tokenA) < BigInt(args.tokenB)
        ? [args.tokenA, args.tokenB]
        : [args.tokenB, args.tokenA];
    const salt = keccak256(
      encodePacked(['address', 'address'], [token0, token1]),
    );
    return this.deriveCreate2Address({
      deployer: args.factory,
      salt,
      initCodeHash: UNISWAP_V2_PAIR_INIT_CODE_HASH,
    });
  }

  private computeUniswapV3PoolAddress(args: {
    factory: Address;
    tokenA: Address;
    tokenB: Address;
    fee: number;
  }): Address {
    const [token0, token1] =
      BigInt(args.tokenA) < BigInt(args.tokenB)
        ? [args.tokenA, args.tokenB]
        : [args.tokenB, args.tokenA];
    const salt = keccak256(
      encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }],
        [token0, token1, args.fee],
      ),
    );
    return this.deriveCreate2Address({
      deployer: args.factory,
      salt,
      initCodeHash: UNISWAP_V3_POOL_INIT_CODE_HASH,
    });
  }

  private resolveStaticV3PoolExclusion(args: {
    addresses: ReturnType<typeof getAddresses>;
    tokenAddress: Address;
    numeraire: Address;
    fee: number;
  }): Address | undefined {
    if (!args.addresses.uniswapV3Factory) {
      return undefined;
    }

    return this.computeUniswapV3PoolAddress({
      factory: args.addresses.uniswapV3Factory,
      tokenA: args.tokenAddress,
      tokenB: args.numeraire,
      fee: args.fee,
    });
  }

  private resolveUniswapV2MigrationPairExclusion(args: {
    migration: MigrationConfig;
    addresses: ReturnType<typeof getAddresses>;
    tokenAddress: Address;
    numeraire: Address;
  }): Address | undefined {
    if (
      (args.migration.type !== 'uniswapV2' &&
        args.migration.type !== 'uniswapV2Split') ||
      !args.addresses.uniswapV2Factory
    ) {
      return undefined;
    }

    return this.computeUniswapV2PairAddress({
      factory: args.addresses.uniswapV2Factory,
      tokenA: args.tokenAddress,
      tokenB: args.numeraire,
    });
  }

  private mergeDopplerERC20V1BalanceLimitExclusions(
    userExclusions: readonly Address[] | undefined,
    protocolExclusions: readonly (Address | undefined)[] | undefined,
  ): Address[] {
    const exclusions: Address[] = [];
    const seen = new Set<string>();

    for (const address of [
      ...(userExclusions ?? []),
      ...(protocolExclusions ?? []),
    ]) {
      if (!address || address === ZERO_ADDRESS) {
        continue;
      }
      const key = address.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      exclusions.push(address);
    }

    return exclusions;
  }

  private resolveV2VestingSchedules(args: {
    vesting?: VestingConfig;
    recipientCount: number;
  }): {
    schedules: V2VestingSchedule[];
    scheduleIds: bigint[];
  } {
    if (!args.vesting) {
      return { schedules: [], scheduleIds: [] };
    }

    if (!this.hasCustomV2Schedules(args.vesting)) {
      return {
        schedules: [
          {
            cliff: BigInt(args.vesting.cliffDuration ?? 0),
            duration: BigInt(args.vesting.duration ?? 0),
          },
        ],
        scheduleIds: Array.from({ length: args.recipientCount }, () => 0n),
      };
    }

    const schedules: V2VestingSchedule[] = [];
    const scheduleIds: bigint[] = [];
    const scheduleIdsByKey = new Map<string, bigint>();

    for (const allocation of args.vesting.allocations ?? []) {
      const cliff = BigInt(allocation.schedule.cliffDuration ?? 0);
      const duration = BigInt(allocation.schedule.duration ?? 0);
      const key = `${cliff}:${duration}`;
      let scheduleId = scheduleIdsByKey.get(key);
      if (scheduleId === undefined) {
        scheduleId = BigInt(schedules.length);
        schedules.push({ cliff, duration });
        scheduleIdsByKey.set(key, scheduleId);
      }
      scheduleIds.push(scheduleId);
    }

    return { schedules, scheduleIds };
  }

  private resolveStandardTokenFactoryMode(args: {
    vesting?: VestingConfig;
    tokenFactory: Address;
    addresses: ReturnType<typeof getAddresses>;
  }): StandardTokenFactoryMode {
    if (this.usesDerc20V2Vesting(args.vesting)) {
      return 'v2';
    }

    const v2Factory = args.addresses.derc20V2Factory;
    if (
      v2Factory &&
      args.tokenFactory.toLowerCase() === v2Factory.toLowerCase()
    ) {
      return 'v2';
    }

    return 'legacy';
  }

  private assertStandardTokenFactoryCompatibility(args: {
    token: TokenConfig;
    vesting?: VestingConfig;
    tokenFactory: Address;
    addresses: ReturnType<typeof getAddresses>;
  }): void {
    if (
      this.isDoppler404Token(args.token) ||
      this.isDopplerERC20V1Token(args.token) ||
      !this.usesDerc20V2Vesting(args.vesting)
    ) {
      return;
    }

    const v2Factory = args.addresses.derc20V2Factory;
    if (!v2Factory || v2Factory === ZERO_ADDRESS) {
      throw new Error(
        'Cliff vesting requires the DERC20 V2 factory, but no V2 factory is configured for this chain.',
      );
    }

    if (args.tokenFactory.toLowerCase() !== v2Factory.toLowerCase()) {
      throw new Error(
        'Cliff vesting requires the DERC20 V2 factory. Remove the tokenFactory override or point it at the chain DERC20 V2 factory.',
      );
    }
  }

  private assertDoppler404Compatibility(args: {
    token: TokenConfig;
    vesting?: VestingConfig;
    configuredFactory?: Address;
  }): void {
    if (!this.isDoppler404Token(args.token)) {
      return;
    }

    if (!args.configuredFactory || args.configuredFactory === ZERO_ADDRESS) {
      throw new Error(
        'Doppler404 factory address not configured for this chain',
      );
    }

    if (args.vesting !== undefined) {
      throw new Error('Doppler404 tokens do not support vesting');
    }
  }

  private buildStandardTokenFactoryData(args: {
    token: StandardTokenConfig;
    sale: SaleConfig;
    vesting?: VestingConfig;
    userAddress: Address;
    airlock: Address;
    tokenFactory: Address;
    addresses: ReturnType<typeof getAddresses>;
  }): StandardTokenFactoryData {
    const { recipients, amounts } = this.resolveVestingAllocations(args);
    const yearlyMintRate =
      args.token.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE;
    const mode = this.resolveStandardTokenFactoryMode({
      vesting: args.vesting,
      tokenFactory: args.tokenFactory,
      addresses: args.addresses,
    });

    if (mode === 'v2') {
      const implementation = args.addresses.derc20V2Implementation;
      if (!implementation || implementation === ZERO_ADDRESS) {
        throw new Error(
          'DERC20 V2 implementation address not configured for this chain.',
        );
      }

      const { schedules, scheduleIds } = this.resolveV2VestingSchedules({
        vesting: args.vesting,
        recipientCount: recipients.length,
      });

      return {
        kind: 'v2',
        name: args.token.name,
        symbol: args.token.symbol,
        initialSupply: args.sale.initialSupply,
        airlock: args.airlock,
        yearlyMintRate,
        schedules,
        beneficiaries: recipients,
        scheduleIds,
        amounts,
        tokenURI: args.token.tokenURI,
        implementation,
      };
    }

    return {
      kind: 'legacy',
      name: args.token.name,
      symbol: args.token.symbol,
      initialSupply: args.sale.initialSupply,
      airlock: args.airlock,
      yearlyMintRate,
      vestingDuration: BigInt(args.vesting?.duration ?? 0),
      recipients,
      amounts,
      tokenURI: args.token.tokenURI,
    };
  }

  private encodeStandardTokenFactoryData(
    tokenFactoryData: StandardTokenFactoryData,
  ): Hex {
    if (tokenFactoryData.kind === 'v2') {
      return encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
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
        ],
        [
          tokenFactoryData.name,
          tokenFactoryData.symbol,
          tokenFactoryData.yearlyMintRate,
          tokenFactoryData.schedules.map((schedule) => ({
            cliff: schedule.cliff,
            duration: schedule.duration,
          })),
          tokenFactoryData.beneficiaries,
          tokenFactoryData.scheduleIds,
          tokenFactoryData.amounts,
          tokenFactoryData.tokenURI,
        ],
      );
    }

    return encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address[]' },
        { type: 'uint256[]' },
        { type: 'string' },
      ],
      [
        tokenFactoryData.name,
        tokenFactoryData.symbol,
        tokenFactoryData.yearlyMintRate,
        tokenFactoryData.vestingDuration,
        tokenFactoryData.recipients,
        tokenFactoryData.amounts,
        tokenFactoryData.tokenURI,
      ],
    );
  }

  private encodeDopplerERC20V1TokenFactoryData(
    tokenFactoryData: DopplerERC20V1TokenFactoryData,
  ): Hex {
    return encodeAbiParameters(
      [
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
      ],
      [
        tokenFactoryData.name,
        tokenFactoryData.symbol,
        tokenFactoryData.schedules.map((schedule) => ({
          cliff: schedule.cliff,
          duration: schedule.duration,
        })),
        tokenFactoryData.beneficiaries,
        tokenFactoryData.scheduleIds,
        tokenFactoryData.amounts,
        tokenFactoryData.tokenURI,
        tokenFactoryData.maxBalanceLimit,
        tokenFactoryData.balanceLimitEnd,
        tokenFactoryData.controller,
        tokenFactoryData.excludedFromBalanceLimit,
      ],
    );
  }

  private computeSoladyCloneInitCodeHash(implementation: Address): Hash {
    return keccak256(
      `0x602c3d8160093d39f33d3d3d3d363d3d37363d73${implementation.slice(
        2,
      )}5af43d3d93803e602a57fd5bf3`,
    );
  }

  private computeStandardTokenInitHash(
    tokenFactoryData: StandardTokenFactoryData,
    tokenFactory: Address,
  ): Hash {
    if (tokenFactoryData.kind === 'v2') {
      return this.computeSoladyCloneInitCodeHash(
        tokenFactoryData.implementation,
      );
    }

    const initData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address[]' },
        { type: 'uint256[]' },
        { type: 'string' },
      ],
      [
        tokenFactoryData.name,
        tokenFactoryData.symbol,
        tokenFactoryData.initialSupply,
        tokenFactoryData.airlock,
        tokenFactoryData.airlock,
        tokenFactoryData.yearlyMintRate,
        tokenFactoryData.vestingDuration,
        tokenFactoryData.recipients,
        tokenFactoryData.amounts,
        tokenFactoryData.tokenURI,
      ],
    );

    const isTokenFactory80 =
      tokenFactory.toLowerCase() === TOKEN_FACTORY_80_ADDRESS;

    return keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [
          isTokenFactory80
            ? (DERC2080Bytecode as Hex)
            : (DERC20Bytecode as Hex),
          initData,
        ],
      ),
    );
  }

  /**
   * Set a custom migration data encoder function
   * @param encoder Custom function to encode migration data
   * @returns The factory instance for method chaining
   */
  withCustomMigrationEncoder(encoder: MigrationEncoder): this {
    this.customMigrationEncoder = encoder;
    return this;
  }

  async encodeCreateStaticAuctionParams(
    params: CreateStaticAuctionParams<C>,
  ): Promise<CreateParams> {
    // Validate parameters
    this.validateStaticAuctionParams(params);

    const addresses = getAddresses(this.chainId);
    this.assertDoppler404Compatibility({
      token: params.token,
      vesting: params.vesting,
      configuredFactory: addresses.doppler404Factory,
    });

    // Check if beneficiaries are provided - this determines which initializer to use
    const hasBeneficiaries =
      params.pool.beneficiaries && params.pool.beneficiaries.length > 0;

    // 1. Encode pool initializer data
    // Standard V3 initializer expects InitData struct WITHOUT beneficiaries (5 fields)
    // Lockable V3 initializer expects InitData struct WITH beneficiaries (6 fields)
    let poolInitializerData: Hex;

    if (hasBeneficiaries) {
      // Sort beneficiaries by address (ascending) and reject duplicates as
      // required by the contract
      const sortedBeneficiaries = sortBeneficiaries(params.pool.beneficiaries!);

      // Lockable V3 initializer encoding (6 fields including beneficiaries)
      poolInitializerData = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { type: 'uint24', name: 'fee' },
              { type: 'int24', name: 'tickLower' },
              { type: 'int24', name: 'tickUpper' },
              { type: 'uint16', name: 'numPositions' },
              { type: 'uint256', name: 'maxShareToBeSold' },
              {
                type: 'tuple[]',
                name: 'beneficiaries',
                components: [
                  { type: 'address', name: 'beneficiary' },
                  { type: 'uint96', name: 'shares' },
                ],
              },
            ],
          },
        ],
        [
          {
            fee: params.pool.fee,
            tickLower: params.pool.startTick,
            tickUpper: params.pool.endTick,
            numPositions: params.pool.numPositions ?? DEFAULT_V3_NUM_POSITIONS,
            maxShareToBeSold:
              params.pool.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
            beneficiaries: sortedBeneficiaries.map((b) => ({
              beneficiary: b.beneficiary,
              shares: b.shares,
            })),
          },
        ],
      );
    } else {
      // Standard V3 initializer encoding (5 fields, no beneficiaries)
      poolInitializerData = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { type: 'uint24', name: 'fee' },
              { type: 'int24', name: 'tickLower' },
              { type: 'int24', name: 'tickUpper' },
              { type: 'uint16', name: 'numPositions' },
              { type: 'uint256', name: 'maxShareToBeSold' },
            ],
          },
        ],
        [
          {
            fee: params.pool.fee,
            tickLower: params.pool.startTick,
            tickUpper: params.pool.endTick,
            numPositions: params.pool.numPositions ?? DEFAULT_V3_NUM_POSITIONS,
            maxShareToBeSold:
              params.pool.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
          },
        ],
      );
    }

    // 2. Encode migration data based on MigrationConfig
    const liquidityMigratorData = this.encodeMigrationData(params.migration, {
      overrides: params.modules,
    });

    const resolvedTokenFactory: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : this.isDopplerERC20V1Token(params.token)
          ? (params.modules?.dopplerERC20V1Factory ??
            addresses.dopplerERC20V1Factory)
          : this.usesDerc20V2Vesting(params.vesting)
            ? addresses.derc20V2Factory
            : addresses.tokenFactory);

    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured. Provide an explicit address via builder.withTokenFactory(...) or ensure chain config includes a valid factory.',
      );
    }
    this.assertStandardTokenFactoryCompatibility({
      token: params.token,
      vesting: params.vesting,
      tokenFactory: resolvedTokenFactory,
      addresses,
    });

    const poolInitializerAddress: Address = (() => {
      if (hasBeneficiaries) {
        const lockableInitializer =
          params.modules?.lockableV3Initializer ??
          addresses.lockableV3Initializer;
        if (!lockableInitializer || lockableInitializer === ZERO_ADDRESS) {
          throw new Error(
            'Lockable V3 initializer address not configured on this chain. Required when using beneficiaries.',
          );
        }
        return lockableInitializer;
      }
      const standardInitializer =
        params.modules?.v3Initializer ?? addresses.v3Initializer;
      if (!standardInitializer || standardInitializer === ZERO_ADDRESS) {
        throw new Error(
          'UniswapV3Initializer address not configured on this chain. Use beneficiaries for lockable V3 support, provide an override via builder.withV3Initializer(...), or use a chain with standard V3 initializer support.',
        );
      }
      return standardInitializer;
    })();
    const liquidityMigratorAddress = this.getMigratorAddress(
      params.migration,
      params.modules,
    );
    const includeProtocolBalanceLimitExclusions =
      this.usesDefaultDopplerERC20V1Integration(params.modules);

    // 3. Encode token parameters (standard vs Doppler404)
    let tokenFactoryData: Hex | undefined = undefined;
    let v1TokenFactoryData: DopplerERC20V1TokenFactoryData | undefined;
    if (this.isDoppler404Token(params.token)) {
      const token404 = params.token;
      const baseURI = token404.baseURI;
      const unit = token404.unit !== undefined ? BigInt(token404.unit) : WAD;
      tokenFactoryData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
        ],
        [params.token.name, params.token.symbol, baseURI, unit],
      );
    } else if (this.isDopplerERC20V1Token(params.token)) {
      v1TokenFactoryData = this.resolveDopplerERC20V1TokenFactoryData({
        token: params.token,
        sale: params.sale,
        vesting: params.vesting,
        userAddress: params.userAddress,
        governance: params.governance,
        addresses,
        modules: params.modules,
        protocolBalanceLimitExclusions: includeProtocolBalanceLimitExclusions
          ? [
              poolInitializerAddress,
              liquidityMigratorAddress,
              params.migration.type === 'uniswapV4'
                ? (params.modules?.poolManager ?? addresses.poolManager)
                : undefined,
              ...this.resolveMigrationLockerBalanceLimitExclusions(
                params.migration,
                addresses,
              ),
              ...this.resolveGovernanceBalanceLimitExclusions(
                params.governance,
              ),
            ]
          : undefined,
      });
      tokenFactoryData =
        this.encodeDopplerERC20V1TokenFactoryData(v1TokenFactoryData);
    } else {
      const standardTokenFactoryData = this.buildStandardTokenFactoryData({
        token: params.token as StandardTokenConfig,
        sale: params.sale,
        vesting: params.vesting,
        userAddress: params.userAddress,
        airlock: params.modules?.airlock ?? addresses.airlock,
        tokenFactory: resolvedTokenFactory,
        addresses,
      });
      tokenFactoryData = this.encodeStandardTokenFactoryData(
        standardTokenFactoryData,
      );
    }

    // 4. Encode governance factory data
    const governanceFactoryData: Hex = (() => {
      if (params.governance.type === 'noOp') {
        return '0x' as Hex;
      }
      if (params.governance.type === 'launchpad') {
        return encodeAbiParameters(
          [{ type: 'address' }],
          [params.governance.multisig],
        );
      }
      return encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom'
            ? params.governance.initialVotingDelay
            : this.governanceDuration(
                params.token,
                DEFAULT_V3_INITIAL_VOTING_DELAY,
              ),
          params.governance.type === 'custom'
            ? params.governance.initialVotingPeriod
            : this.governanceDuration(
                params.token,
                DEFAULT_V3_INITIAL_VOTING_PERIOD,
              ),
          params.governance.type === 'custom'
            ? params.governance.initialProposalThreshold
            : DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
        ],
      );
    })();

    // 4.1 Choose governance factory
    const governanceFactoryAddress = this.resolveGovernanceFactoryAddress({
      governance: params.governance,
      modules: params.modules,
      addresses,
      noOpError:
        'No-op governance requested, but no-op governanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
      launchpadError:
        'Launchpad governance requested, but launchpadGovernanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
      standardError:
        'Standard governance requested but governanceFactory is not deployed on this chain.',
    });

    if (!tokenFactoryData) {
      throw new Error('Token factory data could not be resolved.');
    }

    // 5. Generate a unique salt
    // Build the base CreateParams for the V3-style ABI; salt will be mined below
    const baseCreateParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactory,
      tokenFactoryData: tokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData: governanceFactoryData,
      poolInitializer: poolInitializerAddress,
      poolInitializerData: poolInitializerData,
      liquidityMigrator: liquidityMigratorAddress,
      liquidityMigratorData: liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
    };

    const minedCreateParams = await this.mineTokenOrder({
      params,
      baseCreateParams,
      addresses,
      v1TokenFactoryData,
      includeProtocolBalanceLimitExclusions,
    });

    return minedCreateParams;
  }

  /**
   * Simulate a static auction creation and return predicted addresses.
   */
  async simulateCreateStaticAuction(
    params: CreateStaticAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    asset: Address;
    pool: Address;
    gasEstimate?: bigint;
    /** Execute the create with the same params used in simulation (guarantees address match) */
    execute: () => Promise<{
      poolAddress: Address;
      tokenAddress: Address;
      transactionHash: string;
    }>;
  }> {
    const createParams = await this.encodeCreateStaticAuctionParams(params);
    const addresses = getAddresses(this.chainId);

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    });
    const simResult = result as readonly unknown[] | undefined;
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    });

    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate static auction create');
    }

    return {
      createParams,
      asset: simResult[0] as Address,
      pool: simResult[1] as Address,
      gasEstimate,
      execute: () =>
        this.createStaticAuction(params, { _createParams: createParams }),
    };
  }

  /**
   * Create a new static auction (using Uniswap V3 for initial liquidity)
   * @param params Configuration for the static auction
   * @returns The address of the created pool and token
   */
  async createStaticAuction(
    params: CreateStaticAuctionParams<C>,
    options?: { _createParams?: CreateParams },
  ): Promise<{
    poolAddress: Address;
    tokenAddress: Address;
    transactionHash: string;
  }> {
    // Use provided createParams (from simulate) or auto-simulate to get consistent params
    const createParams =
      options?._createParams ??
      (await this.simulateCreateStaticAuction(params)).createParams;

    const addresses = getAddresses(this.chainId);

    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    });
    const simResult = result as readonly unknown[] | undefined;

    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    });
    const gasOverride = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT;
    const hash = await this.walletClient.writeContract({
      ...request,
      gas: gasOverride,
    });

    // Wait for transaction and get the receipt
    const receipt = await (
      this.publicClient as PublicClient
    ).waitForTransactionReceipt({ hash, confirmations: 2 });

    // Always extract actual addresses from event logs (source of truth)
    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);

    if (!actualAddresses) {
      throw new Error(
        'Failed to extract addresses from Create event in transaction logs',
      );
    }

    // Warn if simulation predicted different addresses (helps debugging state divergence)
    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      const simulatedToken = simResult[0] as Address;
      const simulatedPool = simResult[1] as Address;
      if (
        simulatedToken.toLowerCase() !==
        actualAddresses.tokenAddress.toLowerCase()
      ) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualAddresses.tokenAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
      if (
        simulatedPool.toLowerCase() !==
        actualAddresses.poolOrHookAddress.toLowerCase()
      ) {
        console.warn(
          `[DopplerSDK] Simulation predicted pool ${simulatedPool} but actual is ${actualAddresses.poolOrHookAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
    }

    return {
      tokenAddress: actualAddresses.tokenAddress,
      poolAddress: actualAddresses.poolOrHookAddress,
      transactionHash: hash,
    };
  }

  /**
   * Generate a random salt based on user address
   */
  private generateRandomSalt(account: Address): Hex {
    // Use crypto.getRandomValues for secure random generation
    const array = new Uint8Array(32);

    // Try to use crypto API if available (Node.js or browser)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback: use timestamp and account for deterministic generation
      const timestamp = Date.now();
      const timestampBytes = new Uint8Array(8);
      const bigTimestamp = BigInt(timestamp);
      for (let i = 0; i < 8; i++) {
        timestampBytes[i] = Number((bigTimestamp >> BigInt(i * 8)) & 0xffn);
      }

      // Fill array with timestamp and account-based entropy
      for (let i = 0; i < 32; i++) {
        if (i < 8) {
          array[i] = timestampBytes[i];
        } else {
          array[i] = i;
        }
      }
    }

    // XOR with address bytes for additional entropy
    if (account) {
      const addressBytes = account.slice(2).padStart(40, '0');
      for (let i = 0; i < 20; i++) {
        const addressByte = parseInt(
          addressBytes.slice(i * 2, (i + 1) * 2),
          16,
        );
        array[i] ^= addressByte;
      }
    }

    return `0x${Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}` as Hex;
  }

  /**
   * Extract actual deployed addresses from Create event logs.
   * This is the source of truth - what actually deployed on-chain.
   * @param receipt Transaction receipt containing logs
   * @returns Token and pool/hook addresses from the Create event, or null if not found
   */
  private extractAddressesFromCreateEvent(receipt: {
    logs: readonly unknown[];
  }): { tokenAddress: Address; poolOrHookAddress: Address } | null {
    const createEvent = receipt.logs.find((log: unknown) => {
      try {
        const decoded = decodeEventLog({
          abi: airlockAbi,
          data: (log as { data: Hex }).data,
          topics: (log as { topics: readonly `0x${string}`[] }).topics as [
            `0x${string}`,
            ...`0x${string}`[],
          ],
        });
        return decoded.eventName === 'Create';
      } catch {
        return false;
      }
    });

    if (!createEvent) return null;

    const decoded = decodeEventLog({
      abi: airlockAbi,
      data: (createEvent as { data: Hex }).data,
      topics: (createEvent as { topics: readonly `0x${string}`[] }).topics as [
        `0x${string}`,
        ...`0x${string}`[],
      ],
    });

    if (decoded.eventName === 'Create') {
      const args = decoded.args as { asset: Address; poolOrHook: Address };
      return { tokenAddress: args.asset, poolOrHookAddress: args.poolOrHook };
    }

    return null;
  }

  /**
   * Iteratively mine a salt that ensures the newly created token sorts after the numeraire.
   * This mirrors the legacy SDK behaviour so tick configuration can assume the numeraire is token0.
   */
  private async mineTokenOrder(args: {
    params: CreateStaticAuctionParams<C>;
    baseCreateParams: Omit<CreateParams, 'salt'>;
    addresses: ReturnType<typeof getAddresses>;
    v1TokenFactoryData?: DopplerERC20V1TokenFactoryData;
    includeProtocolBalanceLimitExclusions?: boolean;
  }): Promise<CreateParams> {
    const { params, baseCreateParams, addresses } = args;

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    if (!airlockAddress || airlockAddress === ZERO_ADDRESS) {
      throw new Error(
        'Airlock address not configured. Provide an explicit address via modules.airlock or ensure chain config includes a valid airlock.',
      );
    }

    const accountForSimulation =
      this.walletClient?.account ?? params.userAddress;
    const numeraireBigInt = BigInt(params.sale.numeraire);

    let attempt = 0n;
    const maxAttempts = 256n;
    let salt = this.generateRandomSalt(params.userAddress);

    while (attempt < maxAttempts) {
      let createParams = { ...baseCreateParams, salt } as CreateParams;

      if (
        args.v1TokenFactoryData &&
        args.includeProtocolBalanceLimitExclusions &&
        this.isDopplerERC20V1BalanceLimitActive(args.v1TokenFactoryData)
      ) {
        const tokenAddress = this.predictDopplerERC20V1TokenAddress({
          tokenFactory: baseCreateParams.tokenFactory,
          salt,
          implementation: args.v1TokenFactoryData.implementation,
        });
        const tokenFactoryData = this.withDopplerERC20V1BalanceLimitExclusions(
          args.v1TokenFactoryData,
          [
            this.resolveStaticV3PoolExclusion({
              addresses,
              tokenAddress,
              numeraire: params.sale.numeraire,
              fee: params.pool.fee,
            }),
            this.resolveUniswapV2MigrationPairExclusion({
              migration: params.migration,
              addresses,
              tokenAddress,
              numeraire: params.sale.numeraire,
            }),
          ],
        );
        createParams = {
          ...createParams,
          tokenFactoryData:
            this.encodeDopplerERC20V1TokenFactoryData(tokenFactoryData),
        };
      }

      const { result } = await (
        this.publicClient as PublicClient
      ).simulateContract({
        address: airlockAddress,
        abi: airlockAbi,
        functionName: 'create',
        args: [{ ...createParams }],
        account: accountForSimulation,
      });

      const simResult = result as readonly unknown[] | undefined;
      if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
        throw new Error(
          'Failed to simulate static auction create while mining token ordering',
        );
      }

      const tokenAddress = simResult[0] as Address;
      const isToken0 = BigInt(tokenAddress) < numeraireBigInt;
      const wantToken0 = isToken0Expected(params.sale.numeraire);
      if ((wantToken0 && isToken0) || (!wantToken0 && !isToken0)) {
        return createParams;
      }

      attempt += 1n;
      const incrementedAccount = toHex(
        BigInt(params.userAddress) + attempt,
      ) as Address;
      salt = this.generateRandomSalt(incrementedAccount);
    }

    throw new Error(
      'Token mining exceeded iteration limit while trying to force token order. Try again or provide a different user address.',
    );
  }

  async encodeCreateDynamicAuctionParams(
    params: CreateDynamicAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    hookAddress: Address;
    tokenAddress: Address;
  }> {
    // Validate parameters
    this.validateDynamicAuctionParams(params);

    const addresses = getAddresses(this.chainId);
    this.assertDoppler404Compatibility({
      token: params.token,
      vesting: params.vesting,
      configuredFactory: addresses.doppler404Factory,
    });

    // 1. Calculate gamma if not provided
    const gamma =
      params.auction.gamma ??
      computeOptimalGamma(
        params.auction.startTick,
        params.auction.endTick,
        params.auction.duration,
        params.auction.epochLength,
        params.pool.tickSpacing,
      );

    // 2. Prepare time parameters
    // Use provided block timestamp or fetch the latest
    let blockTimestamp: number;
    if (params.blockTimestamp !== undefined) {
      blockTimestamp = params.blockTimestamp;
    } else {
      const latestBlock = await (this.publicClient as PublicClient).getBlock({
        blockTag: 'latest',
      });
      blockTimestamp = Number(
        (latestBlock as { timestamp: bigint | number }).timestamp,
      );
    }

    // Use startTimeOffset if provided, otherwise default to 30 seconds
    const startTimeOffset = params.startTimeOffset ?? 30;
    const startTime = blockTimestamp + startTimeOffset;
    const endTime = blockTimestamp + params.auction.duration + startTimeOffset;

    // 3. Prepare hook initialization data
    const dopplerData = {
      minimumProceeds: params.auction.minProceeds,
      maximumProceeds: params.auction.maxProceeds,
      startingTime: BigInt(startTime),
      endingTime: BigInt(endTime),
      startingTick: params.auction.startTick,
      endingTick: params.auction.endTick,
      epochLength: BigInt(params.auction.epochLength),
      gamma,
      isToken0: false, // Will be determined during mining
      numPDSlugs: BigInt(params.auction.numPdSlugs ?? DEFAULT_PD_SLUGS),
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
    };

    // 4. Prepare token parameters (standard vs Doppler404)
    const resolvedTokenFactoryDyn: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : this.isDopplerERC20V1Token(params.token)
          ? (params.modules?.dopplerERC20V1Factory ??
            addresses.dopplerERC20V1Factory)
          : this.usesDerc20V2Vesting(params.vesting)
            ? addresses.derc20V2Factory
            : addresses.tokenFactory);

    if (!resolvedTokenFactoryDyn || resolvedTokenFactoryDyn === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured. Provide an explicit address via builder.withTokenFactory(...) or ensure chain config includes a valid factory.',
      );
    }
    this.assertStandardTokenFactoryCompatibility({
      token: params.token,
      vesting: params.vesting,
      tokenFactory: resolvedTokenFactoryDyn,
      addresses,
    });

    const poolInitializerAddress =
      params.modules?.v4Initializer ?? addresses.v4Initializer;
    if (!poolInitializerAddress || poolInitializerAddress === ZERO_ADDRESS) {
      throw new Error(
        'UniswapV4Initializer address not configured on this chain. Provide an override via builder.withV4Initializer(...) or use a chain with dynamic auction support.',
      );
    }
    const liquidityMigratorAddress = this.getMigratorAddress(
      params.migration,
      params.modules,
    );
    const includeProtocolBalanceLimitExclusions =
      this.usesDefaultDopplerERC20V1Integration(params.modules);

    const tokenFactoryData = this.isDoppler404Token(params.token)
      ? (() => {
          const t = params.token as Doppler404TokenConfig;
          return {
            name: t.name,
            symbol: t.symbol,
            baseURI: t.baseURI,
            unit: t.unit !== undefined ? BigInt(t.unit) : WAD,
          };
        })()
      : this.isDopplerERC20V1Token(params.token)
        ? this.resolveDopplerERC20V1TokenFactoryData({
            token: params.token,
            sale: params.sale,
            vesting: params.vesting,
            userAddress: params.userAddress,
            addresses,
            governance: params.governance,
            modules: params.modules,
            protocolBalanceLimitExclusions:
              includeProtocolBalanceLimitExclusions
                ? [
                    poolInitializerAddress,
                    params.modules?.poolManager ?? addresses.poolManager,
                    liquidityMigratorAddress,
                    ...this.resolveMigrationLockerBalanceLimitExclusions(
                      params.migration,
                      addresses,
                    ),
                    ...this.resolveGovernanceBalanceLimitExclusions(
                      params.governance,
                    ),
                  ]
                : undefined,
          })
        : this.buildStandardTokenFactoryData({
            token: params.token as StandardTokenConfig,
            sale: params.sale,
            vesting: params.vesting,
            userAddress: params.userAddress,
            airlock: params.modules?.airlock ?? addresses.airlock,
            tokenFactory: resolvedTokenFactoryDyn,
            addresses,
          });

    // 5. Mine hook address with appropriate flags

    const [
      salt,
      hookAddress,
      tokenAddress,
      poolInitializerData,
      encodedTokenFactoryData,
    ] = this.mineHookAddress({
      airlock: params.modules?.airlock ?? addresses.airlock,
      poolManager: params.modules?.poolManager ?? addresses.poolManager,
      deployer: params.modules?.dopplerDeployer ?? addresses.dopplerDeployer,
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactoryDyn,
      tokenFactoryData: tokenFactoryData,
      poolInitializer: poolInitializerAddress,
      poolInitializerData: dopplerData,
      tokenVariant: this.isDoppler404Token(params.token)
        ? 'doppler404'
        : this.isDopplerERC20V1Token(params.token)
          ? 'dopplerERC20V1'
          : 'standard',
      migration: params.migration,
      addresses,
      includeProtocolBalanceLimitExclusions,
    });

    // 6. Encode migration data
    const liquidityMigratorData = this.encodeMigrationData(params.migration, {
      overrides: params.modules,
    });

    // 7. Encode governance factory data
    const governanceFactoryData: Hex = (() => {
      if (params.governance.type === 'noOp') {
        return '0x' as Hex;
      }
      if (params.governance.type === 'launchpad') {
        return encodeAbiParameters(
          [{ type: 'address' }],
          [params.governance.multisig],
        );
      }
      return encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom'
            ? params.governance.initialVotingDelay
            : this.governanceDuration(
                params.token,
                DEFAULT_V4_INITIAL_VOTING_DELAY,
              ),
          params.governance.type === 'custom'
            ? params.governance.initialVotingPeriod
            : this.governanceDuration(
                params.token,
                DEFAULT_V4_INITIAL_VOTING_PERIOD,
              ),
          params.governance.type === 'custom'
            ? params.governance.initialProposalThreshold
            : DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
        ],
      );
    })();

    // 7.1 Choose governance factory
    const governanceFactoryAddress = this.resolveGovernanceFactoryAddress({
      governance: params.governance,
      modules: params.modules,
      addresses,
      noOpError:
        'No-op governance requested, but no-op governanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
      launchpadError:
        'Launchpad governance requested, but launchpadGovernanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
      standardError:
        'Standard governance requested but governanceFactory is not deployed on this chain.',
    });

    // 8. Build the complete CreateParams for the V4-style ABI
    const createParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactoryDyn,
      tokenFactoryData: encodedTokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData: governanceFactoryData,
      poolInitializer: poolInitializerAddress,
      poolInitializerData: poolInitializerData,
      liquidityMigrator: liquidityMigratorAddress,
      liquidityMigratorData: liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt: salt,
    };

    return { createParams, hookAddress, tokenAddress };
  }

  /**
   * Create a new dynamic auction (using Uniswap V4 hook for gradual Dutch auction)
   * @param params Configuration for the dynamic auction
   * @returns The address of the created hook and token
   */
  async createDynamicAuction(
    params: CreateDynamicAuctionParams<C>,
    options?: { _createParams?: CreateParams },
  ): Promise<{
    hookAddress: Address;
    tokenAddress: Address;
    poolId: string;
    transactionHash: string;
  }> {
    const addresses = getAddresses(this.chainId);

    // Use provided createParams (from simulate) or auto-simulate to get consistent params
    let createParams: CreateParams;

    if (options?._createParams) {
      createParams = options._createParams;
    } else {
      const simulation = await this.simulateCreateDynamicAuction(params);
      createParams = simulation.createParams;
    }

    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    });
    const simResult = result as readonly unknown[] | undefined;

    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    });
    const gasOverride = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT;
    const hash = await this.walletClient.writeContract({
      ...request,
      gas: gasOverride,
    });

    // Wait for transaction and get the receipt
    const receipt = await (
      this.publicClient as PublicClient
    ).waitForTransactionReceipt({ hash, confirmations: 2 });

    // Always extract actual addresses from event logs (source of truth)
    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);

    if (!actualAddresses) {
      throw new Error(
        'Failed to extract addresses from Create event in transaction logs',
      );
    }

    const actualTokenAddress = actualAddresses.tokenAddress;
    const actualHookAddress = actualAddresses.poolOrHookAddress;

    // Warn if simulation predicted different addresses (helps debugging state divergence)
    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      const simulatedToken = simResult[0] as Address;
      const simulatedHook = simResult[1] as Address;
      if (simulatedToken.toLowerCase() !== actualTokenAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualTokenAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
      if (simulatedHook.toLowerCase() !== actualHookAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted hook ${simulatedHook} but actual is ${actualHookAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
    }

    // Calculate pool ID for V4 using actual addresses
    const poolId = this.computePoolId({
      currency0:
        actualTokenAddress < params.sale.numeraire
          ? actualTokenAddress
          : params.sale.numeraire,
      currency1:
        actualTokenAddress < params.sale.numeraire
          ? params.sale.numeraire
          : actualTokenAddress,
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      hooks: actualHookAddress,
    });

    return {
      hookAddress: actualHookAddress,
      tokenAddress: actualTokenAddress,
      poolId,
      transactionHash: hash,
    };
  }

  /**
   * Simulate a dynamic auction creation and return predicted addresses and poolId.
   * Useful for clients that need the hook/token/poolId before submitting the tx.
   */
  async simulateCreateDynamicAuction(
    params: CreateDynamicAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    hookAddress: Address;
    tokenAddress: Address;
    poolId: string;
    gasEstimate?: bigint;
    /** Execute the create with the same params used in simulation (guarantees address match) */
    execute: () => Promise<{
      hookAddress: Address;
      tokenAddress: Address;
      poolId: string;
      transactionHash: string;
    }>;
  }> {
    const { createParams } =
      await this.encodeCreateDynamicAuctionParams(params);
    const addresses = getAddresses(this.chainId);

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    });
    const simResult = result as readonly unknown[] | undefined;
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    });

    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate dynamic auction create');
    }

    const tokenAddress = simResult[0] as Address;
    const hookAddress = simResult[1] as Address;

    const poolId = this.computePoolId({
      currency0:
        tokenAddress < params.sale.numeraire
          ? tokenAddress
          : params.sale.numeraire,
      currency1:
        tokenAddress < params.sale.numeraire
          ? params.sale.numeraire
          : tokenAddress,
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      hooks: hookAddress,
    });

    return {
      createParams,
      hookAddress,
      tokenAddress,
      poolId,
      gasEstimate,
      execute: () =>
        this.createDynamicAuction(params, {
          _createParams: createParams,
        }),
    };
  }

  async encodeCreateOpeningAuctionParams(
    params: CreateOpeningAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    hookAddress: Address;
    tokenAddress: Address;
    minedSalt: Hash;
  }> {
    this.validateOpeningAuctionParams(params);
    const addresses = getAddresses(this.chainId);
    this.assertDoppler404Compatibility({
      token: params.token,
      vesting: params.vesting,
      configuredFactory: addresses.doppler404Factory,
    });

    const openingAuctionInitializer =
      this.resolveOpeningAuctionInitializerAddress(params.modules, addresses);

    const [poolManagerForAuction, auctionDeployer] = await Promise.all([
      (this.publicClient as PublicClient).readContract({
        address: openingAuctionInitializer,
        abi: openingAuctionInitializerAbi,
        functionName: 'poolManager',
      }) as Promise<Address>,
      (this.publicClient as PublicClient).readContract({
        address: openingAuctionInitializer,
        abi: openingAuctionInitializerAbi,
        functionName: 'auctionDeployer',
      }) as Promise<Address>,
    ]);

    let blockTimestamp: number;
    if (params.blockTimestamp !== undefined) {
      blockTimestamp = params.blockTimestamp;
    } else {
      const latestBlock = await (this.publicClient as PublicClient).getBlock({
        blockTag: 'latest',
      });
      blockTimestamp = Number(
        (latestBlock as { timestamp: bigint | number }).timestamp,
      );
    }

    const startOffset =
      params.startTimeOffset ?? params.doppler.startTimeOffset ?? 30;
    const startTime =
      params.startingTime ??
      params.doppler.startingTime ??
      blockTimestamp + startOffset;
    const endTime = startTime + params.doppler.duration;

    const isToken0 = isToken0Expected(params.sale.numeraire);
    const gamma =
      params.doppler.gamma ??
      computeOptimalGamma(
        params.doppler.startTick,
        params.doppler.endTick,
        params.doppler.duration,
        params.doppler.epochLength,
        params.doppler.tickSpacing,
      );

    const dopplerData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      [
        params.doppler.minProceeds,
        params.doppler.maxProceeds,
        BigInt(startTime),
        BigInt(endTime),
        params.doppler.startTick,
        params.doppler.endTick,
        BigInt(params.doppler.epochLength),
        gamma,
        isToken0,
        BigInt(params.doppler.numPdSlugs ?? DEFAULT_PD_SLUGS),
        params.doppler.fee,
        params.doppler.tickSpacing,
      ],
    );

    const poolInitializerData = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            {
              name: 'auctionConfig',
              type: 'tuple',
              components: [
                { name: 'auctionDuration', type: 'uint256' },
                { name: 'minAcceptableTickToken0', type: 'int24' },
                { name: 'minAcceptableTickToken1', type: 'int24' },
                { name: 'incentiveShareBps', type: 'uint256' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'fee', type: 'uint24' },
                { name: 'minLiquidity', type: 'uint128' },
                { name: 'shareToAuctionBps', type: 'uint256' },
              ],
            },
            { name: 'dopplerData', type: 'bytes' },
          ],
        },
      ],
      [
        {
          auctionConfig: {
            auctionDuration: BigInt(params.openingAuction.auctionDuration),
            minAcceptableTickToken0:
              params.openingAuction.minAcceptableTickToken0,
            minAcceptableTickToken1:
              params.openingAuction.minAcceptableTickToken1,
            incentiveShareBps: BigInt(params.openingAuction.incentiveShareBps),
            tickSpacing: params.openingAuction.tickSpacing,
            fee: params.openingAuction.fee,
            minLiquidity: params.openingAuction.minLiquidity,
            shareToAuctionBps: BigInt(params.openingAuction.shareToAuctionBps),
          },
          dopplerData,
        },
      ],
    );

    const resolvedTokenFactory: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : this.isDopplerERC20V1Token(params.token)
          ? (params.modules?.dopplerERC20V1Factory ??
            addresses.dopplerERC20V1Factory)
          : this.usesDerc20V2Vesting(params.vesting)
            ? addresses.derc20V2Factory
            : addresses.tokenFactory);

    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured. Provide an explicit address via builder.withTokenFactory(...) or ensure chain config includes a valid factory.',
      );
    }
    this.assertStandardTokenFactoryCompatibility({
      token: params.token,
      vesting: params.vesting,
      tokenFactory: resolvedTokenFactory,
      addresses,
    });

    const liquidityMigratorAddress = this.getMigratorAddress(
      params.migration,
      params.modules,
    );
    const includeProtocolBalanceLimitExclusions =
      this.usesDefaultDopplerERC20V1Integration(params.modules);

    const tokenFactoryData = this.isDoppler404Token(params.token)
      ? (() => {
          const t = params.token as Doppler404TokenConfig;
          return {
            name: t.name,
            symbol: t.symbol,
            baseURI: t.baseURI,
            unit: t.unit !== undefined ? BigInt(t.unit) : WAD,
          };
        })()
      : this.isDopplerERC20V1Token(params.token)
        ? this.resolveDopplerERC20V1TokenFactoryData({
            token: params.token,
            sale: params.sale,
            vesting: params.vesting,
            userAddress: params.userAddress,
            addresses,
            governance: params.governance,
            modules: params.modules,
            protocolBalanceLimitExclusions:
              includeProtocolBalanceLimitExclusions
                ? [
                    openingAuctionInitializer,
                    poolManagerForAuction,
                    auctionDeployer,
                    liquidityMigratorAddress,
                    ...this.resolveMigrationLockerBalanceLimitExclusions(
                      params.migration,
                      addresses,
                    ),
                    ...this.resolveGovernanceBalanceLimitExclusions(
                      params.governance,
                    ),
                  ]
                : undefined,
          })
        : this.buildStandardTokenFactoryData({
            token: params.token as StandardTokenConfig,
            sale: params.sale,
            vesting: params.vesting,
            userAddress: params.userAddress,
            airlock: params.modules?.airlock ?? addresses.airlock,
            tokenFactory: resolvedTokenFactory,
            addresses,
          });

    const auctionTokens =
      (params.sale.numTokensToSell *
        BigInt(params.openingAuction.shareToAuctionBps)) /
      10_000n;
    if (auctionTokens <= 0n) {
      throw new Error('Opening auction token allocation rounds to zero');
    }

    const [salt, hookAddress, tokenAddress, encodedTokenFactoryData] =
      this.mineOpeningAuctionHookAddress({
        auctionDeployer,
        openingAuctionInitializer,
        poolManager: poolManagerForAuction,
        auctionTokens,
        openingAuctionConfig: params.openingAuction,
        numeraire: params.sale.numeraire,
        tokenFactory: resolvedTokenFactory,
        tokenFactoryData,
        airlock: params.modules?.airlock ?? addresses.airlock,
        initialSupply: params.sale.initialSupply,
        tokenVariant: this.isDoppler404Token(params.token)
          ? 'doppler404'
          : this.isDopplerERC20V1Token(params.token)
            ? 'dopplerERC20V1'
            : 'standard',
        migration: params.migration,
        addresses,
        includeProtocolBalanceLimitExclusions,
      });

    const liquidityMigratorData = this.encodeMigrationData(params.migration, {
      overrides: params.modules,
    });

    const governanceFactoryData: Hex = (() => {
      if (params.governance.type === 'noOp') {
        return '0x' as Hex;
      }
      if (params.governance.type === 'launchpad') {
        return encodeAbiParameters(
          [{ type: 'address' }],
          [params.governance.multisig],
        );
      }
      return encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom'
            ? params.governance.initialVotingDelay
            : this.governanceDuration(
                params.token,
                DEFAULT_V4_INITIAL_VOTING_DELAY,
              ),
          params.governance.type === 'custom'
            ? params.governance.initialVotingPeriod
            : this.governanceDuration(
                params.token,
                DEFAULT_V4_INITIAL_VOTING_PERIOD,
              ),
          params.governance.type === 'custom'
            ? params.governance.initialProposalThreshold
            : DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
        ],
      );
    })();

    const governanceFactoryAddress = this.resolveGovernanceFactoryAddress({
      governance: params.governance,
      modules: params.modules,
      addresses,
      noOpError:
        'No-op governance requested, but no-op governanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
      launchpadError:
        'Launchpad governance requested, but launchpadGovernanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
      standardError:
        'Standard governance requested but governanceFactory is not deployed on this chain.',
    });

    if (!tokenFactoryData) {
      throw new Error('Token factory data could not be resolved.');
    }

    const createParams: CreateParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactory,
      tokenFactoryData: encodedTokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData,
      poolInitializer: openingAuctionInitializer,
      poolInitializerData,
      liquidityMigrator: liquidityMigratorAddress,
      liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt,
    };

    return {
      createParams,
      hookAddress,
      tokenAddress,
      minedSalt: salt,
    };
  }

  async simulateCreateOpeningAuction(
    params: CreateOpeningAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    openingAuctionHookAddress: Address;
    tokenAddress: Address;
    minedSalt: Hash;
    gasEstimate?: bigint;
    execute: () => Promise<OpeningAuctionCreateResult>;
  }> {
    const { createParams, minedSalt } =
      await this.encodeCreateOpeningAuctionParams(params);
    const addresses = getAddresses(this.chainId);

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    });
    const simResult = result as readonly unknown[] | undefined;
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    });

    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate opening auction create');
    }

    return {
      createParams,
      openingAuctionHookAddress: simResult[1] as Address,
      tokenAddress: simResult[0] as Address,
      minedSalt,
      gasEstimate,
      execute: () =>
        this.createOpeningAuction(params, {
          _createParams: createParams,
          _minedSalt: minedSalt,
        }),
    };
  }

  async createOpeningAuction(
    params: CreateOpeningAuctionParams<C>,
    options?: { _createParams?: CreateParams; _minedSalt?: Hash },
  ): Promise<OpeningAuctionCreateResult> {
    const addresses = getAddresses(this.chainId);
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    let createParams = options?._createParams;
    let minedSalt = options?._minedSalt;
    if (!createParams || !minedSalt) {
      const simulation = await this.simulateCreateOpeningAuction(params);
      createParams = simulation.createParams;
      minedSalt = simulation.minedSalt;
    }

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    });
    const simResult = result as readonly unknown[] | undefined;

    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    });
    const gasOverride = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT;
    const hash = await this.walletClient.writeContract({
      ...request,
      gas: gasOverride,
    });

    const receipt = await (
      this.publicClient as PublicClient
    ).waitForTransactionReceipt({ hash, confirmations: 2 });

    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);
    if (!actualAddresses) {
      throw new Error(
        'Failed to extract addresses from Create event in transaction logs',
      );
    }

    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      const simulatedToken = simResult[0] as Address;
      const simulatedHook = simResult[1] as Address;
      if (
        simulatedToken.toLowerCase() !==
        actualAddresses.tokenAddress.toLowerCase()
      ) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualAddresses.tokenAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
      if (
        simulatedHook.toLowerCase() !==
        actualAddresses.poolOrHookAddress.toLowerCase()
      ) {
        console.warn(
          `[DopplerSDK] Simulation predicted opening hook ${simulatedHook} but actual is ${actualAddresses.poolOrHookAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
    }

    return {
      tokenAddress: actualAddresses.tokenAddress,
      openingAuctionHookAddress: actualAddresses.poolOrHookAddress,
      transactionHash: hash,
      createParams,
      minedSalt,
    };
  }

  async simulateCompleteOpeningAuction(args: {
    asset: Address;
    initializerAddress?: Address;
    dopplerSalt?: Hash;
    blockTimestamp?: number;
  }): Promise<{
    asset: Address;
    dopplerSalt: Hash;
    dopplerHookAddress: Address;
    gasEstimate?: bigint;
    execute: () => Promise<OpeningAuctionCompleteResult>;
  }> {
    const initializerAddress = args.initializerAddress
      ? args.initializerAddress
      : this.resolveOpeningAuctionInitializerAddress();

    const autoMined = args.dopplerSalt === undefined;
    const deterministic = args.blockTimestamp !== undefined;
    const maxAttempts =
      autoMined && !deterministic ? MAX_COMPLETION_ATTEMPTS : 1;

    let startSalt: bigint | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const stateRaw = await (this.publicClient as PublicClient).readContract({
        address: initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'getState',
        args: [args.asset],
      });
      const state = this.normalizeOpeningAuctionState(stateRaw);

      const phase = await (this.publicClient as PublicClient).readContract({
        address: state.openingAuctionHook,
        abi: openingAuctionAbi,
        functionName: 'phase',
      });
      if (Number(phase) !== OPENING_AUCTION_PHASE_SETTLED) {
        throw new Error(
          'Opening auction is not settled yet. Run settleAuction() first, then simulate completion.',
        );
      }

      const completion =
        args.dopplerSalt !== undefined
          ? {
              dopplerSalt: args.dopplerSalt,
              dopplerHookAddress: ZERO_ADDRESS,
            }
          : await this.mineDopplerCompletionSalt({
              asset: args.asset,
              initializerAddress,
              state,
              blockTimestamp: args.blockTimestamp,
              startSalt,
            });

      try {
        const { request } = await (
          this.publicClient as PublicClient
        ).simulateContract({
          address: initializerAddress,
          abi: openingAuctionInitializerAbi,
          functionName: 'completeAuction',
          args: [args.asset, completion.dopplerSalt],
          account: this.walletClient?.account,
        });

        const gasEstimate =
          request &&
          typeof request === 'object' &&
          'gas' in (request as Record<string, unknown>)
            ? ((request as { gas?: bigint }).gas ?? undefined)
            : undefined;

        return {
          asset: args.asset,
          dopplerSalt: completion.dopplerSalt,
          dopplerHookAddress: completion.dopplerHookAddress,
          gasEstimate,
          execute: () =>
            this.completeOpeningAuction({
              asset: args.asset,
              initializerAddress,
              ...(args.dopplerSalt !== undefined
                ? { dopplerSalt: args.dopplerSalt }
                : {}),
              autoSettle: false,
              blockTimestamp: args.blockTimestamp,
            }),
        };
      } catch (err) {
        lastError = err;
        if (attempt >= maxAttempts) {
          if (maxAttempts === 1) throw err;
          break;
        }
        if (autoMined) startSalt = BigInt(completion.dopplerSalt) + 1n;
      }
    }

    const lastMsg =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `simulateCompleteOpeningAuction failed after ${maxAttempts} attempt${
        maxAttempts === 1 ? '' : 's'
      }: ${lastMsg}`,
    );
  }

  async completeOpeningAuction(args: {
    asset: Address;
    initializerAddress?: Address;
    dopplerSalt?: Hash;
    autoSettle?: boolean;
    blockTimestamp?: number;
  }): Promise<OpeningAuctionCompleteResult> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const initializerAddress = args.initializerAddress
      ? args.initializerAddress
      : this.resolveOpeningAuctionInitializerAddress();

    const stateRaw = await (this.publicClient as PublicClient).readContract({
      address: initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'getState',
      args: [args.asset],
    });
    const state = this.normalizeOpeningAuctionState(stateRaw);
    if (state.status !== OPENING_AUCTION_STATUS_ACTIVE) {
      throw new Error(
        `Opening auction status is not active for ${args.asset}. Current status: ${state.status}.`,
      );
    }

    const autoSettle = args.autoSettle ?? true;
    const phase = await (this.publicClient as PublicClient).readContract({
      address: state.openingAuctionHook,
      abi: openingAuctionAbi,
      functionName: 'phase',
    });

    if (autoSettle && Number(phase) !== OPENING_AUCTION_PHASE_SETTLED) {
      const { request } = await (
        this.publicClient as PublicClient
      ).simulateContract({
        address: state.openingAuctionHook,
        abi: openingAuctionAbi,
        functionName: 'settleAuction',
        account: this.walletClient.account,
      });
      const settleTx = await this.walletClient.writeContract(request);
      await (this.publicClient as PublicClient).waitForTransactionReceipt({
        hash: settleTx,
      });
    }

    const autoMined = args.dopplerSalt === undefined;
    const deterministic = args.blockTimestamp !== undefined;
    const maxAttempts =
      autoMined && !deterministic ? MAX_COMPLETION_ATTEMPTS : 1;

    let startSalt: bigint | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const stateRawAttempt = await (
        this.publicClient as PublicClient
      ).readContract({
        address: initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'getState',
        args: [args.asset],
      });
      const stateAttempt = this.normalizeOpeningAuctionState(stateRawAttempt);
      if (stateAttempt.status !== OPENING_AUCTION_STATUS_ACTIVE) {
        throw new Error(
          `Opening auction status is not active for ${args.asset}. Current status: ${stateAttempt.status}.`,
        );
      }

      const completion =
        args.dopplerSalt !== undefined
          ? {
              dopplerSalt: args.dopplerSalt,
              dopplerHookAddress: ZERO_ADDRESS,
            }
          : await this.mineDopplerCompletionSalt({
              asset: args.asset,
              initializerAddress,
              state: stateAttempt,
              blockTimestamp: args.blockTimestamp,
              startSalt,
            });

      let request: unknown;
      try {
        ({ request } = await (
          this.publicClient as PublicClient
        ).simulateContract({
          address: initializerAddress,
          abi: openingAuctionInitializerAbi,
          functionName: 'completeAuction',
          args: [args.asset, completion.dopplerSalt],
          account: this.walletClient.account,
        }));
      } catch (err) {
        lastError = err;
        if (attempt >= maxAttempts) {
          if (maxAttempts === 1) throw err;
          break;
        }
        if (autoMined) startSalt = BigInt(completion.dopplerSalt) + 1n;
        continue;
      }

      const txHash = await this.walletClient.writeContract(request as any);
      const receipt = await (
        this.publicClient as PublicClient
      ).waitForTransactionReceipt({
        hash: txHash,
        confirmations: 2,
      });
      if (receipt.status === 'reverted') {
        const receiptError = new Error(
          `completeAuction transaction reverted (hash: ${txHash})`,
        );
        lastError = receiptError;
        if (attempt >= maxAttempts) {
          if (maxAttempts === 1) throw receiptError;
          break;
        }
        if (autoMined) startSalt = BigInt(completion.dopplerSalt) + 1n;
        continue;
      }

      const dopplerHookAddress = await (
        this.publicClient as PublicClient
      ).readContract({
        address: initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'getDopplerHook',
        args: [args.asset],
      });

      const finalHookAddress =
        dopplerHookAddress === ZERO_ADDRESS
          ? completion.dopplerHookAddress
          : dopplerHookAddress;

      if (finalHookAddress === ZERO_ADDRESS) {
        throw new Error(
          'Unable to determine dopplerHookAddress after completeAuction. The on-chain getDopplerHook returned zero. Try calling getDopplerHook manually after the transaction confirms.',
        );
      }

      return {
        asset: args.asset,
        dopplerHookAddress: finalHookAddress,
        transactionHash: txHash,
        dopplerSalt: completion.dopplerSalt,
      };
    }

    const lastMsg =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `completeOpeningAuction failed after ${maxAttempts} attempt${
        maxAttempts === 1 ? '' : 's'
      }: ${lastMsg}`,
    );
  }

  async simulateRecoverOpeningAuctionIncentives(args: {
    asset: Address;
    initializerAddress?: Address;
    account?: Address | Account;
  }): Promise<{ request: unknown }> {
    const initializerAddress = args.initializerAddress
      ? args.initializerAddress
      : this.resolveOpeningAuctionInitializerAddress();

    const { request } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'recoverOpeningAuctionIncentives',
      args: [args.asset],
      account: args.account ?? this.walletClient?.account,
    });
    return { request };
  }

  async recoverOpeningAuctionIncentives(args: {
    asset: Address;
    initializerAddress?: Address;
  }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }
    const simulation = await this.simulateRecoverOpeningAuctionIncentives({
      ...args,
      account: this.walletClient.account,
    });
    return this.walletClient.writeContract(simulation.request as any);
  }

  async simulateSweepOpeningAuctionIncentives(args: {
    asset: Address;
    initializerAddress?: Address;
    account?: Address | Account;
  }): Promise<{ request: unknown }> {
    const initializerAddress = args.initializerAddress
      ? args.initializerAddress
      : this.resolveOpeningAuctionInitializerAddress();

    const { request } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'sweepOpeningAuctionIncentives',
      args: [args.asset],
      account: args.account ?? this.walletClient?.account,
    });
    return { request };
  }

  async sweepOpeningAuctionIncentives(args: {
    asset: Address;
    initializerAddress?: Address;
  }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }
    const simulation = await this.simulateSweepOpeningAuctionIncentives({
      ...args,
      account: this.walletClient.account,
    });
    return this.walletClient.writeContract(simulation.request as any);
  }

  private resolveOpeningAuctionInitializerAddress(
    modules?: ModuleAddressOverrides,
    chainAddresses?: ReturnType<typeof getAddresses>,
  ): Address {
    const addresses = chainAddresses ?? getAddresses(this.chainId);
    const resolved =
      modules?.openingAuctionInitializer ??
      addresses.openingAuctionInitializer ??
      ZERO_ADDRESS;
    if (!resolved || resolved === ZERO_ADDRESS) {
      throw new Error(
        'OpeningAuctionInitializer address not configured. Provide modules.openingAuctionInitializer or configure chain addresses.',
      );
    }
    return resolved;
  }

  private normalizeOpeningAuctionState(raw: unknown): OpeningAuctionState {
    if (Array.isArray(raw)) {
      const [
        numeraire,
        auctionStartTime,
        auctionEndTime,
        auctionTokens,
        dopplerTokens,
        status,
        openingAuctionHook,
        dopplerHook,
        openingAuctionPoolKey,
        dopplerInitData,
        isToken0,
      ] = raw as [
        Address,
        bigint,
        bigint,
        bigint,
        bigint,
        number,
        Address,
        Address,
        unknown,
        `0x${string}`,
        boolean,
      ];

      return {
        numeraire,
        auctionStartTime,
        auctionEndTime,
        auctionTokens,
        dopplerTokens,
        status,
        openingAuctionHook,
        dopplerHook,
        openingAuctionPoolKey: this.normalizePoolKey(openingAuctionPoolKey),
        dopplerInitData,
        isToken0,
      };
    }

    const value = raw as Record<string, unknown>;
    return {
      numeraire: value.numeraire as Address,
      auctionStartTime: value.auctionStartTime as bigint,
      auctionEndTime: value.auctionEndTime as bigint,
      auctionTokens: value.auctionTokens as bigint,
      dopplerTokens: value.dopplerTokens as bigint,
      status: Number(value.status),
      openingAuctionHook: value.openingAuctionHook as Address,
      dopplerHook: value.dopplerHook as Address,
      openingAuctionPoolKey: this.normalizePoolKey(value.openingAuctionPoolKey),
      dopplerInitData: value.dopplerInitData as `0x${string}`,
      isToken0: Boolean(value.isToken0),
    };
  }

  private decodeDopplerInitData(dopplerData: `0x${string}`): {
    minimumProceeds: bigint;
    maximumProceeds: bigint;
    startingTime: bigint;
    endingTime: bigint;
    startingTick: number;
    endingTick: number;
    epochLength: bigint;
    gamma: number;
    isToken0: boolean;
    numPDSlugs: bigint;
    lpFee: number;
    tickSpacing: number;
  } {
    const decoded = decodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      dopplerData,
    );

    return {
      minimumProceeds: decoded[0],
      maximumProceeds: decoded[1],
      startingTime: decoded[2],
      endingTime: decoded[3],
      startingTick: Number(decoded[4]),
      endingTick: Number(decoded[5]),
      epochLength: decoded[6],
      gamma: Number(decoded[7]),
      isToken0: decoded[8],
      numPDSlugs: decoded[9],
      lpFee: Number(decoded[10]),
      tickSpacing: Number(decoded[11]),
    };
  }

  private encodeDopplerInitData(data: {
    minimumProceeds: bigint;
    maximumProceeds: bigint;
    startingTime: bigint;
    endingTime: bigint;
    startingTick: number;
    endingTick: number;
    epochLength: bigint;
    gamma: number;
    isToken0: boolean;
    numPDSlugs: bigint;
    lpFee: number;
    tickSpacing: number;
  }): Hex {
    return encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      [
        data.minimumProceeds,
        data.maximumProceeds,
        data.startingTime,
        data.endingTime,
        data.startingTick,
        data.endingTick,
        data.epochLength,
        data.gamma,
        data.isToken0,
        data.numPDSlugs,
        data.lpFee,
        data.tickSpacing,
      ],
    );
  }

  private alignTickTowardZero(tick: number, tickSpacing: number): number {
    return tick - (tick % tickSpacing);
  }

  private alignTickForDirection(
    isToken0: boolean,
    tick: number,
    tickSpacing: number,
  ): number {
    if (isToken0) {
      return tick < 0
        ? Math.trunc((tick - tickSpacing + 1) / tickSpacing) * tickSpacing
        : Math.trunc(tick / tickSpacing) * tickSpacing;
    }

    return tick < 0
      ? Math.trunc(tick / tickSpacing) * tickSpacing
      : Math.trunc((tick + tickSpacing - 1) / tickSpacing) * tickSpacing;
  }

  private async mineDopplerCompletionSalt(args: {
    asset: Address;
    initializerAddress: Address;
    state: OpeningAuctionState;
    blockTimestamp?: number;
    startSalt?: bigint;
  }): Promise<{ dopplerSalt: Hash; dopplerHookAddress: Address }> {
    const [
      phaseRaw,
      clearingTickRaw,
      incentiveTokensTotal,
      totalIncentivesClaimed,
    ] = await Promise.all([
      (this.publicClient as PublicClient).readContract({
        address: args.state.openingAuctionHook,
        abi: openingAuctionAbi,
        functionName: 'phase',
      }),
      (this.publicClient as PublicClient).readContract({
        address: args.state.openingAuctionHook,
        abi: openingAuctionAbi,
        functionName: 'clearingTick',
      }),
      (this.publicClient as PublicClient).readContract({
        address: args.state.openingAuctionHook,
        abi: openingAuctionAbi,
        functionName: 'incentiveTokensTotal',
      }),
      (this.publicClient as PublicClient).readContract({
        address: args.state.openingAuctionHook,
        abi: openingAuctionAbi,
        functionName: 'totalIncentivesClaimed',
      }),
    ]);

    if (Number(phaseRaw) !== OPENING_AUCTION_PHASE_SETTLED) {
      throw new Error(
        'Opening auction must be settled before completion mining',
      );
    }

    const rawAssetBalance = await (
      this.publicClient as PublicClient
    ).readContract({
      address: args.asset,
      abi: erc20BalanceOfAbi,
      functionName: 'balanceOf',
      args: [args.state.openingAuctionHook],
    });

    const reservedIncentives =
      totalIncentivesClaimed < incentiveTokensTotal
        ? incentiveTokensTotal - totalIncentivesClaimed
        : 0n;
    const unsoldTokens =
      rawAssetBalance > reservedIncentives
        ? rawAssetBalance - reservedIncentives
        : 0n;

    const dopplerData = this.decodeDopplerInitData(args.state.dopplerInitData);
    let alignedClearingTick = this.alignTickForDirection(
      args.state.isToken0,
      Number(clearingTickRaw),
      dopplerData.tickSpacing,
    );
    const minAligned = this.alignTickTowardZero(
      MIN_TICK,
      dopplerData.tickSpacing,
    );
    const maxAligned = this.alignTickTowardZero(
      MAX_TICK,
      dopplerData.tickSpacing,
    );
    if (alignedClearingTick < minAligned) alignedClearingTick = minAligned;
    if (alignedClearingTick > maxAligned) alignedClearingTick = maxAligned;

    let blockTimestamp: number;
    if (args.blockTimestamp !== undefined) {
      blockTimestamp = args.blockTimestamp;
    } else {
      const latestBlock = await (this.publicClient as PublicClient).getBlock({
        blockTag: 'latest',
      });
      blockTimestamp = Number(
        (latestBlock as { timestamp: bigint | number }).timestamp,
      );
    }

    const originalDuration = dopplerData.endingTime - dopplerData.startingTime;
    let newStartingTime = dopplerData.startingTime;
    let newEndingTime = dopplerData.endingTime;
    if (BigInt(blockTimestamp) >= dopplerData.startingTime) {
      newStartingTime = BigInt(blockTimestamp + 1);
      newEndingTime = newStartingTime + originalDuration;
    }

    const modifiedDopplerData = this.encodeDopplerInitData({
      ...dopplerData,
      startingTime: newStartingTime,
      endingTime: newEndingTime,
      startingTick: alignedClearingTick,
    });
    const decodedModified = this.decodeDopplerInitData(
      modifiedDopplerData as `0x${string}`,
    );

    const [poolManager, dopplerDeployer] = await Promise.all([
      (this.publicClient as PublicClient).readContract({
        address: args.initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'poolManager',
      }) as Promise<Address>,
      (this.publicClient as PublicClient).readContract({
        address: args.initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'dopplerDeployer',
      }) as Promise<Address>,
    ]);

    let startSalt = args.startSalt ?? 0n;
    while (startSalt < ONE_MILLION) {
      const mined = this.mineDopplerHookSalt({
        dopplerDeployer,
        poolManager,
        initializerAddress: args.initializerAddress,
        unsoldTokens,
        dopplerData: decodedModified,
        startSalt,
      });

      const bytecode = await (this.publicClient as PublicClient).getBytecode({
        address: mined.hookAddress,
      });
      if (!bytecode || bytecode === '0x') {
        return {
          dopplerSalt: mined.salt,
          dopplerHookAddress: mined.hookAddress,
        };
      }
      startSalt = BigInt(mined.salt) + 1n;
    }

    throw new Error('Could not find an unused Doppler completion salt');
  }

  private mineDopplerHookSalt(args: {
    dopplerDeployer: Address;
    poolManager: Address;
    initializerAddress: Address;
    unsoldTokens: bigint;
    dopplerData: {
      minimumProceeds: bigint;
      maximumProceeds: bigint;
      startingTime: bigint;
      endingTime: bigint;
      startingTick: number;
      endingTick: number;
      epochLength: bigint;
      gamma: number;
      isToken0: boolean;
      numPDSlugs: bigint;
      lpFee: number;
      tickSpacing: number;
    };
    startSalt?: bigint;
  }): { salt: Hash; hookAddress: Address } {
    const { dopplerData } = args;
    const initHashData = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint24' },
      ],
      [
        args.poolManager,
        args.unsoldTokens,
        dopplerData.minimumProceeds,
        dopplerData.maximumProceeds,
        dopplerData.startingTime,
        dopplerData.endingTime,
        dopplerData.startingTick,
        dopplerData.endingTick,
        dopplerData.epochLength,
        dopplerData.gamma,
        dopplerData.isToken0,
        dopplerData.numPDSlugs,
        args.initializerAddress,
        dopplerData.lpFee,
      ],
    );

    const initHash = keccak256(
      encodePacked(['bytes', 'bytes'], [DopplerBytecode as Hex, initHashData]),
    );
    const hookBuffer = this.prepareCreate2Buffer(
      args.dopplerDeployer,
      initHash,
    );

    for (let salt = args.startSalt ?? 0n; salt < ONE_MILLION; salt++) {
      this.updateSaltInBuffer(hookBuffer, salt);
      const hookRaw = this.computeCreate2AddressFast(hookBuffer);
      const hookBigInt = BigInt(hookRaw);
      if ((hookBigInt & FLAG_MASK) !== DOPPLER_FLAGS) {
        continue;
      }

      return {
        salt: `0x${salt.toString(16).padStart(64, '0')}` as Hash,
        hookAddress: getAddress(hookRaw) as Address,
      };
    }

    throw new Error('Could not mine Doppler completion salt');
  }

  private mineOpeningAuctionHookAddress(params: {
    auctionDeployer: Address;
    openingAuctionInitializer: Address;
    poolManager: Address;
    auctionTokens: bigint;
    openingAuctionConfig: CreateOpeningAuctionParams<C>['openingAuction'];
    numeraire: Address;
    tokenFactory: Address;
    tokenFactoryData:
      | {
          name: string;
          symbol: string;
          baseURI: string;
          unit?: bigint;
        }
      | DopplerERC20V1TokenFactoryData
      | StandardTokenFactoryData;
    airlock: Address;
    initialSupply: bigint;
    tokenVariant: TokenFactoryVariant;
    migration?: MigrationConfig;
    addresses?: ReturnType<typeof getAddresses>;
    includeProtocolBalanceLimitExclusions?: boolean;
  }): [Hash, Address, Address, Hex] {
    const config = params.openingAuctionConfig;
    const initHashData = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        {
          type: 'tuple',
          components: [
            { type: 'uint256', name: 'auctionDuration' },
            { type: 'int24', name: 'minAcceptableTickToken0' },
            { type: 'int24', name: 'minAcceptableTickToken1' },
            { type: 'uint256', name: 'incentiveShareBps' },
            { type: 'int24', name: 'tickSpacing' },
            { type: 'uint24', name: 'fee' },
            { type: 'uint128', name: 'minLiquidity' },
            { type: 'uint256', name: 'shareToAuctionBps' },
          ],
        },
      ],
      [
        params.poolManager,
        params.openingAuctionInitializer,
        params.auctionTokens,
        {
          auctionDuration: BigInt(config.auctionDuration),
          minAcceptableTickToken0: config.minAcceptableTickToken0,
          minAcceptableTickToken1: config.minAcceptableTickToken1,
          incentiveShareBps: BigInt(config.incentiveShareBps),
          tickSpacing: config.tickSpacing,
          fee: config.fee,
          minLiquidity: config.minLiquidity,
          shareToAuctionBps: BigInt(config.shareToAuctionBps),
        },
      ],
    );

    const hookInitHash = keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [OpeningAuctionBytecode as Hex, initHashData],
      ),
    );

    const encodedTokenFactoryData =
      params.tokenVariant === 'doppler404'
        ? (() => {
            const t = params.tokenFactoryData as {
              name: string;
              symbol: string;
              baseURI: string;
              unit?: bigint;
            };
            return encodeAbiParameters(
              [
                { type: 'string' },
                { type: 'string' },
                { type: 'string' },
                { type: 'uint256' },
              ],
              [t.name, t.symbol, t.baseURI, t.unit ?? WAD],
            );
          })()
        : params.tokenVariant === 'dopplerERC20V1'
          ? this.encodeDopplerERC20V1TokenFactoryData(
              params.tokenFactoryData as DopplerERC20V1TokenFactoryData,
            )
          : this.encodeStandardTokenFactoryData(
              params.tokenFactoryData as StandardTokenFactoryData,
            );

    let tokenInitHash: Hash;
    if (params.tokenVariant === 'doppler404') {
      const t = params.tokenFactoryData as {
        name: string;
        symbol: string;
        baseURI: string;
        unit?: bigint;
      };
      const initData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'address' },
          { type: 'string' },
          { type: 'uint256' },
        ],
        [
          t.name,
          t.symbol,
          params.initialSupply,
          params.airlock,
          params.airlock,
          t.baseURI,
          t.unit ?? WAD,
        ],
      );
      tokenInitHash = keccak256(
        encodePacked(
          ['bytes', 'bytes'],
          [
            getDopplerDN404Bytecode(
              params.addresses?.doppler404Factory ?? params.tokenFactory,
            ),
            initData,
          ],
        ),
      );
    } else if (params.tokenVariant === 'dopplerERC20V1') {
      const tokenFactoryData =
        params.tokenFactoryData as DopplerERC20V1TokenFactoryData;
      tokenInitHash = this.computeSoladyCloneInitCodeHash(
        tokenFactoryData.implementation,
      );
    } else {
      tokenInitHash = this.computeStandardTokenInitHash(
        params.tokenFactoryData as StandardTokenFactoryData,
        params.tokenFactory,
      );
    }

    const isToken0 = isToken0Expected(params.numeraire);
    const numeraireBigInt = BigInt(params.numeraire);
    const hookBuffer = this.prepareCreate2Buffer(
      params.auctionDeployer,
      hookInitHash,
    );
    const tokenBuffer = this.prepareCreate2Buffer(
      params.tokenFactory,
      tokenInitHash,
    );

    for (let salt = 0n; salt < ONE_MILLION; salt++) {
      this.updateSaltInBuffer(hookBuffer, salt);
      const hookRaw = this.computeCreate2AddressFast(hookBuffer);
      if ((BigInt(hookRaw) & FLAG_MASK) !== OPENING_AUCTION_FLAGS) {
        continue;
      }

      this.updateSaltInBuffer(tokenBuffer, salt);
      const tokenRaw = this.computeCreate2AddressFast(tokenBuffer);
      const tokenBigInt = BigInt(tokenRaw);
      if (
        (isToken0 && tokenBigInt < numeraireBigInt) ||
        (!isToken0 && tokenBigInt > numeraireBigInt)
      ) {
        const hook = getAddress(hookRaw) as Address;
        const v1TokenFactoryData =
          params.tokenFactoryData as DopplerERC20V1TokenFactoryData;
        const finalEncodedTokenFactoryData =
          params.tokenVariant === 'dopplerERC20V1' &&
          params.includeProtocolBalanceLimitExclusions &&
          this.isDopplerERC20V1BalanceLimitActive(v1TokenFactoryData)
            ? this.encodeDopplerERC20V1TokenFactoryData({
                ...v1TokenFactoryData,
                excludedFromBalanceLimit:
                  this.mergeDopplerERC20V1BalanceLimitExclusions(
                    v1TokenFactoryData.excludedFromBalanceLimit,
                    [
                      hook,
                      params.migration && params.addresses
                        ? this.resolveUniswapV2MigrationPairExclusion({
                            migration: params.migration,
                            addresses: params.addresses,
                            tokenAddress: getAddress(tokenRaw) as Address,
                            numeraire: params.numeraire,
                          })
                        : undefined,
                    ],
                  ),
              })
            : encodedTokenFactoryData;
        return [
          `0x${salt.toString(16).padStart(64, '0')}` as Hash,
          hook,
          getAddress(tokenRaw) as Address,
          finalEncodedTokenFactoryData,
        ];
      }
    }

    throw new Error('Unable to mine opening auction salt');
  }

  private isCreateGasRevert(error: unknown): boolean {
    if (
      error instanceof ContractFunctionRevertedError ||
      error instanceof ExecutionRevertedError
    ) {
      return true;
    }
    if (!(error instanceof BaseError)) return false;

    return Boolean(
      error.walk(
        (cause) =>
          cause instanceof ContractFunctionRevertedError ||
          cause instanceof ExecutionRevertedError,
      ),
    );
  }

  private async resolveInternalCreateGasEstimate(args: {
    request?: unknown;
    address: Address;
    createParams: CreateParams;
    account?: Address | Account;
  }): Promise<InternalCreateGasEstimate> {
    const { request, address, createParams, account } = args;
    let gasFromRequest: bigint | undefined;
    if (
      request &&
      typeof request === 'object' &&
      'gas' in request &&
      typeof request.gas === 'bigint'
    ) {
      gasFromRequest = request.gas;
    }

    if (gasFromRequest !== undefined) {
      return { status: 'estimated', gas: gasFromRequest };
    }

    try {
      const gas = await (this.publicClient as PublicClient).estimateContractGas(
        {
          address,
          abi: airlockAbi,
          functionName: 'create',
          args: [{ ...createParams }],
          account,
        },
      );
      return { status: 'estimated', gas };
    } catch (error) {
      return this.isCreateGasRevert(error)
        ? { status: 'reverted', error }
        : { status: 'unavailable' };
    }
  }

  private async resolveCreateGasEstimate(args: {
    request?: unknown;
    address: Address;
    createParams: CreateParams;
    account?: Address | Account;
  }): Promise<bigint | undefined> {
    const estimate = await this.resolveInternalCreateGasEstimate(args);
    return estimate.status === 'estimated' ? estimate.gas : undefined;
  }

  private isDoppler404Token(
    token: TokenConfig,
  ): token is Doppler404TokenConfig {
    return (token as Doppler404TokenConfig).type === 'doppler404';
  }

  private isDopplerERC20V1Token(
    token: TokenConfig,
  ): token is DopplerERC20V1TokenConfig | InferredDopplerERC20V1TokenConfig {
    assertTokenConfigSupportsYearlyMintRate(token);
    return token.type !== 'standard' && token.type !== 'doppler404';
  }

  /**
   * Encode migration data based on the MigrationConfig
   * This replaces the manual encoding methods from the old SDKs
   */
  private encodeMigrationData(
    config: MigrationConfig,
    options?: {
      overrides?: ModuleAddressOverrides;
    },
  ): Hex {
    // Use custom encoder if available
    if (this.customMigrationEncoder) {
      return this.customMigrationEncoder(config);
    }

    if (
      config.type === 'uniswapV2' &&
      this.resolveUniswapV2Migrator(options?.overrides).isSplit
    ) {
      return encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [ZERO_ADDRESS, 0n],
      );
    }

    switch (config.type) {
      case 'uniswapV2':
        // V2 migrator expects empty data
        return '0x' as Hex;

      case 'uniswapV2Split': {
        const proceedsRecipient =
          config.proceedsSplit?.recipient ?? ZERO_ADDRESS;
        const proceedsShare = config.proceedsSplit?.share ?? 0n;

        return encodeAbiParameters(
          [{ type: 'address' }, { type: 'uint256' }],
          [proceedsRecipient, proceedsShare],
        );
      }

      case 'noOp':
        // NoOp migrator expects empty data
        return '0x' as Hex;

      case 'uniswapV4':
        // Encode V4 migration data with optional streamable fees config
        // When streamableFees is omitted, mirror legacy SDK behaviour by emitting an empty payload
        const streamableFees = config.streamableFees;
        if (!streamableFees) {
          // Default V4 migrator behaviour: no additional payload required
          return '0x';
        }

        // Copy beneficiaries, sort by address ascending and reject duplicates (required by contract)
        const beneficiaryData = sortBeneficiaries(streamableFees.beneficiaries);

        // Note: The contract will validate that the airlock owner gets at least 5%
        // If not present, the SDK user should add it manually

        return encodeAbiParameters(
          [
            { type: 'uint24' }, // fee
            { type: 'int24' }, // tickSpacing
            { type: 'uint32' }, // lockDuration (0 if no streamableFees)
            {
              type: 'tuple[]',
              components: [
                { type: 'address', name: 'beneficiary' },
                { type: 'uint96', name: 'shares' },
              ],
            },
          ],
          [
            config.fee,
            config.tickSpacing,
            streamableFees.lockDuration,
            beneficiaryData,
          ],
        );

      case 'uniswapV4Split': {
        const beneficiaryData = sortBeneficiaries(
          config.streamableFees.beneficiaries,
        );

        const proceedsRecipient =
          config.proceedsSplit?.recipient ?? ZERO_ADDRESS;
        const proceedsShare = config.proceedsSplit?.share ?? 0n;

        return encodeAbiParameters(
          [
            { type: 'uint24' },
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
            { type: 'uint256' },
          ],
          [
            config.fee,
            config.tickSpacing,
            config.streamableFees.lockDuration,
            beneficiaryData,
            proceedsRecipient,
            proceedsShare,
          ],
        );
      }

      case 'dopplerHook':
      case 'dopplerHookMigrator': {
        const dopplerHookMigratorConfig = config;

        // Copy beneficiaries, sort by address ascending and reject duplicates (required by contract)
        const beneficiaries = sortBeneficiaries(
          dopplerHookMigratorConfig.beneficiaries,
        );

        let dopplerHookAddress: Address = ZERO_ADDRESS;
        let onInitializationCalldata: Hex = '0x';

        if (dopplerHookMigratorConfig.hook) {
          dopplerHookAddress = dopplerHookMigratorConfig.hook.hookAddress;
          onInitializationCalldata =
            dopplerHookMigratorConfig.hook.onInitializationCalldata ?? '0x';
        }

        const proceedsRecipient =
          dopplerHookMigratorConfig.proceedsSplit?.recipient ?? ZERO_ADDRESS;
        const proceedsShare =
          dopplerHookMigratorConfig.proceedsSplit?.share ?? 0n;

        return encodeAbiParameters(
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
          [
            dopplerHookMigratorConfig.fee,
            dopplerHookMigratorConfig.useDynamicFee ?? false,
            dopplerHookMigratorConfig.tickSpacing,
            dopplerHookMigratorConfig.lockDuration,
            beneficiaries,
            dopplerHookAddress,
            onInitializationCalldata,
            proceedsRecipient,
            proceedsShare,
          ],
        );
      }

      default:
        throw new Error('Unknown migration type');
    }
  }

  /**
   * Encode create params for Uniswap V4 Multicurve initializer/migrator flow
   */
  private normalizeUint32(value: number | bigint, label: string): number {
    const normalized =
      typeof value === 'bigint' ? Number(value) : Number(value);
    if (!Number.isFinite(normalized) || !Number.isInteger(normalized)) {
      throw new Error(
        `${label} must be an integer number of seconds since Unix epoch`,
      );
    }
    if (normalized < 0) {
      throw new Error(`${label} cannot be negative`);
    }
    const UINT32_MAX = 0xffffffff;
    if (normalized > UINT32_MAX) {
      throw new Error(
        `${label} must fit within uint32 (seconds since Unix epoch up to year 2106)`,
      );
    }
    return normalized;
  }

  private validateV4StreamableFeesConfig(
    streamableFees: StreamableFeesConfig | undefined,
    label: string,
    required = false,
  ): void {
    if (!streamableFees) {
      if (required) {
        throw new Error(`${label} requires streamableFees configuration`);
      }
      return;
    }

    const beneficiaries = streamableFees.beneficiaries;
    if (beneficiaries.length === 0) {
      throw new Error(`At least one beneficiary is required for ${label}`);
    }

    const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n);
    if (totalShares !== WAD) {
      throw new Error(
        `Beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`,
      );
    }

    for (const beneficiary of beneficiaries) {
      if (beneficiary.shares <= 0n) {
        throw new Error('Each beneficiary must have positive shares');
      }
    }

    const lockDuration = Number(streamableFees.lockDuration);
    if (!Number.isInteger(lockDuration) || lockDuration < 0) {
      throw new Error(
        `${label} lockDuration must be a non-negative integer number of seconds`,
      );
    }
    if (lockDuration > 0xffffffff) {
      throw new Error(`${label} lockDuration must fit within uint32`);
    }
  }

  private validateProceedsSplitConfig(
    proceedsSplit: ProceedsSplitConfig | undefined,
    label: string,
  ): void {
    if (!proceedsSplit) return;

    if (proceedsSplit.recipient === ZERO_ADDRESS) {
      throw new Error(
        `${label} proceeds split recipient cannot be zero address`,
      );
    }

    if (proceedsSplit.share < 0n) {
      throw new Error(`${label} proceeds split share cannot be negative`);
    }

    if (proceedsSplit.share > MAX_PROCEEDS_SPLIT_SHARE) {
      throw new Error(
        `${label} proceeds split share cannot exceed ${MAX_PROCEEDS_SPLIT_SHARE}`,
      );
    }
  }

  private resolveMulticurveInitializerMode(
    params: CreateMulticurveParams<C>,
  ): ResolvedMulticurveInitializerMode {
    const legacySchedule = params.schedule;
    const legacyHook = params.dopplerHook;
    const hasLegacySchedule = legacySchedule !== undefined;
    const hasLegacyHook = legacyHook !== undefined;

    if (hasLegacySchedule && hasLegacyHook) {
      throw new Error(
        'Cannot combine schedule and dopplerHook legacy multicurve options. Use exactly one initializer mode.',
      );
    }

    const initializer = params.initializer;
    let mode: ResolvedMulticurveInitializerMode;

    if (!initializer) {
      if (hasLegacySchedule) {
        mode = {
          type: 'scheduled',
          startTime: this.normalizeUint32(
            legacySchedule.startTime,
            'Scheduled multicurve startTime',
          ),
        };
      } else if (hasLegacyHook) {
        mode = { type: 'dopplerHook', hookConfig: legacyHook };
      } else {
        mode = { type: 'dopplerHook' };
      }
    } else {
      switch (initializer.type) {
        case 'dopplerHook':
        case 'dopplerHookInitializer': {
          if (hasLegacySchedule || hasLegacyHook) {
            throw new Error(
              "Initializer type 'dopplerHookInitializer' cannot be combined with legacy schedule or RehypeDopplerHookInitializer configuration",
            );
          }
          mode = { type: 'dopplerHook' };
          break;
        }
        case 'standard': {
          if (hasLegacySchedule || hasLegacyHook) {
            throw new Error(
              "Initializer type 'standard' cannot be combined with legacy schedule/dopplerHook fields",
            );
          }
          mode = { type: 'standard' };
          break;
        }
        case 'scheduled': {
          if (hasLegacyHook) {
            throw new Error(
              "Initializer type 'scheduled' cannot be combined with dopplerHook",
            );
          }
          const normalizedStart = this.normalizeUint32(
            initializer.startTime,
            'Scheduled multicurve startTime',
          );
          if (hasLegacySchedule) {
            const legacyStart = this.normalizeUint32(
              legacySchedule.startTime,
              'Scheduled multicurve startTime',
            );
            if (legacyStart !== normalizedStart) {
              throw new Error(
                'Conflicting scheduled start times provided via initializer and schedule',
              );
            }
          }
          mode = { type: 'scheduled', startTime: normalizedStart };
          break;
        }
        case 'decay': {
          if (hasLegacySchedule || hasLegacyHook) {
            throw new Error(
              "Initializer type 'decay' cannot be combined with legacy schedule/dopplerHook fields",
            );
          }
          const startTime = this.normalizeUint32(
            initializer.startTime,
            'Decay multicurve startTime',
          );
          const startFee = Number(initializer.startFee);
          const durationSeconds = this.normalizeUint32(
            initializer.durationSeconds,
            'Decay multicurve durationSeconds',
          );
          const endFee = Number(params.pool.fee);
          if (!Number.isInteger(startFee)) {
            throw new Error('Decay multicurve startFee must be an integer');
          }
          if (startFee < 0 || startFee > DECAY_MAX_START_FEE) {
            throw new Error(
              `Decay multicurve startFee must be between 0 and ${DECAY_MAX_START_FEE}`,
            );
          }
          if (!Number.isInteger(endFee) || endFee < 0 || endFee > V4_MAX_FEE) {
            throw new Error(
              `Multicurve pool fee must be between 0 and ${V4_MAX_FEE}`,
            );
          }
          if (startFee < endFee) {
            throw new Error(
              `Decay multicurve startFee (${startFee}) must be greater than or equal to terminal pool fee (${endFee})`,
            );
          }
          if (startFee > endFee && durationSeconds <= 0) {
            throw new Error(
              'Decay multicurve durationSeconds must be greater than 0 when startFee is greater than terminal pool fee',
            );
          }
          mode = {
            type: 'decay',
            startTime,
            startFee,
            durationSeconds,
          };
          break;
        }
        case 'rehype': {
          if (hasLegacySchedule) {
            throw new Error(
              "Initializer type 'rehype' cannot be combined with schedule",
            );
          }
          mode = { type: 'dopplerHook', hookConfig: initializer.config };
          break;
        }
        default: {
          const exhaustive: never = initializer;
          throw new Error(
            `Unsupported multicurve initializer type: ${(exhaustive as { type?: string })?.type ?? 'unknown'}`,
          );
        }
      }
    }

    // Backwards-compatible behavior: an explicit dopplerHookInitializer override
    // selects the DopplerHookInitializer path even without hook config.
    if (params.modules?.dopplerHookInitializer !== undefined) {
      if (mode.type === 'standard') {
        mode = { type: 'dopplerHook' };
      } else if (mode.type !== 'dopplerHook') {
        throw new Error(
          'modules.dopplerHookInitializer can only be used with the dopplerHookInitializer, rehype, or standard multicurve initializer mode',
        );
      }
    }

    return mode;
  }

  encodeCreateMulticurveParams(
    params: CreateMulticurveParams<C>,
  ): CreateParams {
    // Validate parameters
    this.validateMulticurveParams(params);

    // Basic validation
    if (!params.pool || params.pool.curves.length === 0) {
      throw new Error('Multicurve pool must include at least one curve');
    }

    const normalizedCurves = this.normalizeMulticurveCurves(
      params.pool.curves,
      params.pool.tickSpacing,
      params.sale.numTokensToSell,
    );

    const addresses = getAddresses(this.chainId);
    const resolvedBundler = params.devBuy
      ? (params.modules?.bundler ?? addresses.bundler)
      : undefined;
    if (
      params.devBuy &&
      (!resolvedBundler || resolvedBundler === ZERO_ADDRESS)
    ) {
      throw new Error(
        'Bundler address not configured on this chain. Override via builder.withBundler() or modules.bundler.',
      );
    }

    // Pool initializer data: (fee, tickSpacing, farTick, curves[], beneficiaries[], dopplerHook, onInitializationCalldata, graduationCalldata)
    const sortedBeneficiaries = sortBeneficiaries(
      params.pool.beneficiaries ?? [],
    );

    const initializerMode = this.resolveMulticurveInitializerMode(params);
    const useScheduledInitializer = initializerMode.type === 'scheduled';
    const useDecayInitializer = initializerMode.type === 'decay';
    const useDopplerHookInitializer = initializerMode.type === 'dopplerHook';
    const normalizedRehypeHookConfig =
      initializerMode.type === 'dopplerHook' && initializerMode.hookConfig
        ? normalizeRehypeDopplerHookInitializerConfig(
            initializerMode.hookConfig,
            undefined,
            params.integrator,
          )
        : undefined;

    // Shared curve and beneficiary component definitions for ABI encoding
    const curveComponents = [
      { type: 'int24', name: 'tickLower' },
      { type: 'int24', name: 'tickUpper' },
      { type: 'uint16', name: 'numPositions' },
      { type: 'uint256', name: 'shares' },
    ];
    const beneficiaryComponents = [
      { type: 'address', name: 'beneficiary' },
      { type: 'uint96', name: 'shares' },
    ];

    // Prepare curve and beneficiary data (shared across all initializer formats)
    const curvesData = normalizedCurves.map(
      (c: (typeof normalizedCurves)[number]) => ({
        tickLower: c.tickLower,
        tickUpper: c.tickUpper,
        numPositions: c.numPositions,
        shares: c.shares,
      }),
    );
    const beneficiariesData = sortedBeneficiaries.map(
      (b: NonNullable<typeof params.pool.beneficiaries>[number]) => ({
        beneficiary: b.beneficiary,
        shares: b.shares,
      }),
    );

    // Encode pool initializer data based on which initializer is being used
    // Each initializer expects a different InitData struct format:
    //
    // UniswapV4MulticurveInitializer (basic):
    //   struct InitData { uint24 fee; int24 tickSpacing; Curve[] curves; BeneficiaryData[] beneficiaries; }
    //
    // UniswapV4ScheduledMulticurveInitializer:
    //   struct InitData { uint24 fee; int24 tickSpacing; Curve[] curves; BeneficiaryData[] beneficiaries; uint32 startingTime; }
    //
    // DecayMulticurveInitializer:
    //   struct InitData { uint24 startFee; uint24 fee; uint32 durationSeconds; int24 tickSpacing; Curve[] curves;
    //                     BeneficiaryData[] beneficiaries; uint32 startingTime; }
    //
    // DopplerHookInitializer:
    //   struct InitData { uint24 fee; int24 tickSpacing; int24 farTick; Curve[] curves; BeneficiaryData[] beneficiaries;
    //                     address dopplerHook; bytes onInitializationDopplerHookCalldata; bytes graduationDopplerHookCalldata; }

    let poolInitializerData: Hex;

    if (useDopplerHookInitializer) {
      const hookConfig = normalizedRehypeHookConfig;
      // DopplerHookInitializer format (8 fields)
      // Calculate farTick: use provided value from dopplerHook, or auto-calculate from curves
      let farTick: number;
      if (hookConfig?.farTick !== undefined) {
        farTick = hookConfig.farTick;
      } else {
        // Keep farTick strictly inside the global curve range so it remains
        // reachable regardless of whether the mined token sorts as token0 or token1.
        const allTickUppers = normalizedCurves.map((c) => c.tickUpper);
        farTick = Math.max(...allTickUppers) - params.pool.tickSpacing;
      }

      // Encode dopplerHook initialization calldata if provided
      let onInitializationDopplerHookCalldata: Hex = '0x';
      let graduationDopplerHookCalldata: Hex = '0x';
      let dopplerHookAddress: Address = ZERO_ADDRESS;

      if (hookConfig) {
        dopplerHookAddress = hookConfig.hookAddress;

        onInitializationDopplerHookCalldata =
          encodeRehypeDopplerHookInitializerData(
            params.sale.numeraire,
            hookConfig,
          );
        graduationDopplerHookCalldata = hookConfig.graduationCalldata ?? '0x';
      }

      const dopplerHookTupleComponents = [
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'farTick', type: 'int24' },
        { name: 'curves', type: 'tuple[]', components: curveComponents },
        {
          name: 'beneficiaries',
          type: 'tuple[]',
          components: beneficiaryComponents,
        },
        { name: 'dopplerHook', type: 'address' },
        { name: 'onInitializationDopplerHookCalldata', type: 'bytes' },
        { name: 'graduationDopplerHookCalldata', type: 'bytes' },
      ];

      poolInitializerData = encodeAbiParameters(
        [{ type: 'tuple', components: dopplerHookTupleComponents }],
        [
          {
            fee: params.pool.fee,
            tickSpacing: params.pool.tickSpacing,
            farTick,
            curves: curvesData,
            beneficiaries: beneficiariesData,
            dopplerHook: dopplerHookAddress,
            onInitializationDopplerHookCalldata,
            graduationDopplerHookCalldata,
          },
        ],
      );
    } else if (useDecayInitializer) {
      // DecayMulticurveInitializer format (7 fields)
      const decayTupleComponents = [
        { name: 'startFee', type: 'uint24' },
        { name: 'fee', type: 'uint24' },
        { name: 'durationSeconds', type: 'uint32' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'curves', type: 'tuple[]', components: curveComponents },
        {
          name: 'beneficiaries',
          type: 'tuple[]',
          components: beneficiaryComponents,
        },
        { name: 'startingTime', type: 'uint32' },
      ];

      if (initializerMode.type !== 'decay') {
        throw new Error('Invalid multicurve initializer state for decay mode');
      }

      poolInitializerData = encodeAbiParameters(
        [{ type: 'tuple', components: decayTupleComponents }],
        [
          {
            startFee: initializerMode.startFee,
            fee: params.pool.fee,
            durationSeconds: initializerMode.durationSeconds,
            tickSpacing: params.pool.tickSpacing,
            curves: curvesData,
            beneficiaries: beneficiariesData,
            startingTime: initializerMode.startTime,
          },
        ],
      );
    } else if (useScheduledInitializer) {
      // UniswapV4ScheduledMulticurveInitializer format (5 fields)
      if (initializerMode.type !== 'scheduled') {
        throw new Error(
          'Invalid multicurve initializer state for scheduled mode',
        );
      }
      const scheduledTupleComponents = [
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'curves', type: 'tuple[]', components: curveComponents },
        {
          name: 'beneficiaries',
          type: 'tuple[]',
          components: beneficiaryComponents,
        },
        { name: 'startingTime', type: 'uint32' },
      ];

      poolInitializerData = encodeAbiParameters(
        [{ type: 'tuple', components: scheduledTupleComponents }],
        [
          {
            fee: params.pool.fee,
            tickSpacing: params.pool.tickSpacing,
            curves: curvesData,
            beneficiaries: beneficiariesData,
            startingTime: initializerMode.startTime,
          },
        ],
      );
    } else {
      // UniswapV4MulticurveInitializer format (4 fields - basic)
      const basicTupleComponents = [
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'curves', type: 'tuple[]', components: curveComponents },
        {
          name: 'beneficiaries',
          type: 'tuple[]',
          components: beneficiaryComponents,
        },
      ];

      poolInitializerData = encodeAbiParameters(
        [{ type: 'tuple', components: basicTupleComponents }],
        [
          {
            fee: params.pool.fee,
            tickSpacing: params.pool.tickSpacing,
            curves: curvesData,
            beneficiaries: beneficiariesData,
          },
        ],
      );
    }

    this.assertDoppler404Compatibility({
      token: params.token,
      vesting: params.vesting,
      configuredFactory: addresses.doppler404Factory,
    });

    const resolvedTokenFactory: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : this.isDopplerERC20V1Token(params.token)
          ? (params.modules?.dopplerERC20V1Factory ??
            addresses.dopplerERC20V1Factory)
          : this.usesDerc20V2Vesting(params.vesting)
            ? addresses.derc20V2Factory
            : addresses.tokenFactory);
    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured. Provide an explicit address or ensure chain config includes a valid factory.',
      );
    }
    this.assertStandardTokenFactoryCompatibility({
      token: params.token,
      vesting: params.vesting,
      tokenFactory: resolvedTokenFactory,
      addresses,
    });

    // Token factory data (standard vs 404)
    let tokenFactoryData: Hex | undefined = undefined;
    if (this.isDoppler404Token(params.token)) {
      const token404 = params.token;
      const unit = token404.unit !== undefined ? BigInt(token404.unit) : WAD;
      tokenFactoryData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
        ],
        [token404.name, token404.symbol, token404.baseURI, unit],
      );
    } else if (!this.isDopplerERC20V1Token(params.token)) {
      const standardTokenFactoryData = this.buildStandardTokenFactoryData({
        token: params.token as StandardTokenConfig,
        sale: params.sale,
        vesting: params.vesting,
        userAddress: params.userAddress,
        airlock: params.modules?.airlock ?? addresses.airlock,
        tokenFactory: resolvedTokenFactory,
        addresses,
      });
      tokenFactoryData = this.encodeStandardTokenFactoryData(
        standardTokenFactoryData,
      );
    }

    // Governance factory data
    const governanceFactoryData: Hex = (() => {
      if (params.governance.type === 'noOp') {
        return '0x' as Hex;
      }
      if (params.governance.type === 'launchpad') {
        return encodeAbiParameters(
          [{ type: 'address' }],
          [params.governance.multisig],
        );
      }
      return encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom'
            ? params.governance.initialVotingDelay
            : this.governanceDuration(
                params.token,
                DEFAULT_V4_INITIAL_VOTING_DELAY,
              ),
          params.governance.type === 'custom'
            ? params.governance.initialVotingPeriod
            : this.governanceDuration(
                params.token,
                DEFAULT_V4_INITIAL_VOTING_PERIOD,
              ),
          params.governance.type === 'custom'
            ? params.governance.initialProposalThreshold
            : DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
        ],
      );
    })();

    // Resolve module addresses
    const salt = params.salt ?? this.generateRandomSalt(params.userAddress);

    const resolvedInitializer: Address | undefined = (() => {
      if (useDopplerHookInitializer) {
        return (
          params.modules?.dopplerHookInitializer ??
          addresses.dopplerHookInitializer
        );
      }
      if (useDecayInitializer) {
        return (
          params.modules?.v4DecayMulticurveInitializer ??
          addresses.v4DecayMulticurveInitializer
        );
      }
      if (useScheduledInitializer) {
        return (
          params.modules?.v4ScheduledMulticurveInitializer ??
          addresses.v4ScheduledMulticurveInitializer
        );
      }
      return (
        params.modules?.v4MulticurveInitializer ??
        addresses.v4MulticurveInitializer
      );
    })();
    if (!resolvedInitializer || resolvedInitializer === ZERO_ADDRESS) {
      if (useDopplerHookInitializer) {
        throw new Error(
          'DopplerHookInitializer address not configured on this chain. Override via builder.withDopplerHookInitializer() or update chain config.',
        );
      }
      if (useDecayInitializer) {
        throw new Error(
          'Decay multicurve initializer address not configured on this chain. Override via builder.withV4DecayMulticurveInitializer() or update chain config.',
        );
      }
      throw new Error(
        useScheduledInitializer
          ? 'Scheduled multicurve initializer address not configured on this chain. Override via builder or update chain config.'
          : 'Multicurve initializer address not configured on this chain. Override via builder or update chain config.',
      );
    }

    // When beneficiaries are provided, use NoOpMigrator with empty data
    // The beneficiaries will be handled by the multicurve initializer, not the migrator
    const hasBeneficiaries =
      params.pool.beneficiaries && params.pool.beneficiaries.length > 0;

    let liquidityMigratorData: Hex;
    let resolvedMigrator: Address | undefined;

    if (hasBeneficiaries) {
      // Use NoOpMigrator with empty data when beneficiaries are provided
      liquidityMigratorData = '0x' as Hex;
      resolvedMigrator = params.modules?.noOpMigrator ?? addresses.noOpMigrator;
      if (!resolvedMigrator || resolvedMigrator === ZERO_ADDRESS) {
        throw new Error(
          'NoOpMigrator address not configured on this chain. Override via modules.noOpMigrator or update chain config.',
        );
      }
    } else {
      // Use standard migration flow when no beneficiaries
      liquidityMigratorData = this.encodeMigrationData(params.migration, {
        overrides: params.modules,
      });
      resolvedMigrator = this.getMigratorAddress(
        params.migration,
        params.modules,
      );
      if (!resolvedMigrator || resolvedMigrator === ZERO_ADDRESS) {
        throw new Error(
          'Migrator address not configured on this chain. Override via builder or update chain config.',
        );
      }
    }

    if (this.isDopplerERC20V1Token(params.token)) {
      const includeProtocolBalanceLimitExclusions =
        this.usesDefaultDopplerERC20V1Integration(params.modules);
      const resolvedV1TokenFactoryData =
        this.resolveDopplerERC20V1TokenFactoryData({
          token: params.token,
          sale: params.sale,
          vesting: params.vesting,
          userAddress: params.userAddress,
          addresses,
          governance: params.governance,
          modules: params.modules,
          protocolBalanceLimitExclusions: includeProtocolBalanceLimitExclusions
            ? [
                resolvedInitializer,
                resolvedMigrator,
                params.modules?.poolManager ?? addresses.poolManager,
                ...this.resolveMigrationLockerBalanceLimitExclusions(
                  params.migration,
                  addresses,
                ),
                ...this.resolveGovernanceBalanceLimitExclusions(
                  params.governance,
                ),
                ...(params.devBuy
                  ? [
                      params.devBuy.recipient,
                      ...(params.devBuy.vesting.vestingDuration !== 0n &&
                      resolvedBundler
                        ? [resolvedBundler]
                        : []),
                    ]
                  : []),
              ]
            : undefined,
        });
      const predictedTokenAddress = this.predictDopplerERC20V1TokenAddress({
        tokenFactory: resolvedTokenFactory,
        salt,
        implementation: resolvedV1TokenFactoryData.implementation,
      });
      const finalV1TokenFactoryData = includeProtocolBalanceLimitExclusions
        ? this.withDopplerERC20V1BalanceLimitExclusions(
            resolvedV1TokenFactoryData,
            [
              this.resolveUniswapV2MigrationPairExclusion({
                migration: params.migration,
                addresses,
                tokenAddress: predictedTokenAddress,
                numeraire: params.sale.numeraire,
              }),
            ],
          )
        : resolvedV1TokenFactoryData;
      tokenFactoryData = this.encodeDopplerERC20V1TokenFactoryData(
        finalV1TokenFactoryData,
      );
    }

    const governanceFactoryAddress = this.resolveGovernanceFactoryAddress({
      governance: params.governance,
      modules: params.modules,
      addresses,
      noOpError:
        'No-op governance requested, but no-op governanceFactory is not configured on this chain.',
      launchpadError:
        'Launchpad governance requested, but launchpadGovernanceFactory is not configured on this chain.',
      standardError:
        'Standard governance requested but governanceFactory is not deployed on this chain.',
    });

    if (!tokenFactoryData) {
      throw new Error('Token factory data could not be resolved.');
    }

    const createParams: CreateParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactory,
      tokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData,
      poolInitializer: resolvedInitializer,
      poolInitializerData,
      liquidityMigrator: resolvedMigrator,
      liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt,
    };

    return createParams;
  }

  private resolveBundlerAddress(params: CreateMulticurveParams<C>): Address {
    const bundler =
      params.modules?.bundler ?? getAddresses(this.chainId).bundler;
    if (!bundler || bundler === ZERO_ADDRESS) {
      throw new Error(
        'Bundler address not configured on this chain. Override via builder.withBundler() or modules.bundler.',
      );
    }
    return bundler;
  }

  private async ensureDevBuyInitializerCompatibility(args: {
    params: CreateMulticurveParams<C>;
    bundler: Address;
  }): Promise<void> {
    const initializerMode = this.resolveMulticurveInitializerMode(args.params);
    if (initializerMode.type !== 'dopplerHook') {
      throw new Error(
        'Dev buys require a DopplerHookInitializer or Rehype initializer',
      );
    }

    const rehypeInitializer = initializerMode.hookConfig?.hookAddress;
    if (!rehypeInitializer) return;

    const configuredBundler = (await (
      this.publicClient as PublicClient
    ).readContract({
      address: rehypeInitializer,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'bundler',
    })) as Address;
    if (configuredBundler.toLowerCase() !== args.bundler.toLowerCase()) {
      throw new Error(
        `Rehype initializer ${rehypeInitializer} is configured for Bundler ${configuredBundler}, not ${args.bundler}`,
      );
    }
  }

  private parseBundleSimulation(result: unknown): {
    asset: Address;
    poolKey: V4PoolKey;
    governance: Address;
    timelock: Address;
    amountOut: bigint;
  } {
    const values = Array.isArray(result)
      ? result
      : result && typeof result === 'object'
        ? [
            (result as Record<string, unknown>).asset,
            (result as Record<string, unknown>).poolKey,
            (result as Record<string, unknown>).governance,
            (result as Record<string, unknown>).timelock,
            (result as Record<string, unknown>).amountOut,
          ]
        : [];
    if (values.length < 5) {
      throw new Error('Failed to simulate multicurve dev buy');
    }
    return {
      asset: values[0] as Address,
      poolKey: this.normalizePoolKey(values[1]),
      governance: values[2] as Address,
      timelock: values[3] as Address,
      amountOut: values[4] as bigint,
    };
  }

  private async resolveFinalMulticurveCreate(args: {
    params: CreateMulticurveParams<C>;
    simulationAccount?: Address | Account;
    createParams?: CreateParams;
  }) {
    const { params, simulationAccount } = args;
    const addresses = getAddresses(this.chainId);
    const airlock = params.modules?.airlock ?? addresses.airlock;
    const createParams =
      args.createParams ?? this.encodeCreateMulticurveParams(params);

    if (!params.devBuy) {
      const simulation = await (
        this.publicClient as PublicClient
      ).simulateContract({
        address: airlock,
        abi: airlockAbi,
        functionName: 'create',
        args: [{ ...createParams }],
        account: simulationAccount,
      });
      const result = simulation.result as readonly unknown[] | undefined;
      if (!result || !Array.isArray(result) || result.length < 5) {
        throw new Error('Failed to simulate multicurve create');
      }

      const request = simulation.request;

      const tokenAddress = result[0] as Address;
      const poolIdentity = await this.computeMulticurvePoolIdentity(
        params,
        tokenAddress,
      );
      const prediction: MulticurveCreatePrediction = {
        tokenAddress,
        poolOrHookAddress: result[1] as Address,
        governanceAddress: result[2] as Address,
        timelockAddress: result[3] as Address,
        migrationPoolAddress: result[4] as Address,
        ...poolIdentity,
      };
      return { airlock, createParams, prediction, request };
    }

    this.validateMulticurveDevBuy(params.devBuy);
    const bundler = this.resolveBundlerAddress(params);
    await this.ensureDevBuyInitializerCompatibility({ params, bundler });

    const simulation = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'simulateBundle',
      args: [{ ...createParams }, params.devBuy.exactAmountIn],
    });
    const result = this.parseBundleSimulation(simulation.result);

    const currency0 = result.poolKey.currency0.toLowerCase();
    const currency1 = result.poolKey.currency1.toLowerCase();
    const asset = result.asset.toLowerCase();
    const numeraire = createParams.numeraire.toLowerCase();
    if (
      !(
        (currency0 === asset && currency1 === numeraire) ||
        (currency1 === asset && currency0 === numeraire)
      )
    ) {
      throw new Error(
        'Bundler simulation returned a pool key that does not contain the created asset and numeraire',
      );
    }
    if (
      result.poolKey.hooks.toLowerCase() !==
      createParams.poolInitializer.toLowerCase()
    ) {
      throw new Error(
        'Bundler simulation returned an unexpected pool initializer',
      );
    }

    const prediction: MulticurveCreatePrediction = {
      tokenAddress: result.asset,
      poolOrHookAddress: result.asset,
      governanceAddress: result.governance,
      timelockAddress: result.timelock,
      poolKey: result.poolKey,
      poolId: this.computePoolId(result.poolKey) as Hex,
      tokenIsCurrency0: currency0 === asset,
    };
    const devBuy: PreparedMulticurveDevBuy = {
      ...params.devBuy,
      vesting: { ...params.devBuy.vesting },
      bundler,
      simulatedAmountOut: result.amountOut,
    };
    return { airlock, bundler, createParams, prediction, devBuy };
  }

  private buildDevBuyTransaction(args: {
    createParams: CreateParams;
    devBuy: PreparedMulticurveDevBuy;
  }): PreparedMulticurveCreate<C>['transaction'] {
    return {
      to: args.devBuy.bundler,
      data: encodeFunctionData({
        abi: bundlerAbi,
        functionName: 'bundle',
        args: [
          { ...args.createParams },
          { ...args.devBuy.vesting },
          args.devBuy.exactAmountIn,
          args.devBuy.recipient,
        ],
      }),
      value:
        args.createParams.numeraire === ZERO_ADDRESS
          ? args.devBuy.exactAmountIn
          : 0n,
    };
  }

  private async readDevBuyAllowance(args: {
    createParams: CreateParams;
    account: Address;
    bundler: Address;
  }): Promise<bigint | undefined> {
    if (args.createParams.numeraire === ZERO_ADDRESS) {
      return undefined;
    }
    return (await (this.publicClient as PublicClient).readContract({
      address: args.createParams.numeraire,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [args.account, args.bundler],
    })) as bigint;
  }

  private async estimateDevBuyGas(args: {
    createParams: CreateParams;
    devBuy: PreparedMulticurveDevBuy;
    account: Address | Account;
  }): Promise<MulticurveCreateGasEstimate> {
    try {
      const gas = await (this.publicClient as PublicClient).estimateContractGas(
        {
          address: args.devBuy.bundler,
          abi: bundlerAbi,
          functionName: 'bundle',
          args: [
            { ...args.createParams },
            { ...args.devBuy.vesting },
            args.devBuy.exactAmountIn,
            args.devBuy.recipient,
          ],
          account: args.account,
          value:
            args.createParams.numeraire === ZERO_ADDRESS
              ? args.devBuy.exactAmountIn
              : 0n,
        },
      );
      return { status: 'estimated', gas };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async prepareCreateMulticurve(
    params: CreateMulticurveParams<C>,
    options: PrepareCreateMulticurveOptions,
  ): Promise<PreparedMulticurveCreate<C>> {
    const resolved = await this.resolveFinalMulticurveCreate({
      params,
      simulationAccount: options.account,
    });
    if (!resolved.devBuy) {
      const internalGasEstimate = await this.resolveInternalCreateGasEstimate({
        request: resolved.request,
        address: resolved.airlock,
        createParams: resolved.createParams,
        account: options.account,
      });
      if (internalGasEstimate.status === 'reverted') {
        throw internalGasEstimate.error;
      }
      return {
        chainId: this.chainId,
        account: options.account,
        airlock: resolved.airlock,
        createParams: resolved.createParams,
        prediction: resolved.prediction,
        transaction: {
          to: resolved.airlock,
          data: encodeFunctionData({
            abi: airlockAbi,
            functionName: 'create',
            args: [{ ...resolved.createParams }],
          }),
          value: 0n,
        },
        gasEstimate: internalGasEstimate,
      };
    }

    const allowance = await this.readDevBuyAllowance({
      createParams: resolved.createParams,
      account: options.account,
      bundler: resolved.devBuy.bundler,
    });
    const approvalRequired =
      allowance !== undefined && allowance < resolved.devBuy.exactAmountIn;
    const approvalTransaction = approvalRequired
      ? {
          to: resolved.createParams.numeraire,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [resolved.devBuy.bundler, resolved.devBuy.exactAmountIn],
          }),
          value: 0n,
        }
      : undefined;
    const gasEstimate = approvalRequired
      ? ({ status: 'unavailable' } as const)
      : await this.estimateDevBuyGas({
          createParams: resolved.createParams,
          devBuy: resolved.devBuy,
          account: options.account,
        });
    return {
      chainId: this.chainId,
      account: options.account,
      airlock: resolved.airlock,
      createParams: resolved.createParams,
      prediction: resolved.prediction,
      transaction: this.buildDevBuyTransaction({
        createParams: resolved.createParams,
        devBuy: resolved.devBuy,
      }),
      approvalTransaction,
      devBuy: resolved.devBuy,
      gasEstimate,
    };
  }

  async simulateCreateMulticurve(
    params: CreateMulticurveParams<C>,
  ): Promise<SimulatedMulticurveCreate<C>> {
    const paramsSnapshot = structuredClone(params);
    const resolved = await this.resolveFinalMulticurveCreate({
      params: paramsSnapshot,
      simulationAccount: this.walletClient?.account,
    });
    const createParamsSnapshot = structuredClone(resolved.createParams);
    let gasEstimate: bigint | undefined;
    if (resolved.devBuy) {
      const account = this.walletClient?.account ?? paramsSnapshot.userAddress;
      const allowance = await this.readDevBuyAllowance({
        createParams: resolved.createParams,
        account:
          typeof account === 'string' ? account : (account.address as Address),
        bundler: resolved.devBuy.bundler,
      });
      if (
        allowance === undefined ||
        allowance >= resolved.devBuy.exactAmountIn
      ) {
        const estimate = await this.estimateDevBuyGas({
          createParams: resolved.createParams,
          devBuy: resolved.devBuy,
          account,
        });
        gasEstimate =
          estimate.status === 'estimated' ? estimate.gas : undefined;
      }
    } else {
      gasEstimate = await this.resolveCreateGasEstimate({
        request: resolved.request,
        address: resolved.airlock,
        createParams: resolved.createParams,
        account: this.walletClient?.account ?? paramsSnapshot.userAddress,
      });
    }

    return {
      createParams: resolved.createParams,
      tokenAddress: resolved.prediction.tokenAddress,
      poolId: resolved.prediction.poolId,
      gasEstimate,
      devBuy: resolved.devBuy,
      execute: () =>
        this.createMulticurve(paramsSnapshot, {
          _createParams: createParamsSnapshot,
        }),
    };
  }

  async createMulticurve(
    params: CreateMulticurveParams<C>,
    options?: { _createParams?: CreateParams },
  ): Promise<MulticurveCreateResult> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const resolved = await this.resolveFinalMulticurveCreate({
      params,
      simulationAccount: this.walletClient.account,
      createParams: options?._createParams,
    });
    let approvalTransactionHash: Hash | undefined;
    let hash: Hash;

    if (resolved.devBuy) {
      const account = this.walletClient.account;
      if (!account) {
        throw new Error('Wallet account required for write operations');
      }
      const accountAddress =
        typeof account === 'string' ? account : account.address;
      const [allowance, balance] = await Promise.all([
        this.readDevBuyAllowance({
          createParams: resolved.createParams,
          account: accountAddress,
          bundler: resolved.devBuy.bundler,
        }),
        resolved.createParams.numeraire === ZERO_ADDRESS
          ? undefined
          : (this.publicClient as PublicClient).readContract({
              address: resolved.createParams.numeraire,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [accountAddress],
            }),
      ]);
      if (balance !== undefined && balance < resolved.devBuy.exactAmountIn) {
        throw new Error(
          `Insufficient ERC20 balance for dev buy: required ${resolved.devBuy.exactAmountIn}, available ${balance}`,
        );
      }
      if (
        allowance !== undefined &&
        allowance < resolved.devBuy.exactAmountIn
      ) {
        const { request: approvalRequest, result: approvalSucceeded } = await (
          this.publicClient as PublicClient
        ).simulateContract({
          address: resolved.createParams.numeraire,
          abi: erc20Abi,
          functionName: 'approve',
          args: [resolved.devBuy.bundler, resolved.devBuy.exactAmountIn],
          account,
        });
        if (approvalSucceeded !== true) {
          throw new Error('Bundler approval simulation returned false');
        }
        approvalTransactionHash =
          await this.walletClient.writeContract(approvalRequest);
        const approvalReceipt = await (
          this.publicClient as PublicClient
        ).waitForTransactionReceipt({
          hash: approvalTransactionHash,
          confirmations: 2,
        });
        if (approvalReceipt.status !== 'success') {
          throw new Error('Bundler approval transaction reverted');
        }
        const approvedAllowance = await this.readDevBuyAllowance({
          createParams: resolved.createParams,
          account: accountAddress,
          bundler: resolved.devBuy.bundler,
        });
        if (
          approvedAllowance === undefined ||
          approvedAllowance < resolved.devBuy.exactAmountIn
        ) {
          throw new Error(
            'Bundler approval transaction did not provide the required allowance',
          );
        }
      }

      const { request } = await (
        this.publicClient as PublicClient
      ).simulateContract({
        address: resolved.devBuy.bundler,
        abi: bundlerAbi,
        functionName: 'bundle',
        args: [
          { ...resolved.createParams },
          { ...resolved.devBuy.vesting },
          resolved.devBuy.exactAmountIn,
          resolved.devBuy.recipient,
        ],
        account,
        value:
          resolved.createParams.numeraire === ZERO_ADDRESS
            ? resolved.devBuy.exactAmountIn
            : 0n,
      });
      hash = await this.walletClient.writeContract(
        params.gas === undefined ? request : { ...request, gas: params.gas },
      );
    } else {
      const gasEstimate = await this.resolveCreateGasEstimate({
        request: resolved.request,
        address: resolved.airlock,
        createParams: resolved.createParams,
        account: this.walletClient.account,
      });
      const gas = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT;
      hash = await this.walletClient.writeContract({
        ...resolved.request,
        gas,
      });
    }

    const receipt = await (
      this.publicClient as PublicClient
    ).waitForTransactionReceipt({ hash, confirmations: 2 });
    const account = this.walletClient.account;
    if (!account) {
      throw new Error('Wallet account required for receipt verification');
    }
    const accountAddress =
      typeof account === 'string' ? account : account.address;
    const transaction = resolved.devBuy
      ? this.buildDevBuyTransaction({
          createParams: resolved.createParams,
          devBuy: resolved.devBuy,
        })
      : {
          to: resolved.airlock,
          data: encodeFunctionData({
            abi: airlockAbi,
            functionName: 'create',
            args: [{ ...resolved.createParams }],
          }),
          value: 0n,
        };
    const prepared: PreparedMulticurveCreate<C> = {
      chainId: this.chainId,
      account: accountAddress,
      airlock: resolved.airlock,
      createParams: resolved.createParams,
      prediction: resolved.prediction,
      transaction,
      devBuy: resolved.devBuy,
      gasEstimate: { status: 'unavailable' },
    };
    const verified = verifyPreparedCreateReceipt({ prepared, receipt });
    const baseResult = {
      tokenAddress: verified.receiptIdentity.tokenAddress,
      poolId: resolved.prediction.poolId,
      transactionHash: hash,
      approvalTransactionHash,
    };
    if (!resolved.devBuy) {
      return baseResult;
    }
    if (!verified.devBuy) {
      throw new Error(
        'Bundler receipt verification did not return dev-buy data',
      );
    }
    return {
      ...baseResult,
      devBuy: {
        exactAmountIn: resolved.devBuy.exactAmountIn,
        recipient: resolved.devBuy.recipient,
        vesting: { ...resolved.devBuy.vesting },
        bundler: resolved.devBuy.bundler,
        amountOut: verified.devBuy.amountOut,
      },
    };
  }

  /**
   * Normalize user-provided multicurve positions and ensure they satisfy SDK constraints
   */
  private normalizeMulticurveCurves(
    curves: CreateMulticurveParams['pool']['curves'],
    tickSpacing: number,
    numTokensToSell: bigint,
  ): CreateMulticurveParams['pool']['curves'] {
    if (tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive');
    }
    if (!curves.length) {
      throw new Error('Multicurve pool must include at least one curve');
    }

    let totalShares = 0n;
    let mostPositiveTickUpper: number | undefined;

    const sanitizedCurves = curves.map((curve) => {
      const sanitized = { ...curve };

      if (
        !Number.isFinite(sanitized.tickLower) ||
        !Number.isFinite(sanitized.tickUpper)
      ) {
        throw new Error('Multicurve ticks must be finite numbers');
      }
      if (sanitized.tickLower >= sanitized.tickUpper) {
        throw new Error(
          'Multicurve curve tickLower must be less than tickUpper',
        );
      }
      if (
        !Number.isInteger(sanitized.numPositions) ||
        sanitized.numPositions <= 0
      ) {
        throw new Error(
          'Multicurve curve numPositions must be a positive integer',
        );
      }
      if (sanitized.shares <= 0n) {
        throw new Error('Multicurve curve shares must be positive');
      }

      totalShares += sanitized.shares;
      if (totalShares > WAD) {
        throw new Error('Total multicurve shares cannot exceed 100% (1e18)');
      }

      if (
        mostPositiveTickUpper === undefined ||
        sanitized.tickUpper > mostPositiveTickUpper
      ) {
        mostPositiveTickUpper = sanitized.tickUpper;
      }

      return sanitized;
    });

    if (totalShares === WAD) {
      return sanitizedCurves;
    }

    const missingShare = WAD - totalShares;
    if (missingShare <= 0n) {
      return sanitizedCurves;
    }

    const fallbackTickLower = mostPositiveTickUpper;
    if (fallbackTickLower === undefined) {
      throw new Error('Unable to determine fallback multicurve tick range');
    }

    const fallbackNumPositions =
      sanitizedCurves[sanitizedCurves.length - 1]?.numPositions ?? 1;
    const fallbackTickUpper = getMaxLiquiditySafeMulticurveTickUpper({
      tickLower: fallbackTickLower,
      tickUpper: this.roundMaxTickDown(tickSpacing),
      tickSpacing,
      numPositions: fallbackNumPositions,
      curveSupply: (numTokensToSell * missingShare) / WAD,
    });

    const fallbackCurve = {
      // Extend from the most positive user tick out to the maximum supported tick bucket
      tickLower: fallbackTickLower,
      tickUpper: fallbackTickUpper,
      numPositions: fallbackNumPositions,
      shares: missingShare,
    };

    return [...sanitizedCurves, fallbackCurve];
  }

  private roundMaxTickDown(tickSpacing: number): number {
    if (tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive');
    }

    const rounded = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
    return rounded;
  }

  private validateVestingConfig(
    sale: SaleConfig,
    vesting?: VestingConfig,
  ): void {
    if (!vesting) {
      return;
    }

    const cliffDuration = vesting.cliffDuration ?? 0;
    const duration = vesting.duration ?? 0;
    const hasCustomSchedules = this.hasCustomV2Schedules(vesting);

    if (
      hasCustomSchedules &&
      (cliffDuration > 0 ||
        duration > 0 ||
        vesting.recipients !== undefined ||
        vesting.amounts !== undefined)
    ) {
      throw new Error(
        'Use vesting.allocations instead of top-level duration/cliffDuration/recipients/amounts when configuring per-beneficiary vesting',
      );
    }

    const availableForVesting = sale.initialSupply - sale.numTokensToSell;

    if (vesting.allocations) {
      if (vesting.allocations.length === 0) {
        throw new Error('Vesting allocations array cannot be empty');
      }

      const totalVested = vesting.allocations.reduce(
        (sum, allocation) => sum + allocation.amount,
        0n,
      );
      if (totalVested > availableForVesting) {
        throw new Error(
          `Total vesting amount (${totalVested}) exceeds available tokens (${availableForVesting})`,
        );
      }

      for (const [index, allocation] of vesting.allocations.entries()) {
        const scheduleCliff = allocation.schedule.cliffDuration ?? 0;
        const scheduleDuration = allocation.schedule.duration ?? 0;

        this.validateUint64LikeNumber(
          scheduleCliff,
          `Vesting allocations[${index}].schedule.cliffDuration`,
        );
        this.validateUint64LikeNumber(
          scheduleDuration,
          `Vesting allocations[${index}].schedule.duration`,
        );
        if (scheduleCliff > scheduleDuration) {
          throw new Error(
            `Vesting allocations[${index}].schedule.cliffDuration cannot exceed duration`,
          );
        }
        if (
          scheduleCliff > 0 &&
          scheduleDuration > 0 &&
          scheduleDuration < DERC20_V2_MIN_VESTING_DURATION
        ) {
          throw new Error(
            `Vesting allocations[${index}].schedule.duration must be 0 or at least ${DERC20_V2_MIN_VESTING_DURATION} seconds when using cliffs`,
          );
        }
      }

      return;
    }

    if (vesting.recipients && vesting.amounts) {
      if (vesting.recipients.length !== vesting.amounts.length) {
        throw new Error(
          'Vesting recipients and amounts arrays must have the same length',
        );
      }
      if (vesting.recipients.length === 0) {
        throw new Error('Vesting recipients array cannot be empty');
      }

      const totalVested = vesting.amounts.reduce((sum, amt) => sum + amt, 0n);
      if (totalVested > availableForVesting) {
        throw new Error(
          `Total vesting amount (${totalVested}) exceeds available tokens (${availableForVesting})`,
        );
      }
    } else {
      const vestedAmount = sale.initialSupply - sale.numTokensToSell;
      if (vestedAmount <= 0n) {
        throw new Error('No tokens available for vesting');
      }
    }

    if (cliffDuration < 0) {
      throw new Error('Vesting cliff duration cannot be negative');
    }
    if (duration < 0) {
      throw new Error('Vesting duration cannot be negative');
    }
    if (cliffDuration > duration) {
      throw new Error('Vesting cliff duration cannot exceed vesting duration');
    }
    if (
      cliffDuration > 0 &&
      duration > 0 &&
      duration < DERC20_V2_MIN_VESTING_DURATION
    ) {
      throw new Error(
        `Vesting duration must be 0 or at least ${DERC20_V2_MIN_VESTING_DURATION} seconds when using cliffs`,
      );
    }
  }

  private validateStaticAuctionParams(params: CreateStaticAuctionParams): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

    // Validate tick range
    if (params.pool.startTick >= params.pool.endTick) {
      throw new Error('Start tick must be less than end tick');
    }

    const tickSpacing = (TICK_SPACINGS as Record<number, number>)[
      params.pool.fee
    ];
    if (tickSpacing === undefined) {
      throw new Error(
        `Unsupported fee tier ${params.pool.fee} for static auctions`,
      );
    }

    if (params.pool.startTick < MIN_TICK || params.pool.endTick > MAX_TICK) {
      throw new Error(
        `Ticks must be within the allowed range (${MIN_TICK} to ${MAX_TICK})`,
      );
    }

    const startTickAligned = params.pool.startTick % tickSpacing === 0;
    const endTickAligned = params.pool.endTick % tickSpacing === 0;
    if (!startTickAligned || !endTickAligned) {
      throw new Error(
        `Pool ticks must be multiples of tick spacing ${tickSpacing} for fee tier ${params.pool.fee}`,
      );
    }

    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    this.validateVestingConfig(params.sale, params.vesting);

    // Validate migration config
    if (isDopplerHookMigratorConfig(params.migration)) {
      throw new Error(
        'dopplerHookMigrator migration is only supported for dynamic auctions',
      );
    }

    if (params.migration.type === 'uniswapV2Split') {
      this.validateProceedsSplitConfig(
        params.migration.proceedsSplit,
        'V2 split migration',
      );
    }

    if (params.migration.type === 'uniswapV4') {
      this.validateV4StreamableFeesConfig(
        params.migration.streamableFees,
        'V4 migration',
      );
    }

    if (params.migration.type === 'uniswapV4Split') {
      this.validateV4StreamableFeesConfig(
        params.migration.streamableFees,
        'V4 split migration',
        true,
      );
      this.validateProceedsSplitConfig(
        params.migration.proceedsSplit,
        'V4 split migration',
      );
    }

    // Validate pool beneficiaries for V3 locked pools
    if (params.pool.beneficiaries && params.pool.beneficiaries.length > 0) {
      const beneficiaries = params.pool.beneficiaries;

      // Check that shares sum to 100% (WAD)
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n);
      if (totalShares !== WAD) {
        throw new Error(
          `Pool beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`,
        );
      }

      // Validate each beneficiary has positive shares
      for (const b of beneficiaries) {
        if (b.shares <= 0n) {
          throw new Error('Each beneficiary must have positive shares');
        }
      }
    }
  }

  /**
   * Validate dynamic auction parameters
   */
  private validateDynamicAuctionParams(
    params: CreateDynamicAuctionParams,
  ): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

    // Validate tick range
    const isToken0 = isToken0Expected(params.sale.numeraire);
    if (isToken0 && params.auction.startTick <= params.auction.endTick) {
      throw new Error(
        'Start tick must be greater than end tick if base token is currency0',
      );
    }
    if (!isToken0 && params.auction.startTick >= params.auction.endTick) {
      throw new Error(
        'Start tick must be less than end tick if base token is currency1',
      );
    }

    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    this.validateVestingConfig(params.sale, params.vesting);

    // Validate auction parameters
    if (params.auction.duration <= 0) {
      throw new Error('Auction duration must be positive');
    }
    if (params.auction.epochLength <= 0) {
      throw new Error('Epoch length must be positive');
    }
    if (params.pool.tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive');
    }

    // Validate tick spacing against Doppler contract constraint
    // @see Doppler.sol line 159: `int24 constant MAX_TICK_SPACING = 30`
    if (params.pool.tickSpacing > DOPPLER_MAX_TICK_SPACING) {
      throw new Error(
        `Dynamic auctions require tickSpacing <= ${DOPPLER_MAX_TICK_SPACING} (Doppler.sol MAX_TICK_SPACING). ` +
          `Got tickSpacing=${params.pool.tickSpacing}. ` +
          `Use withMarketCapRange() which handles this automatically, or use a smaller tickSpacing with poolConfig().`,
      );
    }

    // Validate that total duration is divisible by epoch length
    if (params.auction.duration % params.auction.epochLength !== 0) {
      throw new Error('Epoch length must divide total duration evenly');
    }

    // Validate gamma if provided
    if (params.auction.gamma !== undefined) {
      if (params.auction.gamma % params.pool.tickSpacing !== 0) {
        throw new Error('Gamma must be divisible by tick spacing');
      }
    }

    // Validate migration config
    if (params.migration.type === 'uniswapV2Split') {
      this.validateProceedsSplitConfig(
        params.migration.proceedsSplit,
        'V2 split migration',
      );
    }

    if (params.migration.type === 'uniswapV4') {
      this.validateV4StreamableFeesConfig(
        params.migration.streamableFees,
        'V4 migration',
      );
    }

    if (params.migration.type === 'uniswapV4Split') {
      this.validateV4StreamableFeesConfig(
        params.migration.streamableFees,
        'V4 split migration',
        true,
      );
      this.validateProceedsSplitConfig(
        params.migration.proceedsSplit,
        'V4 split migration',
      );
    }

    if (isDopplerHookMigratorConfig(params.migration)) {
      const migration = params.migration;

      if (!Number.isInteger(migration.fee) || migration.fee < 0) {
        throw new Error(
          'DopplerHook migration fee must be a non-negative integer',
        );
      }
      if (migration.fee > 150_000) {
        throw new Error('DopplerHook migration fee must be <= 150000 (15%)');
      }

      if (
        !Number.isInteger(migration.tickSpacing) ||
        migration.tickSpacing <= 0
      ) {
        throw new Error(
          'DopplerHook migration tickSpacing must be a positive integer',
        );
      }

      if (migration.beneficiaries.length === 0) {
        throw new Error(
          'At least one beneficiary is required for dopplerHookMigrator migration',
        );
      }

      const totalShares = migration.beneficiaries.reduce(
        (sum, b) => sum + b.shares,
        0n,
      );
      if (totalShares !== WAD) {
        throw new Error(
          `Beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`,
        );
      }

      const lockDuration = Number(migration.lockDuration);
      if (!Number.isInteger(lockDuration) || lockDuration < 0) {
        throw new Error(
          'DopplerHook migration lockDuration must be a non-negative integer number of seconds',
        );
      }
      if (lockDuration > 0xffffffff) {
        throw new Error(
          'DopplerHook migration lockDuration must fit within uint32',
        );
      }

      this.validateProceedsSplitConfig(
        migration.proceedsSplit,
        'DopplerHook migration',
      );
    }
  }

  private validateOpeningAuctionParams(
    params: CreateOpeningAuctionParams<C>,
  ): void {
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

    if (params.sale.initialSupply <= 0n) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= 0n) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    if (params.openingAuction.shareToAuctionBps <= 0) {
      throw new Error('openingAuction.shareToAuctionBps must be positive');
    }
    if (params.openingAuction.shareToAuctionBps > 10_000) {
      throw new Error('openingAuction.shareToAuctionBps cannot exceed 10_000');
    }
    if (params.openingAuction.incentiveShareBps < 0) {
      throw new Error('openingAuction.incentiveShareBps cannot be negative');
    }
    if (params.openingAuction.incentiveShareBps > 10_000) {
      throw new Error('openingAuction.incentiveShareBps cannot exceed 10_000');
    }
    if (
      params.openingAuction.incentiveShareBps +
        params.openingAuction.shareToAuctionBps >
      10_000
    ) {
      throw new Error(
        'openingAuction.incentiveShareBps + shareToAuctionBps cannot exceed 10_000',
      );
    }
    if (params.openingAuction.auctionDuration <= 0) {
      throw new Error('openingAuction.auctionDuration must be positive');
    }
    if (params.openingAuction.tickSpacing <= 0) {
      throw new Error('openingAuction.tickSpacing must be positive');
    }
    if (params.openingAuction.minLiquidity <= 0n) {
      throw new Error('openingAuction.minLiquidity must be positive');
    }

    if (params.doppler.duration <= 0 || params.doppler.epochLength <= 0) {
      throw new Error(
        'doppler.duration and doppler.epochLength must be positive',
      );
    }
    if (params.doppler.duration % params.doppler.epochLength !== 0) {
      throw new Error(
        'doppler.epochLength must divide doppler.duration evenly',
      );
    }
    if (params.doppler.tickSpacing <= 0) {
      throw new Error('doppler.tickSpacing must be positive');
    }
    if (params.doppler.tickSpacing > DOPPLER_MAX_TICK_SPACING) {
      throw new Error(
        `doppler.tickSpacing must be <= ${DOPPLER_MAX_TICK_SPACING}`,
      );
    }
    if (params.openingAuction.tickSpacing % params.doppler.tickSpacing !== 0) {
      throw new Error(
        `openingAuction.tickSpacing (${params.openingAuction.tickSpacing}) must be divisible by doppler.tickSpacing (${params.doppler.tickSpacing})`,
      );
    }

    if (
      params.openingAuction.minAcceptableTickToken0 < INT24_MIN ||
      params.openingAuction.minAcceptableTickToken0 > INT24_MAX
    ) {
      throw new Error(
        `openingAuction.minAcceptableTickToken0 must be within int24 range (${INT24_MIN} to ${INT24_MAX})`,
      );
    }
    if (
      params.openingAuction.minAcceptableTickToken1 < INT24_MIN ||
      params.openingAuction.minAcceptableTickToken1 > INT24_MAX
    ) {
      throw new Error(
        `openingAuction.minAcceptableTickToken1 must be within int24 range (${INT24_MIN} to ${INT24_MAX})`,
      );
    }
    if (
      params.doppler.startTick < INT24_MIN ||
      params.doppler.startTick > INT24_MAX
    ) {
      throw new Error(
        `doppler.startTick must be within int24 range (${INT24_MIN} to ${INT24_MAX})`,
      );
    }
    if (
      params.doppler.endTick < INT24_MIN ||
      params.doppler.endTick > INT24_MAX
    ) {
      throw new Error(
        `doppler.endTick must be within int24 range (${INT24_MIN} to ${INT24_MAX})`,
      );
    }

    const isToken0 = isToken0Expected(params.sale.numeraire);
    if (isToken0 && params.doppler.startTick < params.doppler.endTick) {
      throw new Error(
        'doppler.startTick must be >= doppler.endTick when token is expected as currency0',
      );
    }
    if (!isToken0 && params.doppler.startTick > params.doppler.endTick) {
      throw new Error(
        'doppler.startTick must be <= doppler.endTick when token is expected as currency1',
      );
    }

    if (
      params.doppler.gamma !== undefined &&
      params.doppler.gamma % params.doppler.tickSpacing !== 0
    ) {
      throw new Error('doppler.gamma must be divisible by doppler.tickSpacing');
    }

    if (isDopplerHookMigratorConfig(params.migration)) {
      throw new Error(
        'dopplerHookMigrator migration type is not supported for opening auctions',
      );
    }

    if (params.migration.type === 'uniswapV2Split') {
      this.validateProceedsSplitConfig(
        params.migration.proceedsSplit,
        'V2 split migration',
      );
    }

    if (params.migration.type === 'uniswapV4') {
      this.validateV4StreamableFeesConfig(
        params.migration.streamableFees,
        'V4 migration',
      );
    }

    if (params.migration.type === 'uniswapV4Split') {
      this.validateV4StreamableFeesConfig(
        params.migration.streamableFees,
        'V4 split migration',
        true,
      );
      this.validateProceedsSplitConfig(
        params.migration.proceedsSplit,
        'V4 split migration',
      );
    }
  }

  private validateMulticurveDevBuy(devBuy: MulticurveDevBuyConfig): void {
    if (devBuy.exactAmountIn <= 0n || devBuy.exactAmountIn > MAX_UINT128) {
      throw new Error('Dev buy exactAmountIn must be in the uint128 range');
    }
    if (devBuy.recipient.toLowerCase() === ZERO_ADDRESS) {
      throw new Error('Dev buy recipient must not be the zero address');
    }
    const { vestingDuration, cliffDuration } = devBuy.vesting;
    if (
      vestingDuration < 0n ||
      vestingDuration > MAX_UINT64 ||
      cliffDuration < 0n ||
      cliffDuration > MAX_UINT64
    ) {
      throw new Error('Dev buy vesting durations must be in the uint64 range');
    }
    if (
      vestingDuration !== 0n &&
      vestingDuration < MIN_BUNDLER_VESTING_DURATION
    ) {
      throw new Error('Dev buy vestingDuration must be at least 86400 seconds');
    }
    if (cliffDuration > vestingDuration) {
      throw new Error('Dev buy cliffDuration must not exceed vestingDuration');
    }
  }

  /**
   * Validate multicurve auction parameters
   */
  private validateMulticurveParams(params: CreateMulticurveParams<C>): void {
    if (
      params.salt !== undefined &&
      (typeof params.salt !== 'string' ||
        !/^0x[0-9a-fA-F]{64}$/.test(params.salt))
    ) {
      throw new Error('Multicurve salt must be exactly 32 bytes');
    }

    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    // Validate initializer mode / compatibility and mode-specific constraints.
    this.resolveMulticurveInitializerMode(params);
    if (params.devBuy) {
      this.validateMulticurveDevBuy(params.devBuy);
      if (
        this.resolveMulticurveInitializerMode(params).type !== 'dopplerHook'
      ) {
        throw new Error(
          'Dev buys require a DopplerHookInitializer or Rehype initializer',
        );
      }
    }

    this.validateVestingConfig(params.sale, params.vesting);

    // Validate pool beneficiaries if provided
    if (params.pool.beneficiaries && params.pool.beneficiaries.length > 0) {
      const beneficiaries = params.pool.beneficiaries;
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n);
      if (totalShares !== WAD) {
        throw new Error(
          `Pool beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`,
        );
      }
      for (const b of beneficiaries) {
        if (b.shares <= 0n) {
          throw new Error('Each beneficiary must have positive shares');
        }
      }
    }

    // Validate migration config for V4
    if (isDopplerHookMigratorConfig(params.migration)) {
      throw new Error(
        'dopplerHookMigrator migration is only supported for dynamic auctions',
      );
    }

    if (params.migration.type === 'uniswapV2Split') {
      this.validateProceedsSplitConfig(
        params.migration.proceedsSplit,
        'V2 split migration',
      );
    }

    if (params.migration.type === 'uniswapV4') {
      this.validateV4StreamableFeesConfig(
        params.migration.streamableFees,
        'V4 migration',
      );
    }

    if (params.migration.type === 'uniswapV4Split') {
      this.validateV4StreamableFeesConfig(
        params.migration.streamableFees,
        'V4 split migration',
        true,
      );
      this.validateProceedsSplitConfig(
        params.migration.proceedsSplit,
        'V4 split migration',
      );
    }
  }

  /**
   * Get the appropriate migrator address based on migration config
   * Allows override via ModuleAddressOverrides when provided in params.
   */
  private resolveUniswapV2Migrator(overrides?: ModuleAddressOverrides): {
    address: Address;
    isSplit: boolean;
  } {
    const addresses = getAddresses(this.chainId);
    const v2Address = overrides?.v2Migrator ?? addresses.v2Migrator;
    if (v2Address && v2Address !== ZERO_ADDRESS) {
      return { address: v2Address, isSplit: false };
    }

    const v2SplitAddress =
      overrides?.v2MigratorSplit ?? addresses.v2MigratorSplit;
    if (v2SplitAddress && v2SplitAddress !== ZERO_ADDRESS) {
      return { address: v2SplitAddress, isSplit: true };
    }

    throw new Error(
      'Neither UniswapV2Migrator nor UniswapV2MigratorSplit is deployed on this chain. Provide an override via modules.v2Migrator or modules.v2MigratorSplit.',
    );
  }

  private getMigratorAddress(
    config: MigrationConfig,
    overrides?: ModuleAddressOverrides,
  ): Address {
    const addresses = getAddresses(this.chainId);

    switch (config.type) {
      case 'uniswapV2':
        return this.resolveUniswapV2Migrator(overrides).address;
      case 'uniswapV2Split': {
        const v2SplitAddress =
          overrides?.v2MigratorSplit ?? addresses.v2MigratorSplit;
        if (!v2SplitAddress || v2SplitAddress === ZERO_ADDRESS) {
          throw new Error(
            'UniswapV2MigratorSplit not deployed on this chain. Use uniswapV2 migration or provide override via modules.v2MigratorSplit.',
          );
        }
        return v2SplitAddress;
      }
      case 'uniswapV4': {
        const v4Address = overrides?.v4Migrator ?? addresses.v4Migrator;
        if (!v4Address || v4Address === ZERO_ADDRESS) {
          throw new Error(
            'UniswapV4Migrator not deployed on this chain. Use uniswapV2 migration or provide override via modules.v4Migrator.',
          );
        }
        return v4Address;
      }
      case 'uniswapV4Split': {
        const v4SplitAddress =
          overrides?.v4MigratorSplit ?? addresses.v4MigratorSplit;
        if (!v4SplitAddress || v4SplitAddress === ZERO_ADDRESS) {
          throw new Error(
            'UniswapV4MigratorSplit not deployed on this chain. Use uniswapV4 migration or provide override via modules.v4MigratorSplit.',
          );
        }
        return v4SplitAddress;
      }
      case 'dopplerHook':
      case 'dopplerHookMigrator': {
        const dopplerHookMigratorAddress =
          overrides?.dopplerHookMigrator ?? addresses.dopplerHookMigrator;
        if (
          !dopplerHookMigratorAddress ||
          dopplerHookMigratorAddress === ZERO_ADDRESS
        ) {
          throw new Error(
            'DopplerHookMigrator not configured on this chain. Provide override via modules.dopplerHookMigrator or use a different migration type.',
          );
        }
        return dopplerHookMigratorAddress;
      }
      case 'noOp': {
        const noOpAddress = overrides?.noOpMigrator ?? addresses.noOpMigrator;
        if (!noOpAddress || noOpAddress === ZERO_ADDRESS) {
          throw new Error(
            'NoOpMigrator not configured on this chain. Provide override via modules.noOpMigrator or update chain config.',
          );
        }
        return noOpAddress;
      }

      default:
        throw new Error('Unknown migration type');
    }
  }

  // computeTicks moved to builders. No longer needed here.
  // computeOptimalGamma moved to utils.

  private normalizePoolKey(value: any): V4PoolKey {
    if (Array.isArray(value)) {
      const [currency0, currency1, feeRaw, tickSpacingRaw, hooks] = value as [
        Address,
        Address,
        number | bigint,
        number | bigint,
        Address,
      ];
      const feeValue = Number(feeRaw);
      const tickSpacingValue = Number(tickSpacingRaw);
      if (!Number.isFinite(feeValue) || !Number.isFinite(tickSpacingValue)) {
        throw new Error(
          'Invalid pool key numeric fields in multicurve bundle simulation result',
        );
      }
      return {
        currency0: currency0 as Address,
        currency1: currency1 as Address,
        fee: feeValue,
        tickSpacing: tickSpacingValue,
        hooks: hooks as Address,
      };
    }
    if (value && typeof value === 'object') {
      const { currency0, currency1, fee, tickSpacing, hooks } = value as Record<
        string,
        unknown
      >;
      const feeValue = Number(fee);
      const tickSpacingValue = Number(tickSpacing);
      if (!Number.isFinite(feeValue) || !Number.isFinite(tickSpacingValue)) {
        throw new Error(
          'Invalid pool key numeric fields in multicurve bundle simulation result',
        );
      }
      return {
        currency0: currency0 as Address,
        currency1: currency1 as Address,
        fee: feeValue,
        tickSpacing: tickSpacingValue,
        hooks: hooks as Address,
      };
    }
    throw new Error(
      'Unable to normalize PoolKey from multicurve bundle simulation result',
    );
  }
  /**
   * Mines a salt and hook address with the appropriate flags
   *
   * This method iterates through possible salt values to find a combination that:
   * - Produces a hook address with required Doppler flags
   * - Maintains proper token ordering relative to numeraire
   * - Ensures deterministic deployment addresses
   *
   * @param params - Parameters for hook address mining
   * @returns Tuple of [salt, hook address, token address, pool data, token data]
   * @throws {Error} If no valid salt can be found within the search limit
   * @private
   */
  private mineHookAddress(params: {
    airlock: Address;
    poolManager: Address;
    deployer: Address;
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address;
    tokenFactory: Address;
    tokenFactoryData:
      | {
          name: string;
          symbol: string;
          baseURI: string;
          unit?: bigint;
        }
      | DopplerERC20V1TokenFactoryData
      | StandardTokenFactoryData;
    poolInitializer: Address;
    poolInitializerData: {
      minimumProceeds: bigint;
      maximumProceeds: bigint;
      startingTime: bigint;
      endingTime: bigint;
      startingTick: number;
      endingTick: number;
      epochLength: bigint;
      gamma: number;
      numPDSlugs: bigint;
      fee: number;
      tickSpacing: number;
    };
    customDerc20Bytecode?: `0x${string}`;
    tokenVariant?: TokenFactoryVariant;
    migration?: MigrationConfig;
    addresses?: ReturnType<typeof getAddresses>;
    includeProtocolBalanceLimitExclusions?: boolean;
  }): [Hash, Address, Address, Hex, Hex] {
    const isToken0 = isToken0Expected(params.numeraire);

    const {
      minimumProceeds,
      maximumProceeds,
      startingTime,
      endingTime,
      startingTick,
      endingTick,
      epochLength,
      gamma,
      numPDSlugs,
      fee,
      tickSpacing,
    } = params.poolInitializerData;

    const poolInitializerData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      [
        minimumProceeds,
        maximumProceeds,
        startingTime,
        endingTime,
        startingTick,
        endingTick,
        epochLength,
        gamma,
        isToken0,
        numPDSlugs,
        fee,
        tickSpacing,
      ],
    );

    const { poolManager, numTokensToSell, poolInitializer } = params;

    const hookInitHashData = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint24' },
      ],
      [
        poolManager,
        numTokensToSell,
        minimumProceeds,
        maximumProceeds,
        startingTime,
        endingTime,
        startingTick,
        endingTick,
        epochLength,
        gamma,
        isToken0,
        numPDSlugs,
        poolInitializer,
        fee,
      ],
    );

    const hookInitHash = keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [DopplerBytecode as Hex, hookInitHashData],
      ),
    );

    const tokenFactoryData =
      params.tokenVariant === 'doppler404'
        ? (() => {
            const t = params.tokenFactoryData as {
              name: string;
              symbol: string;
              baseURI: string;
              unit?: bigint;
            };
            return encodeAbiParameters(
              [
                { type: 'string' },
                { type: 'string' },
                { type: 'string' },
                { type: 'uint256' },
              ],
              [t.name, t.symbol, t.baseURI, t.unit ?? WAD],
            );
          })()
        : params.tokenVariant === 'dopplerERC20V1'
          ? this.encodeDopplerERC20V1TokenFactoryData(
              params.tokenFactoryData as DopplerERC20V1TokenFactoryData,
            )
          : this.encodeStandardTokenFactoryData(
              params.tokenFactoryData as StandardTokenFactoryData,
            );

    // Compute token init hash; use DN404 bytecode if tokenVariant is doppler404
    let tokenInitHash: Hash | undefined;
    if (params.tokenVariant === 'doppler404') {
      const { name, symbol, baseURI, unit } = params.tokenFactoryData as {
        name: string;
        symbol: string;
        baseURI: string;
        unit?: bigint;
      };
      const { airlock, initialSupply } = params;
      const initHashData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'address' },
          { type: 'string' },
          { type: 'uint256' },
        ],
        [name, symbol, initialSupply, airlock, airlock, baseURI, unit ?? WAD],
      );
      tokenInitHash = keccak256(
        encodePacked(
          ['bytes', 'bytes'],
          [
            getDopplerDN404Bytecode(
              params.addresses?.doppler404Factory ?? params.tokenFactory,
            ),
            initHashData,
          ],
        ),
      );
    } else if (params.tokenVariant === 'dopplerERC20V1') {
      const tokenFactoryData =
        params.tokenFactoryData as DopplerERC20V1TokenFactoryData;
      tokenInitHash = this.computeSoladyCloneInitCodeHash(
        tokenFactoryData.implementation,
      );
    } else {
      const standardTokenFactoryData =
        params.tokenFactoryData as StandardTokenFactoryData;
      if (standardTokenFactoryData.kind === 'v2') {
        tokenInitHash = this.computeStandardTokenInitHash(
          standardTokenFactoryData,
          params.tokenFactory,
        );
      } else {
        const initHashData = encodeAbiParameters(
          [
            { type: 'string' },
            { type: 'string' },
            { type: 'uint256' },
            { type: 'address' },
            { type: 'address' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'address[]' },
            { type: 'uint256[]' },
            { type: 'string' },
          ],
          [
            standardTokenFactoryData.name,
            standardTokenFactoryData.symbol,
            standardTokenFactoryData.initialSupply,
            standardTokenFactoryData.airlock,
            standardTokenFactoryData.airlock,
            standardTokenFactoryData.yearlyMintRate,
            standardTokenFactoryData.vestingDuration,
            standardTokenFactoryData.recipients,
            standardTokenFactoryData.amounts,
            standardTokenFactoryData.tokenURI,
          ],
        );
        const isTokenFactory80 =
          params.tokenFactory.toLowerCase() === TOKEN_FACTORY_80_ADDRESS;
        const bytecode = isTokenFactory80
          ? (DERC2080Bytecode as Hex)
          : ((params.customDerc20Bytecode as Hex) ?? (DERC20Bytecode as Hex));

        tokenInitHash = keccak256(
          encodePacked(['bytes', 'bytes'], [bytecode, initHashData]),
        );
      }
    }

    // Use the exact flags from V4 SDK
    const flags = BigInt(
      (1 << 13) | // BEFORE_INITIALIZE_FLAG
        (1 << 12) | // AFTER_INITIALIZE_FLAG
        (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
        (1 << 7) | // BEFORE_SWAP_FLAG
        (1 << 6) | // AFTER_SWAP_FLAG
        (1 << 5), // BEFORE_DONATE_FLAG
    );

    // Pre-compute values outside the loop (optimization)
    const numeraireBigInt = BigInt(params.numeraire);

    // Pre-allocate CREATE2 buffers with constant parts
    const hookBuffer = this.prepareCreate2Buffer(params.deployer, hookInitHash);
    const tokenBuffer = tokenInitHash
      ? this.prepareCreate2Buffer(params.tokenFactory, tokenInitHash)
      : null;

    for (let salt = 0n; salt < 1_000_000n; salt++) {
      // Update salt in pre-computed buffer (avoids string formatting)
      this.updateSaltInBuffer(hookBuffer, salt);

      // Compute hook address using fast method (no checksum)
      const hookRaw = this.computeCreate2AddressFast(hookBuffer);
      const hookBigInt = BigInt(hookRaw);

      // Early termination: skip token computation if hook flags don't match
      // Only ~1 in 8192 addresses match the required flags, so this saves ~50% of keccak256 calls
      if ((hookBigInt & FLAG_MASK) !== flags) {
        continue;
      }

      if (tokenBuffer) {
        // Update salt in token buffer
        this.updateSaltInBuffer(tokenBuffer, salt);

        // Compute token address using fast method
        const tokenRaw = this.computeCreate2AddressFast(tokenBuffer);
        const tokenBigInt = BigInt(tokenRaw);

        if (
          (isToken0 && tokenBigInt < numeraireBigInt) ||
          (!isToken0 && tokenBigInt > numeraireBigInt)
        ) {
          // Found a match! Convert to proper format for return
          const saltBytes = `0x${salt.toString(16).padStart(64, '0')}` as Hash;
          const hook = getAddress(hookRaw) as Address;
          const token = getAddress(tokenRaw) as Address;
          const v1TokenFactoryData =
            params.tokenFactoryData as DopplerERC20V1TokenFactoryData;
          const encodedTokenFactoryData =
            params.tokenVariant === 'dopplerERC20V1' &&
            params.includeProtocolBalanceLimitExclusions &&
            this.isDopplerERC20V1BalanceLimitActive(v1TokenFactoryData)
              ? this.encodeDopplerERC20V1TokenFactoryData({
                  ...v1TokenFactoryData,
                  excludedFromBalanceLimit:
                    this.mergeDopplerERC20V1BalanceLimitExclusions(
                      v1TokenFactoryData.excludedFromBalanceLimit,
                      [
                        hook,
                        params.migration && params.addresses
                          ? this.resolveUniswapV2MigrationPairExclusion({
                              migration: params.migration,
                              addresses: params.addresses,
                              tokenAddress: token,
                              numeraire: params.numeraire,
                            })
                          : undefined,
                      ],
                    ),
                })
              : tokenFactoryData;
          return [
            saltBytes,
            hook,
            token,
            poolInitializerData,
            encodedTokenFactoryData,
          ];
        }
      }
    }

    throw new Error('AirlockMiner: could not find salt');
  }

  /**
   * Helper to convert hex string to Uint8Array
   * @private
   */
  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Helper to convert Uint8Array to hex string
   * @private
   */
  private bytesToHex(bytes: Uint8Array): string {
    return (
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  /**
   * Pre-compute CREATE2 buffer with constant prefix for fast mining
   * Buffer layout: 0xff (1 byte) + deployer (20 bytes) + salt (32 bytes) + initCodeHash (32 bytes) = 85 bytes
   * @private
   */
  private prepareCreate2Buffer(
    deployer: Address,
    initCodeHash: Hash,
  ): Uint8Array {
    const buffer = new Uint8Array(85);
    buffer[0] = 0xff;
    const deployerBytes = this.hexToBytes(deployer);
    buffer.set(deployerBytes, 1);
    const initCodeHashBytes = this.hexToBytes(initCodeHash);
    buffer.set(initCodeHashBytes, 53); // 1 + 20 + 32 = 53
    return buffer;
  }

  /**
   * Update salt in pre-computed CREATE2 buffer (bytes 21-52)
   * Uses direct byte manipulation instead of string conversion
   * @private
   */
  private updateSaltInBuffer(buffer: Uint8Array, salt: bigint): void {
    // Salt is 32 bytes, positioned at offset 21 (after 0xff + 20-byte deployer)
    // Clear salt region first
    for (let i = 21; i < 53; i++) {
      buffer[i] = 0;
    }
    // Write salt bytes from right to left (big-endian)
    let remaining = salt;
    for (let i = 52; remaining > 0n && i >= 21; i--) {
      buffer[i] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }
  }

  /**
   * Compute CREATE2 address from pre-computed buffer (fast version for mining)
   * Returns raw lowercase address without checksum for comparison
   * @private
   */
  private computeCreate2AddressFast(buffer: Uint8Array): string {
    const hash = keccak256(this.bytesToHex(buffer) as Hex);
    // Return last 40 hex chars (20 bytes) as lowercase address
    return '0x' + hash.slice(-40).toLowerCase();
  }

  /**
   * Compute V4 pool ID from pool key components
   */
  private computePoolId(poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  }): string {
    // V4 pools are identified by the hash of their PoolKey
    const encoded = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' },
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ],
    );
    return keccak256(encoded);
  }

  /**
   * Compute the complete V4 multicurve pool identity from the same pool-key
   * fields the initializer will register on-chain.
   */
  private async computeMulticurvePoolIdentity(
    params: CreateMulticurveParams<C>,
    tokenAddress: Address,
  ): Promise<{
    poolKey: V4PoolKey;
    poolId: Hex;
    tokenIsCurrency0: boolean;
  }> {
    const addresses = getAddresses(this.chainId);
    const initializerMode = this.resolveMulticurveInitializerMode(params);
    let hookAddress: Address;

    if (initializerMode.type === 'dopplerHook') {
      // DopplerHookInitializer pools are registered on Uniswap with the
      // initializer itself as poolKey.hooks. The Rehype hook lives separately
      // in the encoded init payload and is not part of the Uniswap pool key.
      hookAddress =
        params.modules?.dopplerHookInitializer ??
        addresses.dopplerHookInitializer ??
        ZERO_ADDRESS;
      if (hookAddress === ZERO_ADDRESS) {
        throw new Error('DopplerHookInitializer address not configured');
      }
    } else {
      const initializerAddress = (() => {
        if (initializerMode.type === 'decay') {
          return (
            params.modules?.v4DecayMulticurveInitializer ??
            addresses.v4DecayMulticurveInitializer
          );
        }
        if (initializerMode.type === 'scheduled') {
          return (
            params.modules?.v4ScheduledMulticurveInitializer ??
            addresses.v4ScheduledMulticurveInitializer
          );
        }
        return (
          params.modules?.v4MulticurveInitializer ??
          addresses.v4MulticurveInitializer
        );
      })();

      if (!initializerAddress) {
        throw new Error('Multicurve initializer address not configured');
      }

      hookAddress = (await (this.publicClient as PublicClient).readContract({
        address: initializerAddress,
        abi: v4MulticurveInitializerAbi,
        functionName: 'HOOK',
      })) as Address;
    }

    const numeraire = params.sale.numeraire;
    const tokenIsCurrency0 = BigInt(tokenAddress) < BigInt(numeraire);
    const poolKey: V4PoolKey = {
      currency0: tokenIsCurrency0 ? tokenAddress : numeraire,
      currency1: tokenIsCurrency0 ? numeraire : tokenAddress,
      fee:
        initializerMode.type === 'decay' ||
        (initializerMode.type === 'dopplerHook' && initializerMode.hookConfig)
          ? DYNAMIC_FEE_FLAG
          : params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      hooks: hookAddress,
    };

    return {
      poolKey,
      poolId: this.computePoolId(poolKey) as Hex,
      tokenIsCurrency0,
    };
  }
}
