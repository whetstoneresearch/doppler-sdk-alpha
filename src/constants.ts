import { Address, parseEther } from 'viem'

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
export const DEFAULT_EPOCH_LENGTH = 43200 // 12 hours in seconds (matching V4 SDK)
export const DEFAULT_AUCTION_DURATION = 7 * SECONDS_PER_DAY // 7 days
export const DEFAULT_LOCK_DURATION = SECONDS_PER_YEAR // 1 year
export const DEFAULT_PD_SLUGS = 5 // Default price discovery slugs
export const DAY_SECONDS = SECONDS_PER_DAY // Alias for consistency

// Default gas limit to fall back on when create() simulations do not return a value
export const DEFAULT_CREATE_GAS_LIMIT = 13_500_000n

// V3 Default parameters
export const DEFAULT_V3_START_TICK = 175000
export const DEFAULT_V3_END_TICK = 225000
export const DEFAULT_V3_NUM_POSITIONS = 15
export const DEFAULT_V3_FEE = 10000 // 1% fee tier
export const DEFAULT_V3_INITIAL_VOTING_DELAY = 172800 // 2 days
export const DEFAULT_V3_INITIAL_VOTING_PERIOD = 1209600 // 14 days
export const DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD = 0n
export const DEFAULT_V3_VESTING_DURATION = BigInt(SECONDS_PER_YEAR)
export const DEFAULT_V3_INITIAL_SUPPLY = parseEther('1000000000') // 1 billion tokens
export const DEFAULT_V3_NUM_TOKENS_TO_SELL = parseEther('900000000') // 900 million tokens
export const DEFAULT_V3_YEARLY_MINT_RATE = parseEther('0.02') // 2% yearly mint rate
export const DEFAULT_V3_PRE_MINT = parseEther('9000000') // 9 million tokens (0.9%)
export const DEFAULT_V3_MAX_SHARE_TO_BE_SOLD = parseEther('0.35') // 35%

// V4 Default parameters
export const DEFAULT_V4_INITIAL_VOTING_DELAY = 7200 // 2 hours
export const DEFAULT_V4_INITIAL_VOTING_PERIOD = 50400 // 14 hours
export const DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD = 0n
export const DEFAULT_V4_YEARLY_MINT_RATE = parseEther('0.02') // 2% yearly mint rate

// V4 Multicurve Default Tick Ranges
// Based on market cap tiers: LOW ($7.5k -> $30k), MEDIUM ($50k -> $150k), HIGH ($250k -> $750k)
// Calculated for 1B token supply, $4500 numeraire (e.g., WETH on Base)
export const DEFAULT_MULTICURVE_LOWER_TICKS = [-202_100, -183_100, -167_000] as const
export const DEFAULT_MULTICURVE_UPPER_TICKS = [-188_200, -172_100, -156_000] as const
export const DEFAULT_MULTICURVE_NUM_POSITIONS = [11, 11, 11] as const
export const DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES = [
  parseEther('0.05'),   // 5% for LOW tier
  parseEther('0.125'),  // 12.5% for MEDIUM tier
  parseEther('0.2'),    // 20% for HIGH tier
] as const

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

// V4 Dynamic Fee Flag
export const DYNAMIC_FEE_FLAG = 0x800000 // 8388608 in decimal
export const FEE_AMOUNT_MASK = 0xFFFFFF // Mask to extract actual fee from dynamic fee
