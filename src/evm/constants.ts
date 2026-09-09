import { Address, parseEther } from 'viem';

// Common constants
export const WAD = 10n ** 18n;
export const DEAD_ADDRESS =
  '0x000000000000000000000000000000000000dEaD' as Address;
export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as Address;
export const MAX_UINT64 = (1n << 64n) - 1n;
export const MAX_UINT128 = (1n << 128n) - 1n;

// =============================================================================
// Fee Tiers - V3 vs V4 Distinction
// =============================================================================
//
// Uniswap V3 (Static Auctions): Fees are COUPLED to tick spacings. Only 4 tiers allowed.
// Uniswap V4 (Dynamic/Multicurve): Fees are DECOUPLED. Any fee 0-100,000 is valid.
//
// The standard fee tiers below are recognized by both V3 and V4, but V4 pools
// can use ANY fee value as long as you provide an explicit tickSpacing.

/** Standard fee tiers recognized by both Uniswap V3 and V4 */
export const FEE_TIERS = {
  LOWEST: 100, // 0.01%
  LOW: 500, // 0.05%
  MEDIUM: 3000, // 0.30%
  HIGH: 10000, // 1.00%
} as const;

/** Valid fee tier values (100, 500, 3000, 10000) */
export type FeeTier = (typeof FEE_TIERS)[keyof typeof FEE_TIERS];

/**
 * Standard fee tiers - REQUIRED for V3 (Static Auctions).
 * V4 pools can use custom fees but these are the recommended defaults.
 */
export const VALID_FEE_TIERS: readonly FeeTier[] = [
  100, 500, 3000, 10000,
] as const;

/**
 * V3 fee tiers - These are the ONLY valid fees for Uniswap V3 pools.
 * Static Auctions use V3 and must use one of these tiers.
 */
export const V3_FEE_TIERS = VALID_FEE_TIERS;

/**
 * Maximum LP fee for V4 pools (from DopplerHookInitializer.sol).
 * V4 pools can use any fee from 0 to this value.
 * @see DopplerHookInitializer.sol line 171: `uint24 constant MAX_LP_FEE = 100_000`
 */
export const V4_MAX_FEE = 100_000; // 10%

/**
 * Maximum allowed start fee for decay multicurve schedules.
 * This is intentionally higher than V4_MAX_FEE to support anti-sniping launches.
 * 800_000 = 80%
 */
export const DECAY_MAX_START_FEE = 800_000; // 80%

// Tick spacings for different fee tiers (standard Uniswap V3 mapping)
// In V4, tickSpacing is independent of fee - you can use any combination
export const TICK_SPACINGS = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
} as const;

/**
 * Maximum tick spacing allowed by Doppler.sol for dynamic (Dutch) auctions.
 * @see Doppler.sol line 159: `int24 constant MAX_TICK_SPACING = 30`
 */
export const DOPPLER_MAX_TICK_SPACING = 30;

// Time constants
export const SECONDS_PER_DAY = 86400;
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
export const MIN_BUNDLER_VESTING_DURATION = BigInt(SECONDS_PER_DAY);

// Default values
export const DEFAULT_EPOCH_LENGTH = 43200; // 12 hours in seconds (matching V4 SDK)
export const DEFAULT_AUCTION_DURATION = 7 * SECONDS_PER_DAY; // 7 days
export const DEFAULT_LOCK_DURATION = SECONDS_PER_YEAR; // 1 year
export const DEFAULT_PD_SLUGS = 5; // Default price discovery slugs
export const DAY_SECONDS = SECONDS_PER_DAY; // Alias for consistency

// Default gas limit to fall back on when create() simulations do not return a value
export const DEFAULT_CREATE_GAS_LIMIT = 13_500_000n;

// V3 Default parameters
export const DEFAULT_V3_START_TICK = 175000;
export const DEFAULT_V3_END_TICK = 225000;
export const DEFAULT_V3_NUM_POSITIONS = 15;
export const DEFAULT_V3_FEE = 10000; // 1% fee tier
export const DEFAULT_V3_INITIAL_VOTING_DELAY = SECONDS_PER_DAY; // 1 day
export const DEFAULT_V3_INITIAL_VOTING_PERIOD = 7 * SECONDS_PER_DAY; // 7 days
export const DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD = 0n;
export const DEFAULT_V3_VESTING_DURATION = BigInt(SECONDS_PER_YEAR);
export const DEFAULT_V3_INITIAL_SUPPLY = parseEther('1000000000'); // 1 billion tokens
export const DEFAULT_V3_NUM_TOKENS_TO_SELL = parseEther('900000000'); // 900 million tokens
export const DEFAULT_V3_YEARLY_MINT_RATE = parseEther('0.02'); // 2% yearly mint rate
export const DEFAULT_V3_PRE_MINT = parseEther('9000000'); // 9 million tokens (0.9%)
export const DEFAULT_V3_MAX_SHARE_TO_BE_SOLD = parseEther('0.35'); // 35%

// V4 Default parameters
export const DEFAULT_V4_INITIAL_VOTING_DELAY = SECONDS_PER_DAY; // 1 day
export const DEFAULT_V4_INITIAL_VOTING_PERIOD = 7 * SECONDS_PER_DAY; // 7 days
export const DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD = 0n;
export const DEFAULT_V4_YEARLY_MINT_RATE = parseEther('0.02'); // 2% yearly mint rate

