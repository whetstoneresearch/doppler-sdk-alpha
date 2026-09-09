# Doppler SDK

A unified TypeScript SDK for interacting with the Doppler Protocol across EVM and Solana/SVM deployments.

## Overview

The Doppler SDK exposes network-specific entrypoints for creating, managing, and interacting with Doppler launches. The EVM entrypoint consolidates functionality from the previous `doppler-v3-sdk` and `doppler-v4-sdk` packages into one interface for Ethereum and EVM-compatible chains. The Solana entrypoint provides generated instruction builders, PDA helpers, clients, React bindings, and examples for Doppler's SVM programs.

### Key Features

- **EVM Auctions**: Static auctions, dynamic auctions, and multicurve launches across Uniswap V3/V4 paths
- **EVM Migration Paths**: Support for V2, V2 split, V4, V4 split, DopplerHook, and no-op migration
- **EVM Multicurve Fees**: Single-token and batched pending-fee previews plus beneficiary fee claiming for locked multicurve pools
- **Solana Launches**: Initializer, CPMM, migrator, hook, oracle, and Token-2022-compatible instruction helpers
- **Solana Clients and React**: Read clients, PDA helpers, generated codecs, and optional React bindings
- **Token Management**: Built-in EVM support for DERC20 tokens with vesting
- **Type Safety**: Full TypeScript support across EVM and Solana entrypoints
- **Network Support**: EVM deployments on Base, Arbitrum One, Unichain, Ink, and other supported chains; Solana/SVM support via explicit Solana program deployments

## Installation

```bash
npm install @whetstone-research/doppler-sdk viem
# or
yarn add @whetstone-research/doppler-sdk viem
# or
pnpm add @whetstone-research/doppler-sdk viem
```

Use network-specific entrypoints:

```typescript
import { DopplerSDK } from '@whetstone-research/doppler-sdk/evm';
import {
  initializer,
  cpmm,
  cpmmMigrator,
} from '@whetstone-research/doppler-sdk/solana';
import { DopplerSolanaProvider } from '@whetstone-research/doppler-sdk/solana/react';
```

## Quick Start

### EVM

```typescript
import { DopplerSDK } from '@whetstone-research/doppler-sdk/evm';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

// Set up viem clients
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const walletClient = createWalletClient({
  chain: base,
  transport: http(),
  account: '0x...', // Your wallet address
});

// Initialize the SDK
const sdk = new DopplerSDK({
  publicClient,
  walletClient,
  chainId: base.id,
});
```

### Solana

```typescript
import { address, createSolanaRpc, type Address } from '@solana/kit';
import { cpmm, initializer } from '@whetstone-research/doppler-sdk/solana';

const rpc = createSolanaRpc('https://api.devnet.solana.com');
const WSOL_MINT: Address =
  'So11111111111111111111111111111111111111112' as Address;

if (!process.env.BASE_MINT) {
  throw new Error('BASE_MINT must be set');
}

const baseMint = address(process.env.BASE_MINT);
const [initializerConfig] = await initializer.getConfigAddress();
const [cpmmConfig] = await cpmm.getConfigAddress();
const pool = await cpmm.getPoolByMints(rpc, baseMint, WSOL_MINT);

console.log('Initializer config:', initializerConfig);
console.log('CPMM config:', cpmmConfig);
console.log('Pool:', pool?.address ?? 'not found');
```

For runnable Solana flows, configure `examples/.env` and run with `pnpm tsx`, for example `pnpm tsx examples/solana-launch-by-marketcap.ts`:

- [examples/solana-launch-by-marketcap.ts](./examples/solana-launch-by-marketcap.ts)
- [examples/solana-adv-launch.ts](./examples/solana-adv-launch.ts)
- [examples/solana-adv-e2e-launch.ts](./examples/solana-adv-e2e-launch.ts)
- [examples/solana-cosigner-gated-launch.ts](./examples/solana-cosigner-gated-launch.ts)
- [examples/solana-cosigner-gated-buy.ts](./examples/solana-cosigner-gated-buy.ts)
- [examples/solana-usdc-e2e-launch.ts](./examples/solana-usdc-e2e-launch.ts)
- [examples/solana-usdc-cosigner-gated-buy.ts](./examples/solana-usdc-cosigner-gated-buy.ts)
- [examples/solana-prediction-market.ts](./examples/solana-prediction-market.ts)
- [examples/solana-swap.ts](./examples/solana-swap.ts)
- [examples/solana-vesting-launch.ts](./examples/solana-vesting-launch.ts)
- [examples/solana-vesting-claim.ts](./examples/solana-vesting-claim.ts)

To implement an independently deployed callback program, see
[Building a custom Solana hook](./docs/solana-custom-hooks.md) and the
[minimal Anchor example](./examples/solana-custom-hook/).

Resolve managed swap cosigning before constructing a launch:

```typescript
const cosignerGate = await dopplerLaunchHookV1.resolveManagedCosignerGate(rpc, {
  programId: deployment.dopplerLaunchHookV1Program,
  expiresAt,
});

const launch = await createLaunch({ ...input, cosignerGate });
```

The resolver verifies the hook's singleton config and selects its first active
Doppler-managed signer. `createLaunch` then pins that signer in the launch's
immutable remaining-account commitment without performing an RPC read. Launch
creators do not provide or register a cosigner key through this high-level
flow. Low-level hook payload and remaining-account helpers accept a cosigner
only to reconstruct an already-authorized launch commitment.

Cosigning through Doppler launch hook v1 is a Doppler-managed service.
Integrators that require their own cosigner must deploy and use a separate hook
program approved by the protocol. Passing a different cosigner to low-level
payload or remaining-account helpers does not authorize or register that key
with the Doppler-managed hook.

## Creating Auctions

### Static Auction (Fixed Price Range)

Static auctions use Uniswap V3 pools with concentrated liquidity in a fixed price range. They're ideal for simple, predictable price discovery.

```typescript
import { StaticAuctionBuilder } from '@whetstone-research/doppler-sdk/evm';
import { base } from 'viem/chains';

const params = new StaticAuctionBuilder(base.id)
  .tokenConfig({
    type: 'standard',
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000000'),
    numTokensToSell: parseEther('900000000'),
    numeraire: '0x...',
  })
  .poolByTicks({
    startTick: -92200,
    endTick: -69000,
    fee: 10000,
    numPositions: 15,
  })
  .withVesting({
    duration: BigInt(365 * 24 * 60 * 60),
    // Optional: specify multiple recipients and amounts
    // recipients: ['0xTeam...', '0xAdvisor...'],
    // amounts: [parseEther('50000000'), parseEther('50000000')]
    // Optional: define per-beneficiary vesting allocations on the DERC20 V2 path
    // allocations: [
    //   {
    //     recipient: '0xTeam...',
    //     amount: parseEther('50000000'),
    //     schedule: { duration: BigInt(180 * 24 * 60 * 60), cliffDuration: 30 * 24 * 60 * 60 },
    //   },
    //   {
    //     recipient: '0xAdvisor...',
    //     amount: parseEther('50000000'),
    //     schedule: { duration: BigInt(365 * 24 * 60 * 60), cliffDuration: 90 * 24 * 60 * 60 },
    //   },
    // ]
  })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build();

const result = await sdk.factory.createStaticAuction(params);
console.log('Pool address:', result.poolAddress);
console.log('Token address:', result.tokenAddress);
```

Explicit `type: 'standard'` tokens with `cliffDuration > 0` or `allocations` use the legacy DERC20 V2 factory and expose schedule-aware reads via `sdk.getDerc20V2(tokenAddress)`. When `allocations` is provided, the SDK dedupes identical schedules internally and maps each recipient to the correct onchain schedule.

