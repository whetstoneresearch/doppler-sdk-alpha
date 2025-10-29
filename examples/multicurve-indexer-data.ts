/**
 * Example: Processing Multicurve Indexer Data
 *
 * This example demonstrates:
 * - Querying pool data from the Doppler indexer
 * - Processing and displaying pool metrics (liquidity, volume, fees)
 * - Parsing PoolKey and pool state from indexer response
 * - Using indexer data to interact with pools via the SDK
 *
 * Prerequisites:
 * - Install graphql-request: npm install graphql-request
 */

import { DopplerSDK, getAddresses } from '../src'
import { GraphQLClient } from 'graphql-request'
import { createPublicClient, http, formatEther, formatUnits, type Address } from 'viem'
import { base } from 'viem/chains'

const rpcUrl = (process.env.RPC_URL || 'https://mainnet.base.org') as string
const indexerUrl = process.env.INDEXER_URL || 'https://testnet-indexer.doppler.lol/'

// GraphQL query for fetching pool data
const GET_POOL_QUERY = `
  query GetPool($address: String!, $chainId: Float!) {
    pools(
      where: { address: $address }
      limit: 1
    ) {
      items {
        address
        chainId
        tick
        sqrtPrice
        liquidity
        createdAt
        baseToken { address name symbol }
        quoteToken { address name symbol }
        price
        fee
        type
        dollarLiquidity
        volumeUsd
        percentDayChange
        totalFee0
        totalFee1
        isToken0
        lastRefreshed
        lastSwapTimestamp
        poolKey
        reserves0
        reserves1
        asset {
          marketCapUsd
          migrated
          migratedAt
          v2Pool
        }
      }
    }
  }
`

// GraphQL query for listing recent pools
const GET_RECENT_POOLS_QUERY = `
  query GetRecentPools($types: [String!]) {
    pools(
      orderBy: "createdAt"
      orderDirection: "desc"
      limit: 10
      where: {
        type_in: $types
      }
    ) {
      items {
        address
        chainId
        baseToken { address name symbol }
        quoteToken { address name symbol }
        type
        dollarLiquidity
        volumeUsd
        createdAt
        poolKey
      }
    }
  }
`

interface PoolKey {
  currency0: string
  currency1: string
  fee: number
  tickSpacing: number
  hooks: string
}

interface Pool {
  address: string
  chainId: number
  tick: number
  sqrtPrice: string
  liquidity: string
  createdAt: string
  baseToken: { address: string; name: string; symbol: string }
  quoteToken: { address: string; name: string; symbol: string }
  price: string
  fee: number
  type: string
  dollarLiquidity: string
  volumeUsd: string
  percentDayChange: number
  totalFee0: string
  totalFee1: string
  isToken0: boolean
  lastRefreshed: string | null
  lastSwapTimestamp: string | null
  poolKey?: PoolKey
  reserves0: string
  reserves1: string
  asset?: {
    marketCapUsd: string
    migrated: boolean
    migratedAt: string | null
    v2Pool: string | null
  }
}

