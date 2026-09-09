import {
  arbitrum,
  base,
  baseSepolia,
  ink,
  mainnet,
  unichain,
} from 'viem/chains';
import { CHAIN_IDS, type SupportedChainId } from './addresses';
// Re-export SupportedChainId so consumers can import from this module
export { type SupportedChainId } from './addresses';
import type { Address, Hash, Hex, WalletClient } from 'viem';

export type SupportedChain =
  | typeof mainnet
  | typeof arbitrum
  | typeof base
  | typeof baseSepolia
  | typeof ink
  | typeof unichain;
// Use a wide type to avoid cross-package viem type identity issues when linking packages locally.
export type SupportedPublicClient = unknown;

// Core configuration types
// Token configuration
export interface StandardTokenConfig {
  type: 'standard';
  name: string;
  symbol: string;
  tokenURI: string;
  yearlyMintRate?: bigint; // Optional yearly mint rate (in WAD, default: 2% = 0.02e18)
}

export type DopplerERC20V1OnlyTokenConfigFields = {
  maxBalanceLimit?: bigint;
  balanceLimitEnd?: number;
  controller?: Address;
  excludedFromBalanceLimit?: Address[];
};

export interface Doppler404TokenConfig {
  type: 'doppler404';
  name: string;
  symbol: string;
  baseURI: string;
  // Optional base-unit threshold per NFT. Defaults to WAD (1e18), or one full token.
  unit?: bigint;
}

export type DopplerERC20V1TokenConfig = {
  type: 'dopplerERC20V1';
  name: string;
  symbol: string;
  tokenURI: string;
  /**
   * DopplerERC20V1 does not support yearly minting.
   * Set `type: 'standard'` to configure `yearlyMintRate`.
   */
  yearlyMintRate?: never;
} & DopplerERC20V1OnlyTokenConfigFields;

export type InferredDopplerERC20V1TokenConfig = {
  type?: never;
  name: string;
  symbol: string;
  tokenURI: string;
  /**
   * DopplerERC20V1 does not support yearly minting.
   * Set `type: 'standard'` to configure `yearlyMintRate`.
   */
  yearlyMintRate?: never;
} & DopplerERC20V1OnlyTokenConfigFields;

export type TokenConfig =
  | StandardTokenConfig
  | Doppler404TokenConfig
  | DopplerERC20V1TokenConfig
  | InferredDopplerERC20V1TokenConfig;

export interface SaleConfig {
  initialSupply: bigint;
  numTokensToSell: bigint;
  numeraire: Address; // e.g., WETH address
}

// Static Auction Pool configuration
export interface StaticPoolConfig {
  startTick: number;
  endTick: number;
  fee: number; // e.g., 3000 for 0.3%
  // Optional parameters for lockable initializer
  numPositions?: number; // Number of liquidity positions (default: based on tick range)
  maxShareToBeSold?: bigint; // Maximum share of tokens to sell (in WAD, default: 1e18 = 100%)
  beneficiaries?: BeneficiaryData[]; // Optional beneficiaries for fee streaming
}

// Dynamic Auction configuration
export interface DynamicAuctionConfig {
  duration: number; // in seconds
  epochLength: number; // in seconds
  startTick: number;
  endTick: number;
  gamma?: number; // Optional, can be auto-calculated
  minProceeds: bigint;
  maxProceeds: bigint;
  numPdSlugs?: number; // Price discovery slugs (optional)
}

// Opening Auction configuration
export interface OpeningAuctionConfig {
  auctionDuration: number; // in seconds
  minAcceptableTickToken0: number;
  minAcceptableTickToken1: number;
  incentiveShareBps: number;
  tickSpacing: number;
  fee: number; // e.g., 3000 for 0.3%
  minLiquidity: bigint;
  shareToAuctionBps: number;
}

// Doppler handoff configuration used by opening-auction initializer
export interface OpeningAuctionDopplerConfig {
  minProceeds: bigint;
  maxProceeds: bigint;
  startTick: number;
  endTick: number;
  epochLength: number; // in seconds
  duration: number; // in seconds
  gamma?: number;
  numPdSlugs?: number;
  fee: number; // e.g., 10000 for 1%
  tickSpacing: number;
  // Optional time controls for deterministic simulations/builds
  startTimeOffset?: number;
  startingTime?: number;
}

// Vesting configuration
export interface VestingScheduleConfig {
  duration: number; // in seconds
  cliffDuration: number; // in seconds
}

export interface VestingAllocationConfig {
  recipient: Address;
  amount: bigint;
  schedule: VestingScheduleConfig;
}

export type VestingConfig =
  | {
      duration: number; // in seconds
      cliffDuration: number; // in seconds
      recipients?: Address[]; // Optional array of recipient addresses (defaults to [userAddress] if not specified)
      amounts?: bigint[]; // Optional array of vesting amounts per recipient (must match recipients length if provided)
      allocations?: never;
    }
  | {
      duration?: never;
      cliffDuration?: never;
      recipients?: never;
      amounts?: never;
      allocations: VestingAllocationConfig[];
    };

