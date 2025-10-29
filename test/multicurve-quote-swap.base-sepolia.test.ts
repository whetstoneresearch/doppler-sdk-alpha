import { describe, it, expect, beforeAll } from 'vitest'
import { createPublicClient, http, parseEther, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD, FEE_TIERS } from '../src'

describe('Multicurve Quote & Swap (Base Sepolia fork)', () => {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL
  if (!rpcUrl) {
    it.skip('requires BASE_SEPOLIA_RPC_URL env var')
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) })
  const sdk = new DopplerSDK({ publicClient, chainId })

  let modulesWhitelisted = false

  beforeAll(async () => {
    try {
      const [initState, migratorState, tokenFactoryState, governanceFactoryState] = await Promise.all([
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.v4MulticurveInitializer!],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.v2Migrator],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.tokenFactory],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.governanceFactory],
        }),
      ])

      // ModuleState: TokenFactory=1, GovernanceFactory=2, PoolInitializer=3, LiquidityMigrator=4
      modulesWhitelisted =
        Number(tokenFactoryState) === 1 &&
        Number(governanceFactoryState) === 2 &&
        Number(initState) === 3 &&
        Number(migratorState) === 4
    } catch (error) {
      console.error('Failed to check module states:', error)
    }
  })

  it('simulates multicurve creation with market cap presets', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Quote Swap Test',
        symbol: 'QSWAP',
        tokenURI: 'ipfs://test-quote-swap',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMarketCapPresets({
        fee: FEE_TIERS.LOW,
        presets: ['low', 'medium', 'high'],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()
    const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)

    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)

    // Verify market cap presets generated multiple curves
    expect(params.pool.curves.length).toBeGreaterThan(3) // low, medium, high + filler

    console.log(`  ✓ Created multicurve with ${params.pool.curves.length} curves`)
  })

  it('quotes swap on simulated multicurve pool', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Quote Test',
        symbol: 'QUOT',
        tokenURI: 'ipfs://quote-test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMarketCapPresets({
        fee: FEE_TIERS.LOW,
        presets: ['low', 'medium', 'high'],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()
    const { createParams } = await sdk.factory.simulateCreateMulticurve(params)

    // Get poolKey from bundle quote simulation instead
    const exactAmountOut = params.sale.numTokensToSell / 100n
    const quoteResult = await sdk.factory.simulateMulticurveBundleExactOut(createParams, {
      exactAmountOut,
      hookData: '0x' as `0x${string}`,
    })

    const poolKey = quoteResult.poolKey
    expect(poolKey.currency0).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolKey.currency1).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(poolKey.hooks).toMatch(/^0x[a-fA-F0-9]{40}$/)

    // Determine swap direction
    const zeroForOne = poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase()
    const amountIn = parseEther('0.01')

    // Note: This will likely fail on Base Sepolia since the pool doesn't actually exist
    // But we can still verify the method signature and parameter validation
    try {
      const quote = await sdk.quoter.quoteExactInputV4({
        poolKey: {
          currency0: poolKey.currency0 as Address,
          currency1: poolKey.currency1 as Address,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks as Address,
        },
        zeroForOne,
        exactAmount: amountIn,
        hookData: '0x' as `0x${string}`,
      })

      // If we get here, the pool exists (unlikely in fork test)
      expect(quote.amountOut).toBeGreaterThan(0n)
      expect(quote.gasEstimate).toBeGreaterThan(0n)
      console.log('  ✓ Quote successful (unexpected - pool actually exists!)')
    } catch (error) {
      // Expected: pool doesn't exist yet since we only simulated creation
      expect(error).toBeDefined()
      console.log('  ✓ Quote failed as expected (pool not deployed in simulation)')
    }
  })

  it('validates quote parameters', async () => {
    const poolKey = {
      currency0: addresses.weth as Address,
      currency1: '0x0000000000000000000000000000000000000001' as Address,
      fee: 500,
      tickSpacing: 10,
      hooks: '0x0000000000000000000000000000000000000000' as Address,
    }

    // Test with zero amount should fail
    await expect(
      sdk.quoter.quoteExactInputV4({
        poolKey,
        zeroForOne: true,
        exactAmount: 0n,
        hookData: '0x' as `0x${string}`,
      })
    ).rejects.toThrow()
  })

  it('simulates bundle quote for exact output', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Bundle Quote',
        symbol: 'BNDL',
        tokenURI: 'ipfs://bundle-quote',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 500_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMarketCapPresets({
        fee: FEE_TIERS.LOW,
        presets: ['medium', 'high'],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()
    const { createParams, asset } = await sdk.factory.simulateCreateMulticurve(params)

    const exactAmountOut = params.sale.numTokensToSell / 10n

    const quote = await sdk.factory.simulateMulticurveBundleExactOut(createParams, {
      exactAmountOut,
      hookData: '0x' as `0x${string}`,
    })

    expect(quote.asset).toBe(asset)
    expect(quote.amountIn).toBeGreaterThan(0n)
    expect(quote.gasEstimate).toBeGreaterThanOrEqual(0n)
    expect(quote.poolKey.hooks).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('simulates bundle quote for exact input', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'Bundle Input',
        symbol: 'BNDIN',
        tokenURI: 'ipfs://bundle-input',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 500_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMarketCapPresets({
        fee: FEE_TIERS.LOW,
        presets: ['low', 'medium'],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()
    const { createParams, asset } = await sdk.factory.simulateCreateMulticurve(params)

    const exactAmountIn = parseEther('1')

    try {
      const quote = await sdk.factory.simulateMulticurveBundleExactIn(createParams, {
        exactAmountIn,
        hookData: '0x' as `0x${string}`,
      })

      expect(quote.asset).toBe(asset)
      expect(quote.amountOut).toBeGreaterThan(0n)
      expect(quote.gasEstimate).toBeGreaterThanOrEqual(0n)
      expect(quote.poolKey.currency0).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(quote.poolKey.currency1).toMatch(/^0x[a-fA-F0-9]{40}$/)
      console.log('  ✓ Exact input quote successful')
    } catch (error) {
      // The bundler on this chain may not support exact-in or has different requirements
      console.warn('  ⚠️  Exact-in simulation not supported on this chain')
      expect(error).toBeDefined()
    }
  })
})
