# Doppler SDK

A unified TypeScript SDK for interacting with the Doppler Protocol - enabling fair token launches through Dutch auction mechanisms on Uniswap.

## Overview

The Doppler SDK consolidates functionality from the previous `doppler-v3-sdk` and `doppler-v4-sdk` packages into a single, intuitive interface. It provides comprehensive support for creating and managing token auctions on Ethereum and EVM-compatible chains.

### Key Features

- **Static Auctions**: Fixed price range liquidity bootstrapping using Uniswap V3
- **Dynamic Auctions**: Gradual Dutch auctions using Uniswap V4 hooks
- **Multicurve Initializer**: Seed Uniswap V4 pools across multiple curves
- **Flexible Migration**: Support for migrating to Uniswap V2, V3, or V4
- **Token Management**: Built-in support for DERC20 tokens with vesting
- **Type Safety**: Full TypeScript support with discriminated unions
- **Chain Support**: Works with Base, Unichain, Ink, and other EVM chains

## Installation

```bash
npm install @whetstone-research/doppler-sdk viem
# or
yarn add @whetstone-research/doppler-sdk viem
# or
pnpm add @whetstone-research/doppler-sdk viem
```

## Quick Start

```typescript
import { DopplerSDK } from '@whetstone-research/doppler-sdk';
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

## Creating Auctions

### Static Auction (Fixed Price Range)

Static auctions use Uniswap V3 pools with concentrated liquidity in a fixed price range. They're ideal for simple, predictable price discovery.

```typescript
import { StaticAuctionBuilder } from '@whetstone-research/doppler-sdk'

const params = new StaticAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000000'), numTokensToSell: parseEther('900000000'), numeraire: '0x...' })
  .poolByTicks({ startTick: -92200, endTick: -69000, fee: 10000, numPositions: 15 })
  .withVesting({
    duration: BigInt(365 * 24 * 60 * 60),
    // Optional: specify multiple recipients and amounts
    // recipients: ['0xTeam...', '0xAdvisor...'],
    // amounts: [parseEther('50000000'), parseEther('50000000')]
  })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const result = await sdk.factory.createStaticAuction(params)
console.log('Pool address:', result.poolAddress)
console.log('Token address:', result.tokenAddress)
```

> **Tick spacing reminder:** When you provide ticks manually via `poolByTicks`, make sure both `startTick` and `endTick` are exact multiples of the fee tier’s tick spacing (100→1, 500→10, 3000→60, 10000→200). The SDK now validates this locally and will fail fast if the ticks are misaligned.

### Dynamic Auction (Dutch Auction)

Dynamic auctions use Uniswap V4 hooks to implement gradual Dutch auctions where the price moves over time.

```typescript
import { DynamicAuctionBuilder, DAY_SECONDS } from '@whetstone-research/doppler-sdk'

const params = new DynamicAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: '0x...' })
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
  .withGovernanceFactory('0xGovFactory...') // used for both standard and no‑op governance
  // .withV2Migrator('0xV2Migrator...')
  // .withV3Migrator('0xV3Migrator...')
  // .withV4Migrator('0xV4Migrator...')
  .withUserAddress('0x...')
  .build()

const result = await sdk.factory.createDynamicAuction(params)
console.log('Hook address:', result.hookAddress)
console.log('Token address:', result.tokenAddress)
```

### Multicurve Auction (V4 Multicurve Initializer)

Multicurve auctions use a Uniswap V4-style initializer that seeds liquidity across multiple curves in a single pool. This enables richer distributions and can be combined with any supported migration path (V2, V3, V4, or NoOp).

**Standard Multicurve with Migration:**
```typescript
import { MulticurveBuilder } from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'
import { base } from 'viem/chains'