// Chains where no-op governance is enabled
export const NO_OP_ENABLED_CHAIN_IDS = [
  CHAIN_IDS.MAINNET,
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.BASE,
  CHAIN_IDS.BASE_SEPOLIA,
  CHAIN_IDS.UNICHAIN,
  CHAIN_IDS.UNICHAIN_SEPOLIA,
  CHAIN_IDS.ROBINHOOD,
  CHAIN_IDS.MONAD_TESTNET,
  CHAIN_IDS.MONAD_MAINNET,
] as const;

export type NoOpEnabledChainId = (typeof NO_OP_ENABLED_CHAIN_IDS)[number];

/**
 * Check if a chain supports no-op governance
 */
export function isNoOpEnabledChain(
  chainId: number,
): chainId is NoOpEnabledChainId {
  return (NO_OP_ENABLED_CHAIN_IDS as readonly number[]).includes(chainId);
}

// Chains where launchpad governance is enabled
export const LAUNCHPAD_ENABLED_CHAIN_IDS = [
  CHAIN_IDS.MAINNET,
  CHAIN_IDS.ARBITRUM,
  CHAIN_IDS.BASE,
  CHAIN_IDS.BASE_SEPOLIA,
  CHAIN_IDS.ROBINHOOD,
  CHAIN_IDS.MONAD_MAINNET,
] as const;

export type LaunchpadEnabledChainId =
  (typeof LAUNCHPAD_ENABLED_CHAIN_IDS)[number];

/**
 * Check if a chain supports launchpad governance
 */
export function isLaunchpadEnabledChain(
  chainId: number,
): chainId is LaunchpadEnabledChainId {
  return (LAUNCHPAD_ENABLED_CHAIN_IDS as readonly number[]).includes(chainId);
}

// Governance configuration (discriminated union)
export type GovernanceDefault = { type: 'default' };
export interface GovernanceCustom {
  type: 'custom';
  /** Duration in token-clock units; seconds for timestamp-clock deployments. */
  initialVotingDelay: number;
  /** Duration in token-clock units; seconds for timestamp-clock deployments. */
  initialVotingPeriod: number;
  initialProposalThreshold: bigint;
}
export type GovernanceNoOp = { type: 'noOp' };
export interface GovernanceLaunchpad {
  type: 'launchpad';
  multisig: Address;
}

export type GovernanceOption<C extends SupportedChainId> =
  | GovernanceDefault
  | GovernanceCustom
  | (C extends NoOpEnabledChainId ? GovernanceNoOp : never)
  | (C extends LaunchpadEnabledChainId ? GovernanceLaunchpad : never);

// Unified beneficiary data used for fee streaming, lockable initializers, and migration configs
// Uses shares in WAD format (1e18 = 100%) for consistency across all beneficiary configurations
export interface BeneficiaryData {
  beneficiary: Address;
  shares: bigint; // shares in WAD (1e18 = 100%)
}

// Pool status for lockable initializer
export enum LockablePoolStatus {
  Uninitialized = 0,
  Initialized = 1,
  Locked = 2,
  Exited = 3,
}

// Opening auction phase (hook-level)
export enum OpeningAuctionPhase {
  NotStarted = 0,
  Active = 1,
  Closed = 2,
  Settled = 3,
}

// Opening auction status (initializer-level)
export enum OpeningAuctionStatus {
  Uninitialized = 0,
  AuctionActive = 1,
  DopplerActive = 2,
  Exited = 3,
}

// Lockable pool state
export interface LockablePoolState {
  asset: Address;
  numeraire: Address;
  tickLower: number;
  tickUpper: number;
  maxShareToBeSold: bigint;
  totalTokensOnBondingCurve: bigint;
  status: LockablePoolStatus;
}

// Multicurve pool state (V4 initializer)
export interface MulticurvePoolState {
  asset: Address;
  numeraire: Address;
  fee: number;
  tickSpacing: number;
  status: LockablePoolStatus; // Reuses the same enum
  poolKey: V4PoolKey;
  farTick: number;
}

// Migration configuration (discriminated union)

export interface DopplerHookMigratorConfig {
  type: 'dopplerHookMigrator';
  // Fee for fixed-fee pools, or initial LP fee when useDynamicFee=true.
  fee: number;
  // Use dynamic LP fees on the migrated V4 pool.
  useDynamicFee?: boolean;
  // Tick spacing for the migrated V4 pool.
  tickSpacing: number;
  // Fee lock duration in seconds.
  lockDuration: number;
  // Fee streaming beneficiaries (must be sorted and sum to WAD onchain).
  beneficiaries: BeneficiaryData[];
  // Generic hook configuration (raw initialization calldata).
  hook?: {
    hookAddress: Address;
    onInitializationCalldata?: `0x${string}`;
  };
  // Optional proceeds split paid out during migration.
  proceedsSplit?: {
    recipient: Address;
    share: bigint;
  };
}

