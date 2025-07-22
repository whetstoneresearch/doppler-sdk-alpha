/**
 * Price helper utilities for common token launch scenarios
 */

import { parseEther, formatEther } from 'viem'
import { priceToTick, tickToPrice, getNearestUsableTick } from './tickMath'

/**
 * Calculate the tick range for a desired price range
 * @param minPrice Minimum price (ETH per token)
 * @param maxPrice Maximum price (ETH per token)
 * @param tickSpacing The tick spacing of the pool
 * @param wethDecimals Decimals of WETH (usually 18)
 * @param tokenDecimals Decimals of the token (usually 18)
 * @returns Object with startTick and endTick
 */
export function calculateTickRange(
  minPrice: number,
  maxPrice: number,
  tickSpacing: number,
  wethDecimals = 18,
  tokenDecimals = 18
): { startTick: number; endTick: number } {
  // For token/WETH pools, we need to invert the price
  // because Uniswap orders tokens by address
  const startTick = getNearestUsableTick(
    priceToTick(1 / maxPrice, tokenDecimals, wethDecimals),
    tickSpacing
  )
  
  const endTick = getNearestUsableTick(
    priceToTick(1 / minPrice, tokenDecimals, wethDecimals),
    tickSpacing
  )
  
  return { startTick, endTick }
}

/**
 * Calculate the number of tokens to sell based on desired raise
 * @param targetRaiseETH Target amount to raise in ETH
 * @param avgPricePerToken Average expected price per token in ETH
 * @returns Number of tokens to sell (as bigint)
 */
export function calculateTokensToSell(
  targetRaiseETH: number,
  avgPricePerToken: number
): bigint {
  const tokensToSell = targetRaiseETH / avgPricePerToken
  return parseEther(tokensToSell.toFixed(18))
}

/**
 * Calculate gamma for dynamic auctions
 * @param startTick Starting tick
 * @param endTick Ending tick
 * @param durationDays Duration in days
 * @param epochLengthHours Epoch length in hours
 * @returns Gamma value
 */
export function calculateGamma(
  startTick: number,
  endTick: number,
  durationDays: number,
  epochLengthHours: number
): number {
  const totalEpochs = (durationDays * 24) / epochLengthHours
  const tickRange = Math.abs(endTick - startTick)
  return Math.floor(tickRange / totalEpochs)
}

/**
 * Estimate the price at a specific epoch in a dynamic auction
 * @param startTick Starting tick
 * @param gamma Tick movement per epoch
 * @param currentEpoch Current epoch number
 * @param tokenDecimals Token decimals
 * @param wethDecimals WETH decimals
 * @param isIncreasing Whether price increases (true) or decreases (false) over time
 * @returns Estimated price in ETH per token
 */
export function estimatePriceAtEpoch(
  startTick: number,
  gamma: number,
  currentEpoch: number,
  tokenDecimals = 18,
  wethDecimals = 18,
  isIncreasing = true
): number {
  const direction = isIncreasing ? 1 : -1
  const currentTick = startTick + (currentEpoch * gamma * direction)
  
  // Get price from tick (returns WETH/token)
  const wethPerToken = tickToPrice(currentTick, tokenDecimals, wethDecimals, false)
  
  // Invert to get ETH per token
  return 1 / wethPerToken
}

/**
 * Format a tick value to a human-readable price string
 * @param tick The tick value
 * @param tokenSymbol Symbol of the token
 * @param numeraireSymbol Symbol of the numeraire (e.g., "ETH")
 * @param tokenDecimals Token decimals
 * @param numeraireDecimals Numeraire decimals
 * @returns Formatted price string
 */
export function formatTickAsPrice(
  tick: number,
  tokenSymbol: string,
  numeraireSymbol: string,
  tokenDecimals = 18,
  numeraireDecimals = 18
): string {
  const price = tickToPrice(tick, tokenDecimals, numeraireDecimals, false)
  const ethPerToken = 1 / price
  
  if (ethPerToken < 0.0001) {
    return `${ethPerToken.toExponential(2)} ${numeraireSymbol} per ${tokenSymbol}`
  } else if (ethPerToken < 1) {
    return `${ethPerToken.toFixed(6)} ${numeraireSymbol} per ${tokenSymbol}`
  } else {
    return `${ethPerToken.toFixed(2)} ${numeraireSymbol} per ${tokenSymbol}`
  }
}

/**
 * Calculate the market cap at a given price
 * @param totalSupply Total token supply (as bigint)
 * @param pricePerToken Price per token in ETH
 * @param ethPrice Current ETH price in USD (optional)
 * @returns Market cap object with ETH and USD values
 */
export function calculateMarketCap(
  totalSupply: bigint,
  pricePerToken: number,
  ethPrice?: number
): { eth: string; usd?: string } {
  const totalSupplyNumber = Number(formatEther(totalSupply))
  const marketCapETH = totalSupplyNumber * pricePerToken
  
  const result: { eth: string; usd?: string } = {
    eth: `${marketCapETH.toFixed(2)} ETH`
  }
  
  if (ethPrice) {
    const marketCapUSD = marketCapETH * ethPrice
    result.usd = `$${marketCapUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  
  return result
}

/**
 * Calculate fully diluted valuation (FDV)
 * @param totalSupply Total token supply including vested tokens (as bigint)
 * @param pricePerToken Price per token in ETH
 * @param ethPrice Current ETH price in USD (optional)
 * @returns FDV object with ETH and USD values
 */
export function calculateFDV(
  totalSupply: bigint,
  pricePerToken: number,
  ethPrice?: number
): { eth: string; usd?: string } {
  // FDV is the same calculation as market cap but includes all tokens
  return calculateMarketCap(totalSupply, pricePerToken, ethPrice)
}

/**
 * Estimate slippage for a trade in a concentrated liquidity pool
 * @param amountIn Amount to trade
 * @param liquidity Current liquidity
 * @param currentTick Current tick
 * @param fee Pool fee (e.g., 3000 for 0.3%)
 * @returns Estimated slippage percentage
 */
export function estimateSlippage(
  amountIn: bigint,
  liquidity: bigint,
  currentTick: number,
  fee: number
): number {
  // Simplified slippage estimation
  // In practice, you'd need to simulate the swap through tick ranges
  const feeMultiplier = 1 - (fee / 1000000)
  const liquidityNumber = Number(liquidity) / 1e18
  const amountNumber = Number(amountIn) / 1e18
  
  // Basic approximation: slippage increases with trade size relative to liquidity
  const impactRatio = amountNumber / liquidityNumber
  const slippage = impactRatio * 100 * feeMultiplier
  
  return Math.min(slippage, 100) // Cap at 100%
}