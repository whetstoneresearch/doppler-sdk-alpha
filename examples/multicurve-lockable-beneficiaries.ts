/**
 * Example: Create a Multicurve Auction with Lockable Beneficiaries (NoOp Migration)
 *
 * This example demonstrates:
 * - Creating a multicurve auction with lockable beneficiaries for fee streaming
 * - Using the NoOp migrator (no post-auction migration)
 * - Distributing liquidity fees to multiple beneficiaries with WAD-based shares
 * - Ensuring the protocol owner (Airlock owner) receives at least 5% shares
 *
 * Use case: When you want fee revenue to flow to specific addresses without
 * migrating liquidity after the auction completes.
 */

import { DopplerSDK, WAD, getAddresses } from '../src'
import { createPublicClient, createWalletClient, http, type Address } from 'viem'
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
  const addresses = getAddresses(base.id)

  // Get the Airlock owner address (required beneficiary with minimum 5% shares)
  // On Base mainnet, you'd query this via: publicClient.readContract({ address: addresses.airlock, abi: airlockAbi, functionName: 'owner' })
  // For this example, we'll use a placeholder - replace with actual protocol owner
  const protocolOwner = '0x0000000000000000000000000000000000000000' as Address // REPLACE with actual Airlock owner

  // Define beneficiaries with shares that sum to WAD (1e18 = 100%)
  // IMPORTANT: Protocol owner must be included with at least 5% shares (WAD/20)
  const beneficiaries = [
    { beneficiary: protocolOwner, shares: WAD / 10n },              // 10% to protocol owner (>= 5% required)
    { beneficiary: account.address, shares: (WAD * 4n) / 10n },     // 40% to deployer
    { beneficiary: '0x1234567890123456789012345678901234567890' as Address, shares: WAD / 2n }, // 50% to another address
  ]
  // Total: 100% (WAD)

  // Build multicurve with beneficiaries
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      type: 'standard',
      name: 'Lockable Beneficiaries Token',
      symbol: 'LBT',
      tokenURI: 'ipfs://token-metadata.json'
    })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: addresses.weth // WETH on Base
    })
    .withMulticurveAuction({
      fee: 0,
      tickSpacing: 8,
      curves: [
        // Create 10 curves with equal shares
        ...Array.from({ length: 10 }, (_, i) => ({
          tickLower: 8 + i * 16_000,
          tickUpper: 240_000,
          numPositions: 10,
          shares: WAD / 10n, // 10% per curve
        }))
      ],
      // Specify beneficiaries for fee collection
      beneficiaries
    })
    .withGovernance({ type: 'default' })
    // IMPORTANT: Use 'noOp' migration type when using beneficiaries
    // This tells the SDK to use NoOpMigrator (no post-auction migration)
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    // Optional: Override the NoOpMigrator address if using a custom deployment
    // .withNoOpMigrator(addresses.noOpMigrator!)
    .build()

  console.log('📋 Multicurve Configuration:')
  console.log('  Token:', params.token.name, `(${params.token.symbol})`)
  console.log('  Curves:', params.pool.curves.length)
  console.log('  Beneficiaries:', params.pool.beneficiaries?.length)
  console.log('  Migration:', params.migration.type)

  // Simulate to preview addresses
  const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
  console.log('\n✅ Simulation successful')
  console.log('  Predicted token address:', asset)
  console.log('  Predicted pool address:', pool)

  // Encode params to verify NoOpMigrator is used
  const createParams = sdk.factory.encodeCreateMulticurveParams(params)
  console.log('\n🔍 Encoded Parameters:')
  console.log('  Liquidity Migrator:', createParams.liquidityMigrator)
  console.log('  Migration Data:', createParams.liquidityMigratorData)

  // Create the multicurve pool + token
  console.log('\n🚀 Creating multicurve auction with lockable beneficiaries...')
  const result = await sdk.factory.createMulticurve(params)
  console.log('✅ Multicurve created successfully!')
  console.log('  Token address:', result.tokenAddress)
  console.log('  Pool address:', result.poolAddress)
  console.log('  Transaction:', result.transactionHash)
  console.log('\n💡 Fee revenue will be distributed to the specified beneficiaries')
  console.log('   after liquidity is locked (no migration will occur).')
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
