import { describe, it, expect, beforeAll } from 'vitest'
import { createPublicClient, http, parseEther } from 'viem'
import { baseSepolia } from 'viem/chains'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../src'

describe('Multicurve Pre-Buy with WETH (Base Sepolia fork)', () => {
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

      modulesWhitelisted =
        Number(tokenFactoryState) === 1 &&
        Number(governanceFactoryState) === 2 &&
        Number(initState) === 3 &&
        Number(migratorState) === 4
    } catch (error) {
      console.error('Failed to check module states:', error)
    }
  })

  it('simulates multicurve creation with WETH numeraire', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        name: 'WETH Prebuy Test',
        symbol: 'WPBUY',
        tokenURI: 'ipfs://test-weth-prebuy',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
          { tickLower: 16000, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
        ],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .build()

    const { createParams, asset, pool } = await sdk.factory.simulateCreateMulticurve(params)

    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)

    // Get poolKey from bundle quote to verify WETH
    const quote = await sdk.factory.simulateMulticurveBundleExactOut(createParams, {
      exactAmountOut: params.sale.numTokensToSell / 100n,
      hookData: '0x' as `0x${string}`,
    })

    const poolKey = quote.poolKey
    const hasWETH =
      poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase() ||
      poolKey.currency1.toLowerCase() === addresses.weth.toLowerCase()
    expect(hasWETH).toBe(true)

    console.log('  ✓ Simulated creation with WETH numeraire')
    console.log(`    Asset: ${asset}`)
    console.log(`    Pool: ${pool}`)
  })

  it('simulates bundle exact output quote for WETH prebuy', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        name: 'Bundle Quote Test',
        symbol: 'BQTST',
        tokenURI: 'ipfs://bundle-quote-test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
          { tickLower: 16000, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
        ],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .build()

    const { createParams, asset } = await sdk.factory.simulateCreateMulticurve(params)

    // Quote for buying 1% of tokens
    const exactAmountOut = params.sale.numTokensToSell / 100n

    const quote = await sdk.factory.simulateMulticurveBundleExactOut(createParams, {
      exactAmountOut,
      hookData: '0x' as `0x${string}`,
    })

    expect(quote.asset).toBe(asset)
    expect(quote.amountIn).toBeGreaterThan(0n)
    expect(quote.gasEstimate).toBeGreaterThanOrEqual(0n)
    expect(quote.poolKey.hooks).toMatch(/^0x[a-fA-F0-9]{40}$/)

    console.log('  ✓ Bundle quote successful')
    console.log(`    WETH required: ${quote.amountIn}`)
    console.log(`    Tokens to receive: ${exactAmountOut}`)
    console.log(`    Gas estimate: ${quote.gasEstimate}`)
  })

  it('verifies swap direction for WETH → Token', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        name: 'Direction Test',
        symbol: 'DTEST',
        tokenURI: 'ipfs://direction-test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('1') },
        ],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .build()

    const { createParams } = await sdk.factory.simulateCreateMulticurve(params)

    // Get poolKey from bundle quote
    const quote = await sdk.factory.simulateMulticurveBundleExactOut(createParams, {
      exactAmountOut: params.sale.numTokensToSell / 100n,
      hookData: '0x' as `0x${string}`,
    })

    const poolKey = quote.poolKey

    // Determine swap direction
    const zeroForOne = poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase()

    // Verify one of the currencies is WETH
    expect(
      poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase() ||
      poolKey.currency1.toLowerCase() === addresses.weth.toLowerCase()
    ).toBe(true)

    console.log('  ✓ Swap direction determined')
    console.log(`    zeroForOne: ${zeroForOne}`)
    console.log(`    Currency0: ${poolKey.currency0}`)
    console.log(`    Currency1: ${poolKey.currency1}`)
  })

  it('validates bundler exact input simulation', async () => {
    if (!modulesWhitelisted) {
      console.warn('⚠️  Modules not whitelisted on this chain, skipping test')
      return
    }

    const params = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        name: 'Exact In Test',
        symbol: 'EXIN',
        tokenURI: 'ipfs://exact-in-test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 900_000n * WAD,
        numeraire: addresses.weth,
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: [
          { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('1') },
        ],
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)
      .build()

    const { createParams, asset } = await sdk.factory.simulateCreateMulticurve(params)

    const exactAmountIn = parseEther('1') // 1 WETH

    const quote = await sdk.factory.simulateMulticurveBundleExactIn(createParams, {
      exactAmountIn,
      hookData: '0x' as `0x${string}`,
    })

    expect(quote.asset).toBe(asset)
    expect(quote.amountOut).toBeGreaterThan(0n)
    expect(quote.gasEstimate).toBeGreaterThanOrEqual(0n)

    console.log('  ✓ Exact input simulation successful')
    console.log(`    WETH in: ${exactAmountIn}`)
    console.log(`    Tokens out (estimated): ${quote.amountOut}`)
  })

  it('ensures bundle helpers exist on SDK factory', () => {
    expect(typeof sdk.factory.simulateMulticurveBundleExactOut).toBe('function')
    expect(typeof sdk.factory.simulateMulticurveBundleExactIn).toBe('function')

    console.log('  ✓ Bundle helper methods available on SDK')
  })

  it('validates permit2 and universal router addresses exist', () => {
    expect(addresses.permit2).toBeDefined()
    expect(addresses.permit2).toMatch(/^0x[a-fA-F0-9]{40}$/)

    expect(addresses.universalRouter).toBeDefined()
    expect(addresses.universalRouter).toMatch(/^0x[a-fA-F0-9]{40}$/)

    console.log('  ✓ Required contract addresses available')
    console.log(`    Permit2: ${addresses.permit2}`)
    console.log(`    Universal Router: ${addresses.universalRouter}`)
  })
})
