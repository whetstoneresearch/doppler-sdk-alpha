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
  getNearestUsableTick,
} from './tickMath';

// Re-export price helper utilities
export {
  calculateTickRange,
  calculateTokensToSell,
  calculateGamma,
  estimatePriceAtEpoch,
  formatTickAsPrice,
  calculateMarketCap,
  calculateFDV,
  estimateSlippage,
} from './priceHelpers';

// Re-export token address mining utilities
export { mineTokenAddress } from './tokenAddressMiner';
export type {
  TokenAddressHookConfig,
  TokenAddressMiningParams,
  TokenAddressMiningResult,
  TokenVariant,
} from './tokenAddressMiner';

export {
  getAirlockOwner,
  getAirlockBeneficiary,
  createAirlockBeneficiary,
  DEFAULT_AIRLOCK_BENEFICIARY_SHARES,
} from './airlock';

export { decodeBalanceDelta } from './balanceDelta';

export { computePoolId, normalizePoolKey } from './poolKey';

export {
  getAmount0ForLiquidity,
  getAmount1ForLiquidity,
  getLiquidityForAmount0,
  getLiquidityForAmount1,
} from './liquidityMath';
export { getMaxLiquiditySafeMulticurveTickUpper } from './multicurveLiquidity';
export type { MulticurveMaxTickLiquidityParams } from './multicurveLiquidity';

export { computeOptimalGamma } from './computeOptimalGamma';

export { resolveGasEstimate } from './gasEstimate';

export { isToken0Expected } from './isToken0Expected';

export { normalizeBeneficiaries, sortBeneficiaries } from './beneficiaries';

export {
  normalizeRehypeDopplerHookInitializerConfig,
  type NormalizedRehypeDopplerHookInitializerConfig,
} from './rehypeDopplerHookInitializer';
export { encodeRehypeDopplerHookInitializerData } from './rehypeDopplerHookInitializerEncoding';

export {
  AirlockCreateReceiptError,
  parseAirlockCreateReceipt,
  verifyPreparedCreateReceipt,
  verifyPreparedCreateExecution,
} from './airlockCreateReceipt';
export type {
  AirlockCreateReceiptErrorCode,
  AirlockCreateResult,
  ParseAirlockCreateReceiptParams,
  PreparedCreateTransactionClient,
  PreparedMulticurveIdentity,
  VerifiedMulticurveCreate,
} from './airlockCreateReceipt';

// Re-export market cap conversion utilities
export {
  // Core conversion functions (pure math)
  marketCapToTokenPrice,
  tokenPriceToRatio,
  ratioToTick,
  isToken1,
  // Auction-specific tick functions
  marketCapToTicksForStaticAuction,
  marketCapToTicksForDynamicAuction,
  marketCapToTicksForMulticurve,
  marketCapToTickForMulticurve,
  // Utility functions
  applyTickOffsets,
  validateMarketCapParameters,
  tickToMarketCap,
  getMaxTickRounded,
} from './marketCapHelpers';
export type {
  MarketCapRange,
  MarketCapValidationResult,
} from './marketCapHelpers';
