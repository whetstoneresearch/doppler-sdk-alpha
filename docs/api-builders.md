# Builder API Reference

This document specifies the fluent builder APIs used to create Doppler auctions. Builders assemble type‑safe parameter objects for `DopplerFactory.createStaticAuction`, `DopplerFactory.createDynamicAuction`, and `DopplerFactory.createMulticurve`, applying sensible defaults and computing derived values (ticks, gamma) where helpful.

- Static auctions: Uniswap V3 style, fixed price range liquidity bootstrapping
- Dynamic auctions: Uniswap V4 hook, dynamic Dutch auction with epoch steps
- Multicurve auctions: Uniswap V4 initializer with multiple curves

All types referenced are exported from `src/types.ts`.

## Common Concepts

- Token specification:
  - `standard` (default): DERC20 with optional vesting and yearly mint rate
- Governance is required:
  - Call `withGovernance(...)` in all cases.
  - `withGovernance()` with no arguments applies standard governance defaults.
  - `withGovernance({ noOp: true })` explicitly selects no‑op governance (requires chain support).
  - Or provide `initialVotingDelay`, `initialVotingPeriod`, and `initialProposalThreshold`, or `withGovernance({ useDefaults: true })`.
- Fee tiers and tick spacing: 100→1, 500→10, 3000→60, 10000→200

Price → Ticks conversion used by builders:
```
startTick = floor(log(startPrice)/log(1.0001)/tickSpacing) * tickSpacing
endTick   =  ceil(log(endPrice) /log(1.0001)/tickSpacing) * tickSpacing
```

---

## StaticAuctionBuilder (V3‑style)

Recommended for fixed price range launches with Uniswap V3.

Methods (chainable):

- tokenConfig(params)
  - Standard: `{ name, symbol, tokenURI, yearlyMintRate? }`
    - Defaults: `yearlyMintRate = DEFAULT_V3_YEARLY_MINT_RATE (0.02e18)`
- saleConfig({ initialSupply, numTokensToSell, numeraire })
- Price specification methods (use one or the other, not both)
  - poolByTicks({ startTick?, endTick?, fee?, numPositions?, maxShareToBeSold? })
    - Defaults: `fee = DEFAULT_V3_FEE (10000)`, `startTick = DEFAULT_V3_START_TICK`, `endTick = DEFAULT_V3_END_TICK`, `numPositions = DEFAULT_V3_NUM_POSITIONS`, `maxShareToBeSold = DEFAULT_V3_MAX_SHARE_TO_BE_SOLD`
  - poolByPriceRange({ priceRange, fee?, numPositions?, maxShareToBeSold? })
    - Computes ticks from `priceRange` using inferred `tickSpacing` from `fee`
- withVesting({ duration?, cliffDuration?, recipients?, amounts? } | undefined)
  - Omit to disable vesting. Default duration if provided but undefined is `DEFAULT_V3_VESTING_DURATION`.
  - `recipients`: Optional array of addresses to receive vested tokens. Defaults to `[userAddress]` if not provided.
  - `amounts`: Optional array of token amounts corresponding to each recipient. Must match `recipients` length if provided. Defaults to all unsold tokens to `userAddress` if not provided.
- withGovernance(GovernanceConfig | { useDefaults: true } | { noOp: true } | undefined)
- withMigration(MigrationConfig)
- withUserAddress(address)
- withIntegrator(address?)
  - Defaults to zero address if omitted
- Address overrides (optional):
  - withAirlock(address)
  - withTokenFactory(address)
  - withV3Initializer(address)
  - withGovernanceFactory(address) — used for both standard and no‑op governance
  - withV2Migrator(address)
  - withV3Migrator(address)
  - withV4Migrator(address)
  - build(): CreateStaticAuctionParams
  - Throws if required sections are missing

Validation highlights:
- token name/symbol non‑empty
- `startTick < endTick`
- `initialSupply > 0`, `numTokensToSell > 0`, and `numTokensToSell <= initialSupply`
- If vesting set, there must be tokens reserved (`initialSupply - numTokensToSell > 0`)
- For V4 migration config (if chosen), beneficiary percentages must sum to 10000

Examples:
```ts
// Example 1: Single vesting beneficiary (default behavior)
const params = new StaticAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1_000_000_000'), numTokensToSell: parseEther('900_000_000'), numeraire: weth })
  .poolByPriceRange({ priceRange: { startPrice: 0.0001, endPrice: 0.001 }, fee: 3000 })
  .withVesting({ duration: BigInt(365*24*60*60) }) // All unsold tokens vest to userAddress
  .withGovernance() // required; no args → standard governance defaults
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build()

// Example 2: Multiple vesting beneficiaries
const paramsMultiVest = new StaticAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1_000_000_000'), numTokensToSell: parseEther('900_000_000'), numeraire: weth })
  .poolByPriceRange({ priceRange: { startPrice: 0.0001, endPrice: 0.001 }, fee: 3000 })
  .withVesting({
    duration: BigInt(365*24*60*60),
    cliffDuration: 0,
    recipients: ['0xTeam...', '0xAdvisor...', '0xTreasury...'],
    amounts: [parseEther('30_000_000'), parseEther('20_000_000'), parseEther('50_000_000')] // Total: 100M of 100M unsold
  })
  .withGovernance()
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build()
```

