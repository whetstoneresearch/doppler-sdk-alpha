/**
 * Tick math utilities for Uniswap V3/V4 price calculations
 * 
 * These utilities help convert between ticks, sqrtPriceX96 values, and human-readable prices
 */

// Constants
export const MIN_TICK = -887272
export const MAX_TICK = 887272
export const MIN_SQRT_RATIO = 4295128739n
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n
export const Q96 = 2n ** 96n

/**
 * Get the sqrt ratio at a given tick
 * @param tick The tick value
 * @returns The sqrt price as a Q64.96 fixed point number
 */
export function getSqrtRatioAtTick(tick: number): bigint {
  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new Error('Tick out of bounds')
  }

  const absTick = tick < 0 ? -tick : tick

  let ratio = (absTick & 0x1) !== 0
    ? 0xfffcb933bd6fad37aa2d162d1a594001n
    : 0x100000000000000000000000000000000n

  if ((absTick & 0x2) !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n
  if ((absTick & 0x4) !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n
  if ((absTick & 0x8) !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n
  if ((absTick & 0x10) !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n
  if ((absTick & 0x20) !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n
  if ((absTick & 0x40) !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n
  if ((absTick & 0x80) !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n
  if ((absTick & 0x100) !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n
  if ((absTick & 0x200) !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n
  if ((absTick & 0x400) !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n
  if ((absTick & 0x800) !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n
  if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n
  if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n
  if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n
  if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n
  if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n
  if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n
  if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n
  if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n

  if (tick > 0) ratio = (2n ** 256n - 1n) / ratio

  // Shift to get Q64.96
  return ratio >> 32n
}

/**
 * Get the tick at a given sqrt ratio
 * @param sqrtRatioX96 The sqrt price as a Q64.96 fixed point number
 * @returns The tick value
 */
export function getTickAtSqrtRatio(sqrtRatioX96: bigint): number {
  if (sqrtRatioX96 < MIN_SQRT_RATIO || sqrtRatioX96 >= MAX_SQRT_RATIO) {
    throw new Error('sqrt ratio out of bounds')
  }

  const ratio = sqrtRatioX96 << 32n

  let r = ratio
  let msb = 0n

  let f = r > 0xffffffffffffffffffffffffffffffffn ? 1n : 0n
  msb = msb | (f << 7n)
  r = r >> (f * 128n)

  f = r > 0xffffffffffffffffn ? 1n : 0n
  msb = msb | (f << 6n)
  r = r >> (f * 64n)

  f = r > 0xffffffffn ? 1n : 0n
  msb = msb | (f << 5n)
  r = r >> (f * 32n)

  f = r > 0xffffn ? 1n : 0n
  msb = msb | (f << 4n)
  r = r >> (f * 16n)

  f = r > 0xffn ? 1n : 0n
  msb = msb | (f << 3n)
  r = r >> (f * 8n)

  f = r > 0xfn ? 1n : 0n
  msb = msb | (f << 2n)
  r = r >> (f * 4n)

  f = r > 0x3n ? 1n : 0n
  msb = msb | (f << 1n)
  r = r >> (f * 2n)

  f = r > 0x1n ? 1n : 0n
  msb = msb | f

  let log2 = (msb - 128n) << 64n
  
  r = ratio >> msb
  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 63n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 62n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 61n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 60n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 59n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 58n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 57n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 56n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 55n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 54n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 53n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 52n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 51n)
  r = r >> f

  r = (r * r) >> 127n
  f = r >> 128n
  log2 = log2 | (f << 50n)

  const log_sqrt10001 = log2 * 255738958999603826347141n

  const tickLow = Number((log_sqrt10001 - 3402992956809132418596140100660247210n) >> 128n)
  const tickHigh = Number((log_sqrt10001 + 291339464771989622907027621153398088495n) >> 128n)

  return tickLow === tickHigh ? tickLow : getSqrtRatioAtTick(tickHigh) <= sqrtRatioX96 ? tickHigh : tickLow
}

/**
 * Convert sqrtPriceX96 to a human-readable price
 * @param sqrtPriceX96 The sqrt price as a Q64.96 fixed point number
 * @param decimals0 Decimals of token0
 * @param decimals1 Decimals of token1
 * @param token0IsBase Whether to return price in terms of token0 (true) or token1 (false)
 * @returns The price as a number
 */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
  token0IsBase = true
): number {
  const price = Number(sqrtPriceX96) / Number(Q96)
  const priceSquared = price * price
  
  // Adjust for decimals
  const decimalAdjustment = 10 ** (decimals1 - decimals0)
  const adjustedPrice = priceSquared * decimalAdjustment
  
  return token0IsBase ? adjustedPrice : 1 / adjustedPrice
}

/**
 * Convert a human-readable price to sqrtPriceX96
 * @param price The price (token1/token0)
 * @param decimals0 Decimals of token0
 * @param decimals1 Decimals of token1
 * @returns The sqrt price as a Q64.96 fixed point number
 */
export function priceToSqrtPriceX96(
  price: number,
  decimals0: number,
  decimals1: number
): bigint {
  // Adjust for decimals
  const decimalAdjustment = 10 ** (decimals1 - decimals0)
  const adjustedPrice = price / decimalAdjustment
  
  // Calculate sqrt and convert to X96
  const sqrtPrice = Math.sqrt(adjustedPrice)
  return BigInt(Math.floor(sqrtPrice * Number(Q96)))
}

/**
 * Convert a tick to a human-readable price
 * @param tick The tick value
 * @param decimals0 Decimals of token0
 * @param decimals1 Decimals of token1
 * @param token0IsBase Whether to return price in terms of token0 (true) or token1 (false)
 * @returns The price as a number
 */
export function tickToPrice(
  tick: number,
  decimals0: number,
  decimals1: number,
  token0IsBase = true
): number {
  const sqrtPriceX96 = getSqrtRatioAtTick(tick)
  return sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1, token0IsBase)
}

/**
 * Convert a human-readable price to a tick
 * @param price The price (token1/token0)
 * @param decimals0 Decimals of token0
 * @param decimals1 Decimals of token1
 * @returns The tick value
 */
export function priceToTick(
  price: number,
  decimals0: number,
  decimals1: number
): number {
  const sqrtPriceX96 = priceToSqrtPriceX96(price, decimals0, decimals1)
  return getTickAtSqrtRatio(sqrtPriceX96)
}

/**
 * Get the nearest usable tick for a given tick spacing
 * @param tick The desired tick
 * @param tickSpacing The tick spacing of the pool
 * @returns The nearest valid tick
 */
export function getNearestUsableTick(
  tick: number,
  tickSpacing: number
): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing
  if (rounded < MIN_TICK) return MIN_TICK
  if (rounded > MAX_TICK) return MAX_TICK
  return rounded
}