/**
 * @deprecated Use DopplerHookMigratorConfig with
 * `type: 'dopplerHookMigrator'` instead.
 */
export type DopplerHookMigrationConfig = Omit<
  DopplerHookMigratorConfig,
  'type'
> & {
  type: 'dopplerHook';
};

export interface ProceedsSplitConfig {
  recipient: Address;
  share: bigint;
}

export interface StreamableFeesConfig {
  lockDuration: number; // in seconds
  beneficiaries: BeneficiaryData[]; // Uses shares in WAD (1e18 = 100%)
}

export interface UniswapV2MigrationConfig {
  type: 'uniswapV2';
}

export interface UniswapV2SplitMigrationConfig {
  type: 'uniswapV2Split';
  // Optional proceeds split paid out during migration.
  proceedsSplit?: ProceedsSplitConfig;
}

export interface UniswapV4MigrationConfig {
  type: 'uniswapV4';
  fee: number;
  tickSpacing: number;
  // Configuration for fee streaming via StreamableFeesLocker (optional)
  // When omitted, fees are not locked and beneficiaries are not configured
  // This is useful when using noOp governance where lock duration is not meaningful
  streamableFees?: StreamableFeesConfig;
}

export interface UniswapV4SplitMigrationConfig {
  type: 'uniswapV4Split';
  fee: number;
  tickSpacing: number;
  // Required for split V4 migration because the migrator always configures
  // locker beneficiaries and lock duration during initialization.
  streamableFees: StreamableFeesConfig;
  // Optional proceeds split paid out during migration.
  proceedsSplit?: ProceedsSplitConfig;
}

export type MigrationConfig =
  | UniswapV2MigrationConfig // Basic migration to a new Uniswap v2 pool
  | UniswapV2SplitMigrationConfig // V2 migration with an optional proceeds split
  | UniswapV4MigrationConfig
  | UniswapV4SplitMigrationConfig
  | DopplerHookMigratorConfig // Dynamic-only: migration via DopplerHookMigrator
  | DopplerHookMigrationConfig // Deprecated DopplerHookMigrator discriminator
  | { type: 'noOp' }; // No migration - used with lockable beneficiaries

// Create Static Auction parameters
export interface CreateStaticAuctionParams<
  C extends SupportedChainId = SupportedChainId,
> {
  // Token configuration
  token: TokenConfig;

  // Sale configuration
  sale: SaleConfig;

  // Static Auction (Uniswap v3) Pool configuration
  pool: StaticPoolConfig;

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Governance configuration (required). Use `{ type: 'noOp' }` where enabled,
  // `{ type: 'default' }` for standard defaults, or `{ type: 'custom', ... }` to customize.
  governance: GovernanceOption<C>;

  // Explicit Migration Configuration
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;

  // Optional address overrides for on-chain modules used during encoding/creation
  modules?: ModuleAddressOverrides;

  // Optional transaction gas limit override for the create() transaction
  // If omitted, SDK will default to 13,500,000 gas for create()
  gas?: bigint;
}

// Create Dynamic Auction parameters
export interface CreateDynamicAuctionParams<
  C extends SupportedChainId = SupportedChainId,
> {
  // Token configuration
  token: TokenConfig;

  // Sale configuration
  sale: SaleConfig;

  // Dynamic Auction (Uniswap v4 Hook) configuration
  auction: DynamicAuctionConfig;

  // Pool configuration
  pool: {
    fee: number; // e.g., 3000 for 0.3%
    tickSpacing: number;
  };

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Governance configuration (required). Use `{ type: 'noOp' }` where enabled,
  // `{ type: 'default' }` for standard defaults, or `{ type: 'custom', ... }` to customize.
  governance: GovernanceOption<C>;

  // Explicit Migration Configuration
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;

  // Time configuration (internal use)
  startTimeOffset?: number;
  blockTimestamp?: number; // Optional: use this block timestamp instead of fetching latest

  // Optional transaction gas limit override for the create() transaction
  // If omitted, SDK will default to 13,500,000 gas for create()
  gas?: bigint;

  // Optional address overrides for on-chain modules used during encoding/creation
  modules?: ModuleAddressOverrides;
}

// Create Opening Auction parameters
export interface CreateOpeningAuctionParams<
  C extends SupportedChainId = SupportedChainId,
