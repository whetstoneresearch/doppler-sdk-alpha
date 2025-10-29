/**
 * Example: Multicurve Quote & Swap
 *
 * This example demonstrates:
 * - Creating a multicurve auction with market cap presets
 * - Quoting a swap on the V4 pool using the SDK quoter
 * - Executing the swap via Universal Router
 */

import { DopplerSDK, WAD, getAddresses, FEE_TIERS } from '../src'
import { CommandBuilder, V4ActionBuilder, V4ActionType } from 'doppler-router'
import { createPublicClient, createWalletClient, http, parseEther, maxUint256, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = (process.env.RPC_URL || 'https://mainnet.base.org') as string

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

// Minimal Universal Router ABI
const universalRouterAbi = [
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'commands', type: 'bytes', internalType: 'bytes' },
      { name: 'inputs', type: 'bytes[]', internalType: 'bytes[]' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

async function main() {
  // 1. Set up clients and SDK
  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: base, transport: http(rpcUrl), account })
  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: base.id })
  const addresses = getAddresses(base.id)

  console.log('🎯 Multicurve Quote & Swap Example')
  console.log('User address:', account.address)
  console.log('WETH address:', addresses.weth)
  console.log('Universal Router:', addresses.universalRouter)
  console.log()

  // 2. Create a multicurve auction with market cap presets
  console.log('📦 Creating Multicurve Auction...')
  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: 'Quote & Swap Test',
      symbol: 'QSWAP',
      tokenURI: 'ipfs://test-quote-swap',
    })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: addresses.weth,
    })
    .withMarketCapPresets({
      fee: FEE_TIERS.LOW, // 0.05% fee tier
      presets: ['low', 'medium', 'high'],
    })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(account.address)
    .build()

  console.log('  Token:', params.token.name, `(${params.token.symbol})`)
  console.log('  Initial Supply:', formatEther(params.sale.initialSupply), 'tokens')
  console.log('  For Sale:', formatEther(params.sale.numTokensToSell), 'tokens')
  console.log()

  // 3. Create the pool
  console.log('🔨 Creating pool...')
  const { poolAddress, tokenAddress, transactionHash } = await sdk.factory.createMulticurve(params)

  console.log('  ✅ Pool created!')
  console.log('  Transaction:', transactionHash)
  console.log('  Token address:', tokenAddress)
  console.log('  Pool address:', poolAddress)
  console.log()

  // Wait for transaction to be mined
  await publicClient.waitForTransactionReceipt({ hash: transactionHash })

  // 4. Get pool state to build PoolKey
  console.log('🔍 Fetching pool state...')
  const multicurvePool = await sdk.getMulticurvePool(tokenAddress)
  const poolState = await multicurvePool.getState()

  const poolKey = {
    currency0: poolState.poolKey.currency0,
    currency1: poolState.poolKey.currency1,
    fee: poolState.fee,
    tickSpacing: poolState.tickSpacing,
    hooks: poolState.poolKey.hooks,
  }

  console.log('  PoolKey:', {
    currency0: poolKey.currency0,
    currency1: poolKey.currency1,
    fee: poolKey.fee,
    tickSpacing: poolKey.tickSpacing,
    hooks: poolKey.hooks,
  })
  console.log()

  // 5. Determine swap direction
  const zeroForOne = poolKey.currency0.toLowerCase() === addresses.weth.toLowerCase()
  const amountIn = parseEther('0.01') // Swap 0.01 ETH/WETH

  console.log('💱 Quoting swap...')
  console.log('  Direction:', zeroForOne ? 'WETH → Token' : 'Token → WETH')
  console.log('  Amount in:', formatEther(amountIn), 'ETH')

  // 6. Get quote using SDK quoter
  const quoter = sdk.quoter
  const quote = await quoter.quoteExactInputV4({
    poolKey,
    zeroForOne,
    exactAmount: amountIn,
    hookData: '0x' as `0x${string}`,
  })

  console.log('  Amount out:', formatEther(quote.amountOut), 'tokens (estimated)')
  console.log('  Gas estimate:', quote.gasEstimate.toString())
  console.log()

  // 7. Build V4 swap actions
  console.log('🔧 Building swap transaction...')
  const minAmountOut = (quote.amountOut * 95n) / 100n // 5% slippage tolerance

  const actionBuilder = new V4ActionBuilder()
  actionBuilder.addSwapExactInSingle(
    poolKey,
    zeroForOne,
    amountIn,
    minAmountOut,
    '0x' as `0x${string}` // No hook data
  )

  // Settle input currency
  actionBuilder.addAction(V4ActionType.SETTLE_ALL, [
    zeroForOne ? poolKey.currency0 : poolKey.currency1,
    maxUint256,
  ])

  // Take output currency
  actionBuilder.addAction(V4ActionType.TAKE_ALL, [
    zeroForOne ? poolKey.currency1 : poolKey.currency0,
    0n,
  ])

  const [actions, actionParams] = actionBuilder.build()

  // 8. Build Universal Router commands
  const commandBuilder = new CommandBuilder()
  commandBuilder.addV4Swap(actions, actionParams)
  const [commands, inputs] = commandBuilder.build()

  console.log('  Built', inputs.length, 'command(s)')
  console.log()

  // 9. Execute swap
  console.log('⚡ Executing swap...')
  const swapTxHash = await walletClient.writeContract({
    address: addresses.universalRouter,
    abi: universalRouterAbi,
    functionName: 'execute',
    args: [commands, inputs],
    value: zeroForOne ? amountIn : 0n, // Send ETH if swapping from native currency
  })

  console.log('  Transaction submitted:', swapTxHash)
  console.log('  Waiting for confirmation...')

  const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTxHash })

  console.log()
  console.log('✅ Swap completed!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Transaction:', swapReceipt.transactionHash)
  console.log('Block:', swapReceipt.blockNumber)
  console.log('Gas used:', swapReceipt.gasUsed.toString())
  console.log()
  console.log('Swapped:', formatEther(amountIn), 'ETH')
  console.log('Received (estimated):', formatEther(quote.amountOut), 'tokens')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()
  console.log('💡 What happened:')
  console.log('  1. Created multicurve auction with market cap presets')
  console.log('  2. Got quote from V4 pool using SDK quoter')
  console.log('  3. Built Universal Router commands for V4 swap')
  console.log('  4. Executed swap and received tokens')
  console.log()
  console.log('🎉 Complete!')
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
