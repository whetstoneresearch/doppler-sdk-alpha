/**
 * Example: Schedule a Multicurve Auction on Base
 *
 * This example demonstrates how to configure a multicurve auction that
 * opens at a specified start time. It assumes the scheduled multicurve
 * initializer is whitelisted on the target chain (Base mainnet or Base
 * Sepolia at the time of writing).
 */

import { DopplerSDK, WAD } from '../src'
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = (process.env.RPC_URL || 'https://mainnet.base.org') as string

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

async function main() {
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: base, transport: http(rpcUrl), account })

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: base.id })

  const startTime = Math.floor(Date.now() / 1000) + 3600 // schedule one hour in the future

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({ name: 'Scheduled Multicurve', symbol: 'SMC', tokenURI: 'ipfs://scheduled.json' })
    .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 900_000n * WAD, numeraire: '0x4200000000000000000000000000000000000006' })
    .withMulticurveAuction({
      fee: 0,
      tickSpacing: 8,
      curves: [
        { tickLower: 0, tickUpper: 240000, numPositions: 12, shares: parseEther('0.5') },
        { tickLower: 16000, tickUpper: 240000, numPositions: 12, shares: parseEther('0.5') },
      ],
    })
    .withSchedule({ startTime })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(account.address)
    .build()

  const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
  console.log('Predicted token address:', asset)
  console.log('Predicted pool address:', pool)
  console.log('Scheduled start time:', startTime)

  const result = await sdk.factory.createMulticurve(params)
  console.log('✅ Scheduled multicurve created')
  console.log('Token address:', result.tokenAddress)
  console.log('Pool address:', result.poolAddress)
  console.log('Transaction:', result.transactionHash)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
