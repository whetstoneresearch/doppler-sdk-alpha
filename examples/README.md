# Doppler SDK Examples

This directory contains practical examples demonstrating how to use the Doppler SDK for various token launch scenarios.

## Examples

### 1. [Static Auction with V2 Migration](./static-auction-v2.ts)

Create a simple token launch using a static price range on Uniswap V3, then migrate to Uniswap V2.

### 2. [Dynamic Auction with V4 Migration](./dynamic-auction-v4.ts)

Create a gradual Dutch auction that adjusts price over time based on demand.

### 3. [Multicurve Initializer (V4)](./multicurve-initializer.ts)

Create a pool seeded with the low/medium/high market cap presets in one initializer call. Use a supported migration path (V2/V4, split variants, or noOp) and optionally tailor individual tiers.

### 4. [Multicurve with Lockable Beneficiaries](./multicurve-lockable-beneficiaries.ts)

Create a multicurve auction with fee streaming to multiple beneficiaries. Uses NoOp migration (no post-auction migration) to keep liquidity locked while distributing fees.

### 4a. [Multicurve No-Migration + Doppler404 (DN404-style)](./multicurve-noop-doppler404.ts)

Create a multicurve auction on Base Sepolia using NoOp migration (no liquidity migration) and a Doppler404 token. Demonstrates the default one-token-per-NFT unit and post-launch access through `sdk.getDopplerDN404(...)`. Defaults to simulation-only; set `EXECUTE=1` to broadcast.

### 5. [Multicurve Fee Collection](./multicurve-collect-fees.ts)

Collect and distribute trading fees from a multicurve pool with lockable beneficiaries. Demonstrates how beneficiaries can claim accumulated fees from swap activity.

### 5a. [Multicurve Pending Fee Preview](./multicurve-get-pending-fees.ts)

Preview pending fees for one beneficiary across multiple locked multicurve tokens with one multicall by default, plus optional token batching for RPC provider limits.

### 6. [Multicurve Dev Buy with WETH](./multicurve-dev-buy-weth.ts)

Creates a Rehype multicurve launch and executes one exact-input WETH purchase through Bundler. The example wraps WETH and submits an exact approval separately, then atomically creates the market and holds the purchased tokens under a seven-day Bundler vesting schedule. Omit the `vesting` field to deliver the output directly to the recipient.

### 7. [Multicurve Quote & Swap](./multicurve-quote-and-swap.ts)

Create a multicurve auction with market cap presets, quote a swap using the SDK quoter, and execute the swap via Universal Router. Shows the complete flow of quoting and swapping on V4 pools.

### 7a. [Multicurve Rehype Initializer, Raw Ticks](./rehype/multicurve-rehype-raw-ticks.ts)

Create a Base Sepolia multicurve pool with `RehypeDopplerHookInitializer` using power-user tick configuration. This is the raw-tick counterpart to the market-cap examples: it sets `farTick` directly, uses direct buyback routing, and demonstrates a mixed fee split across asset buyback, WETH buyback, beneficiaries, and LPs.

### 7b. [Multicurve Rehype by Market Cap, Base Sepolia](./rehype/multicurve-rehype-by-marketcap.ts)

Create a Base Sepolia multicurve pool with `RehypeDopplerHookInitializer` using market-cap ranges instead of raw ticks. This is the easiest initializer-side Rehype multicurve path: `withCurves()` derives ticks from target market caps, includes a small `$50M+` tail range, `graduationMarketCap` derives `farTick`, and the example keeps the standard mixed direct-buyback fee split.

### 7c. [Multicurve Rehype by Market Cap, Base Mainnet](./rehype/multicurve-rehype-by-marketcap-base-mainnet.ts)

Simulate, and optionally broadcast, the same initializer-side market-cap Rehype multicurve flow on Base mainnet. This variant adds mainnet confirmation guards, live ETH pricing, the `$50M+` tail range, decaying Rehype fees, and a small post-deploy buy while still using direct buyback routing with the mixed fee split.

### 7d. [Multicurve Rehype Claimable WETH Buybacks, Base Mainnet](./rehype/multicurve-rehype-by-marketcap-base-mainnet-eth-buybacks.ts)

Simulate, and optionally broadcast, a Base mainnet initializer-side Rehype multicurve whose distributable hook fees accrue 100% as WETH/numeraire claimable by the configured recipient. Unlike the direct-buyback examples, this uses `routeToBeneficiaryFees`, the `$50M+` tail range, a `dopplerERC20V1` token, and demonstrates reading claimable hook fees and calling `collectFees(asset)`.