---

## DynamicAuctionBuilder (V4‑style)

Recommended for Dutch auctions where price moves over epochs using Uniswap V4 hooks.

Methods (chainable):

- tokenConfig(params)
  - Standard: `{ name, symbol, tokenURI, yearlyMintRate? }`
    - Defaults: `yearlyMintRate = DEFAULT_V4_YEARLY_MINT_RATE (0.02e18)`
- saleConfig({ initialSupply, numTokensToSell, numeraire? })
  - Defaults: `numeraire = ZERO_ADDRESS` (token is paired against ETH)
- poolConfig({ fee, tickSpacing })
- Price configuration methods (use one or the other, not both)
  - auctionByTicks({ startTick, endTick, minProceeds, maxProceeds, duration?, epochLength?, gamma?, numPdSlugs? })
    - Defaults: `duration = DEFAULT_AUCTION_DURATION (604800)`, `epochLength = DEFAULT_EPOCH_LENGTH (43200)`, `numPdSlugs` optional
    - If `gamma` omitted, computed from ticks, duration, epoch length, and `tickSpacing`
  - auctionByPriceRange({ priceRange, minProceeds, maxProceeds, duration?, epochLength?, gamma?, tickSpacing?, numPdSlugs? })
    - Uses `pool.tickSpacing` unless `tickSpacing` is provided here
- withVesting({ duration?, cliffDuration?, recipients?, amounts? } | undefined)
  - Omit to disable vesting. Default duration if provided but undefined is `0` for dynamic auctions.
  - `recipients`: Optional array of addresses to receive vested tokens. Defaults to `[userAddress]` if not provided.
  - `amounts`: Optional array of token amounts corresponding to each recipient. Must match `recipients` length if provided. Defaults to all unsold tokens to `userAddress` if not provided.
- withGovernance(GovernanceConfig | { useDefaults: true } | { noOp: true } | undefined)
  - Call is required; `withGovernance()` applies standard defaults; `{ useDefaults: true }` also applies defaults; `{ noOp: true }` explicitly selects no‑op.
- withMigration(MigrationConfig)
- withUserAddress(address)
- withIntegrator(address?)
- withTime({ startTimeOffset?, blockTimestamp? } | undefined)
  - Controls auction time reference; if omitted, factory fetches latest block timestamp and uses 30s offset
- Address overrides (optional):
  - withAirlock(address)
  - withTokenFactory(address)
  - withV4Initializer(address)
  - withPoolManager(address)
  - withDopplerDeployer(address)
  - withGovernanceFactory(address) — used for both standard and no‑op governance
  - withV2Migrator(address)
  - withV3Migrator(address)
  - withV4Migrator(address)
- build(): CreateDynamicAuctionParams
  - Ensures `gamma` finalized, fills defaults, and throws if required sections are missing

Validation highlights:
- token name/symbol non‑empty
- `startTick < endTick`
- `initialSupply > 0`, `numTokensToSell > 0`, and `numTokensToSell <= initialSupply`
- `duration > 0`, `epochLength > 0`, and `duration` divisible by `epochLength`
- `tickSpacing > 0`; if `gamma` provided, it must be a multiple of `tickSpacing`
- For V4 migration config (if chosen), beneficiary percentages must sum to 10000

Examples:
```ts
const params = new DynamicAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1_000_000'), numTokensToSell: parseEther('900_000'), numeraire: weth })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByPriceRange({ priceRange: { startPrice: 0.0001, endPrice: 0.001 }, minProceeds: parseEther('100'), maxProceeds: parseEther('1000') })
  .withGovernance({ useDefaults: true })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build()
```

---

## MulticurveBuilder (V4 Multicurve Initializer)

Recommended when you want to seed a Uniswap V4 pool with multiple curves in a single initializer call. This supports richer liquidity distributions and works with any migration type (V2, V3, or V4).

Methods (chainable):

- tokenConfig(params)
  - Standard: `{ name, symbol, tokenURI, yearlyMintRate? }`
    - Defaults: `yearlyMintRate = DEFAULT_V4_YEARLY_MINT_RATE (0.02e18)`