> {
  // Token configuration
  token: TokenConfig;

  // Sale configuration
  sale: SaleConfig;

  // Opening auction configuration
  openingAuction: OpeningAuctionConfig;

  // Doppler handoff configuration
  doppler: OpeningAuctionDopplerConfig;

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Governance configuration (required). Use `{ type: 'noOp' }` where enabled,
  // `{ type: 'default' }` for standard defaults, or `{ type: 'custom', ... }` to customize.
  governance: GovernanceOption<C>;

  // Explicit Migration Configuration
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;

  // Optional timing controls for Doppler handoff start
  startTimeOffset?: number;
  startingTime?: number;

  // Optional: use this block timestamp instead of fetching latest
  blockTimestamp?: number;

  // Optional transaction gas limit override for the create() transaction
  // If omitted, SDK will default to 13,500,000 gas for create()
  gas?: bigint;

  // Optional address overrides for on-chain modules used during encoding/creation
  modules?: ModuleAddressOverrides;
}

// Price range configuration for automatic tick calculation
export interface PriceRange {
  startPrice: number;
  endPrice: number;
}

// Tick range configuration
export interface TickRange {
  startTick: number;
  endTick: number;
}

// ============================================================================
// Market Cap Configuration Types
// ============================================================================

/**
 * Market cap range in USD for price configurations.
 * Used to define start and end market caps for bonding curves.
 */
export interface MarketCapRange {
  /** Starting market cap in USD (e.g., 100_000 for $100k) */
  start: number;
  /** Ending market cap in USD (e.g., 10_000_000 for $10M) */
  end: number;
}

/**
 * Base configuration for market cap-based tick calculations.
 * Used by builder methods to convert market caps to ticks.
 */
export interface MarketCapConfig {
  /** Target market cap range in USD */
  marketCap: MarketCapRange;
  /** Price of numeraire in USD (e.g., 3000 for ETH at $3000) */
  numerairePrice: number;
  /**
   * Token supply override. If not provided, inferred from saleConfig.initialSupply.
   * Must include decimals (e.g., parseEther('1000000000') for 1B tokens).
   */
  tokenSupply?: bigint;
  /** Token decimals (default: 18) */
  tokenDecimals?: number;
  /** Numeraire decimals (default: 18) */
  numeraireDecimals?: number;
}

/**
 * Market cap configuration for V3 Static Auctions.
 * Extends base config with V3-specific parameters.
 */
export interface StaticAuctionMarketCapConfig extends MarketCapConfig {
  /** Fee tier in basis points (e.g., 10000 for 1%). Default: 10000 */
  fee?: number;
  /** Number of liquidity positions. Default: 15 */
  numPositions?: number;
  /** Maximum share of tokens to sell per position (WAD). Default: 35% */
  maxShareToBeSold?: bigint;
}

/**
 * Market cap range for V4 Dynamic Auctions (Dutch auctions).
 * Uses start/min because price descends from start to minimum.
 */
export interface DynamicMarketCapRange {
  /** Starting market cap in USD - auction begins here (e.g., 500_000 for $500k) */
  start: number;
  /** Minimum market cap in USD - floor price the auction descends to (e.g., 50_000 for $50k) */
  min: number;
}

/**
 * Market cap configuration for V4 Dynamic Auctions.
 * Uses start/min (not start/end) because Dutch auctions descend from start to minimum.
 */
export interface DynamicAuctionMarketCapConfig {
  /** Target market cap range (start = launch price, min = floor price) */
  marketCap: DynamicMarketCapRange;
  /** Price of numeraire in USD (e.g., 3000 for ETH at $3000) */
  numerairePrice: number;
  /**
   * Token supply override. If not provided, inferred from saleConfig.initialSupply.
   * Must include decimals (e.g., parseEther('1000000000') for 1B tokens).
   */
  tokenSupply?: bigint;
  /** Token decimals (default: 18) */
  tokenDecimals?: number;
  /** Numeraire decimals (default: 18) */
  numeraireDecimals?: number;
  /**
   * Pool fee in basis points. Default: 10000 (1%)
   *
   * V4 pools support any fee from 0 to 100,000 (10%).
   * Standard tiers (100, 500, 3000, 10000) auto-derive tickSpacing.
   * Custom fees require explicit tickSpacing parameter.
   */
  fee?: number;
  /**
   * Tick spacing for the pool. Required for custom fees.
   *
   * Must be <= 30 for Doppler pools (MAX_TICK_SPACING constraint).
   * If not provided with a standard fee tier, defaults to 30.
   */
  tickSpacing?: number;
  /** Minimum proceeds required for successful auction */
  minProceeds: bigint;
  /** Maximum proceeds cap for the auction */
  maxProceeds: bigint;
  /** Auction duration in seconds. Default: 7 days */
  duration?: number;
  /** Epoch length in seconds. Default: 3600 (1 hour) */
  epochLength?: number;
  /** Gamma (tick decay per epoch). Auto-calculated if not provided */
  gamma?: number;
  /** Number of price discovery slugs. Default: 5 */
  numPdSlugs?: number;
}

/**
 * Result of market cap parameter validation.
 */
export interface MarketCapValidationResult {
  /** Whether all parameters are within normal bounds */
  valid: boolean;
  /** Warning messages for unusual but technically valid values */
  warnings: string[];
}