### 7e. [Multicurve Rehype Graduation Market Cap](./rehype/multicurve-with-graduation-market-cap.ts)

Focus on `graduationMarketCap` behavior for a Rehype multicurve pool on Base Sepolia. Use this when you want to see how market-cap thresholds must fit inside the configured curve range, how the `$50M+` tail keeps the curve open above the finite target range, and how the SDK converts the graduation target into the hook's `farTick`.

### 7f. [Multicurve Rehype Fee Distribution Controller](./rehype/multicurve-fee-distribution-controller-base-sepolia.ts)

Create a Base Sepolia Rehype multicurve pool with a fee-beneficiary matrix and a separately configured fee distribution controller. The example updates the matrix after launch, executes a V4 swap, verifies the stored distribution, and claims the resulting beneficiary fees.

### 8. [Multicurve Indexer Data](./multicurve-indexer-data.ts)

Query and process pool data from the Doppler indexer. Demonstrates fetching pool metrics, parsing PoolKey data, monitoring migration status, and using indexer data with the SDK for quoting. **Note:** Requires `graphql-request` package.

### 9. [Auction Monitoring](./auction-monitoring.ts)

Monitor an existing auction for graduation status and key metrics.

### 10. [Token Interaction](./token-interaction.ts)

Interact with launched tokens - check balances, approve spending, and release vested tokens.

### 10a. [Vesting Release](./vesting-release.ts)

Preview and claim vested tokens from existing `Derc20`, `Derc20V2`, or `DopplerERC20V1` contracts. Demonstrates `release()`, `releaseSchedule()`, and `releaseFor()` paths.

### 11. [Price Quoter](./price-quoter.ts)

Get price quotes across different Uniswap versions for optimal trading.

### 12. [Scheduled Multicurve Launch](./multicurve-scheduled-launch.ts)

Create a multicurve auction that queues until a future start time using the scheduled initializer on Base.

### 12a. [Per-Beneficiary Vesting Schedules](./multicurve-per-beneficiary-vesting.ts)

Create a multicurve auction whose vesting beneficiaries use different cliff and vesting schedules on the DERC20 V2 path. Demonstrates the `allocations` API and reading the assigned schedule data back from `sdk.getDerc20V2(...)`.

### 12b. [DopplerERC20V1 Token Configuration](./doppler-erc20-v1.ts)

Create a `dopplerERC20V1` token selected automatically from template-specific balance-limit fields, enumerate vesting schedules, release a partial vested amount by schedule or across schedules, and read max-balance-limit state. The default DopplerERC20V1 integration adds protocol balance-limit exclusions; custom `withTokenFactory(address)` paths must provide any required exclusions explicitly. This implementation does not configure or expose yearly mint inflation.

### 12c. [Latest Multicurve Example](./multicurve-latest.ts)

Create and simulate a Base multicurve launch using the default DopplerERC20V1 and DopplerHookInitializer paths, max-balance limits, Rehype fee routing, no-op governance and migration, fee beneficiaries, and multiple vesting distributions for one address. Falls back to Base's public RPC when `RPC_URL` is unset. Optionally broadcasts, previews or claims pool fees, and partially or fully releases vested tokens.

### 12d. [Multicurve DopplerERC20V1 Multi-Schedule Vesting + Governance](./multicurve-derc20v1-multi-vesting-governance.ts)

Build a Base multicurve configuration using the `dopplerERC20V1` token template, standard governance, and per-allocation vesting schedules. Includes multiple unique vesting schedules and one recipient with two vesting allocations on different schedules.

### 12e. [Wallet-Independent Multicurve External Executor](./multicurve-custom-executor.ts)

Prepare an exact unsigned Base Sepolia DopplerERC20V1/Rehype/no-op multicurve create with a public-client-only SDK, then submit it through a separately owned wallet client. The example uses `verifyPreparedCreateExecution()` to perform the receipt checks and retrieve the mined transaction to verify its exact input and value; integrators that only have a receipt can instead use synchronous `verifyPreparedCreateReceipt()`. Set a Base Sepolia `RPC_URL` and funded `PRIVATE_KEY`; add `EXECUTE_TRANSACTION=true` to broadcast. Without that explicit opt-in, the example prepares and prints predictions but does not submit. The application remains responsible for signer authorization, nonce allocation, signed-transaction persistence, retries, replacements, and confirmation policy.

