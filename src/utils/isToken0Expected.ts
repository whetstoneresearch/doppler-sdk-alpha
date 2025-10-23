import { Address } from "viem"

/**
 * Determine token ordering based on numeraire address.
 * Mining will find a salt such that token address is correctly ordered relative to numeraire.
 * For numeraires > halfMaxUint160, token must be token0 (smaller address)
 * For all other cases, token should be token1 (larger address)
 * @param numeraire - Address of numeraire token
 * @returns Whether base token address is expected to be generated as token0
 */
export function isToken0Expected(numeraire: Address): boolean {
  const numeraireBigInt = BigInt(numeraire)
  const halfMaxUint160 = (2n ** 159n) - 1n

  if (numeraireBigInt === 0n) {
    return false  // ETH paired, token will be > 0x0
  } else if (numeraireBigInt > halfMaxUint160) {
    return true   // Large numeraire, token will be < numeraire
  } else {
    return false  // Normal case, token will be > numeraire
  }
}