import { DopplerSDK, StaticAuctionBuilder } from '../src'
import { parseEther, createPublicClient, createWalletClient, http } from 'viem'
import { base } from 'viem/chains'
// Using the builder pattern to construct params

// Example: Creating a static auction that migrates to Uniswap V4
async function createStaticAuctionExample() {
  // Create viem clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http()
  })
  
  const walletClient = createWalletClient({
    chain: base,
    transport: http(),
    // account: '0x...' // Your account
  })

  if (!publicClient || !walletClient) {
    throw new Error('Failed to create viem clients')
  }
  
  // Initialize the SDK
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: 8453, // Base mainnet
  })

  // Configure the static auction with the builder
  const params = new StaticAuctionBuilder()
    .tokenConfig({
      name: 'My Token',
      symbol: 'MTK',
      tokenURI: 'https://example.com/token-metadata.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('900000000'), // 900 million for sale
      numeraire: '0x4200000000000000000000000000000000000006', // WETH on Base
    })
    .poolByTicks({ startTick: 175000, endTick: 225000, fee: 3000 })
    .withVesting({ duration: BigInt(365 * 24 * 60 * 60), cliffDuration: 0 })
    .withMigration({
      type: 'uniswapV4',
      fee: 3000,
      tickSpacing: 60,
      streamableFees: {
        lockDuration: 365 * 24 * 60 * 60, // 1 year
        beneficiaries: [
          { address: '0xBeneficiary1...', percentage: 5000 }, // 50%
          { address: '0xBeneficiary2...', percentage: 3000 }, // 30%
          { address: '0xBeneficiary3...', percentage: 2000 }, // 20%
        ],
      },
    })
    .withUserAddress('0xYourAddress...')
    .build()

  // Create the static auction
  const result = await sdk.factory.createStaticAuction(params)
  
  console.log('Pool created:', result.poolAddress)
  console.log('Token created:', result.tokenAddress)
  console.log('Transaction:', result.transactionHash)
  
  // Later, interact with the auction
  const auction = await sdk.getStaticAuction(result.poolAddress)
  const hasGraduated = await auction.hasGraduated()
  
  if (hasGraduated) {
    console.log('Auction is ready for migration!')
  }
}

// Example: Creating a simple static auction that migrates to Uniswap V2
async function createSimpleStaticAuction() {
  // Create viem clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http()
  })
  
  const walletClient = createWalletClient({
    chain: base,
    transport: http(),
    // account: '0x...' // Your account
  })
  
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: 8453,
  })

  const params = new StaticAuctionBuilder()
    .tokenConfig({ name: 'Simple Token', symbol: 'SIMPLE', tokenURI: 'ipfs://...' })
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: '0x4200000000000000000000000000000000000006', // WETH
    })
    .poolByTicks({ startTick: 175000, endTick: 225000, fee: 10000 })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress('0xYourAddress...')
    .build()

  const result = await sdk.factory.createStaticAuction(params)
  console.log('Created:', result)
}
