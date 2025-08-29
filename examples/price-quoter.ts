/**
 * Example: Price Quoter
 * 
 * This example demonstrates:
 * - Getting price quotes across Uniswap V2, V3, and V4
 * - Comparing quotes to find best prices
 * - Handling different swap types (exact input/output)
 */

// UNCOMMENT IF RUNNING LOCALLY
// import { DopplerSDK } from '@whetstone-research/doppler-sdk';
import { DopplerSDK } from '../src';

import { createPublicClient, http, parseEther, formatEther, type Address } from 'viem'
import { base } from 'viem/chains'

const token = process.env.TOKEN as `0x${string}`;
const rpcUrl = process.env.RPC_URL || 'https://mainnet.base.org' as string;

if (!token) throw new Error('TOKEN is not set');

// Example token addresses (replace with actual addresses)
const weth = '0x4200000000000000000000000000000000000006' as Address // WETH on Base
const usdc = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address // USDC on Base

async function main() {
  // Initialize SDK
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl)
  })

  const sdk = new DopplerSDK({
    publicClient,
    chainId: base.id
  })

  const quoter = sdk.quoter

  console.log('💱 Price Quoter Example')
  console.log('=====================')

  // Example 1: Quote exact input on V3
  console.log('\n📊 Example 1: Swap 1 ETH for USDC on V3')
  try {
    const v3Quote = await quoter.quoteExactInputV3({
      tokenIn: weth,
      tokenOut: usdc,
      amountIn: parseEther('1'),
      fee: 3000 // 0.3% fee tier
    })
    
    console.log('- Amount out:', formatEther(v3Quote.amountOut), 'USDC')
    console.log('- Price impact (ticks crossed):', v3Quote.initializedTicksCrossed)
    console.log('- Gas estimate:', v3Quote.gasEstimate.toString())
    console.log('- Final sqrtPriceX96:', v3Quote.sqrtPriceX96After.toString())
  } catch (error) {
    console.error('V3 quote failed:', error.message)
  }

  // Example 2: Quote exact output on V3
  console.log('\n📊 Example 2: Get exactly 2000 USDC, pay in ETH on V3')
  try {
    const v3QuoteOut = await quoter.quoteExactOutputV3({
      tokenIn: weth,
      tokenOut: usdc,
      amountOut: parseEther('2000'), // Want exactly 2000 USDC
      fee: 3000
    })
    
    console.log('- Amount in required:', formatEther(v3QuoteOut.amountIn), 'ETH')
    console.log('- Price impact (ticks crossed):', v3QuoteOut.initializedTicksCrossed)
    console.log('- Gas estimate:', v3QuoteOut.gasEstimate.toString())
  } catch (error) {
    console.error('V3 exact output quote failed:', error.message)
  }

  // Example 3: Quote on V2 (if available)
  console.log('\n📊 Example 3: Swap 1 ETH for USDC on V2')
  try {
    const v2Quote = await quoter.quoteExactInputV2({
      amountIn: parseEther('1'),
      path: [weth, usdc]
    })
    
    console.log('- Amount out:', formatEther(v2Quote[1]), 'USDC')
    console.log('- Simple constant product AMM pricing')
  } catch (error) {
    console.error('V2 quote failed:', error.message)
  }

  // Example 4: Multi-hop V2 quote
  console.log('\n📊 Example 4: Multi-hop swap ETH -> USDC -> TOKEN on V2')
  try {
    const multiHopQuote = await quoter.quoteExactInputV2({
      amountIn: parseEther('1'),
      path: [weth, usdc, token] // ETH -> USDC -> TOKEN
    })
    
    console.log('Hop results:')
    console.log('- Start:', formatEther(multiHopQuote[0]), 'ETH')
    console.log('- After hop 1:', formatEther(multiHopQuote[1]), 'USDC')
    console.log('- Final:', formatEther(multiHopQuote[2]), 'TOKEN')
  } catch (error) {
    console.error('Multi-hop quote failed:', error.message)
  }

  // Example 5: V4 quote (for graduated dynamic auctions)
  console.log('\n📊 Example 5: Swap on V4 pool')
  try {
    const v4PoolKey = {
      currency0: weth,
      currency1: token,
      fee: 3000,
      tickSpacing: 60,
      hooks: '0x0000000000000000000000000000000000000000' as Address // No hook for graduated pool
    }
    
    const v4Quote = await quoter.quoteExactInputV4({
      poolKey: v4PoolKey,
      zeroForOne: true, // Swapping currency0 (WETH) for currency1 (TOKEN)
      exactAmount: parseEther('1')
    })
    
    console.log('- Amount out:', formatEther(v4Quote.amountOut), 'TOKEN')
    console.log('- Gas estimate:', v4Quote.gasEstimate.toString())
  } catch (error) {
    console.error('V4 quote failed:', error.message)
  }

  // Example 6: Compare quotes across versions
  console.log('\n🔄 Comparing quotes for 1 ETH -> USDC:')
  const results: { version: string; amountOut: bigint; gas: bigint }[] = []
  
  // Try V2
  try {
    const v2 = await quoter.quoteExactInputV2({
      amountIn: parseEther('1'),
      path: [weth, usdc]
    })
    results.push({ 
      version: 'V2', 
      amountOut: v2[1], 
      gas: BigInt(100000) // Approximate
    })
  } catch {}
  
  // Try V3
  try {
    const v3 = await quoter.quoteExactInputV3({
      tokenIn: weth,
      tokenOut: usdc,
      amountIn: parseEther('1'),
      fee: 3000
    })
    results.push({ 
      version: 'V3', 
      amountOut: v3.amountOut, 
      gas: v3.gasEstimate 
    })
  } catch {}
  
  // Sort by best output
  results.sort((a, b) => Number(b.amountOut - a.amountOut))
  
  console.log('\nBest quotes (sorted by output):')
  results.forEach((result, i) => {
    console.log(`${i + 1}. ${result.version}: ${formatEther(result.amountOut)} USDC (gas: ${result.gas})`)
  })
  
  if (results.length > 0) {
    console.log(`\n✅ Best option: ${results[0].version} with ${formatEther(results[0].amountOut)} USDC`)
  }

  console.log('\n✨ Example completed!')
}

main()
