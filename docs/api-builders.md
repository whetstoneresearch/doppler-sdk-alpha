# Builder API Reference

This document specifies the fluent builder APIs used to create Doppler auctions. Builders assemble type‑safe parameter objects for `DopplerFactory.createStaticAuction`, `DopplerFactory.createDynamicAuction`, and `DopplerFactory.createMulticurve`, applying sensible defaults and computing derived values (ticks, gamma) where helpful.

- Static auctions: Uniswap V3 style, fixed price range liquidity bootstrapping
- Dynamic auctions: Uniswap V4 hook, dynamic Dutch auction with epoch steps
- Multicurve auctions: Uniswap V4 initializer with multiple curves

All types referenced are exported from `src/types.ts`.

## Common Concepts

- Token specification:
  - `dopplerERC20V1` (default): DopplerERC20V1 template with schedule vesting and balance-limit settings; selected when `type` is omitted or explicitly set to `'dopplerERC20V1'`
  - `standard`: legacy DERC20 factory path with optional vesting and yearly mint rate; requires explicit `type: 'standard'`
- Governance is required:
  - Call `withGovernance(...)` in all cases.
  - Use `withGovernance({ type: 'default' })` for standard governance defaults.
  - Use `withGovernance({ type: 'noOp' })` where the chain supports no-op governance.
  - Use `withGovernance({ type: 'launchpad', multisig })` on launchpad-enabled chains.
  - Or provide `withGovernance({ type: 'custom', initialVotingDelay, initialVotingPeriod, initialProposalThreshold })`. Current timestamp-clock deployments interpret delay and period as seconds; defaults are 1 day and 7 days. Legacy `type: 'standard'` tokens use equivalent nominal block counts for the chain, including DERC20 V2 vesting. Custom values are not converted; see [Governance Selection](./migration-options.md#governance-selection) for clock assumptions.
- Fee tiers and tick spacing: 100→1, 500→10, 3000→60, 10000→200
- DopplerHook compatibility:
  - Migration config should use `DopplerHookMigratorConfig` with `type: 'dopplerHookMigrator'`; the deprecated `DopplerHookMigrationConfig` and `type: 'dopplerHook'` remain accepted.
  - Multicurve initializer params should use `type: 'dopplerHookInitializer'`; the deprecated initializer discriminator `type: 'dopplerHook'` remains accepted.

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
  - Standard: `{ type: 'standard', name, symbol, tokenURI, yearlyMintRate? }`
    - Legacy opt-in. Defaults: `yearlyMintRate = DEFAULT_V3_YEARLY_MINT_RATE (0.02e18)`
  - DopplerERC20V1: `{ type?: 'dopplerERC20V1', name, symbol, tokenURI, maxBalanceLimit?, balanceLimitEnd?, controller?, excludedFromBalanceLimit? }`
    - Default when `type` is omitted or explicitly set to `dopplerERC20V1`. Uses `dopplerERC20V1Factory`; `withTokenFactory(address)` takes precedence but must point to a compatible factory. DopplerERC20V1 does not encode `yearlyMintRate`; `controller` defaults to the zero address.
    - `excludedFromBalanceLimit` is encoded only at deployment. The SDK adds user-supplied exclusions and, only with the default DopplerERC20V1 integration, deterministic protocol recipients for the selected auction path. When `withTokenFactory` or `withDopplerERC20V1Factory` overrides it, explicitly include every required protocol recipient in `excludedFromBalanceLimit`. It does not add the nonce-based standard-governance timelock. With an active balance limit and `default` or `custom` governance, encoding fails when `initialSupply - numTokensToSell - vesting allocations` exceeds `maxBalanceLimit`; allocate the excess to the sale or vesting, increase the limit, or use no-op or launchpad governance.
- saleConfig({ initialSupply, numTokensToSell, numeraire })
- Price specification methods (use one, not multiple):
  - **withMarketCapRange({ marketCap, numerairePrice, ... })** ⭐ Recommended
    - Configure via dollar-denominated market cap targets (most intuitive)
    - Requires `saleConfig()` to be called first (for numeraire and tokenSupply)
    - Handles all tick math and token ordering internally
    - Parameters: `marketCap: { start, end }`, `numerairePrice`, optional `fee`, `numPositions`, `maxShareToBeSold`, `tokenDecimals`, `numeraireDecimals`
    - Defaults: `fee = 10000`, `numPositions = 15`, `maxShareToBeSold = 0.35e18`
  - poolByTicks({ startTick?, endTick?, fee?, numPositions?, maxShareToBeSold? })
    - Defaults: `fee = DEFAULT_V3_FEE (10000)`, `startTick = DEFAULT_V3_START_TICK`, `endTick = DEFAULT_V3_END_TICK`, `numPositions = DEFAULT_V3_NUM_POSITIONS`, `maxShareToBeSold = DEFAULT_V3_MAX_SHARE_TO_BE_SOLD`
    - `startTick` and `endTick` must be multiples of the fee tier's tick spacing (100→1, 500→10, 3000→60, 10000→200). The SDK enforces this before attempting a transaction.
  - poolByPriceRange({ priceRange, fee?, numPositions?, maxShareToBeSold? })
    - Computes ticks from `priceRange` using inferred `tickSpacing` from `fee`
    - @deprecated: Use `withMarketCapRange()` instead for more intuitive configuration
- withVesting({ duration?, cliffDuration?, recipients?, amounts?, allocations? } | undefined)
  - Omit to disable vesting. Default duration if provided but undefined is `DEFAULT_V3_VESTING_DURATION`.
  - Explicit `type: 'standard'` tokens with `cliffDuration > 0` or `allocations` route through the legacy DERC20 V2 factory (`CloneDERC20VotesV2Factory`).
  - Cliff vesting requires `duration >= 1 day` and `cliffDuration <= duration`.
  - `recipients`: Optional array of addresses to receive vested tokens. Defaults to `[userAddress]` if not provided.
  - `amounts`: Optional array of token amounts corresponding to each recipient. Must match `recipients` length if provided. Defaults to all unsold tokens to `userAddress` if not provided.
  - `allocations`: Optional array of `{ recipient, amount, schedule }` entries for per-beneficiary schedule vesting. Identical schedules are deduped internally.
- withGovernance(GovernanceOption)
- withMigration(MigrationConfig)
- withUserAddress(address)
- withIntegrator(address?)
  - Defaults to zero address if omitted
- Address overrides (optional):
  - withAirlock(address)
  - withTokenFactory(address)
  - withV3Initializer(address)
  - withGovernanceFactory(address) — used for standard, no-op, and launchpad governance
  - withV2Migrator(address)
  - withV2MigratorSplit(address)
  - withV4Migrator(address)
  - withV4MigratorSplit(address)
  - build(): CreateStaticAuctionParams
  - Throws if required sections are missing

Validation highlights:

- token name/symbol non‑empty
- `startTick < endTick`
- `initialSupply > 0`, `numTokensToSell > 0`, and `numTokensToSell <= initialSupply`
- If vesting set, there must be tokens reserved (`initialSupply - numTokensToSell > 0`)
- For V4 migration config (if chosen), beneficiary percentages must sum to 10000
- Use `sdk.getDerc20V2(tokenAddress)` for schedule-aware reads and release flows on explicit `type: 'standard'` cliffed or multi-schedule tokens

Examples:

```ts
// Example 1: Using market cap range (recommended)
const params = sdk
  .buildStaticAuction()
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/mtk.json',
  })
  .saleConfig({
    initialSupply: parseEther('1_000_000_000'),
    numTokensToSell: parseEther('500_000_000'),
    numeraire: WETH,
  })
  .withMarketCapRange({
    marketCap: { start: 100_000, end: 10_000_000 }, // $100k to $10M fully diluted
    numerairePrice: 3000, // ETH = $3000 USD
  })
  .withVesting({ duration: BigInt(365 * 24 * 60 * 60) })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build();

// Example 2: Single vesting beneficiary with price range (legacy)
const paramsLegacy = new StaticAuctionBuilder(chainId)
  .tokenConfig({
    type: 'standard',
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/mtk.json',
  })
  .saleConfig({
    initialSupply: parseEther('1_000_000_000'),
    numTokensToSell: parseEther('900_000_000'),
    numeraire: weth,
  })
  .poolByPriceRange({
    priceRange: { startPrice: 0.0001, endPrice: 0.001 },
    fee: 3000,
  })
  .withVesting({ duration: BigInt(365 * 24 * 60 * 60) }) // All unsold tokens vest to userAddress
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build();

// Example 3: Multiple vesting beneficiaries
const paramsMultiVest = new StaticAuctionBuilder(chainId)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/mtk.json',
  })
  .saleConfig({
    initialSupply: parseEther('1_000_000_000'),
    numTokensToSell: parseEther('900_000_000'),
    numeraire: weth,
  })
  .withMarketCapRange({
    marketCap: { start: 50_000, end: 5_000_000 },
    numerairePrice: 3000,
  })
  .withVesting({
    duration: BigInt(365 * 24 * 60 * 60),
    cliffDuration: 0,
    recipients: ['0xTeam...', '0xAdvisor...', '0xTreasury...'],
    amounts: [
      parseEther('30_000_000'),
      parseEther('20_000_000'),
      parseEther('50_000_000'),
    ], // Total: 100M of 100M unsold
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build();

// Example 4: Per-beneficiary vesting schedules (DERC20 V2)
const paramsPerSchedule = new StaticAuctionBuilder(chainId)
  .tokenConfig({
    type: 'standard',
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/mtk.json',
  })
  .saleConfig({
    initialSupply: parseEther('1_000_000_000'),
    numTokensToSell: parseEther('900_000_000'),
    numeraire: weth,
  })
  .withMarketCapRange({
    marketCap: { start: 50_000, end: 5_000_000 },
    numerairePrice: 3000,
  })
  .withVesting({
    allocations: [
      {
        recipient: '0xTeam...',
        amount: parseEther('30_000_000'),
        schedule: {
          duration: BigInt(180 * 24 * 60 * 60),
          cliffDuration: 30 * 24 * 60 * 60,
        },
      },
      {
        recipient: '0xAdvisor...',
        amount: parseEther('20_000_000'),
        schedule: {
          duration: BigInt(365 * 24 * 60 * 60),
          cliffDuration: 90 * 24 * 60 * 60,
        },
      },
      {
        recipient: '0xTreasury...',
        amount: parseEther('50_000_000'),
        schedule: {
          duration: BigInt(365 * 24 * 60 * 60),
          cliffDuration: 90 * 24 * 60 * 60,
        },
      },
    ],
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build();
```

---

## DynamicAuctionBuilder (V4‑style)

Recommended for Dutch auctions where price moves over epochs using Uniswap V4 hooks.

Methods (chainable):

- tokenConfig(params)
  - Standard: `{ type: 'standard', name, symbol, tokenURI, yearlyMintRate? }`
    - Legacy opt-in. Defaults: `yearlyMintRate = DEFAULT_V4_YEARLY_MINT_RATE (0.02e18)`
  - DopplerERC20V1: `{ type?: 'dopplerERC20V1', name, symbol, tokenURI, maxBalanceLimit?, balanceLimitEnd?, controller?, excludedFromBalanceLimit? }`
    - Default when `type` is omitted or explicitly set to `dopplerERC20V1`. Uses `dopplerERC20V1Factory`; `withTokenFactory(address)` takes precedence but must point to a compatible factory. DopplerERC20V1 does not encode `yearlyMintRate`; `controller` defaults to the zero address.
    - `excludedFromBalanceLimit` is encoded only at deployment. The SDK adds user-supplied exclusions and, only with the default DopplerERC20V1 integration, deterministic protocol recipients for the selected auction path. When `withTokenFactory` or `withDopplerERC20V1Factory` overrides it, explicitly include every required protocol recipient in `excludedFromBalanceLimit`. It does not add the nonce-based standard-governance timelock. With an active balance limit and `default` or `custom` governance, encoding fails when `initialSupply - numTokensToSell - vesting allocations` exceeds `maxBalanceLimit`; allocate the excess to the sale or vesting, increase the limit, or use no-op or launchpad governance.
- saleConfig({ initialSupply, numTokensToSell, numeraire? })
  - Defaults: `numeraire = ZERO_ADDRESS` (token is paired against ETH)
- poolConfig({ fee, tickSpacing })
- Price configuration methods (use one, not multiple):
  - **withMarketCapRange({ marketCap, numerairePrice, minProceeds, maxProceeds, ... })** ⭐ Recommended
    - Configure via dollar-denominated market cap targets
    - Requires `saleConfig()` to be called first (for numeraire and tokenSupply)
    - Handles all tick math and token ordering internally
    - Uses fixed tickSpacing of 30 (max allowed by Doppler contract)
    - Required: `marketCap: { start, min }`, `numerairePrice`, `minProceeds`, `maxProceeds`
      - `start` = auction launch price (high), `min` = floor price the auction descends to (low)
    - Optional: `fee`, `duration`, `epochLength`, `gamma`, `numPdSlugs`, `tokenDecimals`, `numeraireDecimals`
    - Defaults: `fee = 10000 (1%)`, `duration = 7 days`, `epochLength = 1 hour`, `numPdSlugs = 5`
  - auctionByTicks({ startTick, endTick, minProceeds, maxProceeds, duration?, epochLength?, gamma?, numPdSlugs? })
    - Defaults: `duration = DEFAULT_AUCTION_DURATION (604800)`, `epochLength = DEFAULT_EPOCH_LENGTH (43200)`, `numPdSlugs` optional
    - If `gamma` omitted, computed from ticks, duration, epoch length, and `tickSpacing`
  - auctionByPriceRange({ priceRange, minProceeds, maxProceeds, duration?, epochLength?, gamma?, tickSpacing?, numPdSlugs? })
    - Uses `pool.tickSpacing` unless `tickSpacing` is provided here
    - @deprecated: Use `withMarketCapRange()` instead for more intuitive configuration
- withVesting({ duration?, cliffDuration?, recipients?, amounts?, allocations? } | undefined)
  - Omit to disable vesting. Default duration if provided but undefined is `0` for dynamic auctions.
  - Explicit `type: 'standard'` tokens with `cliffDuration > 0` or `allocations` route through legacy DERC20 V2.
  - `recipients`: Optional array of addresses to receive vested tokens. Defaults to `[userAddress]` if not provided.
  - `amounts`: Optional array of token amounts corresponding to each recipient. Must match `recipients` length if provided. Defaults to all unsold tokens to `userAddress` if not provided.
- withGovernance(GovernanceOption)
  - Call is required; use `{ type: 'default' }`, `{ type: 'noOp' }`, `{ type: 'launchpad', multisig }`, or `{ type: 'custom', ... }`.
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
  - withGovernanceFactory(address) — used for standard, no-op, and launchpad governance
  - withV2Migrator(address)
  - withV2MigratorSplit(address)
  - withV4Migrator(address)
  - withV4MigratorSplit(address)
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
// Example 1: Using market cap range (recommended)
const params = sdk.buildDynamicAuction()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1_000_000_000'), numTokensToSell: parseEther('500_000_000'), numeraire: WETH })
  .withMarketCapRange({
    marketCap: { start: 500_000, min: 50_000 }, // $500k start, descends to $50k floor
    numerairePrice: 3000, // ETH = $3000 USD
    minProceeds: parseEther('100'), // Min 100 ETH to graduate
    maxProceeds: parseEther('5000'), // Cap at 5000 ETH
    // fee: 10000,                  // Optional: defaults to 1% (tickSpacing is always 30)
    // duration: 7 * DAY_SECONDS,   // Optional: defaults to 7 days
    // epochLength: 3600,           // Optional: defaults to 1 hour
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 60, streamableFees: { ... } })
  .withUserAddress(user)
  .build()

// Example 2: Using raw ticks (for advanced users or custom fee/tickSpacing)
const paramsManual = new DynamicAuctionBuilder(chainId)
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/mtk.json' })
  .saleConfig({ initialSupply: parseEther('1_000_000'), numTokensToSell: parseEther('900_000'), numeraire: weth })
  .poolConfig({ fee: 3000, tickSpacing: 10 }) // Use poolConfig() + auctionByTicks() for manual config (tickSpacing <= 30)
  .auctionByTicks({ startTick: 100000, endTick: 200000, minProceeds: parseEther('100'), maxProceeds: parseEther('1000') })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build()
```

---

## MulticurveBuilder (V4 Multicurve Initializer)

Recommended when you want to seed a Uniswap V4 pool with multiple curves in a single initializer call. This supports richer liquidity distributions and works with any migration type (V2, V3, or V4).

Methods (chainable):

- tokenConfig(params)
  - Standard: `{ type: 'standard', name, symbol, tokenURI, yearlyMintRate? }`
    - Legacy opt-in. Defaults: `yearlyMintRate = DEFAULT_V4_YEARLY_MINT_RATE (0.02e18)`
  - DopplerERC20V1: `{ type?: 'dopplerERC20V1', name, symbol, tokenURI, maxBalanceLimit?, balanceLimitEnd?, controller?, excludedFromBalanceLimit? }`
    - Default when `type` is omitted or explicitly set to `dopplerERC20V1`. Uses `dopplerERC20V1Factory`; `withTokenFactory(address)` takes precedence but must point to a compatible factory. DopplerERC20V1 does not encode `yearlyMintRate`; `controller` defaults to the zero address.
    - `excludedFromBalanceLimit` is encoded only at deployment. The SDK adds user-supplied exclusions and, only with the default DopplerERC20V1 integration, deterministic protocol recipients for the selected auction path. When `withTokenFactory` or `withDopplerERC20V1Factory` overrides it, explicitly include every required protocol recipient in `excludedFromBalanceLimit`. It does not add the nonce-based standard-governance timelock. With an active balance limit and `default` or `custom` governance, encoding fails when `initialSupply - numTokensToSell - vesting allocations` exceeds `maxBalanceLimit`; allocate the excess to the sale or vesting, increase the limit, or use no-op or launchpad governance.
- saleConfig({ initialSupply, numTokensToSell, numeraire })
- Curve configuration methods (use one, not multiple):
  - **withCurves({ numerairePrice, curves, ... })** ⭐ Recommended
    - Configure via dollar-denominated market cap ranges (no tick math required)
    - Requires `saleConfig()` to be called first
    - Auto-detects token ordering from numeraire address
    - `numerairePrice`: Price of numeraire in USD (e.g., 3000 for ETH at $3000)
    - `curves`: Array of `{ marketCap: { start, end }, numPositions, shares }` - specify market cap ranges directly
    - Optional: `fee`, `tickSpacing`, `tokenDecimals`, `numeraireDecimals`, `beneficiaries`, `tokenSupply`
    - Shares must sum to exactly WAD (1e18 = 100%)
  - poolConfig({ fee, tickSpacing, curves, beneficiaries? })
    - Low-level tick-based configuration for advanced users
    - `curves`: Array of `{ tickLower, tickUpper, numPositions, shares }` where `shares` are WAD-based weights
    - `beneficiaries` (optional): share-based beneficiaries for fee locking at initialization
  - withMarketCapPresets(params?)
    - Convenience wrapper that assembles `curves` using curated market cap tiers (`'low' | 'medium' | 'high'`)
    - Defaults: `fee = FEE_TIERS.LOW (500)`, `tickSpacing` inferred, and all three presets selected
    - `overrides` (per preset) let you tweak ticks, numPositions, or shares while preserving tier ordering
    - Automatically appends a filler curve when the selected presets sum to < 100%, keeping total shares at exactly 1e18
- Initializer configuration defaults to `{ type: 'dopplerHookInitializer' }`.
  - Use `withV4MulticurveInitializer(address)` to select the legacy `{ type: 'standard' }` initializer.
  - `withRehypeDopplerHookInitializer(config)` requires an explicit fee distribution controller. Set `config.buybackDestination` or chain `withFeeDistributionController(address)`, but not both. Both configure the hook's `buybackDst`, which authorizes distribution updates and may also receive direct-buyback proceeds.
  - Set `config.integratorFeeConfig` to reserve an independent share of gross Rehype hook fees. `feeShare` uses a 1,000,000 denominator and is capped at 750,000. Conversion ratios use a 1,000,000,000 denominator.
  - `integratorFeeConfig.integrator` defaults to the address supplied through `withIntegrator(address)`. An explicit nested address overrides that default. Omitting `integratorFeeConfig` disables the Rehype integrator share, even when `withIntegrator` is configured for Airlock fee attribution.
- withVesting({ duration?, cliffDuration?, recipients?, amounts?, allocations? } | undefined)
  - `recipients`: Optional array of addresses to receive vested tokens. Defaults to `[userAddress]` if not provided.
  - `amounts`: Optional array of token amounts corresponding to each recipient. Must match `recipients` length if provided. Defaults to all unsold tokens to `userAddress` if not provided.
- withDevBuy({ exactAmountIn, recipient, vesting?: { vestingDuration, cliffDuration?, permissionlessClaim? } } | undefined)
  - Available only on `MulticurveBuilder`; passing `undefined` clears the configuration.
  - Omit `vesting` for direct recipient delivery. When present, Bundler holds the output under this schedule independently from `withVesting` token allocations.
  - `exactAmountIn` must be in the positive uint128 range and `recipient` must be nonzero.
  - `vestingDuration` must fit uint64 and be at least 86,400 seconds; `cliffDuration` defaults to zero and cannot exceed it; `permissionlessClaim` defaults to `false`.
  - Supported initializer families are DopplerHookInitializer (`dopplerHookInitializer` and its deprecated `dopplerHook` alias) and Rehype; standard, scheduled, and decay initializers reject dev buys.
- withGovernance(GovernanceOption)
  - Call is required; use `{ type: 'default' }`, `{ type: 'custom', ... }`, or `{ type: 'noOp' }` where supported
- withMigration(MigrationConfig)
  - Supports `uniswapV2`, `uniswapV2Split`, `uniswapV4`, `uniswapV4Split`, and `noOp`
- withUserAddress(address)
- withIntegrator(address?)
- withSalt(salt?: Hex)
  - Uses the exact 32-byte salt for deterministic multicurve `CreateParams`, token prediction, and pool identity
  - Reuse the same salt and otherwise identical inputs across independent preview and create operations
  - Pass `undefined` to clear it and restore generated-salt behavior
- Address overrides (optional):
  - withAirlock(address)
  - withTokenFactory(address)
  - withBundler(address)
  - withV4MulticurveInitializer(address)
  - withGovernanceFactory(address)
  - withV2Migrator(address)
  - withV2MigratorSplit(address)
  - withV4Migrator(address)
  - withV4MigratorSplit(address)
- build(): CreateMulticurveParams

Validation highlights:

- At least one curve required
- `initialSupply > 0`, `numTokensToSell > 0`, and `numTokensToSell <= initialSupply`
- Governance selection is required
- SDK sorts beneficiaries by address as required on-chain when encoding
- Explicit salts must be `0x` followed by exactly 64 hexadecimal characters; invalid values fail before RPC or wallet work
- Dev-buy initializer compatibility is checked at build time; Bundler Airlock/PoolManager compatibility and the Rehype initializer's configured Bundler are checked during RPC-backed preparation and simulation.
- Native dev buys send exactly `exactAmountIn`; ERC-20 dev buys may prepare a separate exact approval before the atomic create-and-buy transaction.
- Bundler provides exact-input simulation without a minimum output, deadline, or slippage guard.

Examples:

```ts
// Example 1: Using market cap ranges (recommended)
const params = sdk
  .buildMulticurveAuction()
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/mtk.json',
  })
  .saleConfig({
    initialSupply: parseEther('1_000_000_000'),
    numTokensToSell: parseEther('900_000_000'),
    numeraire: WETH,
  })
  .withCurves({
    numerairePrice: 3000, // ETH = $3000 USD
    curves: [
      // Curve 1: Launch curve (concentrated liquidity at low market cap)
      {
        marketCap: { start: 500_000, end: 1_500_000 },
        numPositions: 10,
        shares: parseEther('0.3'),
      }, // 30%
      // Curve 2: Mid-range (provides depth as price rises)
      {
        marketCap: { start: 1_000_000, end: 5_000_000 },
        numPositions: 15,
        shares: parseEther('0.4'),
      }, // 40%
      // Curve 3: Upper range (moon bag for high market cap)
      {
        marketCap: { start: 4_000_000, end: 50_000_000 },
        numPositions: 10,
        shares: parseEther('0.29'),
      }, // 29%
      // Tail position: extends from the highest curve to infinity ('max')
      {
        marketCap: { start: 50_000_000, end: 'max' },
        numPositions: 10,
        shares: parseEther('0.01'),
      }, // 1%
    ],
  })
  .withVesting({ duration: BigInt(365 * 24 * 60 * 60) })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build();

