import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem'
import type { V4PoolKey } from '../types'

/**
 * Computes the PoolId (bytes32) from a V4 PoolKey
 *
 * In Uniswap V4, a PoolId is computed as keccak256(abi.encode(poolKey))
 * where poolKey contains: currency0, currency1, fee, tickSpacing, hooks
 *
 * @param poolKey - The V4 pool key containing currency0, currency1, fee, tickSpacing, and hooks
 * @returns The computed PoolId as a bytes32 hex string
 */
export function computePoolId(poolKey: V4PoolKey): Hex {
  // Encode the poolKey struct following Solidity's abi.encode rules
  // PoolKey struct has 5 fields, each taking 32 bytes (0xa0 = 160 bytes total)
  const encoded = encodeAbiParameters(
    [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ],
    [
      poolKey.currency0,
      poolKey.currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks,
    ]
  )

  // Return keccak256 hash of the encoded poolKey
  return keccak256(encoded)
}
