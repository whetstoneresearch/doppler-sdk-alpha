# Using Builders + Encode to produce CreateParams

This gist shows how to use the new builder methods to override module addresses and how to call the encode helpers to obtain `CreateParams` objects for both static (V3) and dynamic (V4) auctions. These `CreateParams` match what the old v3/v4 SDKs returned from their respective `encode*` functions.

```ts
import { DopplerSDK, StaticAuctionBuilder, DynamicAuctionBuilder, MulticurveBuilder } from '@whetstone-research/doppler-sdk'
import { createPublicClient, http, parseEther } from 'viem'
import { base } from 'viem/chains'

// Minimal client + SDK
const publicClient = createPublicClient({ chain: base, transport: http() })
const sdk = new DopplerSDK({ publicClient, chainId: base.id })

// Example addresses (replace with real ones for your chain)
const user = '0x0000000000000000000000000000000000000001' as const
const weth = '0x4200000000000000000000000000000000000006' as const

// --- Static (V3-style) ---
const staticParams = new StaticAuctionBuilder(base.id)
  .tokenConfig({ name: 'MyToken', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1000000000'), numTokensToSell: parseEther('900000000'), numeraire: weth })
  .poolByPriceRange({ priceRange: { startPrice: 0.0001, endPrice: 0.001 }, fee: 3000 })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  // Optional: override modules
  .withAirlock('0xAirlock...')
  .withTokenFactory('0xTokenFactory...')
  .withV3Initializer('0xV3Initializer...')
  .withGovernanceFactory('0xGovFactory...')
  .withV2Migrator('0xV2Migrator...')
  .build()

// Encode to CreateParams (matches old v3 SDK encode return shape)
const staticCreateParams = await sdk.factory.encodeCreateStaticAuctionParams(staticParams)
console.log('Static CreateParams:', staticCreateParams)

// --- Dynamic (V4-style) ---
const dynamicParams = new DynamicAuctionBuilder(base.id)
  .tokenConfig({ name: 'MyToken', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: weth })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByPriceRange({ priceRange: { startPrice: 0.0001, endPrice: 0.001 }, minProceeds: parseEther('100'), maxProceeds: parseEther('1000') })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  // Optional: override modules
  .withAirlock('0xAirlock...')
  .withPoolManager('0xPoolManager...')
  .withDopplerDeployer('0xDeployer...')
  .withTokenFactory('0xTokenFactory...')
  .withV4Initializer('0xV4Initializer...')
  .withGovernanceFactory('0xGovFactory...')
  .withV3Migrator('0xV3Migrator...')
  .build()

// Encode to CreateParams (matches old v4 SDK encode return shape)
const { createParams: dynamicCreateParams, hookAddress, tokenAddress } = await sdk.factory.encodeCreateDynamicAuctionParams(dynamicParams)
console.log('Dynamic CreateParams:', dynamicCreateParams)
console.log('Expected Hook Address:', hookAddress)
console.log('Expected Token Address:', tokenAddress)

// --- Multicurve (V4 initializer with multiple curves) ---
const multicurveParams = new MulticurveBuilder(base.id)
  .tokenConfig({ name: 'MyToken', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: weth })
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
  .withUserAddress(user)
  .build()

// Encode to CreateParams for multicurve
const multicurveCreateParams = sdk.factory.encodeCreateMulticurveParams(multicurveParams)
console.log('Multicurve CreateParams:', multicurveCreateParams)
```

Notes
- Builder overrides are optional; if omitted, chain defaults are used.
- `CreateParams` produced here match the structures returned by the legacy `encode*` helpers in the old v3 and v4 SDKs.
