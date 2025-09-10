import { base, baseSepolia, ink, unichain } from 'viem/chains';
import { CHAIN_IDS, type SupportedChainId } from './addresses';
// Re-export SupportedChainId so consumers can import from this module
export { type SupportedChainId } from './addresses';
import type {
  Address,
  PublicClient,
  Transport,
  WalletClient,
} from 'viem';

export type SupportedChain =
  | typeof base
  | typeof baseSepolia
  | typeof ink
  | typeof unichain
  | typeof baseSepolia;
export type SupportedPublicClient = PublicClient<Transport, SupportedChain>;

// Core configuration types
// Token configuration (discriminated union)
export interface StandardTokenConfig {
  type?: 'standard'; // default behavior (backwards compatible)
  name: string;
  symbol: string;
  tokenURI: string;
  yearlyMintRate?: bigint; // Optional yearly mint rate (in WAD, default: 2% = 0.02e18)
}

export interface Doppler404TokenConfig {
  type: 'doppler404';
  name: string;
  symbol: string;
  baseURI: string;
  // Optional unit for DN404 factory (uint256). Defaults to 1000 when omitted.
  unit?: bigint;
}

export type TokenConfig = StandardTokenConfig | Doppler404TokenConfig;

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
  lockableBeneficiaries?: LockableBeneficiaryData[]; // Optional beneficiaries for fee streaming
}

// Dynamic Auction configuration
export interface DynamicAuctionConfig {
  duration: number; // in days
  epochLength: number; // in seconds
  startTick: number;
  endTick: number;
  gamma?: number; // Optional, can be auto-calculated
  minProceeds: bigint;
  maxProceeds: bigint;
  numPdSlugs?: number; // Price discovery slugs (optional)
}

// Vesting configuration
export interface VestingConfig {
  duration: number; // in seconds
  cliffDuration: number; // in seconds
}

// Chains where no-op governance is enabled
export type NoOpEnabledChainId = typeof CHAIN_IDS.BASE | typeof CHAIN_IDS.BASE_SEPOLIA;

// Governance configuration (discriminated union)
export type GovernanceDefault = { type: 'default' };
export interface GovernanceCustom {
  type: 'custom';
  initialVotingDelay: number;
  initialVotingPeriod: number;
  initialProposalThreshold: bigint;
}
export type GovernanceNoOp = { type: 'noOp' };

export type GovernanceOption<C extends SupportedChainId> =
  | GovernanceDefault
  | GovernanceCustom
  | (C extends NoOpEnabledChainId ? GovernanceNoOp : never);

// Beneficiary data for streamable fees
export interface BeneficiaryData {
  address: Address;
  percentage: number; // basis points (e.g., 5000 = 50%)
}

// Lockable initializer beneficiary data (uses shares instead of percentage)
export interface LockableBeneficiaryData {
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

// Migration configuration (discriminated union)
export type MigrationConfig =
  | { type: 'uniswapV2' } // Basic migration to a new Uniswap v2 pool
  | {
      type: 'uniswapV3';
      fee: number;
      tickSpacing: number;
    }
  | {
      type: 'uniswapV4';
      fee: number;
      tickSpacing: number;
      // Configuration for fee streaming via StreamableFeesLocker
      streamableFees: {
        lockDuration: number; // in seconds
        beneficiaries: BeneficiaryData[];
      };
    };

// Create Static Auction parameters
export interface CreateStaticAuctionParams<C extends SupportedChainId = SupportedChainId> {
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
export interface CreateDynamicAuctionParams<C extends SupportedChainId = SupportedChainId> {
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
  duration?: number; // in days (default: 7)
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
export interface DopplerSDKConfig<C extends SupportedChainId = SupportedChainId> {
  publicClient: SupportedPublicClient;
  walletClient?: WalletClient;
  chainId: C;
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
  beneficiaries: LockableBeneficiaryData[];
}

// Multicurve curve configuration (mirrors solidity struct)
export interface MulticurveCurve {
  tickLower: number; // int24
  tickUpper: number; // int24
  numPositions: number; // uint16
  shares: bigint; // uint256 (WAD)
}

// Create Multicurve initializer parameters
export interface CreateMulticurveParams<C extends SupportedChainId = SupportedChainId> {
  // Token configuration
  token: TokenConfig;

  // Sale configuration
  sale: SaleConfig;

  // Pool configuration for multicurve initializer
  pool: {
    fee: number;
    tickSpacing: number;
    curves: MulticurveCurve[];
    // Optional beneficiaries to lock the pool (fee collection only, no migration)
    lockableBeneficiaries?: LockableBeneficiaryData[];
  };

  // Vesting configuration (optional)
  vesting?: VestingConfig;

  // Governance configuration
  governance: GovernanceOption<C>;

  // Migration configuration (can be any supported migrator: V2, V3, or V4)
  migration: MigrationConfig;

  // Integrator details
  integrator?: Address;
  userAddress: Address;

  // Optional address overrides for on-chain modules used during encoding/creation
  modules?: ModuleAddressOverrides;

  // Optional transaction gas limit override for the create() transaction
  gas?: bigint;
}

// Final Params object that gets passed as arg to create
export interface CreateParams {
    initialSupply: bigint,
    numTokensToSell: bigint,
    numeraire: Address,
    tokenFactory: Address,
    tokenFactoryData: `0x${string}`,
    governanceFactory: Address,
    governanceFactoryData: `0x${string}`,
    poolInitializer: Address,
    poolInitializerData: `0x${string}`,
    liquidityMigrator: Address,
    liquidityMigratorData: `0x${string}`,
    integrator: Address,
    salt: `0x${string}`,
}

// Optional per-call module address overrides. When provided, these take precedence
// over chain defaults resolved via getAddresses(chainId).
export interface ModuleAddressOverrides {
  // Core deployment & routing
  airlock?: Address;
  tokenFactory?: Address;

  // Initializers
  v3Initializer?: Address;
  v4Initializer?: Address;
  v4MulticurveInitializer?: Address;

  // Governance
  governanceFactory?: Address;

  // Dynamic auction infra
  poolManager?: Address;
  dopplerDeployer?: Address;

  // Migrators
  v2Migrator?: Address;
  v3Migrator?: Address;
  v4Migrator?: Address;
}