const params = new MulticurveBuilder(base.id)
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: '0x...' })
  .withMulticurveAuction({
    fee: 0,
    tickSpacing: 8,
    curves: [
      { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
      { tickLower: 16000, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
    ],
  })
  .withGovernance({ type: 'default' })
  // Choose a migration path (V2, V3, or V4)
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const result = await sdk.factory.createMulticurve(params)
console.log('Pool address:', result.poolAddress)
console.log('Token address:', result.tokenAddress)
```

**Market Cap Presets (Low / Medium / High):**
```typescript
import { MulticurveBuilder, FEE_TIERS } from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'
import { base } from 'viem/chains'

const presetParams = new MulticurveBuilder(base.id)
  .tokenConfig({ name: 'Preset Launch', symbol: 'PRST', tokenURI: 'ipfs://preset.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: '0x...' })
  .withMarketCapPresets({
    fee: FEE_TIERS.LOW, // defaults to 0.05% fee tier (tick spacing 10)
    presets: ['low', 'medium', 'high'], // defaults to all tiers
    // overrides: { high: { shares: parseEther('0.25') } }, // optional per-tier tweaks
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const presetResult = await sdk.factory.createMulticurve(presetParams)
console.log('Pool address:', presetResult.poolAddress)
console.log('Token address:', presetResult.tokenAddress)
```

The preset helper seeds three curated curve buckets sized for ~1B token supply targets:
- `low`: ~5% of the sale allocated to a $7.5k-$30k market cap window.
- `medium`: ~12.5% targeting roughly $50k-$150k market caps.
- `high`: ~20% aimed at $250k-$750k market caps.

Pass `presets` to pick a subset (e.g. `['medium', 'high']`) or provide `overrides` to adjust ticks, positions, or shares for a specific tier. When the selected presets sum to less than 100%, the builder automatically appends a filler curve (using the highest selected tier's shape) so liquidity always covers the full sale. Shares must stay within 0-1e18 and the helper will throw if the total ever exceeds 100%.

**Scheduled Multicurve Launch:**
```typescript
import { MulticurveBuilder } from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'
import { base } from 'viem/chains'

const startTime = Math.floor(Date.now() / 1000) + 3600 // one hour from now

const scheduled = new MulticurveBuilder(base.id)
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'ipfs://scheduled.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: '0x4200000000000000000000000000000000000006' })
  .withMulticurveAuction({
    fee: 0,
    tickSpacing: 8,
    curves: [
      { tickLower: 0, tickUpper: 240000, numPositions: 12, shares: parseEther('0.5') },
      { tickLower: 16000, tickUpper: 240000, numPositions: 12, shares: parseEther('0.5') },
    ],
  })
  .withSchedule({ startTime })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const scheduledResult = await sdk.factory.createMulticurve(scheduled)
console.log('Pool address:', scheduledResult.poolAddress)
console.log('Token address:', scheduledResult.tokenAddress)
```

Ensure the target chain has the scheduled multicurve initializer whitelisted. If you are targeting a custom deployment, override it via `.withV4ScheduledMulticurveInitializer('0x...')`.

**Multicurve with Lockable Beneficiaries (NoOp Migration):**

When you want fee revenue to flow to specific addresses without migrating liquidity after the auction, use lockable beneficiaries with NoOp migration:

```typescript
import { WAD } from '@whetstone-research/doppler-sdk'

// Define beneficiaries with shares that sum to WAD (1e18 = 100%)
// IMPORTANT: Protocol owner must be included with at least 5% shares
const lockableBeneficiaries = [
  { beneficiary: '0xProtocolOwner...', shares: WAD / 10n },      // 10% to protocol (>= 5% required)
  { beneficiary: '0xYourAddress...', shares: (WAD * 4n) / 10n }, // 40%
  { beneficiary: '0xOtherAddress...', shares: WAD / 2n },        // 50%
]

const params = new MulticurveBuilder(base.id)
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: '0x...' })
  .withMulticurveAuction({
    fee: 3000, // 0.3% fee tier - set > 0 to accumulate fees for beneficiaries
    tickSpacing: 8,
    curves: [
      { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
      { tickLower: 16000, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
    ],
    lockableBeneficiaries // Add beneficiaries for fee streaming
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'noOp' }) // Use NoOp migration with lockable beneficiaries
  .withUserAddress('0x...')
  .build()

const result = await sdk.factory.createMulticurve(params)
const assetAddress = result.tokenAddress // SAVE THIS - you'll need it to collect fees!
console.log('Asset address:', assetAddress)

// Later, to collect fees (works before and after migration):
// const pool = await sdk.getMulticurvePool(assetAddress)
// await pool.collectFees()
```

**Important Notes:**
- Set `fee` > 0 (e.g., 3000 for 0.3%) to accumulate trading fees for beneficiaries
- **Save the asset address** (token address) returned from creation - you need it to collect fees later
- Beneficiaries receive fees proportional to their shares when `collectFees()` is called
- Pool enters "Locked" status (status = 2) and liquidity cannot be migrated
- Beneficiaries are immutable and set at pool creation time
- The SDK automatically handles PoolKey construction and PoolId computation for you

See [examples/multicurve-lockable-beneficiaries.ts](./examples/multicurve-lockable-beneficiaries.ts) for a complete example.

#### Transaction gas override
- You can pass a gas limit to factory create calls via the `gas` field on `CreateStaticAuctionParams` / `CreateDynamicAuctionParams` / `CreateMulticurveParams`.
- If omitted, the SDK uses the simulation's gas estimate when available, falling back to 13,500,000 gas for the `create()` transaction.
- `simulateCreate*` helpers now return `gasEstimate` so you can tune overrides before sending.
- Builders expose `.withGasLimit(gas: bigint)` so you can set overrides fluently.



### Builder Pattern (Recommended)

Prefer using the builders to construct `CreateStaticAuctionParams` and `CreateDynamicAuctionParams` fluently and safely. Builders apply sensible defaults and can compute ticks and gamma for you.

```typescript
import { StaticAuctionBuilder, DynamicAuctionBuilder } from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'

// Dynamic auction via builder
const dynamicParams = new DynamicAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('500000'), numeraire: wethAddress })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByPriceRange({
    priceRange: { startPrice: 0.0001, endPrice: 0.001 },
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('1000'),
  })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const dyn = await sdk.factory.createDynamicAuction(dynamicParams)

// Static auction via builder
const staticParams = new StaticAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000000'), numTokensToSell: parseEther('900000000'), numeraire: wethAddress })
  .poolByPriceRange({ priceRange: { startPrice: 0.0001, endPrice: 0.001 }, fee: 3000 })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const stat = await sdk.factory.createStaticAuction(staticParams)
```

### Simplified Creation with Defaults

The SDK intelligently applies defaults when parameters are omitted. Here are examples with minimal configuration:

```typescript
// Minimal static auction via builder
const staticMinimal = new StaticAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000000'), numTokensToSell: parseEther('900000000'), numeraire: '0x...' })
  .poolByTicks({ fee: 10000 }) // uses default tick range and numPositions
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const staticResult = await sdk.factory.createStaticAuction(staticMinimal)

// Minimal dynamic auction via builder
const dynamicMinimal = new DynamicAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: '0x...' })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByTicks({
    startTick: -92103,
    endTick: -69080,
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('1000'),
  }) // duration/epoch defaults applied; gamma computed automatically
  .withMigration({ type: 'uniswapV4' })
  .withUserAddress('0x...')
  .build()

const dynamicResult = await sdk.factory.createDynamicAuction(dynamicMinimal)
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

Multicurve pools support fee collection and distribution to beneficiaries when configured with `lockableBeneficiaries`.

```typescript
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

// Collect and distribute fees to beneficiaries
// This can be called by anyone, but only beneficiaries receive fees
const { fees0, fees1, transactionHash } = await pool.collectFees();
console.log('Fees collected (token0):', fees0);
console.log('Fees collected (token1):', fees1);
console.log('Transaction:', transactionHash);

// Get token addresses
const tokenAddress = await pool.getTokenAddress();
const numeraireAddress = await pool.getNumeraireAddress();
```

**Fee Collection Technical Details:**

The SDK handles the complexity of fee collection by:
1. **Retrieving pool configuration** from the multicurve initializer contract
2. **Detecting migration status** and, if the pool has migrated, resolving the shared `StreamableFeesLockerV2`
   address via the multicurve migrator (no manual lookup required)
3. **Computing the PoolId** from the PoolKey using `keccak256(abi.encode(poolKey))`
4. **Calling the correct contract** (initializer while locked, locker after migration) with the computed PoolId
5. **Distributing fees** proportionally to all configured beneficiaries

**Important Notes:**
- Fees accumulate from swap activity on the pool (only if fee tier > 0)
- Anyone can call `collectFees()`, but fees are distributed to beneficiaries only
- Fees are automatically split according to configured beneficiary shares
- The function returns the total amount collected for both tokens in the pair
- Works exclusively with pools created using `lockableBeneficiaries` in the multicurve configuration
- Pools in "Locked" status (status = 2) use the multicurve initializer for collection
- Pools in "Exited" status (status = 3) automatically stream fees through `StreamableFeesLockerV2`; the SDK
  resolves the locker address and stream data for you
- Beneficiaries must be configured at pool creation time and cannot be changed

**Common Use Cases:**
- Set up periodic fee collection (e.g., daily or weekly)
- Integrate with a bot that automatically collects fees when threshold is reached
- Allow any beneficiary to trigger collection after significant trading activity
- Monitor swap events to determine optimal collection timing

See [examples/multicurve-collect-fees.ts](./examples/multicurve-collect-fees.ts) for a complete example.

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
import { Derc20 } from '@whetstone-research/doppler-sdk'
const tokenDirect = new Derc20(publicClient, walletClient, tokenAddress)
```

### Governance Delegation (ERC20Votes)

DERC20 extends OpenZeppelin's ERC20Votes. Voting power is tracked via checkpoints and only updates once an address delegates voting power (typically to itself). The SDK exposes simple read/write helpers for delegation.

Basics:
```ts
import { Derc20 } from '@whetstone-research/doppler-sdk'

const token = sdk.getDerc20(tokenAddress)

// Read: who an account delegates to, and current voting power
const currentDelegate = await token.getDelegates(userAddress)
const votes = await token.getVotes(userAddress)

// Self‑delegate to activate vote tracking
await token.delegate(userAddress)

// Or delegate to another address
await token.delegate('0xDelegatee...')
```

Historical votes:
```ts
// OZ v5 uses timepoints (block numbers for block‑based clocks)
const blockNumber = await publicClient.getBlockNumber()
const pastVotes = await token.getPastVotes(userAddress, blockNumber - 1n)
```

Signature‑based delegation (delegateBySig):
```ts
// Signs an EIP‑712 message and submits a transaction calling delegateBySig
// Note: This still submits a transaction from the connected wallet.
const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1h
await token.delegateBySig('0xDelegatee...', expiry)
```

Advanced: gasless delegation via relayer
- The token supports `delegateBySig(delegatee, nonce, expiry, v, r, s)`. A relayer can submit this on behalf of the user if it holds ETH for gas.
- To do this, have the user sign typed data, then send the signature to your backend that calls the contract.

Client (sign only):
```ts
const [nonce, name] = await Promise.all([
  publicClient.readContract({ address: tokenAddress, abi: derc20Abi, functionName: 'nonces', args: [userAddress] }),
  token.getName(),
])
const chainId = await publicClient.getChainId()
const domain = { name, version: '1', chainId, verifyingContract: tokenAddress } as const
const types = { Delegation: [
  { name: 'delegatee', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'expiry', type: 'uint256' },
] } as const
const message = { delegatee: '0xDelegatee...', nonce, expiry } as const

const signature = await walletClient.signTypedData({
  domain, types, primaryType: 'Delegation', message, account: userAddress,
})
// POST { signature, delegatee, nonce, expiry } to your relayer
```

Relayer (submit tx):
```ts
function splitSig(sig: `0x${string}`) {
  const r = `0x${sig.slice(2, 66)}` as `0x${string}`
  const s = `0x${sig.slice(66, 130)}` as `0x${string}`
  let v = parseInt(sig.slice(130, 132), 16); if (v < 27) v += 27
  return { v, r, s }
}

const { v, r, s } = splitSig(signature)
await relayerWallet.writeContract({
  address: tokenAddress,
  abi: derc20Abi,
  functionName: 'delegateBySig',
  args: ['0xDelegatee...', nonce, expiry, v, r, s],
})
```

Notes
- Users must delegate (even to themselves) before votes appear in `getVotes`.
- `getPastVotes`/`getPastTotalSupply` expect a timepoint; for block‑based clocks, pass a block number that has already been mined.
- Events you may track: `DelegateChanged` and `DelegateVotesChanged` for live updates.

### Native ETH

The SDK also provides an ETH wrapper with ERC20-like interface:

```typescript
import { Eth } from '@whetstone-research/doppler-sdk';

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

## Atomic Create + Pre‑Buy (Bundle)

For static auctions, you can create the pool and execute a pre‑buy in a single transaction via the Bundler.

High‑level flow:
- Simulate create to get `CreateParams` and the predicted token address
- Decide `amountOut` to buy, simulate `amountIn` with `simulateBundleExactOutput(...)`
- Build Universal Router commands (e.g., via `doppler-router`)
- Call `factory.bundle(createParams, commands, inputs, { value })`

See docs/quotes-and-swaps.md for a full example.

### Multicurve Bundler Helpers

Multicurve auctions expose similar helpers that work with the Doppler Bundler once it has been upgraded
with multicurve support (selector check added in `0.0.1-alpha.47`). The SDK now verifies the bundler bytecode
before attempting these flows; if you see
`Bundler at <address> does not support multicurve bundling`, deploy or point at the latest bundler release.

```ts
// Prepare multicurve CreateParams up front
const createParams = sdk.factory.encodeCreateMulticurveParams(multicurveConfig)

// Quote an exact-out bundle
const exactOutQuote = await sdk.factory.simulateMulticurveBundleExactOut(createParams, {
  exactAmountOut: parseEther('100'),
})

// Quote an exact-in bundle
const exactInQuote = await sdk.factory.simulateMulticurveBundleExactIn(createParams, {
  exactAmountIn: parseEther('25'),
})

console.log('Predicted asset:', exactOutQuote.asset)
console.log('PoolKey:', exactOutQuote.poolKey)
console.log('Input required:', exactOutQuote.amountIn)
```

The multicurve helpers automatically normalise the returned PoolKey to maintain canonical token ordering and
hash the result when collecting fees, so consumers no longer need to manually assemble the PoolId.

## Migration Configuration

The SDK supports flexible migration paths after auction completion:

### Migrate to Uniswap V2
```typescript
migration: {
  type: 'uniswapV2',
}
```

### Migrate to Uniswap V3
```typescript
migration: {
  type: 'uniswapV3',
  fee: 3000,        // 0.3%
  tickSpacing: 60,  // Standard for 0.3% pools
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

To make configuring the first beneficiary simpler, the SDK now exposes helpers for resolving the
airlock owner and creating the default 5% entry:

```ts
import { DopplerSDK, createAirlockBeneficiary, getAirlockOwner } from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'

const sdk = new DopplerSDK({ publicClient, chainId })

// Get the owner and construct the beneficiary entry (5% by default)
const airlockBeneficiary = await sdk.getAirlockBeneficiary()

// Or build the entry manually if you do not have an SDK instance handy
// (airlockEntry will be equivalent to airlockBeneficiary above)
const owner = await getAirlockOwner(publicClient)
const airlockEntry = createAirlockBeneficiary(owner) // defaults to 5% shares

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
}
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
} from '@whetstone-research/doppler-sdk'

