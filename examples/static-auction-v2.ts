/**
 * Example: Create a Static Auction with Uniswap V2 Migration
 * 
 * This example demonstrates:
 * - Creating a token with fixed price range on Uniswap V3
 * - Migrating liquidity to Uniswap V2 after graduation
 * - Monitoring auction progress
 */

import { DopplerSDK } from 'doppler-sdk'
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import type { CreateStaticAuctionParams } from 'doppler-sdk'

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org'

async function main() {
  // 1. Set up clients
  const account = privateKeyToAccount(PRIVATE_KEY)
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL)
  })

  const walletClient = createWalletClient({
    chain: base,
    transport: http(RPC_URL),
    account
  })

  // 2. Initialize SDK
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: base.id
  })

  // 3. Define auction parameters
  const params: CreateStaticAuctionParams = {
    token: {
      name: 'Example Token',
      symbol: 'EXAMPLE',
      tokenURI: 'https://example.com/token-metadata.json'
    },
    sale: {
      initialSupply: parseEther('1000000'), // 1M tokens
      numTokensToSell: parseEther('500000'), // Sell 500k tokens
      numeraire: '0x4200000000000000000000000000000000000006' // WETH on Base
    },
    pool: {
      // Price range: 0.0001 ETH to 0.001 ETH per token
      startTick: 175000, // ~0.0001 ETH per token
      endTick: 225000,   // ~0.001 ETH per token
      fee: 3000          // 0.3% fee tier
    },
    migration: {
      type: 'uniswapV2' // Simple V2 migration after 7 days
    },
    userAddress: account.address
  }

  console.log('Creating static auction...')
  console.log('Token:', params.token.name, `(${params.token.symbol})`)
  console.log('Selling:', formatEther(params.sale.numTokensToSell), 'tokens')
  console.log('Price range: 0.0001 - 0.001 ETH per token')

  try {
    // 4. Create the auction
    const result = await sdk.factory.createStaticAuction(params)
    
    console.log('\n✅ Auction created successfully!')
    console.log('Pool address:', result.poolAddress)
    console.log('Token address:', result.tokenAddress)
    console.log('Transaction:', result.transactionHash)

    // 5. Get the auction instance
    const auction = await sdk.getStaticAuction(result.poolAddress)
    
    // 6. Monitor the auction
    console.log('\nMonitoring auction...')
    
    const poolInfo = await auction.getPoolInfo()
    console.log('Current liquidity:', formatEther(poolInfo.liquidity))
    console.log('Current sqrtPriceX96:', poolInfo.sqrtPriceX96.toString())
    
    // 7. Check graduation status
    const hasGraduated = await auction.hasGraduated()
    console.log('Has graduated:', hasGraduated)
    
    if (!hasGraduated) {
      console.log('\nAuction is still active. It will graduate after:')
      console.log('- 7 days have passed since creation')
      console.log('- Minimum proceeds are collected')
      console.log('\nLiquidity will then migrate to Uniswap V2')
    }

    // 8. Get current price
    const currentPrice = await auction.getCurrentPrice()
    console.log('\nCurrent price (in tick form):', currentPrice.toString())
    
    // 9. Calculate actual price from tick
    // This is simplified - in production use proper tick math
    const actualPrice = Number(currentPrice) / 1e18
    console.log('Approximate price:', actualPrice, 'ETH per token')

  } catch (error) {
    console.error('\n❌ Error creating auction:', error)
    process.exit(1)
  }

  console.log('\n✨ Example completed!')
}

// Run the example
main().catch(console.error)