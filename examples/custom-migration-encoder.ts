import { createPublicClient, createWalletClient, http, encodeAbiParameters } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import {
  DopplerSDK,
  DopplerFactory,
  type MigrationEncoder,
  type MigrationConfig
} from '../src'

/**
 * Example: Using a custom migration encoder with DopplerFactory
 *
 * This example shows how to provide a custom migration data encoder
 * using the fluent .withCustomMigrationEncoder() method. The custom
 * encoder can handle specialized migration logic beyond the default
 * V2/V3/V4 migrations.
 */

// Create a custom migration encoder
const customMigrationEncoder: MigrationEncoder = (config: MigrationConfig) => {
  switch (config.type) {
    case 'uniswapV2':
      // Custom V2 encoding - perhaps with additional metadata
      console.log('Custom V2 encoding with additional metadata')
      return encodeAbiParameters(
        [{ type: 'string' }],
        ['custom-v2-metadata']
      )

    case 'uniswapV3':
      // Custom V3 encoding - perhaps with different parameter ordering
      console.log('Custom V3 encoding with extended parameters')
      return encodeAbiParameters(
        [
          { type: 'uint24' }, // fee
          { type: 'int24' },  // tickSpacing
          { type: 'bool' }    // additional custom flag
        ],
        [config.fee, config.tickSpacing, true]
      )

    case 'uniswapV4':
      // Custom V4 encoding - perhaps with different beneficiary format
      console.log('Custom V4 encoding with specialized beneficiary handling')

      // Custom logic here - this is just an example
      const customData = encodeAbiParameters(
        [
          { type: 'uint24' },
          { type: 'int24' },
          { type: 'string' }
        ],
        [config.fee, config.tickSpacing, 'custom-v4-migration']
      )

      return customData

    default:
      throw new Error(`Unsupported migration type: ${(config as any).type}`)
  }
}

async function main() {
  // Setup clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http()
  })

  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http()
  })

  // Create SDK
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: base.id
  })

  // Set custom migration encoder on the factory using fluent API
  sdk.factory.withCustomMigrationEncoder(customMigrationEncoder)

  // Example: Create auction params manually to demonstrate custom encoder
  const createParams = {
    token: {
      name: 'Custom Token',
      symbol: 'CUSTOM',
      tokenURI: 'https://example.com/token.json'
    },
    sale: {
      initialSupply: BigInt('1000000000000000000000000000'),
      numTokensToSell: BigInt('900000000000000000000000000'),
      numeraire: '0x4200000000000000000000000000000000000006' // WETH on Base
    },
    pool: {
      startTick: -276320,
      endTick: -276300,
      fee: 10000
    },
    governance: { type: 'default' as const },
    migration: {
      type: 'uniswapV3' as const,
      fee: 3000,
      tickSpacing: 60
    },
    userAddress: account.address
  }

  // The factory will now use your custom encoder for migration data
  const encodedParams = sdk.factory.encodeCreateStaticAuctionParams(createParams)
  console.log('Migration data encoded with custom encoder:', encodedParams.liquidityMigratorData)

  console.log('SDK factory configured with custom migration encoder!')
}

// Example of a factory-only approach (without SDK)
function factoryOnlyExample() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http()
  })

  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http()
  })

  // Create factory directly and configure with fluent API (method chaining)
  const factory = new DopplerFactory(publicClient, walletClient, base.id)
    .withCustomMigrationEncoder(customMigrationEncoder)

  console.log('DopplerFactory created with custom migration encoder!')
  return factory
}

if (require.main === module) {
  main().catch(console.error)
}

export { customMigrationEncoder, main, factoryOnlyExample }