For a runnable example, see [examples/multicurve-per-beneficiary-vesting.ts](./examples/multicurve-per-beneficiary-vesting.ts).

> **Tick spacing reminder:** When you provide ticks manually via `poolByTicks`, make sure both `startTick` and `endTick` are exact multiples of the fee tier's tick spacing (100→1, 500→10, 3000→60, 10000→200). The SDK now validates this locally and will fail fast if the ticks are misaligned.

### Static Auction with Lockable Beneficiaries (V3)

When you want fee revenue to flow to specific addresses without migrating liquidity, use lockable beneficiaries. The pool enters a "Locked" state where trading fees are collected and distributed to beneficiaries:

```typescript
import {
  StaticAuctionBuilder,
  WAD,
  getAirlockOwner,
} from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';

// Get the protocol owner (required beneficiary with min 5%)
const protocolOwner = await getAirlockOwner(publicClient);

// Define beneficiaries - shares must sum to WAD (1e18 = 100%)
const beneficiaries = [
  { beneficiary: protocolOwner, shares: parseEther('0.05') }, // 5% (minimum required)
  { beneficiary: '0xTeamWallet...', shares: parseEther('0.45') }, // 45%
  { beneficiary: '0xDAOTreasury...', shares: parseEther('0.50') }, // 50%
];

const params = new StaticAuctionBuilder(chainId)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000000'),
    numTokensToSell: parseEther('900000000'),
    numeraire: wethAddress,
  })
  .poolByTicks({
    startTick: 174960, // Must be multiple of 60 for fee 3000
    endTick: 225000,
    fee: 3000, // Set > 0 to accumulate fees for beneficiaries
  })
  .withBeneficiaries(beneficiaries) // Lock pool and enable fee streaming
  .withMigration({ type: 'noOp' }) // Use NoOp since pool is locked
  .withGovernance({ type: 'default' })
  .withUserAddress('0x...')
  .build();

const result = await sdk.factory.createStaticAuction(params);
console.log('Pool address:', result.poolAddress); // SAVE THIS - needed to collect fees!
```

**Important Notes:**

- **Shares must sum to exactly WAD (1e18 = 100%)**
- **Protocol owner must receive at least 5%** of fees
- **SDK automatically sorts beneficiaries** by address (ascending)
- **Use `withMigration({ type: 'noOp' })`** - locked pools cannot migrate
- **Set fee > 0** (e.g., 3000 for 0.3%) to accumulate trading fees
- **Pool status = "Locked"** - liquidity stays permanently in the V3 pool
- **Anyone can call `collectFees()`** to trigger distribution to beneficiaries

See [examples/static-auction-lockable-beneficiaries.ts](./examples/static-auction-lockable-beneficiaries.ts) for a complete example.

### Dynamic Auction (Dutch Auction)

Dynamic auctions use Uniswap V4 hooks to implement gradual Dutch auctions where the price moves over time.

```typescript
import {
  DynamicAuctionBuilder,
  DAY_SECONDS,
} from '@whetstone-research/doppler-sdk/evm';
import { base } from 'viem/chains';

const params = new DynamicAuctionBuilder(base.id)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x...',
  })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByTicks({
    duration: 7 * DAY_SECONDS,
    epochLength: 3600,
    startTick: -92103,
    endTick: -69080,
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('1000'),
    numPdSlugs: 5,
  })
  .withVesting({
    duration: BigInt(365 * 24 * 60 * 60),
    // Optional: specify multiple recipients and amounts
    // recipients: ['0xTeam...', '0xAdvisor...'],
    // amounts: [parseEther('50000'), parseEther('50000')]
  })
  .withMigration({
    type: 'uniswapV4',
    fee: 3000,
    tickSpacing: 60,
    streamableFees: {
      lockDuration: 365 * 24 * 60 * 60,
      beneficiaries: [
        { beneficiary: '0x...', shares: parseEther('0.5') }, // 50%
        { beneficiary: '0x...', shares: parseEther('0.5') }, // 50%
      ],
    },
  })
  // Optional: override module addresses instead of chain defaults
  .withAirlock('0xAirlock...')
  .withPoolManager('0xPoolMgr...')
  .withDopplerDeployer('0xDeployer...')
  .withTokenFactory('0xFactory...')
  .withV4Initializer('0xInitializer...')
  .withGovernanceFactory('0xGovFactory...') // used for standard, no-op, or launchpad governance overrides
  // .withV2Migrator('0xV2Migrator...')
  // .withV3Migrator('0xV3Migrator...')
  // .withV4Migrator('0xV4Migrator...')
  .withUserAddress('0x...')
  .build();

const result = await sdk.factory.createDynamicAuction(params);
console.log('Hook address:', result.hookAddress);
console.log('Token address:', result.tokenAddress);
```

### Opening Auction (Lifecycle + Bid Management)

Support includes:

- `sdk.buildOpeningAuction()` for `CreateOpeningAuctionParams`
- `sdk.factory.simulateCreateOpeningAuction(params)` and `sdk.factory.createOpeningAuction(params)`
- `sdk.getOpeningAuction(hookAddress)` for hook reads + `settleAuction()` / `claimIncentives()`
- `sdk.factory.simulateCompleteOpeningAuction(...)` and `sdk.factory.completeOpeningAuction(...)` for handoff to Doppler
- `sdk.getOpeningAuctionLifecycle(initializerAddress?)` for initializer-level state + complete/recover/sweep helpers
- `sdk.getOpeningAuctionPositionManager(positionManagerAddress?)` for placing/withdrawing opening-auction bids
  - Resolve the address via `await (await sdk.getOpeningAuctionLifecycle(initializerAddress)).getPositionManager()` when chain defaults are not configured
  - Resolve `positionId` for incentives via `opening.getPositionId(...)` or `opening.claimIncentivesByPositionKey(...)` (no log parsing required)

> **Base caveat:** on Base mainnet (`chainId = 8453`), `openingAuctionInitializer` and `openingAuctionPositionManager` default to `0x0000000000000000000000000000000000000000` until deployment. Override with `.withOpeningAuctionInitializer('0x...')` / `.withOpeningAuctionPositionManager('0x...')` (or pass explicit addresses) before using opening-auction create/completion/bid flows there.

```typescript
const params = sdk
  .buildOpeningAuction()
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x...',
  })
  .openingAuctionConfig({
    auctionDuration: 3600,
    minAcceptableTickToken0: -887220,
    minAcceptableTickToken1: -887220,
    incentiveShareBps: 500,
    tickSpacing: 60,
    fee: 3000,
    minLiquidity: 1n,
    shareToAuctionBps: 8000,
  })
  .dopplerConfig({
    minProceeds: parseEther('10'),
    maxProceeds: parseEther('100'),
    startTick: -69080,
    endTick: -92103,
  })
  .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 60 })
  .withUserAddress('0x...')
  .withOpeningAuctionInitializer('0x...') // required on Base until deployed
  .build();

const sim = await sdk.factory.simulateCreateOpeningAuction(params);
const created = await sim.execute();

const opening = await sdk.getOpeningAuction(created.openingAuctionHookAddress);
await opening.getPhase();

const lifecycle = await sdk.getOpeningAuctionLifecycle('0x...');
await lifecycle.getState(created.tokenAddress);

await sdk.factory.completeOpeningAuction({
  asset: created.tokenAddress,
  initializerAddress: '0x...',
});
```

`completeOpeningAuction` auto-settles and auto-mines `dopplerSalt` when omitted; because completion mining can race with block timestamps/state changes, the SDK may re-mine and retry a few times if needed. `simulateCompleteOpeningAuction` requires the opening auction to already be settled.

