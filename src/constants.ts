import { Address } from 'viem'

// Common constants
export const WAD = 10n ** 18n
export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD' as Address
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

// Fee tiers
export const FEE_TIERS = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 3000,   // 0.30%
  HIGH: 10000     // 1.00%
} as const

// Tick spacings for different fee tiers
export const TICK_SPACINGS = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200
} as const

// Time constants
export const SECONDS_PER_DAY = 86400
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY

// Default values
export const DEFAULT_EPOCH_LENGTH = 3600 // 1 hour in seconds
export const DEFAULT_AUCTION_DURATION = 7 // 7 days
export const DEFAULT_LOCK_DURATION = SECONDS_PER_YEAR // 1 year
export const DEFAULT_PD_SLUGS = 5 // Default price discovery slugs
export const DAY_SECONDS = SECONDS_PER_DAY // Alias for consistency

// Price bounds
export const MIN_SQRT_RATIO = 4295128739n
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n

// Basis points
export const BASIS_POINTS = 10000

// V4 Hook Flags for Doppler
export const FLAG_MASK = BigInt(0x3fff)
export const DOPPLER_FLAGS = BigInt(
  (1 << 13) | // BEFORE_INITIALIZE_FLAG
  (1 << 12) | // AFTER_INITIALIZE_FLAG  
  (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
  (1 << 7) |  // BEFORE_SWAP_FLAG
  (1 << 6) |  // AFTER_SWAP_FLAG
  (1 << 5)    // BEFORE_DONATE_FLAG
)