export const VERSION = '0.0.1-alpha.42'

// Export the main SDK class
export { DopplerSDK } from './DopplerSDK'

// Export factory and auction classes
export { DopplerFactory } from './entities/DopplerFactory'
export type { MigrationEncoder } from './entities/DopplerFactory'
export { StaticAuction, DynamicAuction } from './entities/auction'

// Export quoter
export { Quoter } from './entities/quoter'

// Export token entities
export { Derc20, Eth } from './entities/token'

// Export builders
export { StaticAuctionBuilder, DynamicAuctionBuilder, MulticurveBuilder } from './builders'

// Export all types
export type {
  // Core types
  TokenConfig,
  SaleConfig,
  StaticPoolConfig,
  DynamicAuctionConfig,
  VestingConfig,
  MigrationConfig,
  BeneficiaryData,

  // Lockable initializer types
  LockablePoolState,
  LockableV3InitializerParams,
  
  // Parameter types
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  V4PoolKey,
  MulticurveBundleExactOutResult,
  MulticurveBundleExactInResult,
  
  // Configuration types
  DopplerSDKConfig,
  
  // Information types
  PoolInfo,
  HookInfo,
  QuoteResult,

  // Chain/public client helper types
  SupportedPublicClient,
  SupportedChain,

  // Governance helper types
  NoOpEnabledChainId,
  GovernanceOption,
  
  // Internal create() param shape (advanced)
  CreateParams,
} from './types'

// Also export module override type for advanced usage
export type { ModuleAddressOverrides } from './types'

// Export enums
export { LockablePoolStatus } from './types'

// Export addresses and utilities
export { ADDRESSES, CHAIN_IDS, getAddresses, SUPPORTED_CHAIN_IDS, isSupportedChainId } from './addresses'
export type { SupportedChainId, ChainAddresses, SupportedChainKey } from './addresses'

// Export constants (excluding MIN_SQRT_RATIO and MAX_SQRT_RATIO to avoid conflicts)
export {
  WAD,
  DEAD_ADDRESS,
  ZERO_ADDRESS,
  FEE_TIERS,
  TICK_SPACINGS,
  SECONDS_PER_DAY,
  SECONDS_PER_YEAR,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_AUCTION_DURATION,
  DEFAULT_LOCK_DURATION,
  DEFAULT_PD_SLUGS,
  DAY_SECONDS,
  DEFAULT_V3_START_TICK,
  DEFAULT_V3_END_TICK,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_FEE,
  DEFAULT_V3_INITIAL_VOTING_DELAY,
  DEFAULT_V3_INITIAL_VOTING_PERIOD,
  DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V3_VESTING_DURATION,
  DEFAULT_V3_INITIAL_SUPPLY,
  DEFAULT_V3_NUM_TOKENS_TO_SELL,
  DEFAULT_V3_YEARLY_MINT_RATE,
  DEFAULT_V3_PRE_MINT,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V4_YEARLY_MINT_RATE,
  BASIS_POINTS
} from './constants'

// Export utility functions (includes MIN_SQRT_RATIO and MAX_SQRT_RATIO from tickMath)
export * from './utils'

// Export ABIs
export * from './abis'