Position-manager bid wrappers are available, but bid sizing is still “advanced user”: `liquidity` is Uniswap V4 liquidity units. Use `simulatePlaceBid(...)` / `simulateWithdrawBid(...)` to inspect the `BalanceDelta` (token amounts in/out) and iterate. During the active auction, liquidity withdrawals must be full (no partial removals); use `withdrawFullBid(...)` to read the onchain liquidity and withdraw safely.

See [examples/opening-auction-lifecycle.ts](./examples/opening-auction-lifecycle.ts) for the full builder/factory/lifecycle flow, and [examples/opening-auction-bidding.ts](./examples/opening-auction-bidding.ts) for the bid-management pattern + positionId resolution.

### Multicurve Auction (V4 Multicurve Initializer)

Multicurve auctions use `DopplerHookInitializer` by default to seed liquidity across multiple curves in a single Uniswap V4 pool. The typed initializer modes are `dopplerHookInitializer`, `standard`, `scheduled`, `decay`, and `rehype`; use `withV4MulticurveInitializer(address)` when explicitly targeting the legacy standard initializer.

**Multicurve with Migration:**

```typescript
import { MulticurveBuilder } from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';
import { base } from 'viem/chains';

const params = new MulticurveBuilder(base.id)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x...',
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
  // Choose a migration path (V2, V2 split, V4, V4 split, DopplerHook, or noOp)
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build();

const result = await sdk.factory.createMulticurve(params);
console.log('Pool address:', result.poolAddress);
console.log('Token address:', result.tokenAddress);
```

**Deterministic preview/create identities:**

By default, each independent multicurve assembly generates a new salt and may
predict a different token and pool identity. Supply an explicit 32-byte salt
when separate preview and create operations must assemble the same
`CreateParams`:

```typescript
import type { Hex } from 'viem';

const salt =
  '0x1111111111111111111111111111111111111111111111111111111111111111' satisfies Hex;

const deterministicParams = { ...params, salt };
const preview = await sdk.factory.simulateCreateMulticurve(deterministicParams);
```

Persist and reuse the salt with otherwise identical inputs for a later
independent create operation. Builder users can call `.withSalt(salt)` before
`.build()`. Omitting the salt, or clearing it with `.withSalt(undefined)`,
preserves the generated-salt behavior. Explicit salts must be `0x` followed by
exactly 64 hexadecimal characters.

**Market Cap Presets (Low / Medium / High):**

```typescript
import {
  MulticurveBuilder,
  FEE_TIERS,
} from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';
import { base } from 'viem/chains';

const presetParams = new MulticurveBuilder(base.id)
  .tokenConfig({
    name: 'Preset Launch',
    symbol: 'PRST',
    tokenURI: 'ipfs://preset.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x...',
  })
  .withMarketCapPresets({
    fee: FEE_TIERS.LOW, // defaults to 0.05% fee tier (tick spacing 10)
    presets: ['low', 'medium', 'high'], // defaults to all tiers
    // overrides: { high: { shares: parseEther('0.25') } }, // optional per-tier tweaks
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build();

const presetResult = await sdk.factory.createMulticurve(presetParams);
console.log('Pool address:', presetResult.poolAddress);
console.log('Token address:', presetResult.tokenAddress);
```

The preset helper seeds three curated curve buckets sized for ~1B token supply targets:

- `low`: 50% of the sale allocated to a $0-$3M market cap window.
- `medium`: 25% targeting roughly $1k-$40M market caps.
- `high`: 24% aimed at $100k-$1B market caps.

