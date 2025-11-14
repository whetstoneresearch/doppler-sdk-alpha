import { describe, it, expect, beforeAll } from 'vitest'
import { createPublicClient, http, decodeAbiParameters, defineChain } from 'viem'

import { DopplerSDK, getAddresses, CHAIN_IDS, airlockAbi, WAD } from '../src'

const monadMainnet = defineChain({
  id: 143,
  name: 'Monad Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MONAD',
  },
  rpcUrls: {
    default: {
      http: [],
    },
  },
})

describe('Scheduled Multicurve (Monad Mainnet) smoke test', () => {
  const rpcUrl = process.env.MONAD_MAINNET_RPC_URL
  if (!rpcUrl) {
    it.skip('requires MONAD_MAINNET_RPC_URL env var')
    return
  }

  const chainId = CHAIN_IDS.MONAD_MAINNET
  const addresses = getAddresses(chainId)

  if (!addresses.v4ScheduledMulticurveInitializer) {
    it.skip('scheduled multicurve initializer not configured on Monad Mainnet')
    return
  }

  const publicClient = createPublicClient({ chain: monadMainnet, transport: http(rpcUrl) })
  const sdk = new DopplerSDK({ publicClient, chainId })

  let scheduledInitializerWhitelisted = false
  let tokenFactoryWhitelisted = false
  let governanceFactoryWhitelisted = false
  let migratorWhitelisted = false

  let states: {
    scheduledInitializer?: number
    tokenFactory?: number
    governanceFactory?: number
    migrator?: number
  } = {}

  beforeAll(async () => {
    try {
      const initializerState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v4ScheduledMulticurveInitializer!],
      }) as unknown as number
      // ModuleState.PoolInitializer = 3
      states.scheduledInitializer = Number(initializerState)
      scheduledInitializerWhitelisted = states.scheduledInitializer === 3
    } catch {}

    try {
      const tokenFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.tokenFactory],
      }) as unknown as number
      // ModuleState.TokenFactory = 1
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
      // ModuleState.GovernanceFactory = 2
      states.governanceFactory = Number(governanceFactoryState)
      governanceFactoryWhitelisted = states.governanceFactory === 2
    } catch {}

    try {
      const migratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v2Migrator],
      }) as unknown as number
      // ModuleState.LiquidityMigrator = 4
      states.migrator = Number(migratorState)
      migratorWhitelisted = states.migrator === 4
    } catch {}
  })

  it('encodes scheduled multicurve params with the scheduled initializer', async () => {
    expect(scheduledInitializerWhitelisted).toBe(true)
    expect(tokenFactoryWhitelisted).toBe(true)
    expect(governanceFactoryWhitelisted).toBe(true)
    expect(migratorWhitelisted).toBe(true)

    const oneHourFromNow = Math.floor(Date.now() / 1000) + 3600

    const builder = sdk
      .buildMulticurveAuction()
      .tokenConfig({ type: 'standard', name: 'ScheduledMultiCurve', symbol: 'SMC', tokenURI: 'ipfs://scheduled' })
      .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 1_000_000n * WAD, numeraire: addresses.weth })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: Array.from({ length: 10 }, (_, i) => ({
          tickLower: i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n,
        })),
      })
      .withSchedule({ startTime: oneHourFromNow })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress(addresses.airlock)
      .withV4ScheduledMulticurveInitializer(addresses.v4ScheduledMulticurveInitializer!)
      .withV2Migrator(addresses.v2Migrator)

    const params = builder.build()
    expect(params.schedule?.startTime).toBe(oneHourFromNow)

    const createParams = sdk.factory.encodeCreateMulticurveParams(params)
    expect(createParams.poolInitializer).toEqual(addresses.v4ScheduledMulticurveInitializer)

    const [decoded] = decodeAbiParameters(
      [{
        type: 'tuple',
        components: [
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          {
            name: 'curves',
            type: 'tuple[]',
            components: [
              { name: 'tickLower', type: 'int24' },
              { name: 'tickUpper', type: 'int24' },
              { name: 'numPositions', type: 'uint16' },
              { name: 'shares', type: 'uint256' },
            ],
          },
          {
            name: 'beneficiaries',
            type: 'tuple[]',
            components: [
              { name: 'beneficiary', type: 'address' },
              { name: 'shares', type: 'uint96' },
            ],
          },
          { name: 'startingTime', type: 'uint32' },
        ],
      }],
      createParams.poolInitializerData,
    ) as [{
      fee: number
      tickSpacing: number
      curves: Array<{ tickLower: number; tickUpper: number; numPositions: number; shares: bigint }>
      beneficiaries: Array<{ beneficiary: `0x${string}`; shares: bigint }>
      startingTime: number
    }]

    expect(decoded.startingTime).toBe(oneHourFromNow)

    const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
    expect(asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(pool).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })
})