### 13. [Multicurve Vanity Launch (Market Cap)](./multicurve-vanity-by-marketcap.ts)

Create a multicurve pool and mine a salt so the deployed token address ends with a chosen hex suffix (identifier). Launches on-chain (requires RPC + PRIVATE_KEY).

### 14. [Decay Multicurve Swap Simulation](./multicurve-decay-simulate-swaps.ts)

Deploy a decay multicurve pool, then simulate buy swaps across the fee schedule using the same Universal Router V4 command pattern used by the Pure Markets interface. Validates that quoted output rises as fees decay.

### 15. [Base Mainnet Decay Multicurve Deploy](./multicurve-decay-base-mainnet-launch.ts)

Deploy a decay multicurve pool on Base mainnet using a simulation-first flow. Requires `CONFIRM_BASE_MAINNET=true` and only broadcasts when `EXECUTE_MAINNET=true`.

### 16. [Decay Multicurve with Vanity Suffix](./multicurve-decay-vanity-launch.ts)

Full production-style decay multicurve launch with integrator, beneficiaries, multi-recipient vesting (1-year linear vest split between deployer and advisor), noOp migration/governance, and CREATE2 salt mining for a vanity token address suffix ("beef"). Demonstrates the complete builder pattern used by production apps.

### 17. [Base Mainnet Decay Multicurve Swap Simulation](./multicurve-decay-base-mainnet-simulate-swaps.ts)

Deploy a decay multicurve pool on Base mainnet, then simulate buys across fee-decay checkpoints using the Pure Markets swap flow. Requires `CONFIRM_BASE_MAINNET=true`.

### 18. [Opening Auction Lifecycle](./opening-auction-lifecycle.ts)

Demonstrates the full opening auction lifecycle: creating an opening auction, monitoring its phase transitions, and settling the auction once it closes.

### 19. [Opening Auction Bidding](./opening-auction-bidding.ts)

Demonstrates bid placement, withdrawal, and management in an opening auction. Covers placing bids at specific tick ranges, checking bid status, and withdrawing or modifying bids.

### 20. [Split Migrator + Launchpad Governance](./split-migrator-launchpad-governance.ts)

Minimal builder examples for `uniswapV2Split` / `uniswapV4Split` migrations and launchpad governance.

## Solana Examples

The Solana examples use `@whetstone-research/doppler-sdk/solana`. Set `SOLANA_NETWORK=devnet` for the checked-in Doppler Solana deployment defaults, or `SOLANA_NETWORK=custom` with explicit RPC URLs and deployment program IDs.

- [`solana-minimal-launch.ts`](./solana-minimal-launch.ts): smallest practical WSOL XYK launch using `createLaunch` defaults.
- [`solana-launch-by-marketcap.ts`](./solana-launch-by-marketcap.ts): WSOL XYK launch with CPMM migration configured from market cap inputs.
- [`solana-dynamic-fee-launch.ts`](./solana-dynamic-fee-launch.ts): WSOL XYK launch using the Doppler launch hook v1 with a decaying fee schedule.
- [`solana-adv-launch.ts`](./solana-adv-launch.ts): WSOL launch with custom allocations, recipients, fees, and migration price floor.
- [`solana-adv-e2e-launch.ts`](./solana-adv-e2e-launch.ts): create, buy, migrate, and inspect a graduated WSOL CPMM pool.
- [`solana-usdc-e2e-launch.ts`](./solana-usdc-e2e-launch.ts): same lifecycle with devnet USDC and fee arithmetic checks.
- [`solana-cosigner-gated-launch.ts`](./solana-cosigner-gated-launch.ts): E2E launch with bonding-curve swaps gated through the configured Doppler launch hook v1.
- [`solana-cosigner-gated-buy.ts`](./solana-cosigner-gated-buy.ts): cosigner-gated WSOL buy flow with env-configured fee beneficiaries.
- [`solana-cosigner-gated-buy-token-2022.ts`](./solana-cosigner-gated-buy-token-2022.ts): same cosigner-gated WSOL flow with a Token-2022 base mint and Metaplex metadata.
- [`solana-usdc-cosigner-gated-buy.ts`](./solana-usdc-cosigner-gated-buy.ts): cosigner-gated devnet USDC buy flow.
- [`solana-prediction-market.ts`](./solana-prediction-market.ts): create a two-outcome prediction market with trusted oracle and prediction migrator.
- [`solana-create-spot-pool.ts`](./solana-create-spot-pool.ts): create a permissionless base-token/WSOL spot pool with an immutable fee tier and an optional allowlisted swap-phase hook.
- [`solana-fee-rehypothecation-launch.ts`](./solana-fee-rehypothecation-launch.ts): create a non-migrating launch with selectable asset-only, numeraire-only, in-kind, or balanced fee routing.
- [`solana-fee-rehypothecation-settle-and-claim.ts`](./solana-fee-rehypothecation-settle-and-claim.ts): settle routed fees with protected conversion quotes, then claim one beneficiary's proceeds.
- [`solana-vesting-launch.ts`](./solana-vesting-launch.ts): create and fund a non-migrating launch with an immutable token vesting allocation.
- [`solana-vesting-claim.ts`](./solana-vesting-claim.ts): permissionlessly claim the tokens currently available to a vesting beneficiary.
- [`solana-swap.ts`](./solana-swap.ts): quote and submit an exact-in CPMM swap.
- [`solana-custom-hook/`](./solana-custom-hook/): minimal Anchor implementation of the Solana hook callback ABI. See the [custom hook guide](../docs/solana-custom-hooks.md) for deployment and SDK wiring.