// Validate and narrow a chain ID
function ensureSupported(id: number): SupportedChainId {
  if (!isSupportedChainId(id)) throw new Error('Unsupported chain')
  return id
}

const chainId = ensureSupported(CHAIN_IDS.BASE)
const addresses: ChainAddresses = getAddresses(chainId)
console.log('Airlock for Base:', addresses.airlock)

// Iterate supported chains
for (const id of SUPPORTED_CHAIN_IDS) {
  console.log('Supported chain id:', id)
}
```

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

#### Mining Token Addresses (Static Auctions)

For static auctions (V3 pools), you can mine vanity token addresses:

```typescript
import {
  StaticAuctionBuilder,
  mineTokenAddress,
  getAddresses,
} from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'
import { base } from 'viem/chains'

const builder = new StaticAuctionBuilder(base.id)
  .tokenConfig({ name: 'Vanity Token', symbol: 'VNY', tokenURI: 'https://example.com/token.json' })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('750000'),
    numeraire: '0x...',
  })
  .poolByTicks({ startTick: -92100, endTick: -69060, fee: 3000 })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV3', fee: 3000, tickSpacing: 60 })
  .withUserAddress('0x...')

const staticParams = builder.build()
// Fetch the encoded create() payload without sending the transaction
const createParams = await sdk.factory.encodeCreateStaticAuctionParams(staticParams)
const addresses = getAddresses(base.id)

