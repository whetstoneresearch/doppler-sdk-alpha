/**
 * Example: Monitor Existing Auctions
 * 
 * This example demonstrates:
 * - Monitoring static and dynamic auctions
 * - Checking graduation status
 * - Tracking key metrics and progress
 */

import { DopplerSDK } from 'doppler-sdk'
import { createPublicClient, http, formatEther, type Address } from 'viem'
import { base } from 'viem/chains'

// Example addresses - replace with your actual auction addresses
const STATIC_POOL_ADDRESS = '0x1234567890123456789012345678901234567890' as Address
const DYNAMIC_HOOK_ADDRESS = '0x0987654321098765432109876543210987654321' as Address

const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org'

async function monitorStaticAuction(sdk: DopplerSDK, poolAddress: Address) {
  console.log('\n📊 Monitoring Static Auction...')
  console.log('Pool address:', poolAddress)
  
  try {
    const auction = await sdk.getStaticAuction(poolAddress)
    
    // Get pool information
    const poolInfo = await auction.getPoolInfo()
    console.log('\nPool Information:')
    console.log('- Token:', poolInfo.tokenAddress)
    console.log('- Numeraire:', poolInfo.numeraireAddress)
    console.log('- Fee tier:', poolInfo.fee / 10000, '%')
    console.log('- Liquidity:', formatEther(poolInfo.liquidity))
    console.log('- SqrtPriceX96:', poolInfo.sqrtPriceX96.toString())
    
    // Get current price
    const currentPrice = await auction.getCurrentPrice()
    console.log('\nCurrent tick price:', currentPrice.toString())
    
    // Check graduation status
    const hasGraduated = await auction.hasGraduated()
    console.log('\nGraduation status:', hasGraduated ? '✅ Graduated' : '⏳ Active')
    
    // Get token address for further info
    const tokenAddress = await auction.getTokenAddress()
    console.log('Token contract:', tokenAddress)
    
  } catch (error) {
    console.error('Error monitoring static auction:', error)
  }
}

async function monitorDynamicAuction(sdk: DopplerSDK, hookAddress: Address) {
  console.log('\n📊 Monitoring Dynamic Auction...')
  console.log('Hook address:', hookAddress)
  
  try {
    const auction = await sdk.getDynamicAuction(hookAddress)
    
    // Get comprehensive hook information
    const hookInfo = await auction.getHookInfo()
    console.log('\nHook Information:')
    console.log('- Token:', hookInfo.tokenAddress)
    console.log('- Numeraire:', hookInfo.numeraireAddress)
    console.log('- Pool ID:', hookInfo.poolId)
    console.log('- Current epoch:', hookInfo.currentEpoch)
    
    console.log('\nSale Progress:')
    console.log('- Total proceeds:', formatEther(hookInfo.totalProceeds), 'ETH')
    console.log('- Tokens sold:', formatEther(hookInfo.totalTokensSold))
    console.log('- Min proceeds:', formatEther(hookInfo.minimumProceeds), 'ETH')
    console.log('- Max proceeds:', formatEther(hookInfo.maximumProceeds), 'ETH')
    
    console.log('\nAuction Status:')
    console.log('- Early exit:', hookInfo.earlyExit ? '✅ Yes' : '❌ No')
    console.log('- Insufficient proceeds:', hookInfo.insufficientProceeds ? '⚠️ Yes' : '✅ No')
    
    // Calculate time remaining
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (now < hookInfo.endingTime) {
      const remaining = Number(hookInfo.endingTime - now)
      const hours = Math.floor(remaining / 3600)
      const minutes = Math.floor((remaining % 3600) / 60)
      console.log('- Time remaining:', `${hours}h ${minutes}m`)
    } else {
      console.log('- Time remaining: Auction ended')
    }
    
    // Get current price tick
    const currentTick = await auction.getCurrentPrice()
    console.log('\nCurrent tick:', currentTick.toString())
    
    // Check if ended early
    const hasEndedEarly = await auction.hasEndedEarly()
    if (hasEndedEarly) {
      console.log('\n🎯 Auction ended early due to reaching max proceeds')
    }
    
    // Check graduation
    const hasGraduated = await auction.hasGraduated()
    console.log('Graduation status:', hasGraduated ? '✅ Graduated' : '⏳ Active')
    
  } catch (error) {
    console.error('Error monitoring dynamic auction:', error)
  }
}

async function main() {
  // Initialize SDK in read-only mode
  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL)
  })

  const sdk = new DopplerSDK({
    publicClient,
    chainId: base.id
  })

  console.log('🔍 Doppler Auction Monitor')
  console.log('=======================')
  
  // Monitor static auction if address provided
  if (STATIC_POOL_ADDRESS !== '0x1234567890123456789012345678901234567890') {
    await monitorStaticAuction(sdk, STATIC_POOL_ADDRESS)
  } else {
    console.log('\n⚠️  No static auction address provided')
  }
  
  // Monitor dynamic auction if address provided
  if (DYNAMIC_HOOK_ADDRESS !== '0x0987654321098765432109876543210987654321') {
    await monitorDynamicAuction(sdk, DYNAMIC_HOOK_ADDRESS)
  } else {
    console.log('\n⚠️  No dynamic auction address provided')
  }
  
  console.log('\n✨ Monitoring complete!')
}

// Run the example
main().catch(console.error)