// ============================================================================
// Market Cap Helper Function Parameter Types
// ============================================================================

/**
 * Parameters for converting market cap range to ticks for V3 Static Auctions.
 */
export interface StaticAuctionTickParams {
  marketCapRange: MarketCapRange;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

/**
 * Parameters for converting market cap range to ticks for V4 Dynamic Auctions.
 */
export interface DynamicAuctionTickParams {
  marketCapRange: MarketCapRange;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  numeraire: Address;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

/**
 * Parameters for converting market cap range to ticks for V4 Multicurve pools.
 */
export interface MulticurveTickRangeParams {
  marketCapLower: number;
  marketCapUpper: number | 'max';
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

/**
 * Parameters for converting a single market cap to a tick for Multicurve.
 */
export interface MulticurveTickParams {
  marketCapUSD: number;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tickSpacing: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

/**
 * Parameters for converting a tick to market cap (reverse conversion).
 */
export interface TickToMarketCapParams {
  tick: number;
  tokenSupply: bigint;
  numerairePriceUSD: number;
  tokenDecimals?: number;
  numeraireDecimals?: number;
}

// ============================================================================
// New Multicurve Market Cap API (no tick math required)
// ============================================================================

/**
 * Curve configuration for Multicurve pools using market cap ranges.
 * Each curve defines a market cap range and liquidity distribution.
 */
export interface MulticurveMarketCapRangeCurve {
  /** Market cap range for this curve */
  marketCap: {
    /** Start market cap in USD (for the first curve, this is the launch price) */
    start: number;
    /** End market cap in USD, or 'max' for the highest contract-safe terminal tick */
    end: number | 'max';
  };
  /** Number of liquidity positions in this curve */
  numPositions: number;
  /** Share of total supply allocated to this curve (WAD, e.g., parseEther('0.3') = 30%) */
  shares: bigint;
}

/**
 * Market cap-based configuration for Multicurve pools.
 * No tick math required - just specify market caps in USD.
 */
export interface MulticurveMarketCapCurvesConfig {
  /** Price of numeraire in USD (e.g., 3000 for ETH at $3000) */
  numerairePrice: number;
  /**
   * Array of curves defining market cap ranges and liquidity distribution.
   * The first curve's marketCap.start is the launch price.
   * Curves must be contiguous (no gaps allowed).
   */
  curves: MulticurveMarketCapRangeCurve[];
  /** Token supply override */
  tokenSupply?: bigint;
  /** Token decimals (default: 18) */
  tokenDecimals?: number;
  /** Numeraire decimals (default: 18) */
  numeraireDecimals?: number;
  /** Fee tier (default: FEE_TIERS.LOW) */
  fee?: number;
  /** Tick spacing (derived from fee if not provided) */
  tickSpacing?: number;
  /** Optional beneficiaries for fee streaming */
  beneficiaries?: BeneficiaryData[];
}

// Build configuration for static auctions (V3-style)
export interface StaticAuctionBuildConfig {
  // Token details
  name: string;
  symbol: string;
  totalSupply?: bigint; // default: 1 billion
  numTokensToSell?: bigint; // default: 900 million
  tokenURI: string;

  // Time parameters
  startTimeOffset?: number; // Optional - seconds to add to current block timestamp (default: 30)

  // Price parameters - must provide either priceRange or tickRange
  numeraire: Address; // Required for V3
  tickRange?: TickRange;
  priceRange?: PriceRange;
  fee?: number; // default: 10000 (1%)

  // Pool parameters (V3 specific)
  numPositions?: number; // default: 15
  maxShareToBeSold?: bigint; // default: 35% in WAD

  // Vesting parameters
  yearlyMintRate?: bigint; // default: 2%
  vestingDuration?: bigint; // default: 1 year
  recipients?: Address[]; // defaults to [userAddress]
  amounts?: bigint[]; // defaults based on pre-mint calculation

  // Migration configuration
  migration: MigrationConfig;

  // Other parameters
  integrator?: Address;
  useGovernance?: boolean; // default: true
}

// Build configuration for dynamic auctions (V4-style)
export interface DynamicAuctionBuildConfig {
  // Token details
  name: string;
  symbol: string;
  totalSupply: bigint;
  numTokensToSell: bigint;
  tokenURI: string;

  // Time parameters
  startTimeOffset?: number; // Optional - seconds to add to block timestamp (default: 30)
  blockTimestamp?: number; // Optional - specific block timestamp to use (default: fetch latest)
  duration?: number; // in seconds (default: 604800 = 7 days)
  epochLength?: number; // in seconds (default: 3600)

  // Price parameters - must provide either priceRange or tickRange
  numeraire?: Address; // defaults to zero address
  tickRange?: TickRange;
  priceRange?: PriceRange;
  tickSpacing: number;
  gamma?: number; // auto-calculated if not provided
  fee: number; // In basis points