async function main() {
  // 1. Set up clients
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const sdk = new DopplerSDK({ publicClient, chainId: base.id })
  const addresses = getAddresses(base.id)
  const graphqlClient = new GraphQLClient(indexerUrl)

  console.log('📊 Multicurve Indexer Data Processing Example')
  console.log('Indexer URL:', indexerUrl)
  console.log('Chain ID:', base.id)
  console.log()

  // 2. Fetch recent multicurve pools
  console.log('🔍 Fetching recent multicurve pools...')
  const recentPoolsResponse = await graphqlClient.request<{
    pools: { items: Pool[] }
  }>(GET_RECENT_POOLS_QUERY, {
    types: ['v4'], // V4 pools include multicurve auctions
  })

  const recentPools = recentPoolsResponse.pools.items
  console.log(`  Found ${recentPools.length} recent pools`)
  console.log()

  if (recentPools.length === 0) {
    console.log('⚠️  No pools found. Try creating one first with multicurve-initializer.ts')
    return
  }

  // 3. Display recent pools
  console.log('📋 Recent Multicurve Pools:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  recentPools.forEach((pool, i) => {
    console.log(`${i + 1}. ${pool.baseToken.symbol}/${pool.quoteToken.symbol}`)
    console.log(`   Address: ${pool.address}`)
    console.log(`   Type: ${pool.type}`)
    console.log(`   Liquidity: $${formatUnits(BigInt(pool.dollarLiquidity), 18)}`)
    console.log(`   Volume: $${formatUnits(BigInt(pool.volumeUsd), 18)}`)
    console.log()
  })

  // 4. Query detailed data for the first pool
  const targetPool = recentPools[0]
  console.log('🔎 Fetching detailed data for:', targetPool.address)
  console.log()

  const poolResponse = await graphqlClient.request<{
    pools: { items: Pool[] }
  }>(GET_POOL_QUERY, {
    address: targetPool.address,
    chainId: base.id,
  })

  const poolData = poolResponse.pools.items[0]
  if (!poolData) {
    console.log('❌ Pool not found')
    return
  }

  // 5. Process and display pool metrics
  console.log('📈 Pool Metrics:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Pool Address:', poolData.address)
  console.log('Type:', poolData.type)
  console.log()

  console.log('Tokens:')
  console.log('  Base:', `${poolData.baseToken.symbol} (${poolData.baseToken.address})`)
  console.log('  Quote:', `${poolData.quoteToken.symbol} (${poolData.quoteToken.address})`)
  console.log()

  console.log('Pool State:')
  console.log('  Current Tick:', poolData.tick)
  console.log('  Sqrt Price:', poolData.sqrtPrice)
  console.log('  Liquidity:', formatEther(BigInt(poolData.liquidity)))
  console.log('  Fee Tier:', poolData.fee / 10000, '%')
  console.log()

  console.log('Reserves:')
  console.log('  Reserve0:', formatEther(BigInt(poolData.reserves0)))
  console.log('  Reserve1:', formatEther(BigInt(poolData.reserves1)))
  console.log()

  console.log('Trading Activity:')
  console.log('  Dollar Liquidity:', '$' + formatUnits(BigInt(poolData.dollarLiquidity), 18))
  console.log('  Volume (USD):', '$' + formatUnits(BigInt(poolData.volumeUsd), 18))
  console.log('  24h Change:', poolData.percentDayChange.toFixed(2), '%')
  console.log()

  console.log('Fees Collected:')
  console.log('  Total Fee0:', formatEther(BigInt(poolData.totalFee0)))
  console.log('  Total Fee1:', formatEther(BigInt(poolData.totalFee1)))
  console.log()

  console.log('Timestamps:')
  console.log('  Created:', new Date(Number(poolData.createdAt) * 1000).toISOString())
  if (poolData.lastSwapTimestamp) {
    console.log('  Last Swap:', new Date(Number(poolData.lastSwapTimestamp) * 1000).toISOString())
  }
  if (poolData.lastRefreshed) {
    console.log('  Last Refreshed:', new Date(Number(poolData.lastRefreshed) * 1000).toISOString())
  }
  console.log()

  // 6. Process PoolKey if available
  if (poolData.poolKey) {
    console.log('🔑 PoolKey:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  Currency0:', poolData.poolKey.currency0)
    console.log('  Currency1:', poolData.poolKey.currency1)
    console.log('  Fee:', poolData.poolKey.fee)
    console.log('  Tick Spacing:', poolData.poolKey.tickSpacing)
    console.log('  Hooks:', poolData.poolKey.hooks)
    console.log()
  }

  // 7. Check migration status
  if (poolData.asset) {
    console.log('🚀 Migration Status:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  Market Cap:', '$' + formatUnits(BigInt(poolData.asset.marketCapUsd), 18))
    console.log('  Migrated:', poolData.asset.migrated ? '✅ Yes' : '❌ No')
    if (poolData.asset.migrated && poolData.asset.migratedAt) {
      console.log('  Migrated At:', new Date(Number(poolData.asset.migratedAt) * 1000).toISOString())
    }
    if (poolData.asset.v2Pool) {
      console.log('  V2 Pool:', poolData.asset.v2Pool)
    }
    console.log()
  }

  // 8. Interact with the pool using the SDK
  console.log('🔧 Interacting with pool via SDK...')

  // For multicurve pools, we need the asset (token) address
  const assetAddress = poolData.baseToken.address as Address

  try {
    const multicurvePool = await sdk.getMulticurvePool(assetAddress)
    const poolState = await multicurvePool.getState()

    console.log('  ✅ Successfully loaded pool via SDK')
    console.log('  Asset:', poolState.asset)
    console.log('  Numeraire:', poolState.numeraire)
    console.log('  Status:', ['Uninitialized', 'Initialized', 'Locked', 'Exited'][poolState.status])
    console.log()
  } catch (error) {
    console.log('  ⚠️  Could not load as multicurve pool:', error instanceof Error ? error.message : 'Unknown error')
    console.log()
  }

  // 9. Example: Using poolKey for quoting (if available)
  if (poolData.poolKey) {
    console.log('💱 Example Quote Using Indexer Data:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const poolKey = {
      currency0: poolData.poolKey.currency0 as Address,
      currency1: poolData.poolKey.currency1 as Address,
      fee: poolData.poolKey.fee,
      tickSpacing: poolData.poolKey.tickSpacing,
      hooks: poolData.poolKey.hooks as Address,
    }

    const zeroForOne = poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase()
    const amountIn = parseEther('0.01')

    console.log('  Quoting swap of', formatEther(amountIn), 'ETH...')

    try {
      const quote = await sdk.quoter.quoteExactInputV4({
        poolKey,
        zeroForOne,
        exactAmount: amountIn,
        hookData: '0x' as `0x${string}`,
      })

      console.log('  ✅ Quote successful!')
      console.log('  Amount out:', formatEther(quote.amountOut), 'tokens')
      console.log('  Gas estimate:', quote.gasEstimate.toString())
    } catch (error) {
      console.log('  ⚠️  Quote failed:', error instanceof Error ? error.message : 'Unknown error')
    }
    console.log()
  }

  console.log('✅ Example complete!')
  console.log()
  console.log('💡 Key Takeaways:')
  console.log('  1. Indexer provides rich pool data including metrics, fees, and reserves')
  console.log('  2. PoolKey from indexer can be used directly for SDK quoting')
  console.log('  3. Combine indexer data with SDK for complete pool interaction')
  console.log('  4. Monitor migration status and pool health via indexer')
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
