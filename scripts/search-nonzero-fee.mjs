import { createPublicClient, http, BaseError } from 'viem'
import { baseSepolia } from 'viem/chains'
import { DopplerSDK, getAddresses, CHAIN_IDS, WAD } from '../dist/index.mjs'

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL
if (!rpcUrl) {
  console.error('Missing BASE_SEPOLIA_RPC_URL environment variable')
  process.exit(1)
}

const chainId = CHAIN_IDS.BASE_SEPOLIA
const addresses = getAddresses(chainId)

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
})

const sdk = new DopplerSDK({ publicClient, chainId })

const combos = [
  { fee: 100, tickSpacing: 1 },
  { fee: 300, tickSpacing: 2 },
  { fee: 500, tickSpacing: 8 },
  { fee: 500, tickSpacing: 16 },
  { fee: 1000, tickSpacing: 8 },
  { fee: 1000, tickSpacing: 10 },
  { fee: 2000, tickSpacing: 40 },
  { fee: 3000, tickSpacing: 60 },
  { fee: 4000, tickSpacing: 120 },
]

const numCurves = 6
const baseShares = WAD / BigInt(numCurves)

const results = []

for (const { fee, tickSpacing } of combos) {
  const baseStep = tickSpacing * 2000
  const curves = Array.from({ length: numCurves }, (_, i) => {
    const tickLower = i * baseStep
    const tickUpper = tickLower + baseStep * 2
    return {
      tickLower,
      tickUpper,
      numPositions: 10,
      shares: baseShares,
    }
  })

  const builder = sdk
    .buildMulticurveAuction()
    .tokenConfig({ type: 'standard', name: `MultiCurve${fee}`, symbol: `MC${fee}`, tokenURI: 'ipfs://non-zero' })
    .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 1_000_000n * WAD, numeraire: addresses.weth })
    .withMulticurveAuction({ fee, tickSpacing, curves })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(addresses.airlock)
    .withV4MulticurveInitializer(addresses.v4MulticurveInitializer)
    .withV2Migrator(addresses.v2Migrator)
    .withGasLimit(30_000_000n)

  const params = builder.build()

  try {
    const { gasEstimate, asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
    results.push({ fee, tickSpacing, ok: true, gasEstimate: gasEstimate?.toString(), asset, pool })
    console.info('SUCCESS', { fee, tickSpacing, gasEstimate: gasEstimate?.toString(), asset, pool })
  } catch (error) {
    let message = 'unknown error'
    if (error instanceof BaseError) {
      const parts = [error.shortMessage]
      if (Array.isArray(error.metaMessages) && error.metaMessages.length > 0) {
        parts.push(...error.metaMessages)
      }
      if (error.details) parts.push(error.details)
      if (error.cause instanceof BaseError) {
        parts.push(error.cause.shortMessage)
        if (Array.isArray(error.cause.metaMessages) && error.cause.metaMessages.length > 0) {
          parts.push(...error.cause.metaMessages)
        }
        if (error.cause.details) parts.push(error.cause.details)
      }
      message = parts.filter(Boolean).join(' | ')
    } else if (error instanceof Error) {
      message = error.message
    }
    results.push({ fee, tickSpacing, ok: false, error: message })
    console.warn('FAIL', { fee, tickSpacing, error: message })
  }
}

console.info('\nSummary:')
for (const entry of results) {
  if (entry.ok) {
    console.info(`  fee=${entry.fee} tickSpacing=${entry.tickSpacing} => success (gas=${entry.gasEstimate})`)
  } else {
    console.info(`  fee=${entry.fee} tickSpacing=${entry.tickSpacing} => fail (${entry.error})`)
  }
}
