/**
 * Example: Create a Multicurve Auction using the V4 Multicurve Initializer
 *
 * This example demonstrates:
 * - Seeding a Uniswap V4 pool with multiple curves in a single initializer
 * - Using WAD-based shares to weight curve distributions
 * - Choosing a standard migration path (V2 in this example)
 *
 * For lockable beneficiaries with NoOp migration, see:
 * - examples/multicurve-lockable-beneficiaries.ts
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

  // Build multicurve initializer parameters
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({ name: 'TEST MULTICURVE', symbol: 'TMC', tokenURI: 'ipfs://token.json' })
    .saleConfig({ initialSupply: 1_000_000n * WAD, numTokensToSell: 900_000n * WAD, numeraire: '0x4200000000000000000000000000000000000006' }) // WETH on Base
    .withMulticurveAuction({
      fee: 0,
      tickSpacing: 8,
      curves: [
        { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
        { tickLower: 16000, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
      ],
      // Optional: lock fee revenue to beneficiaries at init (shares in WAD)
      // lockableBeneficiaries: [ { beneficiary: account.address, shares: parseEther('0.05') } ],
    })
    .withGovernance({ type: 'default' })
    // Choose any supported migration (V2, V3, or V4). Using V2 for simplicity.
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(account.address)
    .build()

  // Simulate to preview addresses
  const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
  console.log('Predicted token address:', asset)
  console.log('Predicted pool address:', pool)

  // Create the multicurve pool + token
  const result = await sdk.factory.createMulticurve(params)
  console.log('✅ Multicurve created')
  console.log('Token address:', result.tokenAddress)
  console.log('Pool address:', result.poolAddress)
  console.log('Transaction:', result.transactionHash)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