  // Sale parameters
  minProceeds: bigint;
  maxProceeds: bigint;
  numPdSlugs?: number; // default: 5

  // Vesting parameters
  yearlyMintRate?: bigint; // default: 2%
  vestingDuration: bigint;
  recipients: Address[];
  amounts: bigint[];

  // Migration configuration
  migration: MigrationConfig;

  // Other parameters
  integrator?: Address;
  useGovernance?: boolean; // default: true
}

// SDK initialization configuration
export interface DopplerSDKConfig {
  publicClient: SupportedPublicClient;
  walletClient?: WalletClient;
  chainId: number;
}

// Pool information types
export interface PoolInfo {
  address: Address;
  tokenAddress: Address;
  numeraireAddress: Address;
  fee: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
}

export interface HookInfo {
  hookAddress: Address;
  tokenAddress: Address;
  numeraireAddress: Address;
  poolId: string;
  currentEpoch: number;
  totalProceeds: bigint;
  totalTokensSold: bigint;
  earlyExit: boolean;
  insufficientProceeds: boolean;
  startingTime: bigint;
  endingTime: bigint;
  epochLength: bigint;
  minimumProceeds: bigint;
  maximumProceeds: bigint;
}

export interface OpeningAuctionState {
  numeraire: Address;
  auctionStartTime: bigint;
  auctionEndTime: bigint;
  auctionTokens: bigint;
  dopplerTokens: bigint;
  status: OpeningAuctionStatus;
  openingAuctionHook: Address;
  dopplerHook: Address;
  openingAuctionPoolKey: V4PoolKey;
  dopplerInitData: `0x${string}`;
  isToken0: boolean;
}

export interface OpeningAuctionCreateResult {
  tokenAddress: Address;
  openingAuctionHookAddress: Address;
  transactionHash: string;
  createParams: CreateParams;
  minedSalt: `0x${string}`;
}

export interface OpeningAuctionCompleteResult {
  asset: Address;
  dopplerHookAddress: Address;
  transactionHash: string;
  dopplerSalt: `0x${string}`;
}

// Quote result type
export interface QuoteResult {
  amountOut: bigint;
  priceImpact: number;
  fee: bigint;
  route: string[];
}

// Lockable Uniswap V3 Initializer encode params
export interface LockableV3InitializerParams {
  fee: number;
  tickLower: number;
  tickUpper: number;
  numPositions: number;
  maxShareToBeSold: bigint;
  beneficiaries: BeneficiaryData[];
}

// Multicurve curve configuration (mirrors solidity struct)
export interface MulticurveCurve {
  tickLower: number; // int24
  tickUpper: number; // int24
  numPositions: number; // uint16
  shares: bigint; // uint256 (WAD)
}

export type MulticurveMarketCapPreset = 'low' | 'medium' | 'high';

export interface V4PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

// RehypeDopplerHook configuration for fee distribution and buyback
export interface RehypeFeeDistributionInfo {
  assetFeesToAssetBuybackWad: bigint;
  assetFeesToNumeraireBuybackWad: bigint;
  assetFeesToBeneficiaryWad: bigint;
  assetFeesToLpWad: bigint;
  numeraireFeesToAssetBuybackWad: bigint;
  numeraireFeesToNumeraireBuybackWad: bigint;
  numeraireFeesToBeneficiaryWad: bigint;
  numeraireFeesToLpWad: bigint;
}

export interface RehypeIntegratorFeeConfig {
  /**
   * Rehype integrator address. Defaults to the launch's top-level integrator.
   */
  integrator?: Address;
  /**
   * Share of the gross Rehype hook fee, in millionths.
   * Valid range: 1 through 750_000.
   */
  feeShare: number;
  /**
   * Portion of asset-denominated fees converted to numeraire.
   * Denominator: 1_000_000_000. Defaults to 0.
   */
  assetFeesToNumeraireRatio?: number;
  /**
   * Portion of numeraire-denominated fees converted to asset.
   * Denominator: 1_000_000_000. Defaults to 0.
   */
  numeraireFeesToAssetRatio?: number;
  /** Whether processed fees are automatically paid to the integrator. */
  automaticPayout?: boolean;
}

export enum RehypeFeeRoutingMode {
  DirectBuyback = 0,
  RouteToBeneficiaryFees = 1,
}

type RehypeFeeRoutingModeInput =
  | RehypeFeeRoutingMode
  | 'directBuyback'
  | 'routeToBeneficiaryFees';

type RehypeDopplerHookInitializerCommonConfig = {
  hookAddress: Address;
  startFee?: number;
  endFee?: number;
  durationSeconds?: number | bigint;
  startingTime?: number | bigint | Date;
  feeDistributionInfo?: RehypeFeeDistributionInfo;
  integratorFeeConfig?: RehypeIntegratorFeeConfig;

  /**
   * @deprecated Use startFee/endFee instead. When provided alone, maps to startFee=endFee=customFee.
   */
  customFee?: number;
  /**
   * @deprecated Use feeDistributionInfo.* fields instead.
   * If feeDistributionInfo is omitted, legacy percentages are mirrored to both rows.
   */
  assetBuybackPercentWad?: bigint;
  /**
   * @deprecated Use feeDistributionInfo.* fields instead.
   */
  numeraireBuybackPercentWad?: bigint;
  /**
   * @deprecated Use feeDistributionInfo.* fields instead.
   */
  beneficiaryPercentWad?: bigint;
  /**
   * @deprecated Use feeDistributionInfo.* fields instead.
   */
  lpPercentWad?: bigint;

  // Optional graduation calldata (called when pool graduates)
  graduationCalldata?: `0x${string}`;

  // Graduation threshold configuration (rehype-only)
  // Market cap in USD at which pool can graduate. Requires numerairePrice (from withCurves() or explicit).
  graduationMarketCap?: number;
  // Price of numeraire in USD. Optional if using withCurves() (reuses that value). Required with poolConfig().
  numerairePrice?: number;
  // Direct tick value for graduation threshold. Use graduationMarketCap for USD-based config.
  farTick?: number;
};

type RehypeBuybackDestinationConfig = {
  buybackDestination?: Address;
  feeBeneficiaries?: never;
  feeRoutingMode?: RehypeFeeRoutingModeInput;
};

type RehypeFeeBeneficiariesConfig = {
  buybackDestination?: Address;
  feeBeneficiaries: [BeneficiaryData, ...BeneficiaryData[]];
  feeRoutingMode?:
    | RehypeFeeRoutingMode.RouteToBeneficiaryFees
    | 'routeToBeneficiaryFees';
};

/**
 * Rehype fee distribution controller requirements:
 *
 * `buybackDestination` is encoded as the hook's `buybackDst`: it is the only
 * address authorized to call `setFeeDistribution` and also receives
 * direct-buyback proceeds and legacy empty-beneficiary fees. Configured
 * `feeBeneficiaries` control beneficiary fee recipients but do not grant that
 * authority.
 *
 * Every Rehype configuration requires an explicit fee distribution controller.
 * Direct factory callers must set `buybackDestination`. Builder callers may
 * instead use `withFeeDistributionController`. These options configure the
 * same on-chain field and cannot be used together.
 *
 * Governance configuration, governance factory results, fee beneficiaries,
 * and LP reinvestment do not determine or provide the controller.
 */
export type RehypeDopplerHookInitializerConfig =
  RehypeDopplerHookInitializerCommonConfig &
    (RehypeBuybackDestinationConfig | RehypeFeeBeneficiariesConfig);

/** @deprecated Use RehypeDopplerHookInitializerConfig instead. */
export type RehypeDopplerHookConfig = RehypeDopplerHookInitializerConfig;

// Decay fee schedule state for multicurve pools using a dynamic-fee hook
export interface MulticurveDecayFeeSchedule {
  startingTime: number;
  startFee: number;
  endFee: number;
  lastFee: number;
  durationSeconds: number;
}

export type MulticurveInitializerConfig =
  | { type: 'dopplerHookInitializer' }
  | {
      /** @deprecated Use 'dopplerHookInitializer' instead. */
      type: 'dopplerHook';
    }
  | { type: 'standard' }
  | { type: 'scheduled'; startTime: number }
  | {
      type: 'decay';
      startTime: number;
      startFee: number;
      durationSeconds: number;
    }
  | { type: 'rehype'; config: RehypeDopplerHookInitializerConfig };

/**
 * Bundler custody schedule for a multicurve dev buy.
 *
 * Durations are seconds. A permissionless claim changes who may trigger the
 * claim, never the recipient.
 */
export interface MulticurveDevBuyVestingConfig {
  permissionlessClaim: boolean;
  vestingDuration: bigint;
  cliffDuration: bigint;
}

/** Exact-input purchase executed atomically with multicurve market creation. */
export interface MulticurveDevBuyConfig {
  exactAmountIn: bigint;
  recipient: Address;
  vesting: MulticurveDevBuyVestingConfig;
}

// Create Multicurve initializer parameters
export interface CreateMulticurveParams<
  C extends SupportedChainId = SupportedChainId,
> {
  // Token configuration
  token: TokenConfig;

  // Sale configuration
  sale: SaleConfig;

  // Pool configuration for multicurve initializer
  pool: {
    // For decay initializer mode, this is the terminal fee (endFee).
    fee: number;
    tickSpacing: number;
    curves: MulticurveCurve[];
    // Optional beneficiaries to lock the pool (fee collection only, no migration)
    beneficiaries?: BeneficiaryData[];
  };

  // Preferred initializer configuration. Defaults to DopplerHookInitializer.
  initializer?: MulticurveInitializerConfig;

  /**
   * @deprecated Use initializer: { type: 'scheduled', startTime } instead.
   * Retained for backwards compatibility.
   */
  // Optional scheduled launch configuration
  schedule?: {
    startTime: number;
  };

  /**
   * @deprecated Use initializer: { type: 'rehype', config } instead.
   * Retained for backwards compatibility.
   */
  dopplerHook?: RehypeDopplerHookConfig;

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  /** Optional exact-input purchase executed atomically through Bundler. */
  devBuy?: MulticurveDevBuyConfig;

  // Governance configuration
  governance: GovernanceOption<C>;

  // Migration configuration (can be any supported migrator: V2, V3, or V4)
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;

  // Optional deterministic salt for CREATE2 token address selection
  salt?: Hex;

  // Optional address overrides for on-chain modules used during encoding/creation
  modules?: ModuleAddressOverrides;

  // Optional transaction gas limit override for the create() transaction
  gas?: bigint;
}

// Final Params object that gets passed as arg to create
export interface CreateParams {
  initialSupply: bigint;
  numTokensToSell: bigint;
  numeraire: Address;
  tokenFactory: Address;
  tokenFactoryData: `0x${string}`;
  governanceFactory: Address;
  governanceFactoryData: `0x${string}`;
  poolInitializer: Address;
  poolInitializerData: `0x${string}`;
  liquidityMigrator: Address;
  liquidityMigratorData: `0x${string}`;
  integrator: Address;
  salt: `0x${string}`;
}

export interface PrepareCreateMulticurveOptions {
  account: Address;
}

export type MulticurveCreateGasEstimate =
  | { status: 'estimated'; gas: bigint }
  | { status: 'unavailable' };

export interface MulticurveCreatePrediction {
  tokenAddress: Address;
  poolOrHookAddress: Address;
  governanceAddress: Address;
  timelockAddress: Address;
  migrationPoolAddress?: Address;
  poolKey: V4PoolKey;
  poolId: Hex;
  tokenIsCurrency0: boolean;
}

export interface PreparedMulticurveTransaction {
  to: Address;
  data: Hex;
  value: bigint;
}

/** Dev-buy details returned by preparation and contract simulation. */
export interface PreparedMulticurveDevBuy extends MulticurveDevBuyConfig {
  bundler: Address;
  simulatedAmountOut: bigint;
}

export interface PreparedMulticurveCreate<
  C extends SupportedChainId = SupportedChainId,
> {
  chainId: C;
  account: Address;
  airlock: Address;
  createParams: CreateParams;
  prediction: MulticurveCreatePrediction;
  transaction: PreparedMulticurveTransaction;
  approvalTransaction?: PreparedMulticurveTransaction;
  devBuy?: PreparedMulticurveDevBuy;
  gasEstimate: MulticurveCreateGasEstimate;
}

export interface SimulatedMulticurveCreate<
  _C extends SupportedChainId = SupportedChainId,
> {
  createParams: CreateParams;
  tokenAddress: Address;
  poolId: Hex;
  gasEstimate?: bigint;
  devBuy?: PreparedMulticurveDevBuy;
  execute: () => Promise<MulticurveCreateResult>;
}

/** Dev-buy details verified from the executed Bundler receipt. */
export interface MulticurveDevBuyResult extends MulticurveDevBuyConfig {
  bundler: Address;
  amountOut: bigint;
}

export interface MulticurveCreateResult {
  tokenAddress: Address;
  poolId: Hex;
  transactionHash: Hash;
  approvalTransactionHash?: Hash;
  devBuy?: MulticurveDevBuyResult;
}

// Optional per-call module address overrides. When provided, these take precedence
// over chain defaults resolved via getAddresses(chainId).
export interface ModuleAddressOverrides {
  // Core deployment & routing
  airlock?: Address;
  bundler?: Address;
  tokenFactory?: Address;
  dopplerERC20V1Factory?: Address;

  // Initializers
  v3Initializer?: Address;
  lockableV3Initializer?: Address;
  v4Initializer?: Address;
  v4MulticurveInitializer?: Address;
  v4ScheduledMulticurveInitializer?: Address;
  v4DecayMulticurveInitializer?: Address;
  openingAuctionInitializer?: Address;
  openingAuctionPositionManager?: Address;
  dopplerHookInitializer?: Address;
  rehypeDopplerHookInitializer?: Address;

  // DopplerHooks
  /**
   * @deprecated Use rehypeDopplerHookInitializer instead.
   */
  rehypeDopplerHook?: Address;

  // Governance
  governanceFactory?: Address;

  // Dynamic auction infra
  poolManager?: Address;
  dopplerDeployer?: Address;

  // Migrators
  v2Migrator?: Address;
  v2MigratorSplit?: Address;
  v4Migrator?: Address;
  v4MigratorSplit?: Address;
  dopplerHookMigrator?: Address;
  noOpMigrator?: Address;
}
