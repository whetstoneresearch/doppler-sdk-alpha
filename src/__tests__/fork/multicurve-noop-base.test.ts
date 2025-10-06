import { describe, it, expect, beforeAll } from 'vitest'
import { createPublicClient, http, type Address, parseEther } from 'viem'
import { base } from 'viem/chains'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../../index'

// Only run when explicitly enabled to avoid flaky network tests in CI
const RUN = process.env.RUN_FORK_TESTS === '1'
const maybeDescribe = RUN ? describe : describe.skip

/**
 * Fork test demonstrating two multicurve auctions with NoOp migration on Base mainnet.
 * Each auction has a single curve with different tick ranges (one positive, one negative).
 */
maybeDescribe('Fork/Live - Multicurve NoOp Migration on Base', () => {
  const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'

  const chainId = CHAIN_IDS.BASE
  const addresses = getAddresses(chainId)
  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })
  const sdk = new DopplerSDK({ publicClient, chainId })

  let protocolOwner: Address
  let noOpMigratorWhitelisted = false

  // Auction parameters
  const MULTICURVE_TOTAL_SUPPLY = parseEther("1000000000")
  const MULTICURVE_NUM_TOKENS_TO_SELL = parseEther("900000000")
  const MULTICURVE_TICK_SPACING = 100

  beforeAll(async () => {
    // Get protocol owner from Airlock.owner()
    try {
      protocolOwner = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'owner',
      }) as Address
    } catch (error) {
      console.error('Failed to get protocol owner:', error)
      protocolOwner = '0x0000000000000000000000000000000000000000' as Address
    }

    // Check if NoOpMigrator is whitelisted
    try {
      const noOpMigratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.noOpMigrator!],
      }) as unknown as number
      // ModuleState.LiquidityMigrator = 4
      noOpMigratorWhitelisted = Number(noOpMigratorState) === 4
    } catch (error) {
      console.error('Failed to check NoOpMigrator state:', error)
    }
  })

  it('creates multicurve auction with positive ticks (188000 to 202000)', async () => {
    if (!noOpMigratorWhitelisted) {
      console.warn('NoOpMigrator not whitelisted on Base, skipping test')
      return
    }

    if (!protocolOwner || protocolOwner === '0x0000000000000000000000000000000000000000') {
      console.warn('Protocol owner not available, skipping test')
      return
    }

    // Define beneficiaries with protocol owner getting 10%
    const beneficiaries = [
      { beneficiary: protocolOwner, shares: WAD / 10n },  // 10% for protocol owner
      { beneficiary: '0x1234567890123456789012345678901234567890' as Address, shares: (WAD * 9n) / 10n },  // 90%
    ]

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'PositiveTicksNoOp',
        symbol: 'PTNOOP',
        tokenURI: 'ipfs://positive-ticks-noop'
      })
      .saleConfig({
        initialSupply: MULTICURVE_TOTAL_SUPPLY,
        numTokensToSell: MULTICURVE_NUM_TOKENS_TO_SELL,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: MULTICURVE_TICK_SPACING,
        curves: [{
          tickLower: 188000,
          tickUpper: 202000,
          numPositions: 11,
          shares: parseEther("1")
        }],
        beneficiaries: beneficiaries
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    // Verify configuration
    expect(params.pool.beneficiaries).toBeDefined()
    expect(params.pool.beneficiaries).toHaveLength(2)

    // Encode and verify NoOpMigrator is used
    const createParams = sdk.factory.encodeCreateMulticurveParams(params)
    expect(createParams.liquidityMigrator).toBe(addresses.noOpMigrator)
    expect(createParams.liquidityMigratorData).toBe('0x')

    // Simulate the create operation
    const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
  }, 30_000)

  it('creates multicurve auction with negative ticks (-202000 to -188000)', async () => {
    if (!noOpMigratorWhitelisted) {
      console.warn('NoOpMigrator not whitelisted on Base, skipping test')
      return
    }

    if (!protocolOwner || protocolOwner === '0x0000000000000000000000000000000000000000') {
      console.warn('Protocol owner not available, skipping test')
      return
    }

    // Define beneficiaries with protocol owner getting 5%
    const beneficiaries = [
      { beneficiary: protocolOwner, shares: WAD / 20n },  // 5% for protocol owner (minimum)
      { beneficiary: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address, shares: (WAD * 19n) / 20n },  // 95%
    ]

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'NegativeTicksNoOp',
        symbol: 'NTNOOP',
        tokenURI: 'ipfs://negative-ticks-noop'
      })
      .saleConfig({
        initialSupply: MULTICURVE_TOTAL_SUPPLY,
        numTokensToSell: MULTICURVE_NUM_TOKENS_TO_SELL,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: MULTICURVE_TICK_SPACING,
        curves: [{
          tickLower: -202000,
          tickUpper: -188000,
          numPositions: 11,
          shares: parseEther("1")
        }],
        beneficiaries: beneficiaries
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'noOp' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    // Verify configuration
    expect(params.pool.beneficiaries).toBeDefined()
    expect(params.pool.beneficiaries).toHaveLength(2)

    // Encode and verify NoOpMigrator is used
    const createParams = sdk.factory.encodeCreateMulticurveParams(params)
    expect(createParams.liquidityMigrator).toBe(addresses.noOpMigrator)
    expect(createParams.liquidityMigratorData).toBe('0x')

    // Simulate the create operation
    const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
  }, 30_000)
})
