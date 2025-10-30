import { DAY_SECONDS } from "../constants"

/**
 * Compute optimal gamma parameter based on price range and time parameters
 * Gamma determines how much the price can move per epoch during the sale.
 */
export function computeOptimalGamma(
  startTick: number,
  endTick: number,
  duration: number,
  epochLength: number,
  tickSpacing: number,
): number {
  // Calculate total number of epochs
  const totalEpochs = duration / epochLength
  const tickDelta = Math.abs(endTick - startTick)
  // Base per-epoch movement in ticks
  let perEpochTicks = Math.ceil(tickDelta / totalEpochs)
  // Quantize up to the nearest multiple of tickSpacing
  const multiples = Math.ceil(perEpochTicks / tickSpacing)
  let gamma = multiples * tickSpacing
  // Ensure minimum of one tickSpacing
  gamma = Math.max(tickSpacing, gamma)
  if (gamma % tickSpacing !== 0) {
    throw new Error('Computed gamma must be divisible by tick spacing')
  }
  return gamma
}