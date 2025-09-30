/**
 * Example: Multicurve Auction with WETH Pre-Buy
 *
 * This example demonstrates:
 * - Creating a multicurve auction (multiple liquidity curves in V4)
 * - Pre-buying tokens using WETH (not ETH) in the same transaction
 * - Using Permit2 for gas-efficient token approvals
 * - Building Universal Router commands with doppler-router
 */

import { DopplerSDK, WAD, getAddresses } from '../src'
import { CommandBuilder, V4ActionBuilder, V4ActionType, getPermitSignature } from 'doppler-router'
import { createPublicClient, createWalletClient, http, parseEther, maxUint256 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = (process.env.RPC_URL || 'https://mainnet.base.org') as string

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

async function main() {
  // 1. Set up clients and SDK
  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: base, transport: http(rpcUrl), account })
  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: base.id })
  const addresses = getAddresses(base.id)

  console.log('🚀 Creating Multicurve Auction with WETH Pre-Buy')
  console.log('User address:', account.address)
  console.log('WETH address:', addresses.weth)
  console.log('Permit2 address:', addresses.permit2)
  console.log('Universal Router:', addresses.universalRouter)
  console.log()

  // 2. Build multicurve auction parameters
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
      numeraire: addresses.weth, // Using WETH as the trading pair
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
    .withUserAddress(account.address)
    .build()

  console.log('📋 Auction Parameters:')
  console.log('  Token:', params.token.name, `(${params.token.symbol})`)
  console.log('  Initial Supply:', params.sale.initialSupply / WAD, 'tokens')
  console.log('  For Sale:', params.sale.numTokensToSell / WAD, 'tokens')
  console.log('  Numeraire: WETH')
  console.log()

  // 3. Simulate create to get predicted addresses and pool key
  console.log('🔮 Simulating pool creation...')
  const { createParams, asset, pool, poolKey } = await sdk.factory.simulateCreateMulticurve(params)

  console.log('  Predicted token address:', asset)
  console.log('  Predicted pool address:', pool)
  console.log('  Pool key:', {
    currency0: poolKey.currency0,
    currency1: poolKey.currency1,
    fee: poolKey.fee,
    tickSpacing: poolKey.tickSpacing,
    hooks: poolKey.hooks,
  })
  console.log()

  // 4. Determine swap direction and quote WETH amount needed
  const zeroForOne = poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase()
  const exactAmountOut = params.sale.numTokensToSell / 100n // Buy 1% of tokens

  console.log('💱 Quoting WETH amount needed...')
  console.log('  Swap direction:', zeroForOne ? 'WETH → Token' : 'Token → WETH')
  console.log('  Tokens to buy:', exactAmountOut / WAD)

  const { amountIn, gasEstimate } = await sdk.factory.simulateMulticurveBundleExactOut(createParams, {
    exactAmountOut,
  })

  console.log('  WETH required:', amountIn)
  console.log('  Estimated gas:', gasEstimate.toString())
  console.log()

  // 5. Setup WETH approval to Permit2 (one-time setup)
  const weth = sdk.getDerc20(addresses.weth)
  const currentAllowance = await weth.getAllowance(account.address, addresses.permit2)

  console.log('🔐 Checking WETH approval to Permit2...')
  console.log('  Current allowance:', currentAllowance.toString())

  if (currentAllowance < amountIn) {
    console.log('  ⚠️  Insufficient allowance. Approving WETH to Permit2...')
    const approveTx = await weth.approve(addresses.permit2, maxUint256)
    console.log('  Approval tx:', approveTx)
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log('  ✅ Approved!')
  } else {
    console.log('  ✅ Sufficient allowance')
  }
  console.log()

  // 6. Get Permit2 signature for this specific swap
  console.log('✍️  Getting Permit2 signature...')
  const now = Math.floor(Date.now() / 1000)
  const permit = {
    details: {
      token: addresses.weth,
      amount: amountIn,
      expiration: BigInt(now + 3600), // 1 hour from now
      nonce: 0n, // Will be fetched by getPermitSignature
    },
    spender: addresses.universalRouter,
    sigDeadline: BigInt(now + 3600),
  }

  const signature = await getPermitSignature(
    permit,
    base.id,
    addresses.permit2,
    publicClient,
    walletClient
  )
  console.log('  Signature obtained:', signature.slice(0, 20) + '...')
  console.log()

  // 7. Build V4 swap actions
  console.log('🔧 Building V4 swap actions...')
  const actionBuilder = new V4ActionBuilder()

  // Add exact output swap
  actionBuilder.addSwapExactOutSingle(
    poolKey,
    zeroForOne,
    exactAmountOut,
    amountIn, // Maximum WETH we're willing to spend
    '0x' as `0x${string}` // No hook data
  )

  // Settle input currency (WETH)
  actionBuilder.addAction(V4ActionType.SETTLE_ALL, [
    zeroForOne ? poolKey.currency0 : poolKey.currency1,
    maxUint256,
  ])

  // Take output currency (new token)
  actionBuilder.addAction(V4ActionType.TAKE_ALL, [
    zeroForOne ? poolKey.currency1 : poolKey.currency0,
    0n,
  ])

  const [actions, actionParams] = actionBuilder.build()
  console.log('  Actions built:', actions)
  console.log()

  // 8. Build Universal Router commands
  console.log('📦 Building Universal Router commands...')
  const commandBuilder = new CommandBuilder()

  // Add Permit2 permit command
  commandBuilder.addPermit2Permit(permit, signature)

  // Add V4 swap command
  commandBuilder.addV4Swap(actions, actionParams)

  const [commands, inputs] = commandBuilder.build()
  console.log('  Commands:', commands)
  console.log('  Inputs count:', inputs.length)
  console.log()

  // 9. Execute the atomic bundle (create pool + pre-buy with WETH)
  console.log('⚡ Executing atomic bundle (create + pre-buy)...')
  console.log('  Note: Using WETH, so value = 0n (no ETH sent)')

  const txHash = await sdk.factory.bundle(createParams, commands, inputs, {
    value: 0n, // No ETH value since we're using WETH via Permit2
    gas: 18_000_000n, // Generous gas limit for complex transaction
  })

  console.log('  Transaction submitted:', txHash)
  console.log('  Waiting for confirmation...')

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  console.log()
  console.log('✅ Success!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Transaction:', receipt.transactionHash)
  console.log('Block:', receipt.blockNumber)
  console.log('Gas used:', receipt.gasUsed.toString())
  console.log()
  console.log('Token address:', asset)
  console.log('Pool address:', pool)
  console.log()
  console.log('WETH spent:', amountIn.toString())
  console.log('Tokens received:', (exactAmountOut / WAD).toString())
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()
  console.log('💡 What happened:')
  console.log('  1. Created multicurve auction with 2 curves')
  console.log('  2. Used Permit2 to allow Universal Router to pull WETH')
  console.log('  3. Executed V4 swap to buy tokens immediately')
  console.log('  4. All in ONE atomic transaction!')
  console.log()
  console.log('🎉 Auction is live and you already own tokens!')
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
