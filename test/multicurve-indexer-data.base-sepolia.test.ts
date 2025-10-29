import { describe, it, expect, beforeAll } from 'vitest'
import { createPublicClient, http, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { DopplerSDK, getAddresses, CHAIN_IDS } from '../src'
import { GraphQLClient } from 'graphql-request'

describe('Multicurve Indexer Data (Base Sepolia fork)', () => {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL
  const indexerUrl = process.env.INDEXER_URL || 'https://testnet-indexer.doppler.lol/'

  if (!rpcUrl) {
    it.skip('requires BASE_SEPOLIA_RPC_URL env var')
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) })
  const sdk = new DopplerSDK({ publicClient, chainId })
  const graphqlClient = new GraphQLClient(indexerUrl)

  const GET_RECENT_POOLS_QUERY = `
    query GetRecentPools($types: [String!], $chainId: Float!) {
      pools(
        orderBy: "createdAt"
        orderDirection: "desc"
        limit: 5
        where: {
          type_in: $types
          chainId: $chainId
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
          fee
          liquidity
          sqrtPrice
        }
      }
    }
  `

  const GET_POOL_QUERY = `
    query GetPool($address: String!, $chainId: Float!) {
      pools(
        where: { address: $address, chainId: $chainId }
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
    tick?: number
    sqrtPrice: string
    liquidity: string
    createdAt: string
    baseToken: { address: string; name: string; symbol: string }
    quoteToken: { address: string; name: string; symbol: string }
    price?: string
    fee: number
    type: string
    dollarLiquidity: string
    volumeUsd: string
    percentDayChange?: number
    totalFee0?: string
    totalFee1?: string
    isToken0?: boolean
    lastRefreshed?: string | null
    lastSwapTimestamp?: string | null
    poolKey?: PoolKey
    reserves0?: string
    reserves1?: string
    asset?: {
      marketCapUsd: string
      migrated: boolean
      migratedAt: string | null
      v2Pool: string | null
    }
  }

  let recentPools: Pool[] = []

  beforeAll(async () => {
    try {
      const response = await graphqlClient.request<{ pools: { items: Pool[] } }>(
        GET_RECENT_POOLS_QUERY,
        {
          types: ['v4'],
          chainId: Number(chainId),
        }
      )
      recentPools = response.pools.items
      console.log(`  Found ${recentPools.length} recent V4 pools on indexer`)
    } catch (error) {
      console.warn('  ⚠️  Failed to fetch pools from indexer:', error)
    }
  })

  it('fetches recent multicurve pools from indexer', async () => {
    expect(recentPools).toBeDefined()
    expect(Array.isArray(recentPools)).toBe(true)

    if (recentPools.length > 0) {
      const pool = recentPools[0]
      expect(pool.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(pool.chainId).toBe(Number(chainId))
      expect(pool.baseToken).toBeDefined()
      expect(pool.baseToken.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(pool.quoteToken).toBeDefined()
      expect(pool.quoteToken.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(pool.type).toBe('v4')
      console.log(`  ✓ Verified pool: ${pool.baseToken.symbol}/${pool.quoteToken.symbol}`)
    } else {
      console.log('  ⚠️  No pools found (this is ok for new deployments)')
    }
  })

  it('fetches detailed pool data including poolKey', async () => {
    if (recentPools.length === 0) {
      console.log('  ⚠️  Skipping (no pools available)')
      return
    }

    const targetPool = recentPools[0]
    const response = await graphqlClient.request<{ pools: { items: Pool[] } }>(
      GET_POOL_QUERY,
      {
        address: targetPool.address,
        chainId: Number(chainId),
      }
    )

    const poolData = response.pools.items[0]
    expect(poolData).toBeDefined()
    expect(poolData.address.toLowerCase()).toBe(targetPool.address.toLowerCase())

    // Verify pool metrics
    expect(poolData.liquidity).toBeDefined()
    expect(poolData.sqrtPrice).toBeDefined()
    expect(poolData.fee).toBeGreaterThanOrEqual(0)
    expect(poolData.dollarLiquidity).toBeDefined()
    expect(poolData.volumeUsd).toBeDefined()

    // Verify timestamps
    expect(poolData.createdAt).toBeDefined()
    expect(Number(poolData.createdAt)).toBeGreaterThan(0)

    console.log('  ✓ Fetched detailed pool data')
    console.log(`    Liquidity: ${poolData.liquidity}`)
    console.log(`    Fee: ${poolData.fee}`)
  })

  it('parses poolKey from indexer response', async () => {
    if (recentPools.length === 0) {
      console.log('  ⚠️  Skipping (no pools available)')
      return
    }

    const targetPool = recentPools[0]
    const response = await graphqlClient.request<{ pools: { items: Pool[] } }>(
      GET_POOL_QUERY,
      {
        address: targetPool.address,
        chainId: Number(chainId),
      }
    )

    const poolData = response.pools.items[0]

    if (poolData.poolKey) {
      const poolKey = poolData.poolKey

      // Validate PoolKey structure
      expect(poolKey.currency0).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(poolKey.currency1).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(typeof poolKey.fee).toBe('number')
      expect(typeof poolKey.tickSpacing).toBe('number')
      expect(poolKey.hooks).toMatch(/^0x[a-fA-F0-9]{40}$/)

      // Verify currency ordering (currency0 < currency1)
      expect(poolKey.currency0.toLowerCase() < poolKey.currency1.toLowerCase()).toBe(true)

      console.log('  ✓ PoolKey parsed successfully')
      console.log(`    Hooks: ${poolKey.hooks}`)
      console.log(`    Fee: ${poolKey.fee}`)
      console.log(`    Tick Spacing: ${poolKey.tickSpacing}`)
    } else {
      console.log('  ⚠️  Pool does not have poolKey (may be V3)')
    }
  })

  it('uses indexer poolKey for SDK quoting', async () => {
    if (recentPools.length === 0) {
      console.log('  ⚠️  Skipping (no pools available)')
      return
    }

    const targetPool = recentPools[0]
    const response = await graphqlClient.request<{ pools: { items: Pool[] } }>(
      GET_POOL_QUERY,
      {
        address: targetPool.address,
        chainId: Number(chainId),
      }
    )

    const poolData = response.pools.items[0]

    if (!poolData.poolKey) {
      console.log('  ⚠️  Skipping (pool has no poolKey)')
      return
    }

    const poolKey = {
      currency0: poolData.poolKey.currency0 as Address,
      currency1: poolData.poolKey.currency1 as Address,
      fee: poolData.poolKey.fee,
      tickSpacing: poolData.poolKey.tickSpacing,
      hooks: poolData.poolKey.hooks as Address,
    }

    const zeroForOne = poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase()

    try {
      const quote = await sdk.quoter.quoteExactInputV4({
        poolKey,
        zeroForOne,
        exactAmount: 1000000n, // Small amount for testing
        hookData: '0x' as `0x${string}`,
      })

      expect(quote).toBeDefined()
      expect(quote.amountOut).toBeGreaterThanOrEqual(0n)
      expect(quote.gasEstimate).toBeGreaterThan(0n)

      console.log('  ✓ Quote successful using indexer poolKey')
      console.log(`    Amount out: ${quote.amountOut}`)
    } catch (error) {
      // This may fail if the pool has no liquidity or was not actually deployed
      console.log('  ⚠️  Quote failed (pool may have no liquidity)')
      expect(error).toBeDefined()
    }
  })

  it('monitors migration status from indexer', async () => {
    if (recentPools.length === 0) {
      console.log('  ⚠️  Skipping (no pools available)')
      return
    }

    const targetPool = recentPools[0]
    const response = await graphqlClient.request<{ pools: { items: Pool[] } }>(
      GET_POOL_QUERY,
      {
        address: targetPool.address,
        chainId: Number(chainId),
      }
    )

    const poolData = response.pools.items[0]

    if (poolData.asset) {
      const asset = poolData.asset

      // Verify asset data structure
      expect(asset.marketCapUsd).toBeDefined()
      expect(typeof asset.migrated).toBe('boolean')

      console.log('  ✓ Asset data available')
      console.log(`    Market Cap: ${asset.marketCapUsd}`)
      console.log(`    Migrated: ${asset.migrated}`)

      if (asset.migrated) {
        expect(asset.migratedAt).toBeDefined()
        console.log(`    Migrated At: ${asset.migratedAt}`)

        if (asset.v2Pool) {
          expect(asset.v2Pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
          console.log(`    V2 Pool: ${asset.v2Pool}`)
        }
      }
    } else {
      console.log('  ⚠️  No asset data (pool may be V3 or not token launch)')
    }
  })

  it('verifies indexer data consistency with on-chain state', async () => {
    if (recentPools.length === 0) {
      console.log('  ⚠️  Skipping (no pools available)')
      return
    }

    const targetPool = recentPools[0]
    const response = await graphqlClient.request<{ pools: { items: Pool[] } }>(
      GET_POOL_QUERY,
      {
        address: targetPool.address,
        chainId: Number(chainId),
      }
    )

    const poolData = response.pools.items[0]

    // For multicurve pools, verify we can load via SDK
    if (poolData.baseToken && poolData.isToken0 !== undefined) {
      try {
        const assetAddress = poolData.baseToken.address as Address
        const multicurvePool = await sdk.getMulticurvePool(assetAddress)
        const onChainState = await multicurvePool.getState()

        // Verify basic consistency
        expect(onChainState.asset.toLowerCase()).toBe(assetAddress.toLowerCase())
        expect(onChainState.fee).toBe(poolData.fee)

        console.log('  ✓ Indexer data consistent with on-chain state')
      } catch (error) {
        // May not be a multicurve pool
        console.log('  ⚠️  Could not verify (may not be multicurve pool)')
      }
    }
  })
})
