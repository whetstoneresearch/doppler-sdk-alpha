export const VERSION = '0.0.1'

// Export the main SDK class
export { DopplerSDK } from './DopplerSDK'

// Export factory and auction classes
export { DopplerFactory } from './entities/DopplerFactory'
export { StaticAuction, DynamicAuction } from './entities/auction'

// Export quoter
export { Quoter } from './entities/quoter'

// Export token entities
export { Derc20, Eth } from './entities/token'

// Export all types
export type {
  // Core types
  TokenConfig,
  SaleConfig,
  StaticPoolConfig,
  DynamicAuctionConfig,
  VestingConfig,
  BeneficiaryData,
  MigrationConfig,
  
  // Parameter types
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  
  // Configuration types
  DopplerSDKConfig,
  
  // Information types
  PoolInfo,
  HookInfo,
  QuoteResult
} from './types'

// Export constants
export * from './constants'

// Export addresses and utilities
export { ADDRESSES, CHAIN_IDS, getAddresses } from './addresses'
export type { SupportedChainId } from './addresses'

// Export ABIs
export * from './abis'