Quick run:

```bash
export SOLANA_KEYPAIR_PATH=~/.config/solana/id.json
export SOLANA_NETWORK=devnet
export SOLANA_RPC_URL=https://api.devnet.solana.com
export SOLANA_WS_URL=wss://api.devnet.solana.com
pnpm tsx examples/solana-minimal-launch.ts
```

For a custom deployment, also set:

```bash
export SOLANA_CPMM_PROGRAM_ID=...
export SOLANA_INITIALIZER_PROGRAM_ID=...
export SOLANA_CPMM_MIGRATOR_PROGRAM_ID=...
export SOLANA_DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID=...
export SOLANA_DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID=...
export SOLANA_DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ID=...
export SOLANA_VESTING_PROGRAM_ID=...
```

Fee rehypothecation launches initialize their routing state and launch in two
transactions. The launch helper configures the router as the Initializer fee
beneficiary; the router's beneficiary list and routing strategy control the
eventual payouts. Settlement conversions use a 50 bps slippage tolerance by
default. Settlement is permissionless: any signer can submit and pay for the
transaction, and no keeper authority is configured at launch creation.

The high-level launch helper uses the deployment's Doppler launch hook v1 automatically. Set `dynamicFee`, a gate returned by `dopplerLaunchHookV1.resolveManagedCosignerGate`, or both in the helper params to enable those features; omit both for static fees without cosigning. The resolver fetches the hook's singleton on-chain config and selects its first active Doppler-managed signer, while `createLaunch` remains an offline instruction builder that pins the resolved signer. Launch creators cannot register or select a cosigner through this flow. Integrators that require their own cosigner must use a separate hook program approved by the protocol; passing a key to the low-level hook helpers does not authorize or register it with the Doppler-managed hook. The gated swap examples require `COSIGNER_KEYPAIR_PATH` or `COSIGNER_KEYPAIR` to match that selected signer because they execute the managed cosigned swap themselves.

The launch examples use ALTs where possible. ALTs reduce account-key bytes, but they do not compress instruction data, so long `metadataName`, `metadataSymbol`, or `metadataUri` values can still exceed Solana's 1232-byte transaction limit.

Run the mainnet-compatible Solana examples against a disposable local fork of
the current mainnet deployment:

```bash
pnpm test:solana:fork:examples
```

The command clones the deployed programs and protocol configs, then uses
ephemeral payer and cosigner keys. The forked hook config is rewritten to
authorize only the ephemeral cosigner; no production key or mainnet write is
required. Set `SOLANA_MAINNET_RPC_URL` to override the public RPC used for
cloning. The prediction-market example is compile-checked but cannot execute in
this suite because its required program revision does not have a mainnet
deployment.

Run examples whose required programs are currently deployed only on devnet
against a disposable local devnet fork:

```bash
pnpm test:solana:fork:devnet-examples
```

