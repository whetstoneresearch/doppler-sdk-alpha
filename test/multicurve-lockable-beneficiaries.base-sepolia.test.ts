import { describe, it, expect, beforeAll } from 'vitest'
import { createPublicClient, http, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../src'

describe('Multicurve with lockable beneficiaries using NoOpMigrator (Base Sepolia fork)', () => {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL
  if (!rpcUrl) {
    it.skip('requires BASE_SEPOLIA_RPC_URL env var')
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) })
  const sdk = new DopplerSDK({ publicClient, chainId })

  let initializerWhitelisted = false
  let noOpMigratorWhitelisted = false
  let tokenFactoryWhitelisted = false
  let governanceFactoryWhitelisted = false
  let states: {
    tokenFactory?: number
    governanceFactory?: number
    initializer?: number
    noOpMigrator?: number
  } = {}

  beforeAll(async () => {
    try {
      const initState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v4MulticurveInitializer!],
      }) as unknown as number
      states.initializer = Number(initState)
      // ModuleState.PoolInitializer = 3
      initializerWhitelisted = states.initializer === 3
    } catch {}

    try {
      const noOpMigratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.noOpMigrator!],
      }) as unknown as number
      states.noOpMigrator = Number(noOpMigratorState)
      // ModuleState.LiquidityMigrator = 4
      noOpMigratorWhitelisted = states.noOpMigrator === 4
    } catch {}

    try {
      const tokenFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.tokenFactory],
      }) as unknown as number
      states.tokenFactory = Number(tokenFactoryState)
      // ModuleState.TokenFactory = 1
      tokenFactoryWhitelisted = states.tokenFactory === 1
    } catch {}

    try {
      const governanceFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.governanceFactory],
      }) as unknown as number
      states.governanceFactory = Number(governanceFactoryState)
      // ModuleState.GovernanceFactory = 2
      governanceFactoryWhitelisted = states.governanceFactory === 2
    } catch {}
  })

  it('can simulate create() for multicurve with lockable beneficiaries using NoOpMigrator', async () => {
    // Skip if NoOpMigrator is not whitelisted
    if (states.noOpMigrator !== 4) {
      console.warn('NoOpMigrator not whitelisted on Base Sepolia (state=%d), skipping test', states.noOpMigrator)
      return
    }

    // Assert module states explicitly; these must be whitelisted
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.noOpMigrator).toBe(4)

    // Define beneficiaries with shares that sum to WAD (1e18)
    // IMPORTANT: Protocol owner (Airlock.owner()) must be included with at least 5% shares
    const protocolOwner = '0x852a09C89463D236eea2f097623574f23E225769' as Address // Airlock owner on Base Sepolia
    const beneficiary1 = protocolOwner // Protocol owner (required)
    const beneficiary2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address
    const beneficiary3 = '0x9876543210987654321098765432109876543210' as Address

    // Shares must sum to exactly WAD (1e18)
    const share1 = WAD / 10n // 10% for protocol (>= 5% required)
    const share2 = WAD / 2n // 50%
    const share3 = (WAD * 4n) / 10n // 40%
    // Total: 100%

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'LockableBeneficiariesTest',
        symbol: 'LBT',
        tokenURI: 'ipfs://lockable-test'
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: 8 + i * 16_000, // Start at 8 to ensure positive ticks
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
        // Add lockable beneficiaries - these should trigger NoOpMigrator usage
        lockableBeneficiaries: [
          { beneficiary: beneficiary1, shares: share1 },
          { beneficiary: beneficiary2, shares: share2 },
          { beneficiary: beneficiary3, shares: share3 },
        ]
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' }) // This should be ignored when beneficiaries are present
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!) // Explicitly set NoOpMigrator

    const params = builder.build()

    // Verify that lockableBeneficiaries are set
    expect(params.pool.lockableBeneficiaries).toBeDefined()
    expect(params.pool.lockableBeneficiaries).toHaveLength(3)

    // Encode the params to verify NoOpMigrator is used
    const createParams = sdk.factory.encodeCreateMulticurveParams(params)

    // Verify that NoOpMigrator is used when beneficiaries are provided
    expect(createParams.liquidityMigrator).toBe(addresses.noOpMigrator)
    // Verify that migration data is empty (0x)
    expect(createParams.liquidityMigratorData).toBe('0x')

    // Simulate the create operation
    const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('uses standard migrator when no lockable beneficiaries are provided', async () => {
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'NoLockableTest',
        symbol: 'NLT',
        tokenURI: 'ipfs://no-lockable'
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: 8 + i * 16_000, // Start at 8 to ensure positive ticks
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
        // No lockableBeneficiaries provided
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()

    // Verify that lockableBeneficiaries are not set
    expect(params.pool.lockableBeneficiaries).toBeUndefined()

    // Encode the params to verify standard migrator is used
    const createParams = sdk.factory.encodeCreateMulticurveParams(params)

    // Verify that V2 migrator is used when no beneficiaries
    expect(createParams.liquidityMigrator).toBe(addresses.v2Migrator)
    // Verify that migration data is empty for V2 (V2 uses empty data by design)
    expect(createParams.liquidityMigratorData).toBe('0x')
  })

  it('validates that beneficiary shares sum to WAD (100%)', async () => {
    // Skip if NoOpMigrator is not whitelisted
    if (states.noOpMigrator !== 4) {
      console.warn('NoOpMigrator not whitelisted on Base Sepolia (state=%d), skipping test', states.noOpMigrator)
      return
    }

    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.noOpMigrator).toBe(4)

    const protocolOwner = '0x852a09C89463D236eea2f097623574f23E225769' as Address // Airlock owner on Base Sepolia
    const beneficiary1 = protocolOwner // Protocol owner (required)
    const beneficiary2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address

    // Shares that DON'T sum to WAD (only 60%)
    const share1 = WAD / 10n // 10% for protocol
    const share2 = WAD / 2n // 50%
    // Total: 60% (should fail - missing 40%)

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'InvalidSharesTest',
        symbol: 'IST',
        tokenURI: 'ipfs://invalid-shares'
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, i) => ({
          tickLower: 8 + i * 16_000, // Start at 8 to ensure positive ticks
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
        lockableBeneficiaries: [
          { beneficiary: beneficiary1, shares: share1 },
          { beneficiary: beneficiary2, shares: share2 },
        ]
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    // The simulation should fail because shares don't sum to WAD
    await expect(async () => {
      await sdk.factory.simulateCreateMulticurve(params)
    }).rejects.toThrow()
  })

  it('validates that beneficiaries are sorted by address', async () => {
    // Skip if NoOpMigrator is not whitelisted
    if (states.noOpMigrator !== 4) {
      console.warn('NoOpMigrator not whitelisted on Base Sepolia (state=%d), skipping test', states.noOpMigrator)
      return
    }

    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.noOpMigrator).toBe(4)

    // Beneficiaries NOT in sorted order
    // We need to include Airlock owner, so let's put it out of order with another address
    const protocolOwner = '0x852a09C89463D236eea2f097623574f23E225769' as Address // Airlock owner on Base Sepolia
    const beneficiary1 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address // Higher address
    const beneficiary2 = protocolOwner // Protocol owner - will be sorted by SDK
    const beneficiary3 = '0x9876543210987654321098765432109876543210' as Address // Another address

    const share1 = WAD / 2n // 50%
    const share2 = WAD / 10n // 10% for protocol
    const share3 = (WAD * 4n) / 10n // 40%

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'UnsortedBeneficiariesTest',
        symbol: 'UBT',
        tokenURI: 'ipfs://unsorted'
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 1_000_000n * WAD,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, i) => ({
          tickLower: 8 + i * 16_000, // Start at 8 to ensure positive ticks
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
        // Unsorted beneficiaries (SDK should sort them automatically)
        lockableBeneficiaries: [
          { beneficiary: beneficiary1, shares: share1 },
          { beneficiary: beneficiary2, shares: share2 },
          { beneficiary: beneficiary3, shares: share3 },
        ]
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withNoOpMigrator(addresses.noOpMigrator!)

    const params = builder.build()

    // The SDK should automatically sort beneficiaries, so this should succeed
    const createParams = sdk.factory.encodeCreateMulticurveParams(params)
    expect(createParams.liquidityMigrator).toBe(addresses.noOpMigrator)

    const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })
})
