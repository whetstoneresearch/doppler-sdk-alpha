/**
 * Decode a Uniswap V4 BalanceDelta (int256) value into separate int128 deltas.
 * The upper 128 bits represent amount0, the lower 128 bits represent amount1.
 */
export function decodeBalanceDelta(delta: bigint): { amount0: bigint; amount1: bigint } {
  const mask = (1n << 128n) - 1n
  const amount0 = BigInt.asIntN(128, delta >> 128n)
  const amount1 = BigInt.asIntN(128, delta & mask)
  return { amount0, amount1 }
}