- saleConfig({ initialSupply, numTokensToSell, numeraire })
- poolConfig({ fee, tickSpacing, curves, lockableBeneficiaries? })
  - Or use the alias `.withMulticurveAuction({...})`
  - `curves`: Array of `{ tickLower, tickUpper, numPositions, shares }` where `shares` are WAD-based weights
  - `lockableBeneficiaries` (optional): share-based beneficiaries for fee locking at initialization
- withMarketCapPresets(params?)
  - Convenience wrapper that assembles `curves` using curated market cap tiers (`'low' | 'medium' | 'high'`)
  - Defaults: `fee = FEE_TIERS.LOW (500)`, `tickSpacing` inferred, and all three presets selected
  - `overrides` (per preset) let you tweak ticks, numPositions, or shares while preserving tier ordering
  - Automatically appends a filler curve when the selected presets sum to < 100%, keeping total shares at exactly 1e18
- withVesting({ duration?, cliffDuration?, recipients?, amounts? } | undefined)
  - `recipients`: Optional array of addresses to receive vested tokens. Defaults to `[userAddress]` if not provided.
  - `amounts`: Optional array of token amounts corresponding to each recipient. Must match `recipients` length if provided. Defaults to all unsold tokens to `userAddress` if not provided.
- withGovernance(GovernanceConfig)
  - Call is required; use `{ type: 'default' }`, `{ type: 'custom', ... }`, or `{ type: 'noOp' }` where supported
- withMigration(MigrationConfig)
  - Supports `uniswapV2`, `uniswapV3`, or `uniswapV4`
- withUserAddress(address)
- withIntegrator(address?)
- Address overrides (optional):
  - withAirlock(address)
  - withTokenFactory(address)
  - withV4MulticurveInitializer(address)
  - withGovernanceFactory(address)
  - withV2Migrator(address)
  - withV3Migrator(address)
  - withV4Migrator(address)
- build(): CreateMulticurveParams

Validation highlights:
- At least one curve required
- `initialSupply > 0`, `numTokensToSell > 0`, and `numTokensToSell <= initialSupply`
- Governance selection is required
- SDK sorts beneficiaries by address as required on-chain when encoding

Example:
```ts
import { MulticurveBuilder } from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'

const params = new MulticurveBuilder(chainId)
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1_000_000'), numTokensToSell: parseEther('900_000'), numeraire: weth })
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

const { poolAddress, tokenAddress } = await sdk.factory.createMulticurve(params)
```

Preset helper usage:
```ts
import { MulticurveBuilder, FEE_TIERS } from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'

const presetParams = new MulticurveBuilder(chainId)
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1_000_000'), numTokensToSell: parseEther('900_000'), numeraire: weth })
  .withMarketCapPresets({
    fee: FEE_TIERS.LOW,
    presets: ['low', 'medium', 'high'], // default ordering; select a subset if needed
    // overrides: { high: { shares: parseEther('0.25') } }, // adjust individual tiers
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build()
```

Preset tiers map to approximate market cap bands (assuming ~1B supply, $4,500 reference numeraire):
- `low`: 5% allocation targeting $7.5k-$30k launches
- `medium`: 12.5% allocation targeting $50k-$150k
- `high`: 20% allocation targeting $250k-$750k

All presets use the curated tick ranges from `DEFAULT_MULTICURVE_*` constants. Shares are represented in WAD (1e18 = 100%); if you override shares, ensure they remain within bounds or the builder will throw.

---

## Build Results

- Static: `CreateStaticAuctionParams` with fields: `token`, `sale`, `pool`, optional `vesting`, `governance`, `migration`, `integrator`, `userAddress`
- Dynamic: `CreateDynamicAuctionParams` with fields: `token`, `sale`, `auction`, `pool`, optional `vesting`, `governance`, `migration`, `integrator`, `userAddress`, optional `startTimeOffset`, optional `blockTimestamp`
- Multicurve: `CreateMulticurveParams` with fields: `token`, `sale`, `pool` (with `curves`), optional `vesting`, `governance`, `migration`, `integrator`, `userAddress`

Pass the built object directly to the factory:
```ts
const { poolAddress, tokenAddress } = await sdk.factory.createStaticAuction(staticParams)
const { hookAddress, tokenAddress: token2, poolId } = await sdk.factory.createDynamicAuction(dynamicParams)
const { poolAddress: pool3, tokenAddress: token3 } = await sdk.factory.createMulticurve(multicurveParams)
```

Notes:
- For doppler404 tokens, ensure `doppler404Factory` is configured on your target chain (see `src/addresses.ts`).
- Doppler404 tokenConfig supports optional `unit?: bigint` which defaults to `1000` when omitted.
- `integrator` defaults to zero address when omitted.
- `withTime` is only relevant to dynamic auctions.
