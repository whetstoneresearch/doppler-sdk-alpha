/**
 * Utility functions for the Doppler SDK
 */

// Re-export tick math utilities
export {
  MIN_TICK,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
  Q96,
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
  sqrtPriceX96ToPrice,
  priceToSqrtPriceX96,
  tickToPrice,
  priceToTick,
  getNearestUsableTick
} from './tickMath'

// Re-export price helper utilities
export {
  calculateTickRange,
  calculateTokensToSell,
  calculateGamma,
  estimatePriceAtEpoch,
  formatTickAsPrice,
  calculateMarketCap,
  calculateFDV,
  estimateSlippage
} from './priceHelpers'

// Re-export the existing address miner
export { getHookAddress } from './getHookAddress'