This suite executes spot-pool creation and vesting launch and claim. It uses an
immediately vested schedule so both vesting examples execute in one CI run
without waiting for wall-clock time. Set
`SOLANA_RUN_DEVNET_REHYPOTHECATION_EXAMPLES=true` to also run the
fee-rehypothecation launch and settlement/claim after the current router ABI is
deployed to devnet. Set `SOLANA_DEVNET_RPC_URL` to override the public RPC used
for cloning.

For larger CPMM launch metadata, use a launch-specific ALT:

1. Build the `initialize_launch` instruction.
2. Collect non-signer lookup addresses with `initializer.getInstructionLookupTableAddresses(ix)`.
3. Build and send setup instructions with `initializer.buildAddressLookupTableSetupInstructions(...)`.
4. Wait for the ALT to be usable in a later slot.
5. Rebuild the transaction and call `initializer.compressTransactionMessageWithLookupTable(...)`.

The shared example helper performs this flow and checks transaction size before signing so metadata and account-pressure failures surface before broadcast.

`SOL_PRICE_USD` can be set to bypass the CoinGecko price lookup in launch examples. `SOLANA_KEYPAIR_PATH` is preferred for local development; `SOLANA_KEYPAIR` also works with a 64-byte JSON secret key array.

## Prerequisites

Before running these examples, ensure you have:

1. **Node.js** (v18 or higher)
2. **A wallet** with private key
3. **ETH or native tokens** for gas fees
4. **RPC endpoint** for your target chain

## Setup

### For SDK Development (this repo)

1. Install dependencies from the repo root:

```bash
pnpm install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your values
```

3. Run an example:

```bash
pnpm tsx examples/multicurve-initializer.ts
```

### For SDK Consumers (using the published package)

1. Install dependencies:

```bash
npm install @whetstone-research/doppler-sdk viem

# For the multicurve quote/swap example (optional)
npm install doppler-router

# For multicurve indexer data example (optional)
npm install graphql-request
```

Use the EVM entrypoint when importing examples from the published package:
`@whetstone-research/doppler-sdk/evm`.

2. Set environment variables (use your preferred method):

```bash
export PRIVATE_KEY=your_private_key_here
export RPC_URL=https://your-rpc-endpoint
```

3. Run an example:

```bash
npx tsx examples/static-auction-v2.ts
```

## Common Patterns

### SDK Initialization

```typescript
import { DopplerSDK } from '@whetstone-research/doppler-sdk/evm';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
});

const sdk = new DopplerSDK({
  publicClient,
  walletClient,
  chainId: baseSepolia.id,
});
```

### Error Handling

All SDK methods can throw errors. Always wrap calls in try-catch blocks:

```typescript
try {
  const result = await sdk.factory.createStaticAuction(params);
  console.log('Success:', result);
} catch (error) {
  console.error('Failed to create auction:', error.message);
}
```

### Gas & Overrides

The SDK automatically simulates transactions before executing.

- For factory `create()` transactions, the SDK uses a default gas limit of 13,500,000. You can override via the `gas` field on `CreateStaticAuctionParams`/`CreateDynamicAuctionParams`.
- For other writes (e.g., token `approve`/`release`), you can pass an optional `{ gas }` to the method.

You can also manually estimate gas:

```typescript
const gasEstimate = await publicClient.estimateGas({
  account: walletClient.account,
  to: contractAddress,
  data: encodedData,
});
```

## Testing Examples

The SDK includes fork tests for selected EVM example flows. These tests run against forked/live network state and validate the covered example paths without implying every example file has a dedicated fork test.

### Running Fork Tests

To run the fork tests, you'll need an RPC URL for Base Sepolia:

```bash
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ANVIL_FORK_ENABLED=true pnpm vitest run --config vitest.fork.config.ts test/evm/fork/base-sepolia/multicurve-dev-buy-weth.base-sepolia.test.ts
```

### Test Coverage

The following example groups have corresponding fork tests:

- **Multicurve Examples**: `test/multicurve*.test.ts`
- **Quote & Swap**: `test/multicurve-quote-swap.test.ts`
- **Indexer Data**: `test/multicurve-indexer-data.test.ts`
- **Dev Buys with WETH**: `test/multicurve-dev-buy-weth.test.ts`

Fork tests validate:

- Contract module whitelisting on target chain
- Transaction simulation without spending gas
- Correct parameter encoding
- Expected return values and pool addresses

## Support

For questions or issues:

- Read the [SDK documentation](../README.md)
- Check the [migration guide](../docs/migration-guide.md)
- Open an issue on [GitHub](https://github.com/doppler-sdk/issues)