// Opening Auction (Phase 1 lifecycle) default parameters
// Defaults mirror current opening-auction test/reference config in doppler.
export const OPENING_AUCTION_BPS = 10_000;
export const DEFAULT_OPENING_AUCTION_DURATION = SECONDS_PER_DAY; // 1 day
export const DEFAULT_OPENING_AUCTION_MIN_ACCEPTABLE_TICK_TOKEN0 = -34_020;
export const DEFAULT_OPENING_AUCTION_MIN_ACCEPTABLE_TICK_TOKEN1 = -34_020;
export const DEFAULT_OPENING_AUCTION_INCENTIVE_SHARE_BPS = 1000; // 10%
export const DEFAULT_OPENING_AUCTION_FEE = 3000; // 0.3%
export const DEFAULT_OPENING_AUCTION_MIN_LIQUIDITY = 10n ** 15n;
export const DEFAULT_OPENING_AUCTION_SHARE_TO_AUCTION_BPS = OPENING_AUCTION_BPS;

// Doppler handoff defaults for opening-auction transitions
export const DEFAULT_OPENING_DOPPLER_DURATION = DEFAULT_AUCTION_DURATION; // 7 days
export const DEFAULT_OPENING_DOPPLER_EPOCH_LENGTH = DEFAULT_EPOCH_LENGTH; // 12 hours
export const DEFAULT_OPENING_DOPPLER_NUM_PD_SLUGS = DEFAULT_PD_SLUGS;
export const DEFAULT_OPENING_DOPPLER_FEE = FEE_TIERS.HIGH; // 1%
export const DEFAULT_OPENING_DOPPLER_TICK_SPACING = DOPPLER_MAX_TICK_SPACING;

// V4 Multicurve Default Tick Ranges
// Based on market cap tiers: LOW ($0 -> $3M), MEDIUM ($1k -> $40M), HIGH ($100k -> $1B)
// Calculated for 1B token supply, $4500 numeraire (e.g., WETH on Base).
// The zero-start low tier uses the lowest usable tick rounded to 100 tick spacing.
export const DEFAULT_MULTICURVE_LOWER_TICKS = [
  -887_200, -222_200, -176_200,
] as const;
export const DEFAULT_MULTICURVE_UPPER_TICKS = [
  -142_200, -116_300, -84_100,
] as const;
export const DEFAULT_MULTICURVE_NUM_POSITIONS = [11, 11, 11] as const;
export const DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES = [
  parseEther('0.5'), // 50% for LOW tier
  parseEther('0.25'), // 25% for MEDIUM tier
  parseEther('0.24'), // 24% for HIGH tier
] as const;

// Price bounds
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO =
  1461446703485210103287273052203988822378723970342n;

// Basis points
export const BASIS_POINTS = 10000;

// V4 Hook Flags for Doppler
export const FLAG_MASK = BigInt(0x3fff);
export const DOPPLER_FLAGS = BigInt(
  (1 << 13) | // BEFORE_INITIALIZE_FLAG
    (1 << 12) | // AFTER_INITIALIZE_FLAG
    (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
    (1 << 7) | // BEFORE_SWAP_FLAG
    (1 << 6) | // AFTER_SWAP_FLAG
    (1 << 5), // BEFORE_DONATE_FLAG
);

// V4 Hook Flags for OpeningAuction
export const OPENING_AUCTION_FLAGS = BigInt(
  (1 << 13) | // BEFORE_INITIALIZE_FLAG
    (1 << 12) | // AFTER_INITIALIZE_FLAG
    (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
    (1 << 10) | // BEFORE_REMOVE_LIQUIDITY_FLAG
    (1 << 9) | // AFTER_ADD_LIQUIDITY_FLAG
    (1 << 8) | // AFTER_REMOVE_LIQUIDITY_FLAG
    (1 << 7) | // BEFORE_SWAP_FLAG
    (1 << 5), // BEFORE_DONATE_FLAG
);

// Opening Auction phase constants (matches on-chain AuctionPhase enum)
export const OPENING_AUCTION_PHASE_NOT_STARTED = 0;
export const OPENING_AUCTION_PHASE_ACTIVE = 1;
export const OPENING_AUCTION_PHASE_CLOSED = 2;
export const OPENING_AUCTION_PHASE_SETTLED = 3;

// Opening Auction status constants (matches on-chain OpeningAuctionStatus enum)
export const OPENING_AUCTION_STATUS_UNINITIALIZED = 0;
export const OPENING_AUCTION_STATUS_ACTIVE = 1;
export const OPENING_AUCTION_STATUS_DOPPLER_ACTIVE = 2;
export const OPENING_AUCTION_STATUS_EXITED = 3;

// Int24 bounds (Uniswap V4 tick type)
export const INT24_MIN = -8_388_608;
export const INT24_MAX = 8_388_607;

// V4 Dynamic Fee Flag
export const DYNAMIC_FEE_FLAG = 0x800000; // 8388608 in decimal
export const FEE_AMOUNT_MASK = 0xffffff; // Mask to extract actual fee from dynamic fee

/**
 * @deprecated Dynamic auctions (V4) support ANY fee 0-100,000 with explicit tickSpacing.
 * This constant is kept for backwards compatibility but is no longer enforced.
 * Standard fee tiers still auto-derive tickSpacing; custom fees require explicit tickSpacing.
 */
export const DYNAMIC_AUCTION_VALID_FEES = [100, 500, 3000, 10000] as const;
