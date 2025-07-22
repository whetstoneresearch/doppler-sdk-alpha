import type { Address, PublicClient, WalletClient } from 'viem'

// Core configuration types
export interface TokenConfig {
  name: string
  symbol: string
  tokenURI: string
}

export interface SaleConfig {
  initialSupply: bigint
  numTokensToSell: bigint
  numeraire: Address // e.g., WETH address
}

// Static Auction Pool configuration
export interface StaticPoolConfig {
  startTick: number
  endTick: number
  fee: number // e.g., 3000 for 0.3%
}

// Dynamic Auction configuration
export interface DynamicAuctionConfig {
  duration: number // in days
  epochLength: number // in seconds
  startTick: number
  endTick: number
  gamma?: number // Optional, can be auto-calculated
  minProceeds: bigint
  maxProceeds: bigint
  numPdSlugs?: number // Price discovery slugs (optional)
}

// Vesting configuration
export interface VestingConfig {
  duration: number // in seconds
  cliffDuration: number // in seconds
}

// Beneficiary data for streamable fees
export interface BeneficiaryData {
  address: Address
  percentage: number // basis points (e.g., 5000 = 50%)
}

// Migration configuration (discriminated union)
export type MigrationConfig =
  | { type: 'uniswapV2' } // Basic migration to a new Uniswap v2 pool
  | {
      type: 'uniswapV3'
      fee: number
      tickSpacing: number
    }
  | {
      type: 'uniswapV4'
      fee: number
      tickSpacing: number
      // Configuration for fee streaming via StreamableFeesLocker
      streamableFees: {
        lockDuration: number // in seconds
        beneficiaries: BeneficiaryData[]
      }
      // For no-op governance where 100% of liquidity is permanently locked
      noOpGovernance?: boolean
    }

// Create Static Auction parameters
export interface CreateStaticAuctionParams {
  // Token configuration
  token: TokenConfig

  // Sale configuration
  sale: SaleConfig

  // Static Auction (Uniswap v3) Pool configuration
  pool: StaticPoolConfig

  // Vesting configuration (optional)
  vesting?: VestingConfig

  // Explicit Migration Configuration
  migration: MigrationConfig

  // Integrator details
  integrator?: Address
  userAddress: Address
}

// Create Dynamic Auction parameters
export interface CreateDynamicAuctionParams {
  // Token configuration
  token: TokenConfig

  // Sale configuration
  sale: SaleConfig

  // Dynamic Auction (Uniswap v4 Hook) configuration
  auction: DynamicAuctionConfig
  
  // Pool configuration
  pool: {
    fee: number // e.g., 3000 for 0.3%
    tickSpacing: number
  }

  // Vesting configuration (optional)
  vesting?: VestingConfig

  // Explicit Migration Configuration
  migration: MigrationConfig

  // Integrator details
  integrator?: Address
  userAddress: Address
}

// SDK initialization configuration
export interface DopplerSDKConfig {
  publicClient: PublicClient
  walletClient?: WalletClient
  chainId: number
}

// Pool information types
export interface PoolInfo {
  address: Address
  tokenAddress: Address
  numeraireAddress: Address
  fee: number
  liquidity: bigint
  sqrtPriceX96: bigint
}

export interface HookInfo {
  hookAddress: Address
  tokenAddress: Address
  numeraireAddress: Address
  poolId: string
  currentEpoch: number
  totalProceeds: bigint
  totalTokensSold: bigint
  earlyExit: boolean
  insufficientProceeds: boolean
  startingTime: bigint
  endingTime: bigint
  epochLength: bigint
  minimumProceeds: bigint
  maximumProceeds: bigint
}


// Quote result type
export interface QuoteResult {
  amountOut: bigint
  priceImpact: number
  fee: bigint
  route: string[]
}