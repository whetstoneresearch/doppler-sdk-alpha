/**
 * Example: Collect Fees from a Multicurve Auction Pool
 *
 * This example demonstrates:
 * - Getting a MulticurvePool instance from the SDK using the asset address
 * - Checking pool state and configuration
 * - Collecting and distributing fees to beneficiaries
 * - Understanding the fee distribution mechanism
 * - How the SDK computes the PoolId from the PoolKey
 *
 * Prerequisites:
 * - A multicurve pool with lockable beneficiaries already created
 * - Trading activity on the pool to generate fees (pool must have fee tier > 0)
 * - Pool must be in "Locked" status (status = 2)
 *
 * Important Technical Details:
 * - The SDK uses the asset address to look up pool configuration
 * - Internally, it computes the PoolId as keccak256(abi.encode(poolKey))
 * - The PoolKey contains: currency0, currency1, fee, tickSpacing, hooks
 * - Anyone can call collectFees(), but only configured beneficiaries receive distributions
 * - Fees are split proportionally according to beneficiary shares configured at pool creation
 *
 * Note: This example requires an existing multicurve pool asset address (token address).
 * See multicurve-lockable-beneficiaries.ts for creating a pool with fee streaming.
 */

import { DopplerSDK, WAD } from '../src'
import { createPublicClient, createWalletClient, http, type Address, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = (process.env.RPC_URL || 'https://mainnet.base.org') as string

// REPLACE with your actual multicurve pool ASSET address (the token address)
// This is the address returned from creating the multicurve auction
const ASSET_ADDRESS = process.env.ASSET_ADDRESS as Address

if (!privateKey) throw new Error('PRIVATE_KEY is not set')
if (!ASSET_ADDRESS) throw new Error('ASSET_ADDRESS is not set. Run multicurve-lockable-beneficiaries.ts first.')

async function main() {
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: base, transport: http(rpcUrl), account })

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: base.id })

  console.log('🔍 Fetching pool information...')
  console.log('   Asset address (token):', ASSET_ADDRESS)
  console.log('   Caller:', account.address)
  console.log()

  // Get the multicurve pool instance using the asset address
  // The SDK will use this to look up pool state and compute the PoolId
  const pool = await sdk.getMulticurvePool(ASSET_ADDRESS)

  // Fetch pool state
  const state = await pool.getState()
  console.log('📊 Pool State:')
  console.log('   Asset (token):', state.asset)
  console.log('   Numeraire:', state.numeraire)
  console.log('   Fee tier:', state.fee)
  console.log('   Tick spacing:', state.tickSpacing)
  console.log('   Tokens on curve:', formatUnits(state.totalTokensOnBondingCurve, 18))
  console.log('   Status:', state.status)
  console.log()

  // Get token information
  const tokenAddress = await pool.getTokenAddress()
  const numeraireAddress = await pool.getNumeraireAddress()
  console.log('🪙 Token Addresses:')
  console.log('   Token:', tokenAddress)
  console.log('   Numeraire:', numeraireAddress)
  console.log()

  // Check if there are fees to collect
  // Note: The actual fee amounts aren't available until we call collectFees
  // In a real scenario, you might want to:
  // 1. Query pool swap events to estimate fees
  // 2. Check beneficiary balances before/after
  // 3. Monitor pool activity and collect periodically

  console.log('💰 Collecting fees from the pool...')
  console.log()
  console.log('How it works:')
  console.log('   1. SDK retrieves pool configuration (asset, numeraire, fee, tickSpacing)')
  console.log('   2. SDK queries the hook address from the multicurve initializer')
  console.log('   3. SDK constructs the PoolKey: {currency0, currency1, fee, tickSpacing, hooks}')
  console.log('   4. SDK computes PoolId = keccak256(abi.encode(poolKey))')
  console.log('   5. SDK calls collectFees(poolId) on the contract')
  console.log('   6. Contract collects fees and distributes to all beneficiaries proportionally')
  console.log()

  try {
    // Collect fees - this will revert if there are no fees to collect
    const { fees0, fees1, transactionHash } = await pool.collectFees()

    console.log('✅ Fees collected successfully!')
    console.log()
    console.log('📈 Fee Distribution:')
    console.log('   Fees (token0):', formatUnits(fees0, 18))
    console.log('   Fees (token1):', formatUnits(fees1, 18))
    console.log('   Transaction:', transactionHash)
    console.log()

    // Determine which token is which
    // In Uniswap V4, token0 < token1 by address
    const isToken0Asset = tokenAddress.toLowerCase() < numeraireAddress.toLowerCase()

    console.log('🎯 Token Breakdown:')
    if (isToken0Asset) {
      console.log('   Asset (token0) fees:', formatUnits(fees0, 18))
      console.log('   Numeraire (token1) fees:', formatUnits(fees1, 18))
    } else {
      console.log('   Numeraire (token0) fees:', formatUnits(fees0, 18))
      console.log('   Asset (token1) fees:', formatUnits(fees1, 18))
    }
    console.log()

    console.log('💡 Important Points:')
    console.log('   - Fees have been distributed to beneficiaries according to their shares')
    console.log('   - Anyone can call collectFees() - not just beneficiaries')
    console.log('   - Only configured beneficiaries receive fee distributions')
    console.log('   - Beneficiaries are set at pool creation and cannot be changed')
    console.log('   - Call collectFees() again after more trading activity to collect new fees')
    console.log('   - Pool must have a non-zero fee tier for fees to accumulate')
    console.log('   - Pool must be in "Locked" status (status = 2) for fee collection to work')

  } catch (error: any) {
    if (error.message?.includes('No fees to collect') || error.message?.includes('revert')) {
      console.log('ℹ️  No fees available to collect at this time.')
      console.log()
      console.log('📝 This could mean:')
      console.log('   - The pool has not had any swap activity yet')
      console.log('   - Fees were already collected recently')
      console.log('   - The pool fee tier is 0 (no fees charged)')
      console.log()
      console.log('💡 To generate fees:')
      console.log('   - Execute swaps on the pool (buy/sell the token)')
      console.log('   - Wait for other users to trade')
      console.log('   - Check that the pool has a non-zero fee tier')
    } else {
      console.error('❌ Error collecting fees:', error.message)
      throw error
    }
  }
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