const { tokenAddress, poolId } = await sdk.factory.createMulticurve(params);

// Example 2: Using raw ticks (advanced users)
const paramsRaw = new MulticurveBuilder(chainId)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/mtk.json',
  })
  .saleConfig({
    initialSupply: parseEther('1_000_000'),
    numTokensToSell: parseEther('900_000'),
    numeraire: weth,
  })
  .poolConfig({
    fee: 0,
    tickSpacing: 8,
    curves: [
      {
        tickLower: 0,
        tickUpper: 240000,
        numPositions: 10,
        shares: parseEther('0.5'),
      },
      {
        tickLower: 16000,
        tickUpper: 240000,
        numPositions: 10,
        shares: parseEther('0.5'),
      },
    ],
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build();

const { tokenAddress, poolId } = await sdk.factory.createMulticurve(params);
```

Preset helper usage:

```ts
import {
  MulticurveBuilder,
  FEE_TIERS,
} from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';

const presetParams = new MulticurveBuilder(chainId)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/mtk.json',
  })
  .saleConfig({
    initialSupply: parseEther('1_000_000'),
    numTokensToSell: parseEther('900_000'),
    numeraire: weth,
  })
  .withMarketCapPresets({
    fee: FEE_TIERS.LOW,
    presets: ['low', 'medium', 'high'], // default ordering; select a subset if needed
    // overrides: { high: { shares: parseEther('0.25') } }, // adjust individual tiers
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build();
```

Preset tiers map to approximate market cap bands (assuming ~1B supply, $4,500 reference numeraire):

- `low`: 50% allocation targeting $0-$3M launches
- `medium`: 25% allocation targeting $1k-$40M
- `high`: 24% allocation targeting $100k-$1B

All presets use the curated tick ranges from `DEFAULT_MULTICURVE_*` constants. Shares are represented in WAD (1e18 = 100%); if you override shares, ensure they remain within bounds or the builder will throw.

### Bundler dev-buy custody and claims

Access the chain-default contract through `sdk.bundler`, or use `sdk.getBundler(address)` for the same custom deployment selected with `withBundler(address)`. Read methods require only a public client; `claim` requires an SDK wallet client.

```ts
const bundler = sdk.getBundler(result.devBuy!.bundler);
const position = await bundler.getVesting(result.tokenAddress);
const claimable = await bundler.getClaimable(result.tokenAddress);

if (claimable > 0n) {
  const simulation = await bundler.simulateClaim(result.tokenAddress);
  console.log('Claimable amount:', simulation.amount);

  const hash = await bundler.claim(result.tokenAddress);
  await publicClient.waitForTransactionReceipt({ hash });
}
```

`getVesting(asset)` returns the stored recipient, permission mode, start timestamp, cliff and vesting durations, total amount, and already claimed amount. All timestamps and durations are seconds. `getClaimable(asset)` returns the amount currently releasable, while `simulateClaim(asset, account?)` validates a caller and produces a write request without submitting it.

Restricted positions can be claimed only by their recipient. Permissionless positions may be triggered by any caller, but Bundler always transfers the vested tokens to the stored recipient.

### Updating a Rehype fee distribution

The fee distribution controller is fixed when the pool is created and cannot be
changed. Use an address that will remain available to sign future updates, such
as the intended operational wallet or multisig. Setting `DEAD_ADDRESS` as the
controller permanently disables fee distribution updates.

`withFeeDistributionController(address)` is a builder API. Callers that construct
`DopplerFactory` parameters directly must set `buybackDestination` in the Rehype
initializer configuration.

After creation, connect the SDK to the controller wallet and replace the pool's
complete fee distribution matrix:

```ts
const hook = await sdk.getRehypeDopplerHookInitializer(hookAddress);

const { transactionHash } = await hook.setFeeDistribution(poolId, {
  assetFeesToAssetBuybackWad: 0n,
  assetFeesToNumeraireBuybackWad: 0n,
  assetFeesToBeneficiaryWad: WAD,
  assetFeesToLpWad: 0n,
  numeraireFeesToAssetBuybackWad: 0n,
  numeraireFeesToNumeraireBuybackWad: 0n,
  numeraireFeesToBeneficiaryWad: WAD,
  numeraireFeesToLpWad: 0n,
});
```

The connected wallet must be the configured controller. This operation replaces
all eight fields rather than applying a partial update. The four asset-fee
allocations must sum to `WAD`, and the four numeraire-fee allocations must
separately sum to `WAD`. The returned transaction hash is provided after the SDK
waits for transaction confirmation.

### Configuring and managing Rehype integrator fees

The Rehype integrator share is separate from both the Airlock integrator and the
standard fee distribution matrix. The SDK can use the same address for both
integrator roles without implicitly enabling the Rehype share. This is a partial
builder fragment showing only the Rehype-specific configuration, not a complete
executable build:

```ts
builder.withIntegrator(integrator).withRehypeDopplerHookInitializer({
  hookAddress,
  buybackDestination: feeDistributionController,
  feeDistributionInfo,
  integratorFeeConfig: {
    feeShare: 200_000, // 20% of the Rehype hook fee
    assetFeesToNumeraireRatio: 500_000_000,
    numeraireFeesToAssetRatio: 0,
    automaticPayout: false,
  },
});
```

Set `integratorFeeConfig.integrator` to use a different address from the
top-level Airlock integrator. Omitting `integratorFeeConfig` encodes the
contract's disabled zero configuration.

An atomic Bundler dev buy is exempt from both the Rehype integrator share and
the residual Rehype shares; only the Airlock owner cut applies.

After creation, the current Rehype integrator can inspect balances and update
its mutable routing configuration:

```ts
const hook = await sdk.getRehypeDopplerHookInitializer(hookAddress);

const feeShare = await hook.getIntegratorFeeShare(poolId);
const routing = await hook.getIntegratorRoutingConfig(poolId);
const pending = await hook.getPendingIntegratorFees(poolId);
const claimable = await hook.getClaimableIntegratorFees(poolId);

await hook.setIntegratorConversionRatios(poolId, 500_000_000, 0);
await hook.setIntegratorAutomaticPayout(poolId, true);
await hook.claimIntegratorFees(asset, destination);
await hook.setIntegrator(poolId, newIntegrator);
```

The fee share is immutable. Ratio and payout changes apply to fees that are
pending but not yet processed. Rotating the integrator transfers control over
pending and claimable balances to the new address.

---

## OpeningAuctionBuilder (Opening Auction -> Doppler)

Use this builder when launch liquidity starts in an OpeningAuction hook and then transitions into a Doppler hook.

Methods (chainable):

- tokenConfig(params)
  - Standard: `{ type: 'standard', name, symbol, tokenURI, yearlyMintRate? }`
  - DopplerERC20V1: `{ type?: 'dopplerERC20V1', name, symbol, tokenURI, maxBalanceLimit?, balanceLimitEnd?, controller?, excludedFromBalanceLimit? }`
    - Default when `type` is omitted or explicitly set to `dopplerERC20V1`. Uses `dopplerERC20V1Factory`; `withTokenFactory(address)` takes precedence but must point to a compatible factory. DopplerERC20V1 does not encode `yearlyMintRate`; `controller` defaults to the zero address.
    - `excludedFromBalanceLimit` is encoded only at deployment. The SDK adds user-supplied exclusions and, only with the default DopplerERC20V1 integration, deterministic protocol recipients for the selected auction path. When `withTokenFactory` or `withDopplerERC20V1Factory` overrides it, explicitly include every required protocol recipient in `excludedFromBalanceLimit`. It does not add the nonce-based standard-governance timelock. With an active balance limit and `default` or `custom` governance, encoding fails when `initialSupply - numTokensToSell - vesting allocations` exceeds `maxBalanceLimit`; allocate the excess to the sale or vesting, increase the limit, or use no-op or launchpad governance.
  - Doppler404: `{ type: 'doppler404', name, symbol, baseURI, unit? }`
- saleConfig({ initialSupply, numTokensToSell, numeraire })
- openingAuctionConfig({ auctionDuration, minAcceptableTickToken0, minAcceptableTickToken1, incentiveShareBps, tickSpacing, fee, minLiquidity, shareToAuctionBps })
  - All fields are required
- dopplerConfig({ minProceeds, maxProceeds, startTick, endTick, duration?, epochLength?, gamma?, numPdSlugs?, fee?, tickSpacing? })
  - Defaults: `duration = 7 days`, `epochLength = 12 hours`, `numPdSlugs = 5`, `fee = 10000`, `tickSpacing = 30`
  - `gamma` is computed automatically when omitted
- withVesting({ duration?, cliffDuration?, recipients?, amounts?, allocations? } | undefined)
- withGovernance(GovernanceOption)
  - Optional in builder; defaults to no-op on no-op-enabled chains, default governance otherwise
- withMigration(MigrationConfig)
- withUserAddress(address)
- withIntegrator(address?)
- withTime({ startTimeOffset?, startingTime?, blockTimestamp? } | undefined)
  - `startTimeOffset` and `startingTime` are mutually exclusive
- Address overrides (optional):
  - withAirlock(address)
  - withTokenFactory(address)
  - withPoolManager(address)
  - withDopplerDeployer(address)
  - withGovernanceFactory(address)
  - withV2Migrator(address)
  - withV2MigratorSplit(address)
  - withV4Migrator(address)
  - withV4MigratorSplit(address)
  - withNoOpMigrator(address)
  - withOpeningAuctionInitializer(address)
  - withOpeningAuctionPositionManager(address)
- build(): `CreateOpeningAuctionParams`

Validation highlights:

- `initialSupply > 0`, `numTokensToSell > 0`, and `numTokensToSell <= initialSupply`
- `openingAuction.shareToAuctionBps` must be in `(0, 10000]`
- `openingAuction.incentiveShareBps` must be in `[0, 10000]`
- `openingAuction.tickSpacing` must be divisible by `doppler.tickSpacing`
- `doppler.duration` must be divisible by `doppler.epochLength`
- Tick direction depends on token ordering against `numeraire`:
  - token expected as currency1: `startTick <= endTick`
  - token expected as currency0: `startTick >= endTick`

Example:

```ts
const openingParams = sdk
  .buildOpeningAuction()
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/mtk.json',
  })
  .saleConfig({
    initialSupply: parseEther('1_000_000'),
    numTokensToSell: parseEther('900_000'),
    numeraire: WETH,
  })
  .openingAuctionConfig({
    auctionDuration: 86400,
    minAcceptableTickToken0: -34020,
    minAcceptableTickToken1: -34020,
    incentiveShareBps: 1000,
    tickSpacing: 60,
    fee: 3000,
    minLiquidity: 10n ** 15n,
    shareToAuctionBps: 10000,
  })
  .dopplerConfig({
    minProceeds: parseEther('5'),
    maxProceeds: parseEther('1000'),
    startTick: -120000,
    endTick: -90000,
    tickSpacing: 30,
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build();

const createSim = await sdk.factory.simulateCreateOpeningAuction(openingParams);
const created = await createSim.execute();
```

Lifecycle usage notes:

- Read lifecycle state via initializer: `const lifecycle = await sdk.getOpeningAuctionLifecycle(initializerAddress)` then `await lifecycle.getState(asset)`
- Settle before completion:
  - Explicit: `await (await sdk.getOpeningAuction(state.openingAuctionHook)).settleAuction()`
  - Or let completion auto-settle: `sdk.factory.completeOpeningAuction({ asset, autoSettle: true })`
- Complete into Doppler (auto-mined salt):
  - `const completionSim = await sdk.factory.simulateCompleteOpeningAuction({ asset, initializerAddress })`
  - `const completion = await completionSim.execute()` (may remine if block time/state changes between simulation and execution)
- Incentive wrappers are available on factory (and lifecycle entity equivalents):
  - `simulateRecoverOpeningAuctionIncentives` / `recoverOpeningAuctionIncentives`
  - `simulateSweepOpeningAuctionIncentives` / `sweepOpeningAuctionIncentives`

Phase 2 bid management (position manager):

- Resolve the onchain `OpeningAuctionPositionManager`:
  - via SDK chain addresses: `const pm = await sdk.getOpeningAuctionPositionManager()`
  - or via initializer (recommended when addresses are not configured): `const pmAddress = await lifecycle.getPositionManager()` then `await sdk.getOpeningAuctionPositionManager(pmAddress)`
- Use the pool key from initializer state: `const { openingAuctionPoolKey } = await lifecycle.getState(asset)`
- Place/withdraw bids as Uniswap V4 liquidity positions. Use simulation to learn the required token deltas:

```ts
import { OpeningAuctionPositionManager } from '@whetstone-research/doppler-sdk/evm';
import { zeroHash } from 'viem';

const lifecycle = await sdk.getOpeningAuctionLifecycle(initializerAddress);
const state = await lifecycle.getState(asset);

const pmAddress = await lifecycle.getPositionManager();
const pm = await sdk.getOpeningAuctionPositionManager(pmAddress);

// Optional: explicit hookData encoding (otherwise the position manager encodes msg.sender internally)
const hookData = OpeningAuctionPositionManager.encodeOwnerHookData(
  account.address,
);

// NOTE: `liquidity` is Uniswap V4 liquidity units; pick a value and iterate using simulation + decoded deltas.
const tickLower = 0;
const salt = zeroHash;

const sim = await pm.simulatePlaceBid({
  key: state.openingAuctionPoolKey,
  tickLower,
  liquidity: 1_000_000n,
  salt,
  hookData,
  account: account.address,
});
console.log('BalanceDelta:', sim.decoded); // negative amounts mean you pay in

// Broadcast:
// await pm.placeBid({ key: state.openingAuctionPoolKey, tickLower, liquidity: 1_000_000n, salt, hookData })
```

Position ID resolution (for incentive claims):

- The opening-auction hook assigns an onchain `positionId`. Use it to query/claim incentives:
  - `await opening.getPositionId({ owner, tickLower, tickUpper, salt })`
  - or `await opening.claimIncentivesByPositionKey({ owner, tickLower, tickUpper, salt })`

Withdrawals during the active auction must be full:

- The hook disallows partial removals while the auction is active.
- Either track the exact liquidity you placed, or use `withdrawFullBid(...)` which reads onchain liquidity first:

```ts
const { transactionHash } = await pm.withdrawFullBid({
  openingAuctionHookAddress: state.openingAuctionHook,
  key: state.openingAuctionPoolKey,
  tickLower,
  salt,
  hookData,
});
console.log('withdraw tx:', transactionHash);
```

---

## Build Results

- Static: `CreateStaticAuctionParams` with fields: `token`, `sale`, `pool`, optional `vesting`, `governance`, `migration`, `integrator`, `userAddress`
- Dynamic: `CreateDynamicAuctionParams` with fields: `token`, `sale`, `auction`, `pool`, optional `vesting`, `governance`, `migration`, `integrator`, `userAddress`, optional `startTimeOffset`, optional `blockTimestamp`
- Multicurve: `CreateMulticurveParams` with fields: `token`, `sale`, `pool` (with `curves`), optional `vesting`, `governance`, `migration`, `integrator`, `userAddress`, optional `salt`
- Opening auction: `CreateOpeningAuctionParams` with fields: `token`, `sale`, `openingAuction`, `doppler`, optional `vesting`, `governance`, `migration`, `integrator`, `userAddress`, optional `startTimeOffset`, optional `startingTime`, optional `blockTimestamp`, optional module overrides

Pass the built object directly to the factory:

```ts
const { poolAddress, tokenAddress } =
  await sdk.factory.createStaticAuction(staticParams);
const {
  hookAddress,
  tokenAddress: token2,
  poolId,
} = await sdk.factory.createDynamicAuction(dynamicParams);
const { tokenAddress: token3, poolId: poolId3 } =
  await sdk.factory.createMulticurve(multicurveParams);
const { tokenAddress: token4, openingAuctionHookAddress } =
  await sdk.factory.createOpeningAuction(openingParams);
```

Notes:

- Doppler404 launches require a configured `doppler404Factory`. They are currently supported on Robinhood, Base, and Base Sepolia. A generic `withTokenFactory(address)` override does not enable Doppler404 on another chain.
- Doppler404 tokenConfig supports optional `unit?: bigint`. It defaults to `WAD` (`1e18`), so one full 18-decimal ERC-20 token corresponds to one NFT. Set `unit` explicitly to choose another ERC-20 base-unit threshold.
- Size `initialSupply` and `unit` together: the maximum NFT count is approximately `initialSupply / unit`. Very large NFT counts can make launch transfers exceed practical gas limits.
- Doppler404 does not support vesting. The factory rejects any Doppler404 launch with `withVesting(...)`.
- After launch, use `sdk.getDopplerDN404(tokenAddress)` to read ERC-20 state, `unit`, `baseURI`, the ERC-721 mirror, NFT supply, and skip-NFT preferences, or to approve, transfer, and update the caller's skip-NFT preference.
- `integrator` defaults to zero address when omitted.
- `withTime` is relevant to dynamic and opening-auction builders.