const { salt, tokenAddress, iterations } = mineTokenAddress({
  prefix: 'dead', // omit 0x prefix
  tokenFactory: createParams.tokenFactory,
  initialSupply: createParams.initialSupply,
  recipient: addresses.airlock,
  owner: addresses.airlock,
  tokenData: createParams.tokenFactoryData,
  maxIterations: 1_000_000, // optional safety cap
})

console.log(`Vanity token ${tokenAddress} found after ${iterations} iterations`)
// Now submit airlock.create({ ...createParams, salt }) when ready to deploy
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
} from '@whetstone-research/doppler-sdk'
import { parseEther, keccak256, encodePacked, encodeAbiParameters } from 'viem'
import { base } from 'viem/chains'

const builder = new DynamicAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/token.json' })
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
  .withUserAddress('0x...')

const dynamicParams = builder.build()
const { createParams } = await sdk.factory.encodeCreateDynamicAuctionParams(dynamicParams)
const addresses = getAddresses(base.id)

// Compute hook init code hash (required for hook mining)
const hookInitHashData = encodeAbiParameters(
  [
    { type: 'address' }, { type: 'uint256' }, { type: 'uint256' },
    { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
    { type: 'int24' }, { type: 'int24' }, { type: 'uint256' },
    { type: 'int24' }, { type: 'bool' }, { type: 'uint256' },
    { type: 'address' }, { type: 'uint24' },
  ],
  [
    addresses.poolManager,
    dynamicParams.sale.numTokensToSell,
    dynamicParams.auction.minProceeds,
    dynamicParams.auction.maxProceeds,
    /* startingTime, endingTime, startTick, endTick, epochLength, gamma, isToken0, numPDSlugs */
    /* poolInitializer, fee - extract from createParams */
  ]
)

const hookInitHash = keccak256(
  encodePacked(['bytes', 'bytes'], [DopplerBytecode, hookInitHashData])
)

const result = mineTokenAddress({
  prefix: 'cafe',        // Token prefix
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
})

console.log('Token address:', result.tokenAddress)
console.log('Hook address:', result.hookAddress) // only if hook config provided
console.log(`Found after ${result.iterations} iterations`)
```

#### Mining Token Addresses (Multicurve Auctions)

For multicurve auctions, you can mine vanity token addresses by computing the `CreateParams` manually with your mined salt. Unlike static and dynamic auctions, multicurve doesn't automatically mine token addresses:

```typescript
import {
  MulticurveBuilder,
  mineTokenAddress,
  getAddresses,
} from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'
import { base } from 'viem/chains'

const builder = new MulticurveBuilder(base.id)
  .tokenConfig({ name: 'Vanity Multicurve', symbol: 'VMC', tokenURI: 'https://example.com/token.json' })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: '0x...',
  })
  .withMulticurveAuction({
    fee: 3000,
    tickSpacing: 60,
    curves: [
      { tickLower: 0, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
      { tickLower: 16000, tickUpper: 240000, numPositions: 10, shares: parseEther('0.5') },
    ],
  })
  .withGovernance({ type: 'default' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')

const multicurveParams = builder.build()
const addresses = getAddresses(base.id)

// Get CreateParams without calling create
const createParams = sdk.factory.encodeCreateMulticurveParams(multicurveParams)

// Mine a vanity token address
const { salt, tokenAddress, iterations } = mineTokenAddress({
  prefix: 'feed',
  tokenFactory: createParams.tokenFactory,
  initialSupply: createParams.initialSupply,
  recipient: addresses.airlock,
  owner: addresses.airlock,
  tokenData: createParams.tokenFactoryData,
  maxIterations: 500_000,
})

console.log(`Vanity token ${tokenAddress} found after ${iterations} iterations`)

// Use the mined salt in createParams
const vanityCreateParams = { ...createParams, salt }

// Now submit the transaction manually with the vanity salt
await publicClient.writeContract({
  address: addresses.airlock,
  abi: airlockAbi,
  functionName: 'create',
  args: [vanityCreateParams],
  account: walletClient.account,
})
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
- **Token variants**: Set `tokenVariant: 'doppler404'` for DN404-style tokens
- **Salt preservation**: High-level helpers like `createStaticAuction` and `createDynamicAuction` recompute salts internally to ensure proper token ordering. To use a mined salt, call `encodeCreate*Params` and submit the transaction manually via `publicClient.writeContract`
- **Hook flags**: The miner automatically ensures V4 hooks have the correct permission flags for Doppler operations

## API Reference

### DopplerSDK

The main SDK class providing access to all functionality.

```typescript
class DopplerSDK {
  constructor(config: DopplerSDKConfig)
  
  // Properties
  factory: DopplerFactory
  quoter: Quoter
  
  // Methods
  getStaticAuction(poolAddress: Address): Promise<StaticAuction>
  getDynamicAuction(hookAddress: Address): Promise<DynamicAuction>
  // Multicurve helper
  buildMulticurveAuction(): MulticurveBuilder
  getPoolInfo(poolAddress: Address): Promise<PoolInfo>
  getHookInfo(hookAddress: Address): Promise<HookInfo>
}
```

### Types

Key types are exported for use in your applications:

```typescript
import type {
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  MigrationConfig,
  PoolInfo,
  HookInfo,
  VestingConfig,
} from '@whetstone-research/doppler-sdk';
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
pnpm test airlock-whitelisting

# Run tests in watch mode
pnpm test:watch

# Development mode with watch
pnpm dev
```

### Testing

The SDK includes comprehensive tests covering:

- **Airlock Whitelisting**: Verifies that all modules are properly whitelisted on deployed Airlock contracts across all chains
- **Multicurve Functionality**: Tests multicurve auction creation and quoting
- **Token Address Mining**: Tests for generating optimized token addresses

See [`test/README.md`](./test/README.md) for detailed testing documentation.

To run whitelisting tests:

```bash
# Uses default public RPCs
pnpm test airlock-whitelisting

# Or with Alchemy (faster and more reliable)
ALCHEMY_API_KEY=your_key_here pnpm test airlock-whitelisting
```

## Migration from Previous SDKs

If you're migrating from `doppler-v3-sdk` or `doppler-v4-sdk`, see our [Migration Guide](./docs/migration-guide.md).

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
