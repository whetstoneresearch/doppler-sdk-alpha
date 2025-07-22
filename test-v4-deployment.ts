import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { DopplerSDK } from './src/DopplerSDK'

// Test reproducing the V4 SDK deployment parameters
async function testV4Deployment() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`
  const account = privateKeyToAccount(privateKey)
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.RPC_URL),
  })
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.RPC_URL),
  })
  
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: sepolia.id,
  })
  
  // Create the exact same parameters as the V4 SDK example
  const params = {
    token: {
      name: "TestToken",
      symbol: "TEST",
      tokenURI: "https://example.com/token.json",
      yearlyMintRate: 0n,
    },
    sale: {
      initialSupply: parseEther("1000000"),
      numTokensToSell: parseEther("500000"),
      numeraire: "0x0000000000000000000000000000000000000000" as const, // ETH
    },
    auction: {
      duration: 7, // 7 days
      epochLength: 43200, // 12 hours (matching V4 SDK)
      startTick: -92203,
      endTick: -91003,
      gamma: 30, // Explicitly set the gamma value from V4 SDK
      minProceeds: parseEther("100"),
      maxProceeds: parseEther("1000"),
      numPdSlugs: 3,
    },
    pool: {
      fee: 3000,
      tickSpacing: 60,
    },
    migration: {
      type: 'uniswapV2' as const,
    },
    integrator: "0x0000000000000000000000000000000000000000" as const, // Use ZERO_ADDRESS like V4 SDK
    userAddress: account.address,
  }
  
  console.log('Creating dynamic auction with V4 SDK parameters...')
  console.log('Parameters:', JSON.stringify(params, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2))
  
  try {
    const result = await sdk.factory.createDynamicAuction(params)
    console.log('Success!', result)
  } catch (error) {
    console.error('Error:', error)
  }
}

testV4Deployment()