Pass `presets` to pick a subset (e.g. `['medium', 'high']`) or provide `overrides` to adjust ticks, positions, or shares for a specific tier. When the selected presets sum to less than 100%, the builder automatically appends a filler curve (using the highest selected tier's shape) so liquidity always covers the full sale. Shares must stay within 0-1e18 and the helper will throw if the total ever exceeds 100%.

**Scheduled Multicurve Launch:**

```typescript
import { MulticurveBuilder } from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';
import { base } from 'viem/chains';

const startTime = Math.floor(Date.now() / 1000) + 3600; // one hour from now

const scheduled = new MulticurveBuilder(base.id)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'ipfs://scheduled.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x4200000000000000000000000000000000000006',
  })
  .poolConfig({
    fee: 0,
    tickSpacing: 8,
    curves: [
      {
        tickLower: 0,
        tickUpper: 240000,
        numPositions: 12,
        shares: parseEther('0.5'),
      },
      {
        tickLower: 16000,
        tickUpper: 240000,
        numPositions: 12,
        shares: parseEther('0.5'),
      },
    ],
  })
  .withSchedule({ startTime })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build();

const scheduledResult = await sdk.factory.createMulticurve(scheduled);
console.log('Pool address:', scheduledResult.poolAddress);
console.log('Token address:', scheduledResult.tokenAddress);
```

Ensure the target chain has the scheduled multicurve initializer whitelisted. If you are targeting a custom deployment, override it via `.withV4ScheduledMulticurveInitializer('0x...')`.

**Decay Multicurve Launch (Dynamic Fee):**

```typescript
import { MulticurveBuilder } from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';
import { baseSepolia } from 'viem/chains';

const startTime = Math.floor(Date.now() / 1000) + 300;

const decay = new MulticurveBuilder(baseSepolia.id)
  .tokenConfig({
    name: 'Decay Token',
    symbol: 'DMC',
    tokenURI: 'ipfs://decay.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x4200000000000000000000000000000000000006',
  })
  .poolConfig({
    fee: 500, // terminal fee (0.05%)
    tickSpacing: 10,
    curves: [
      {
        tickLower: 0,
        tickUpper: 220000,
        numPositions: 12,
        shares: parseEther('0.5'),
      },
      {
        tickLower: 20000,
        tickUpper: 220000,
        numPositions: 12,
        shares: parseEther('0.5'),
      },
    ],
  })
  .withDecay({
    startTime,
    startFee: 3000, // starts at 0.3%
    durationSeconds: 3600, // decays to pool.fee over 1 hour
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build();

const decayResult = await sdk.factory.createMulticurve(decay);
console.log('Pool address:', decayResult.poolAddress);
console.log('Token address:', decayResult.tokenAddress);
```

For decay pools, `pool.fee` is always the terminal fee (`endFee`) of the schedule. `withDecay({ startTime })` is optional; if omitted, `startTime` defaults to `0`. The SDK supports `startFee` values up to `800_000` (80%) for anti-sniping configurations. Ensure your deployed decay initializer/hook also supports the same max start fee. Override the decay initializer module with `.withV4DecayMulticurveInitializer('0x...')` when targeting custom deployments.

**Multicurve with Lockable Beneficiaries (NoOp Migration):**

When you want fee revenue to flow to specific addresses without migrating liquidity after the auction, use lockable beneficiaries with NoOp migration:

```typescript
import { MulticurveFees, WAD } from '@whetstone-research/doppler-sdk/evm';

// Define beneficiaries with shares that sum to WAD (1e18 = 100%)
// IMPORTANT: Protocol owner must be included with at least 5% shares
const lockableBeneficiaries = [
  { beneficiary: '0xProtocolOwner...', shares: WAD / 10n }, // 10% to protocol (>= 5% required)
  { beneficiary: '0xYourAddress...', shares: (WAD * 4n) / 10n }, // 40%
  { beneficiary: '0xOtherAddress...', shares: WAD / 2n }, // 50%
];

const params = new MulticurveBuilder(base.id)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x...',
  })
  .poolConfig({
    fee: 3000, // 0.3% fee tier - set > 0 to accumulate fees for beneficiaries
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
    beneficiaries: lockableBeneficiaries, // Add beneficiaries for fee streaming
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'noOp' }) // Use NoOp migration with lockable beneficiaries
  .withUserAddress('0x...')
  .build();

const result = await sdk.factory.createMulticurve(params);
const assetAddress = result.tokenAddress; // SAVE THIS - you'll need it to collect fees!
console.log('Asset address:', assetAddress);

// Later, to preview and claim fees while the pool is locked:
// const pool = await sdk.getMulticurvePool(assetAddress)
// const pending = await pool.getPendingFees('0xBeneficiary...')
// await pool.collectFees()
//
// To preview many locked multicurve tokens at once:
// const fees = new MulticurveFees(publicClient, walletClient, tokenAddresses)
// const pendingByToken = await fees.getPendingFees('0xBeneficiary...')
```

**Important Notes:**

- Set `fee` > 0 (e.g., 3000 for 0.3%) to accumulate trading fees for beneficiaries
- **Save the asset address** (token address) returned from creation - you need it to collect fees later
- Use `MulticurvePool.getPendingFees(beneficiary)` to preview a beneficiary's claimable token0/token1 fees for one pool
- Use `MulticurveFees.getPendingFees(beneficiary)` to preview pending fees for multiple tokens with one multicall by default
- Pass `tokenBatchSize` to `MulticurveFees` when an RPC provider needs large pending-fee previews split into smaller token batches
- `collectFees()` claims a payout for the calling account only when the caller is a configured beneficiary
- Pool enters "Locked" status (status = 2) and liquidity cannot be migrated
- Beneficiaries are immutable and set at pool creation time
- The SDK automatically handles PoolKey construction and PoolId computation for you

See [examples/multicurve-lockable-beneficiaries.ts](./examples/multicurve-lockable-beneficiaries.ts) for a complete example.
See [docs/multicurve-fees.md](./docs/multicurve-fees.md) for single-token and multi-token pending-fee previews, claiming, batching, and current migrated-launch limitations.

#### Transaction gas override

- You can pass a gas limit to factory create calls via the `gas` field on `CreateStaticAuctionParams` / `CreateDynamicAuctionParams` / `CreateMulticurveParams`.
- If omitted, the SDK uses the simulation's gas estimate when available, falling back to 13,500,000 gas for the `create()` transaction.
- `simulateCreate*` helpers now return `gasEstimate` so you can tune overrides before sending.
- Builders expose `.withGasLimit(gas: bigint)` so you can set overrides fluently.

### Builder Pattern (Recommended)

Prefer using the builders to construct `CreateStaticAuctionParams` and `CreateDynamicAuctionParams` fluently and safely. Builders apply sensible defaults and can compute ticks and gamma for you.

```typescript
import {
  StaticAuctionBuilder,
  DynamicAuctionBuilder,
} from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';
import { base } from 'viem/chains';

// Dynamic auction via builder
const dynamicParams = new DynamicAuctionBuilder(base.id)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('500000'),
    numeraire: wethAddress,
  })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByPriceRange({
    priceRange: { startPrice: 0.0001, endPrice: 0.001 },
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('1000'),
  })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build();

const dyn = await sdk.factory.createDynamicAuction(dynamicParams);

// Static auction via builder
const staticParams = new StaticAuctionBuilder(base.id)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000000'),
    numTokensToSell: parseEther('900000000'),
    numeraire: wethAddress,
  })
  .poolByPriceRange({
    priceRange: { startPrice: 0.0001, endPrice: 0.001 },
    fee: 3000,
  })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build();

const stat = await sdk.factory.createStaticAuction(staticParams);
```

### Simplified Creation with Defaults

The SDK intelligently applies defaults when parameters are omitted. Here are examples with minimal configuration:

```typescript
// Minimal static auction via builder
const staticMinimal = new StaticAuctionBuilder(base.id)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000000'),
    numTokensToSell: parseEther('900000000'),
    numeraire: '0x...',
  })
  .poolByTicks({ fee: 10000 }) // uses default tick range and numPositions
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build();

const staticResult = await sdk.factory.createStaticAuction(staticMinimal);

// Minimal dynamic auction via builder
const dynamicMinimal = new DynamicAuctionBuilder(base.id)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/metadata.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x...',
  })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByTicks({
    startTick: -92103,
    endTick: -69080,
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('1000'),
  }) // duration/epoch defaults applied; gamma computed automatically
  .withMigration({ type: 'uniswapV4' })
  .withUserAddress('0x...')
  .build();

const dynamicResult = await sdk.factory.createDynamicAuction(dynamicMinimal);
```

## Interacting with Auctions

### Static Auction Interactions

```typescript
// Get a static auction instance
const auction = await sdk.getStaticAuction(poolAddress);

// Get pool information
const poolInfo = await auction.getPoolInfo();
console.log('Current price:', poolInfo.sqrtPriceX96);
console.log('Liquidity:', poolInfo.liquidity);

// Check if ready for migration
const hasGraduated = await auction.hasGraduated();

// Get current price
const price = await auction.getCurrentPrice();
```

### Dynamic Auction Interactions

```typescript
// Get a dynamic auction instance
const auction = await sdk.getDynamicAuction(hookAddress);

// Get comprehensive hook information
const hookInfo = await auction.getHookInfo();
console.log('Total proceeds:', hookInfo.state.totalProceeds);
console.log('Tokens sold:', hookInfo.state.totalTokensSold);

// Check auction status
const hasEndedEarly = await auction.hasEndedEarly();
const currentEpoch = await auction.getCurrentEpoch();
```

### Multicurve Pool Interactions

Multicurve pools support fee collection and beneficiary claims when configured
with `pool.beneficiaries` and no-op migration.

```typescript
import { MulticurveFees } from '@whetstone-research/doppler-sdk/evm';

// Get a multicurve pool instance using the asset address (token address)
const pool = await sdk.getMulticurvePool(assetAddress);

// Get pool state
const state = await pool.getState();
console.log('Asset:', state.asset);
console.log('Numeraire:', state.numeraire);
console.log('Fee tier:', state.fee);
console.log('Tick spacing:', state.tickSpacing);
console.log('Hook address:', state.poolKey.hooks);
console.log('Far tick threshold:', state.farTick);
console.log('Pool status:', state.status); // 0=Uninitialized, 1=Initialized, 2=Locked, 3=Exited

// For dynamic-fee multicurve pools, read the live decay fee schedule
const feeSchedule = await pool.getFeeSchedule();
if (feeSchedule) {
  console.log('Fee schedule:', feeSchedule);
}

// Preview pending fees for a beneficiary. This is a read-only call.
const pendingFees = await pool.getPendingFees(beneficiaryAddress);
console.log('Pending fees (token0):', pendingFees.fees0);
console.log('Pending fees (token1):', pendingFees.fees1);

// Preview pending fees for multiple launched tokens. By default this builds
// one multicall for all requested tokens.
const multicurveFees = new MulticurveFees(
  publicClient,
  walletClient,
  [assetAddress, anotherAssetAddress],
  { tokenBatchSize: 25 },
);
const pendingFeesByToken =
  await multicurveFees.getPendingFees(beneficiaryAddress);
for (const pendingFees of pendingFeesByToken) {
  console.log('Asset:', pendingFees.tokenAddress);
  console.log('Pending fees (token0):', pendingFees.fees0);
  console.log('Pending fees (token1):', pendingFees.fees1);
}

// Claim fees from a beneficiary wallet while the pool is locked.
// Any account can call collectFees(), but only a configured beneficiary caller
// receives their pending share.
const { fees0, fees1, transactionHash } = await pool.collectFees();
console.log('Fees collected (token0):', fees0);
console.log('Fees collected (token1):', fees1);
console.log('Transaction:', transactionHash);

// Get token addresses
const tokenAddress = pool.getTokenAddress();
const numeraireAddress = await pool.getNumeraireAddress();
```

**Fee Collection Technical Details:**

The SDK handles the complexity of fee collection by:

1. **Retrieving pool configuration** from the multicurve initializer contract
2. **Detecting pool status** so only locked initializer-side pools proceed
3. **Computing the PoolId** from the PoolKey using `keccak256(abi.encode(poolKey))`
4. **Previewing pending fees** with a Multicall3 aggregate that simulates collection and reads beneficiary share/checkpoint data
5. **Calling the initializer** with the computed PoolId when a beneficiary claims via `collectFees()`

**Important Notes:**

- Fees accumulate from swap activity on the pool (only if fee tier > 0)
- `MulticurvePool.getPendingFees(beneficiary)` returns the beneficiary's pending share for both tokens in one pair
- `MulticurveFees.getPendingFees(beneficiary)` returns pending fees for each requested token and uses one multicall by default
- `MulticurveFees` accepts `tokenBatchSize` when large token lists need to be split into smaller multicalls
- `collectFees()` sends a transaction; the caller needs a wallet client
- Anyone can call `collectFees()`, but only a configured beneficiary caller receives their pending share
- The `collectFees()` return values are the newly collected pool fees, not necessarily the caller's beneficiary payout
- Works exclusively with initializer-side locked pools created with `pool.beneficiaries` and no-op migration
- Pools in "Locked" status (status = 2) use the multicurve initializer for collection
- Pools in "Exited" status (status = 3) are migrated and are not currently supported by `MulticurvePool.getPendingFees()` or `MulticurvePool.collectFees()`
- `getFeeSchedule()` returns decay schedule details only for dynamic-fee multicurve pools, otherwise `null`
- Beneficiaries must be configured at pool creation time and cannot be changed

**Common Use Cases:**

- Preview pending fees for a portfolio or paginated token list
- Set up periodic fee collection (e.g., daily or weekly)
- Integrate with a bot that automatically collects fees when threshold is reached
- Allow any beneficiary to trigger collection after significant trading activity
- Monitor swap events to determine optimal collection timing

See [docs/multicurve-fees.md](./docs/multicurve-fees.md) for a focused guide, [examples/multicurve-get-pending-fees.ts](./examples/multicurve-get-pending-fees.ts) for batched previews, and [examples/multicurve-collect-fees.ts](./examples/multicurve-collect-fees.ts) for claims.

## Token Management

### DERC20 Tokens

The SDK includes full support for DERC20 tokens with vesting functionality:

```typescript
// Get a DERC20 instance from the SDK (uses its clients)
const token = sdk.getDerc20(tokenAddress);

// Read token information
const name = await token.getName();
const symbol = await token.getSymbol();
const balance = await token.getBalanceOf(address);

// Vesting functionality
const vestingData = await token.getVestingData(address);
console.log('Total vested:', vestingData.totalAmount);
console.log('Released:', vestingData.releasedAmount);

// Release currently available vested tokens
await token.release();
```

Alternatively, you can instantiate directly if needed:

```typescript
import { Derc20 } from '@whetstone-research/doppler-sdk/evm';
const tokenDirect = new Derc20(publicClient, walletClient, tokenAddress);
```

For a runnable release-focused example covering legacy DERC20, DERC20 V2 schedules, and DopplerERC20V1 partial releases, see [examples/vesting-release.ts](./examples/vesting-release.ts).

### DopplerERC20V1 Tokens

DopplerERC20V1 is the default token template when `type` is omitted. Set `type: 'dopplerERC20V1'` to make that choice explicit, or set `type: 'standard'` to use the legacy token path, where cliff/allocation vesting routes to the legacy DERC20 template. The SDK uses the configured `dopplerERC20V1Factory` by default; `withTokenFactory(address)` takes precedence but must point to a factory compatible with the selected token path and token data ABI. `controller` is optional and defaults to the zero address, so set it only if early balance-limit disable should be possible.

When balance limiting is enabled on the default DopplerERC20V1 integration, the SDK encodes user exclusions plus determinable protocol recipients for the selected auction path into deployment-time `excludedFromBalanceLimit`, including initializers, hooks, PoolManager, migrators, known migration pools, no-op governance, and launchpad governance multisigs. It cannot safely predict the nonce-based timelock created by `default` or `custom` governance. For those governance modes, the SDK rejects configurations where `initialSupply - numTokensToSell - vesting allocations` exceeds `maxBalanceLimit`, because Airlock would transfer that excess to the non-excluded timelock and revert. Allocate enough tokens to the sale or vesting, increase the limit, or use no-op or launchpad governance. Custom `withTokenFactory(address)` paths receive only the `excludedFromBalanceLimit` entries supplied in `tokenConfig`, so custom token factory users must provide required deployment-time protocol exclusions themselves. Exclusions cannot be added later through the controller or governance.

DopplerERC20V1 supports vesting through `withVesting` while staying on the DopplerERC20V1 factory path: use `duration` with optional `cliffDuration` for a shared schedule, or `allocations` for per-beneficiary schedules.

```typescript
const params = new StaticAuctionBuilder(base.id)
  .tokenConfig({
    name: 'My Doppler Token',
    symbol: 'MDT',
    tokenURI: 'ipfs://doppler-token.json',
    maxBalanceLimit: parseEther('10000'),
    balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
    controller: userAddress, // optional; defaults to zero address when omitted
    excludedFromBalanceLimit: [userAddress], // default DopplerERC20V1 path also adds protocol modules
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: wethAddress,
  })
  .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
  .withVesting({
    duration: 365n * BigInt(DAY_SECONDS),
    cliffDuration: 30 * DAY_SECONDS,
    recipients: [userAddress],
    amounts: [parseEther('100000')],
  })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(userAddress)
  .build();
```

DopplerERC20V1 token data includes schedule vesting and balance-limit controls, but it intentionally omits `yearlyMintRate`; DopplerERC20V1 tokens do not expose `mintInflation` or mint-rate update helpers.

```typescript
const token = sdk.getDopplerERC20V1(tokenAddress);
const scheduleCount = await token.getVestingScheduleCount();

for (let scheduleId = 0n; scheduleId < scheduleCount; scheduleId++) {
  const schedule = await token.getVestingSchedule(scheduleId);
  const available = await token.getAvailableVestedAmountForSchedule(
    userAddress,
    scheduleId,
  );
  console.log(schedule, available);

  // Release half of the available vested amount for one schedule.
  if (available > 0n) await token.releaseSchedule(scheduleId, available / 2n);
}

console.log(await token.getMaxBalanceLimit());
console.log(await token.getBalanceLimitEnd());
console.log(await token.isBalanceLimitActive());
```

For a runnable example, see [examples/doppler-erc20-v1.ts](./examples/doppler-erc20-v1.ts).

### Governance Delegation (ERC20Votes)

DERC20 extends OpenZeppelin's ERC20Votes. Voting power is tracked via checkpoints and only updates once an address delegates voting power (typically to itself). The SDK exposes simple read/write helpers for delegation.

Basics:

```ts
import { Derc20 } from '@whetstone-research/doppler-sdk/evm';

const token = sdk.getDerc20(tokenAddress);

// Read: who an account delegates to, and current voting power
const currentDelegate = await token.getDelegates(userAddress);
const votes = await token.getVotes(userAddress);

// Self‑delegate to activate vote tracking
await token.delegate(userAddress);

// Or delegate to another address
await token.delegate('0xDelegatee...');
```

Historical votes:

```ts
// OZ v5 uses timepoints (block numbers for block‑based clocks)
const blockNumber = await publicClient.getBlockNumber();
const pastVotes = await token.getPastVotes(userAddress, blockNumber - 1n);
```

Signature‑based delegation (delegateBySig):

```ts
// Signs an EIP‑712 message and submits a transaction calling delegateBySig
// Note: This still submits a transaction from the connected wallet.
const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1h
await token.delegateBySig('0xDelegatee...', expiry);
```

Advanced: gasless delegation via relayer

- The token supports `delegateBySig(delegatee, nonce, expiry, v, r, s)`. A relayer can submit this on behalf of the user if it holds ETH for gas.
- To do this, have the user sign typed data, then send the signature to your backend that calls the contract.

Client (sign only):

```ts
const [nonce, name] = await Promise.all([
  publicClient.readContract({
    address: tokenAddress,
    abi: derc20Abi,
    functionName: 'nonces',
    args: [userAddress],
  }),
  token.getName(),
]);
const chainId = await publicClient.getChainId();
const domain = {
  name,
  version: '1',
  chainId,
  verifyingContract: tokenAddress,
} as const;
const types = {
  Delegation: [
    { name: 'delegatee', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
} as const;
const message = { delegatee: '0xDelegatee...', nonce, expiry } as const;

const signature = await walletClient.signTypedData({
  domain,
  types,
  primaryType: 'Delegation',
  message,
  account: userAddress,
});
// POST { signature, delegatee, nonce, expiry } to your relayer
```

Relayer (submit tx):

```ts
function splitSig(sig: `0x${string}`) {
  const r = `0x${sig.slice(2, 66)}` as `0x${string}`;
  const s = `0x${sig.slice(66, 130)}` as `0x${string}`;
  let v = parseInt(sig.slice(130, 132), 16);
  if (v < 27) v += 27;
  return { v, r, s };
}

const { v, r, s } = splitSig(signature);
await relayerWallet.writeContract({
  address: tokenAddress,
  abi: derc20Abi,
  functionName: 'delegateBySig',
  args: ['0xDelegatee...', nonce, expiry, v, r, s],
});
```

Notes

- Users must delegate (even to themselves) before votes appear in `getVotes`.
- `getPastVotes`/`getPastTotalSupply` expect a timepoint; for block‑based clocks, pass a block number that has already been mined.
- Events you may track: `DelegateChanged` and `DelegateVotesChanged` for live updates.

### Native ETH

The SDK also provides an ETH wrapper with ERC20-like interface:

```typescript
import { Eth } from '@whetstone-research/doppler-sdk/evm';

const eth = new Eth(publicClient, walletClient);
const balance = await eth.getBalanceOf(address);
```

## Price Quotes

Get price quotes across Uniswap V2, V3, and V4:

```typescript
const quoter = sdk.quoter;

// Quote on Uniswap V3
const quote = await quoter.quoteV3ExactInputSingle({
  tokenIn: tokenAddress,
  tokenOut: wethAddress,
  amountIn: parseEther('1000'),
  fee: 3000,
  sqrtPriceLimitX96: 0n,
});

console.log('Expected output:', quote.amountOut);
console.log('Price after swap:', quote.sqrtPriceX96After);
```

## Atomic Multicurve Dev Buy

Multicurve dev buys create the market and execute one exact-input purchase through Bundler in the same transaction. They support DopplerHookInitializer and Rehype initializer families; standard, scheduled, and decay initializers reject them. Production use is intended for compatible Rehype launches with no-op governance and no-op migration.

```ts
const params = sdk
  .buildMulticurveAuction()
  // Configure token, sale, curves, and Rehype initializer as usual.
  .withGovernance({ type: 'noOp' })
  .withMigration({ type: 'noOp' })
  .withDevBuy({
    exactAmountIn: parseEther('0.01'),
    recipient: user,
    vesting: {
      vestingDuration: 7n * 24n * 60n * 60n,
      cliffDuration: 24n * 60n * 60n,
      permissionlessClaim: false,
    },
  })
  .build();

const simulated = await sdk.factory.simulateCreateMulticurve(params);
const result = await simulated.execute();

console.log('Simulated output:', simulated.devBuy?.simulatedAmountOut);
console.log('Actual output:', result.devBuy?.amountOut);
```

Omit `vesting` to deliver the purchased tokens directly to `recipient`. When vesting is configured, Bundler holds the output and releases it under the specified schedule; this is independent from `.withVesting(...)`, which configures token allocation vesting. `cliffDuration` defaults to zero and `permissionlessClaim` defaults to `false`.

Native numeraire sends exactly `exactAmountIn` with the Bundler transaction. ERC-20 numeraire may require a separate exact approval transaction before the atomic create-and-buy transaction; the wallet must already hold the input token. Permit2 and Universal Router commands are not part of this flow.

Use `.withBundler(address)` for a compatible custom deployment. Read custody with `sdk.getBundler(address).getVesting(asset)` and `getClaimable(asset)`, then submit a vested claim with `claim(asset)`. Claims always pay the recorded recipient, including when `permissionlessClaim` allows another account to trigger them.

Bundler is exact-input only and provides no minimum output, deadline, or slippage guard. `simulateCreateMulticurve` returns the informational `simulatedAmountOut`; execution returns the amount verified from the Bundler receipt.

See [docs/quotes-and-swaps.md](./docs/quotes-and-swaps.md) and [examples/multicurve-dev-buy-weth.ts](./examples/multicurve-dev-buy-weth.ts) for complete flows.

## Migration Configuration

The SDK supports flexible migration paths after auction completion:

### Migrate to Uniswap V2

```typescript
migration: {
  type: 'uniswapV2',
}
```

### Migrate to Uniswap V4

```typescript
migration: {
  type: 'uniswapV4',
  fee: 3000,
  tickSpacing: 60,
  streamableFees: {
    lockDuration: 365 * 24 * 60 * 60, // 1 year
    beneficiaries: [
      { beneficiary: '0x...', shares: parseEther('1') }, // 100%
    ],
  },
}
```

### Migrate to Uniswap V2 with Proceeds Split

```typescript
migration: {
  type: 'uniswapV2Split',
  proceedsSplit: {
    recipient: '0xRecipient...',
    share: parseEther('0.1'), // 10%, capped at 50%
  },
}
```

- The split recipient receives the configured share of numeraire proceeds during migration.

### Migrate to Uniswap V4 with Proceeds Split

```typescript
migration: {
  type: 'uniswapV4Split',
  fee: 3000,
  tickSpacing: 8,
  streamableFees: {
    lockDuration: 30 * 24 * 60 * 60,
    beneficiaries: [
      { beneficiary: '0xAirlockOwner...', shares: parseEther('0.05') },
      { beneficiary: '0xTeam...', shares: parseEther('0.95') },
    ],
  },
  proceedsSplit: {
    recipient: '0xRecipient...',
    share: parseEther('0.1'),
  },
}
```

- `streamableFees` is required for `uniswapV4Split`.
- Beneficiaries must sum to `1e18`, and the Airlock owner must be included with at least 5% shares.

### Migrate via DopplerHookMigrator (Dynamic Auctions)

Use this mode when the migrated V4 pool needs an optional generic Doppler hook.
This migration type is only supported for dynamic auctions.

```typescript
const params = sdk
  .buildDynamicAuction()
  .tokenConfig({
    name: 'Example',
    symbol: 'EX',
    tokenURI: 'https://example.com/token.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('500000'),
    numeraire: addresses.weth,
  })
  .withMarketCapRange({
    marketCap: { start: 500_000, min: 50_000 },
    numerairePrice: 3000,
    minProceeds: parseEther('10'),
    maxProceeds: parseEther('1000'),
    fee: 3000,
    tickSpacing: 10,
  })
  .withMigration({
    type: 'dopplerHookMigrator',
    fee: 3000,
    tickSpacing: 10,
    lockDuration: 30 * 24 * 60 * 60,
    beneficiaries: [
      { beneficiary: '0xYourBeneficiary...', shares: parseEther('0.95') },
      await sdk.getAirlockBeneficiary(),
    ],
    hook: {
      hookAddress: '0xYourDopplerHook...',
      onInitializationCalldata: '0x...',
    },
  })
  .withUserAddress('0xYourAddress...')
  .build();
```

`dopplerHookMigrator` beneficiaries must include the current Airlock owner with
at least 5% shares, and total shares must sum to `1e18`. Omit `hook` for a
standard migrated pool without custom hook behavior.

For backwards compatibility, the deprecated `DopplerHookMigrationConfig` type
and its `type: 'dopplerHook'` discriminator remain accepted. New code should use
`DopplerHookMigratorConfig` with `type: 'dopplerHookMigrator'`. Multicurve
initializer params similarly accept the deprecated `type: 'dopplerHook'`
discriminator, which resolves to `dopplerHookInitializer`.

To make configuring the first beneficiary simpler, the SDK now exposes helpers for resolving the
airlock owner and creating the default 5% entry:

```ts
import {
  DopplerSDK,
  createAirlockBeneficiary,
  getAirlockOwner,
} from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';

const sdk = new DopplerSDK({ publicClient, chainId });

// Get the owner and construct the beneficiary entry (5% by default)
const airlockBeneficiary = await sdk.getAirlockBeneficiary();

// Or build the entry manually if you do not have an SDK instance handy
// (airlockEntry will be equivalent to airlockBeneficiary above)
const owner = await getAirlockOwner(publicClient);
const airlockEntry = createAirlockBeneficiary(owner); // defaults to 5% shares

const migration = {
  type: 'uniswapV4' as const,
  fee: 3000,
  tickSpacing: 60,
  streamableFees: {
    lockDuration: 365 * 24 * 60 * 60,
    beneficiaries: [
      airlockEntry, // or airlockBeneficiary (5%)
      { beneficiary: '0xYourDAO...', shares: parseEther('0.95') }, // 95%
    ],
  },
};
```

## Supported Chains

The SDK exposes runtime constants and TypeScript types for supported chains:

```ts
import {
  CHAIN_IDS,
  SUPPORTED_CHAIN_IDS,
  getAddresses,
  isSupportedChainId,
  type SupportedChainId,
  type ChainAddresses,
} from '@whetstone-research/doppler-sdk/evm';

// Validate and narrow a chain ID
function ensureSupported(id: number): SupportedChainId {
  if (!isSupportedChainId(id)) throw new Error('Unsupported chain');
  return id;
}

const chainId = ensureSupported(CHAIN_IDS.BASE);
const addresses: ChainAddresses = getAddresses(chainId);
console.log('Airlock for Base:', addresses.airlock);

// Iterate supported chains
for (const id of SUPPORTED_CHAIN_IDS) {
  console.log('Supported chain id:', id);
}
```

Arbitrum One is available as `CHAIN_IDS.ARBITRUM` (`42161`) with a viem chain
definition included in `SupportedChain`.

Robinhood Chain is available as `CHAIN_IDS.ROBINHOOD` (`4663`). The SDK exposes
addresses and support checks for it, but does not export a viem chain definition;
use your application's chain/client setup when constructing clients.

## Advanced Usage

### Custom Vesting Configuration

```typescript
vesting: {
  duration: 180 * 24 * 60 * 60, // 180 days
  recipients: [
    { address: '0x...', amount: parseEther('100000') },
    { address: '0x...', amount: parseEther('50000') },
  ],
}
```

### Vanity Address Mining

The Doppler protocol uses CREATE2 for deterministic deployments, enabling you to find vanity addresses for both tokens and hooks before submitting transactions. The SDK provides a `mineTokenAddress` utility that mirrors on-chain calculations.

`mineTokenAddress` supports matching:

- A **prefix** (address starts with hex characters)
- A **suffix** (address ends with hex characters, useful as an identifier)
- Both prefix + suffix simultaneously (logical AND)

#### Mining Token Addresses (Static Auctions)

For static auctions (V3 pools), you can mine vanity token addresses:

```typescript
import {
  StaticAuctionBuilder,
  mineTokenAddress,
  getAddresses,
} from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';
import { base } from 'viem/chains';

const builder = new StaticAuctionBuilder(base.id)
  .tokenConfig({
    name: 'Vanity Token',
    symbol: 'VNY',
    tokenURI: 'https://example.com/token.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('750000'),
    numeraire: '0x...',
  })
  .poolByTicks({ startTick: -92100, endTick: -69060, fee: 3000 })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 60 })
  .withUserAddress('0x...');

const staticParams = builder.build();
// Fetch the encoded create() payload without sending the transaction
const createParams =
  await sdk.factory.encodeCreateStaticAuctionParams(staticParams);
const addresses = getAddresses(base.id);

const { salt, tokenAddress, iterations } = mineTokenAddress({
  prefix: 'dead', // omit 0x prefix
  tokenFactory: createParams.tokenFactory,
  initialSupply: createParams.initialSupply,
  recipient: addresses.airlock,
  owner: addresses.airlock,
  tokenData: createParams.tokenFactoryData,
  maxIterations: 1_000_000, // optional safety cap
});

console.log(
  `Vanity token ${tokenAddress} found after ${iterations} iterations`,
);
// Now submit airlock.create({ ...createParams, salt }) when ready to deploy
```

You can also mine an identifier at the end of the address using `suffix`:

```typescript
const { salt, tokenAddress, iterations } = mineTokenAddress({
  prefix: '',
  suffix: 'beef', // 1-4 hex chars is typically practical
  tokenFactory: createParams.tokenFactory,
  initialSupply: createParams.initialSupply,
  recipient: addresses.airlock,
  owner: addresses.airlock,
  tokenData: createParams.tokenFactoryData,
  maxIterations: 1_000_000,
});
```

#### Mining Hook and Token Addresses (Dynamic Auctions)

For dynamic auctions (V4 pools), you can mine both hook and token addresses simultaneously. The miner ensures proper Uniswap V4 hook flags and correct token ordering relative to the numeraire:

```typescript
import {
  DynamicAuctionBuilder,
  mineTokenAddress,
  getAddresses,
  DopplerBytecode,
  DAY_SECONDS,
} from '@whetstone-research/doppler-sdk/evm';
import { parseEther, keccak256, encodePacked, encodeAbiParameters } from 'viem';
import { base } from 'viem/chains';

const builder = new DynamicAuctionBuilder(base.id)
  .tokenConfig({
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/token.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x...',
  })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByTicks({
    duration: 7 * DAY_SECONDS,
    epochLength: 3600,
    startTick: -92103,
    endTick: -69080,
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('1000'),
  })
  .withMigration({ type: 'uniswapV4', fee: 3000, tickSpacing: 60 })
  .withUserAddress('0x...');

const dynamicParams = builder.build();
const { createParams } =
  await sdk.factory.encodeCreateDynamicAuctionParams(dynamicParams);
const addresses = getAddresses(base.id);

// Compute hook init code hash (required for hook mining)
const hookInitHashData = encodeAbiParameters(
  [
    { type: 'address' },
    { type: 'uint256' },
    { type: 'uint256' },
    { type: 'uint256' },
    { type: 'uint256' },
    { type: 'uint256' },
    { type: 'int24' },
    { type: 'int24' },
    { type: 'uint256' },
    { type: 'int24' },
    { type: 'bool' },
    { type: 'uint256' },
    { type: 'address' },
    { type: 'uint24' },
  ],
  [
    addresses.poolManager,
    dynamicParams.sale.numTokensToSell,
    dynamicParams.auction.minProceeds,
    dynamicParams.auction.maxProceeds,
    /* startingTime, endingTime, startTick, endTick, epochLength, gamma, isToken0, numPDSlugs */
    /* poolInitializer, fee - extract from createParams */
  ],
);

const hookInitHash = keccak256(
  encodePacked(['bytes', 'bytes'], [DopplerBytecode, hookInitHashData]),
);

const result = mineTokenAddress({
  prefix: 'cafe', // Token prefix
  tokenFactory: createParams.tokenFactory,
  initialSupply: createParams.initialSupply,
  recipient: addresses.airlock,
  owner: addresses.airlock,
  tokenData: createParams.tokenFactoryData,
  tokenVariant: 'standard', // or 'doppler404'
  maxIterations: 1_000_000,
  // Optional: mine hook address with specific prefix too
  hook: {
    deployer: addresses.dopplerDeployer,
    initCodeHash: hookInitHash,
    prefix: '00', // Hook prefix for gas optimization
  },
});

console.log('Token address:', result.tokenAddress);
console.log('Hook address:', result.hookAddress); // only if hook config provided
console.log(`Found after ${result.iterations} iterations`);
```

#### Mining Token Addresses (Multicurve Auctions)

For multicurve auctions, you can mine vanity token addresses by computing the `CreateParams` manually with your mined salt. Unlike static and dynamic auctions, multicurve doesn't automatically mine token addresses:

```typescript
import {
  MulticurveBuilder,
  mineTokenAddress,
  getAddresses,
} from '@whetstone-research/doppler-sdk/evm';
import { parseEther } from 'viem';
import { base } from 'viem/chains';

const builder = new MulticurveBuilder(base.id)
  .tokenConfig({
    name: 'Vanity Multicurve',
    symbol: 'VMC',
    tokenURI: 'https://example.com/token.json',
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x...',
  })
  .poolConfig({
    fee: 3000,
    tickSpacing: 60,
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
  .withUserAddress('0x...');

const multicurveParams = builder.build();
const addresses = getAddresses(base.id);

// Get CreateParams without calling create
const createParams = sdk.factory.encodeCreateMulticurveParams(multicurveParams);

// Mine a vanity token address
const { salt, tokenAddress, iterations } = mineTokenAddress({
  prefix: 'feed',
  tokenFactory: createParams.tokenFactory,
  initialSupply: createParams.initialSupply,
  recipient: addresses.airlock,
  owner: addresses.airlock,
  tokenData: createParams.tokenFactoryData,
  maxIterations: 500_000,
});

console.log(
  `Vanity token ${tokenAddress} found after ${iterations} iterations`,
);

// Use the mined salt in createParams
const vanityCreateParams = { ...createParams, salt };

// Now submit the transaction manually with the vanity salt
await publicClient.writeContract({
  address: addresses.airlock,
  abi: airlockAbi,
  functionName: 'create',
  args: [vanityCreateParams],
  account: walletClient.account,
});
```

**Important**: Since `encodeCreateMulticurveParams` generates a random salt internally, you must construct the final `CreateParams` manually with your mined salt. The high-level `createMulticurve` method will replace any provided salt.

#### Dual-Prefix Mining

When you provide both a token prefix AND a hook configuration with its own prefix, the miner will search for a salt that satisfies **both** requirements simultaneously. This is useful for V4 deployments where you want:

- A vanity token address (e.g., starting with `cafe`)
- An optimized hook address (e.g., starting with `00` for gas savings)

Note: Dual-prefix mining takes significantly longer than single-prefix mining. Consider using shorter prefixes or higher iteration limits.

#### Mining Notes

- **Prefix format**: Omit the `0x` prefix (e.g., use `'dead'` not `'0x dead'`)
- **Case insensitive**: `'DEAD'`, `'dead'`, and `'DeAd'` are equivalent
- **Iteration limit**: Longer prefixes require more iterations. A 4-character hex prefix takes ~65,000 attempts on average.
- **Token variants**: Set `tokenVariant: 'standard-v2'` or `tokenVariant: 'dopplerERC20V1'` with `v2Implementation` for clone templates, or `tokenVariant: 'doppler404'` for DN404-style tokens
- **Salt preservation**: High-level helpers like `createStaticAuction` and `createDynamicAuction` recompute salts internally to ensure proper token ordering. To use a mined salt, call `encodeCreate*Params` and submit the transaction manually via `publicClient.writeContract`
- **Hook flags**: The miner automatically ensures V4 hooks have the correct permission flags for Doppler operations

## API Reference

### DopplerSDK

The main SDK class providing access to all functionality.

```typescript
class DopplerSDK {
  constructor(config: DopplerSDKConfig);

  // Properties
  factory: DopplerFactory;
  quoter: Quoter;

  // Methods
  getStaticAuction(poolAddress: Address): Promise<StaticAuction>;
  getDynamicAuction(hookAddress: Address): Promise<DynamicAuction>;
  // Multicurve helper
  buildMulticurveAuction(): MulticurveBuilder;
  getPoolInfo(poolAddress: Address): Promise<PoolInfo>;
  getHookInfo(hookAddress: Address): Promise<HookInfo>;
}
```

### Types

Key types are exported for use in your applications:

```typescript
import type {
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  MulticurveInitializerConfig,
  MulticurveDecayFeeSchedule,
  MigrationConfig,
  PoolInfo,
  HookInfo,
  VestingConfig,
} from '@whetstone-research/doppler-sdk/evm';
```

## Development

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm build

# Run all tests
pnpm test

# Run specific test suite
pnpm test:whitelisting

# Run tests in watch mode
pnpm test:watch

# Development mode with watch
pnpm dev
```

### Testing

The SDK includes comprehensive tests covering:

- **Airlock Whitelisting**: Verifies that all modules are properly whitelisted on Ethereum Mainnet, Arbitrum One, Monad Mainnet, Base Mainnet, Base Sepolia, and Robinhood Chain
- **Multicurve Functionality**: Tests multicurve auction creation and quoting
- **Token Address Mining**: Tests for generating optimized token addresses

To run whitelisting tests:

```bash
# Canonical whitelist audit
pnpm test:whitelisting

# With Alchemy fallback (faster and more reliable)
ALCHEMY_API_KEY=your_key_here pnpm test:whitelisting

# Limit to specific whitelist-audit chains when needed
TEST_CHAINS=mainnet,base,base-sepolia,arbitrum,monad-mainnet,robinhood pnpm test:whitelisting
```

The whitelisting suite is scoped to the release-audit chains: Ethereum Mainnet, Arbitrum One, Monad Mainnet, Base Mainnet, Base Sepolia, and Robinhood Chain.

Whitelisting test RPC priority is:

1. Chain-specific RPC URL env var (`ETH_MAINNET_RPC_URL`, `ARBITRUM_RPC_URL`, `BASE_RPC_URL`, `BASE_SEPOLIA_RPC_URL`)
2. `ALCHEMY_API_KEY` fallback for supported Alchemy networks, including Monad Mainnet
3. Public/default RPC URL

To run fork tests (Anvil):

```bash
# all fork tests
ALCHEMY_API_KEY=your_key_here pnpm test:fork

# chain-specific fork tests
ALCHEMY_API_KEY=your_key_here TEST_CHAIN=base pnpm test:fork
ALCHEMY_API_KEY=your_key_here TEST_CHAIN=base-sepolia pnpm test:fork
ALCHEMY_API_KEY=your_key_here TEST_CHAIN=mainnet pnpm test:fork
```

You can also provide chain-specific RPC URLs directly:

```bash
ETH_MAINNET_RPC_URL=https://... TEST_CHAIN=mainnet pnpm test:fork
ARBITRUM_RPC_URL=https://... TEST_CHAIN=arbitrum pnpm test:fork
```

## Migration from Previous SDKs

If you're migrating from `doppler-v3-sdk` or `doppler-v4-sdk`, see our [Migration Guide](./docs/migration-guide.md).

## Contributing

Contributions are welcome! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
