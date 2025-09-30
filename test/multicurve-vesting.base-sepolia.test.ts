import { describe, it, expect, beforeAll } from 'vitest'
import { createPublicClient, http, parseEther } from 'viem'
import { baseSepolia } from 'viem/chains'
import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../src'

describe('Multicurve with multiple vesting beneficiaries (Base Sepolia fork)', () => {
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
  let migratorWhitelisted = false
  let tokenFactoryWhitelisted = false
  let governanceFactoryWhitelisted = false
  let states: { tokenFactory?: number; governanceFactory?: number; initializer?: number; migrator?: number } = {}

  beforeAll(async () => {
    try {
      const initState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v4MulticurveInitializer!],
      }) as unknown as number
      states.initializer = Number(initState)
      initializerWhitelisted = states.initializer === 3
    } catch {}

    try {
      const migratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v2Migrator],
      }) as unknown as number
      states.migrator = Number(migratorState)
      migratorWhitelisted = states.migrator === 4
    } catch {}

    try {
      const tokenFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.tokenFactory],
      }) as unknown as number
      states.tokenFactory = Number(tokenFactoryState)
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
      governanceFactoryWhitelisted = states.governanceFactory === 2
    } catch {}
  })

  it('can simulate multicurve with single vesting beneficiary (default behavior)', async () => {
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.migrator).toBe(4)

    const totalSupply = 1_000_000n * WAD
    const tokensToSell = 800_000n * WAD
    const expectedVestedAmount = totalSupply - tokensToSell // 200k tokens

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'SingleVestTest',
        symbol: 'SVT',
        tokenURI: 'ipfs://single-vest'
      })
      .saleConfig({
        initialSupply: totalSupply,
        numTokensToSell: tokensToSell,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
      })
      .withVesting({
        duration: BigInt(365 * 24 * 60 * 60), // 1 year
        cliffDuration: 0
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()

    // Verify vesting config defaults to userAddress with all unsold tokens
    expect(params.vesting).toBeDefined()
    expect(params.vesting?.duration).toBe(365 * 24 * 60 * 60)

    const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('can simulate multicurve with multiple vesting beneficiaries', async () => {
    expect(states.tokenFactory).toBe(1)
    expect(states.governanceFactory).toBe(2)
    expect(states.initializer).toBe(3)
    expect(states.migrator).toBe(4)

    const totalSupply = 1_000_000n * WAD
    const tokensToSell = 700_000n * WAD
    const availableForVesting = totalSupply - tokensToSell // 300k tokens

    // Define multiple beneficiaries
    const recipient1 = '0x1234567890123456789012345678901234567890'
    const recipient2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
    const recipient3 = '0x9876543210987654321098765432109876543210'

    const amount1 = parseEther('100000') // 100k tokens
    const amount2 = parseEther('100000') // 100k tokens
    const amount3 = parseEther('100000') // 100k tokens
    // Total: 300k tokens = exactly the available amount

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'MultiVestTest',
        symbol: 'MVT',
        tokenURI: 'ipfs://multi-vest'
      })
      .saleConfig({
        initialSupply: totalSupply,
        numTokensToSell: tokensToSell,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
      })
      .withVesting({
        duration: BigInt(4 * 365 * 24 * 60 * 60), // 4 years
        cliffDuration: 0,
        recipients: [recipient1, recipient2, recipient3],
        amounts: [amount1, amount2, amount3]
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()

    // Verify vesting config has multiple recipients
    expect(params.vesting).toBeDefined()
    expect(params.vesting?.recipients).toHaveLength(3)
    expect(params.vesting?.amounts).toHaveLength(3)
    expect(params.vesting?.recipients).toEqual([recipient1, recipient2, recipient3])
    expect(params.vesting?.amounts).toEqual([amount1, amount2, amount3])

    const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })

  it('validates that recipients and amounts arrays match in length', async () => {
    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'InvalidVest',
        symbol: 'IVT',
        tokenURI: 'ipfs://invalid'
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 700_000n * WAD,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
      })
      .withVesting({
        duration: BigInt(365 * 24 * 60 * 60),
        cliffDuration: 0,
        recipients: ['0x1234567890123456789012345678901234567890', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'],
        amounts: [parseEther('100000')] // Mismatched length
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()

    await expect(async () => {
      await sdk.factory.simulateCreateMulticurve(params)
    }).rejects.toThrow(/recipients and amounts arrays must have the same length/i)
  })

  it('validates that total vested amount does not exceed available tokens', async () => {
    const totalSupply = 1_000_000n * WAD
    const tokensToSell = 700_000n * WAD
    const availableForVesting = totalSupply - tokensToSell // 300k tokens

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'ExcessVest',
        symbol: 'EVT',
        tokenURI: 'ipfs://excess'
      })
      .saleConfig({
        initialSupply: totalSupply,
        numTokensToSell: tokensToSell,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
      })
      .withVesting({
        duration: BigInt(365 * 24 * 60 * 60),
        cliffDuration: 0,
        recipients: ['0x1234567890123456789012345678901234567890', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'],
        amounts: [parseEther('200000'), parseEther('200000')] // Total: 400k > 300k available
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()

    await expect(async () => {
      await sdk.factory.simulateCreateMulticurve(params)
    }).rejects.toThrow(/total vesting amount.*exceeds available tokens/i)
  })

  it('validates that recipients array cannot be empty', async () => {
    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({
        type: 'standard',
        name: 'EmptyVest',
        symbol: 'EVT',
        tokenURI: 'ipfs://empty'
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 700_000n * WAD,
        numeraire: addresses.weth
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 5 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 5n,
        })),
      })
      .withVesting({
        duration: BigInt(365 * 24 * 60 * 60),
        cliffDuration: 0,
        recipients: [],
        amounts: []
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4MulticurveInitializer(addresses.v4MulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()

    await expect(async () => {
      await sdk.factory.simulateCreateMulticurve(params)
    }).rejects.toThrow(/vesting recipients array cannot be empty/i)
  })
})
