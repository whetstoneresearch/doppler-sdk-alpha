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
  .poolByTicks({ startTick: -92103, endTick: -69080, fee: 10000, numPositions: 15 })
  .withVesting({ duration: BigInt(365 * 24 * 60 * 60) })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress('0x...')
  .build()

const result = await sdk.factory.createStaticAuction(params)
console.log('Pool address:', result.poolAddress)
console.log('Token address:', result.tokenAddress)
```

### Dynamic Auction (Dutch Auction)

Dynamic auctions use Uniswap V4 hooks to implement gradual Dutch auctions where the price moves over time.

```typescript
import { DynamicAuctionBuilder } from '@whetstone-research/doppler-sdk'

const params = new DynamicAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: '0x...' })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByTicks({
    durationDays: 7,
    epochLength: 3600,
    startTick: -92103,
    endTick: -69080,
    minProceeds: parseEther('100'),
    maxProceeds: parseEther('1000'),
    numPdSlugs: 5,
  })
  .withVesting({ duration: BigInt(365 * 24 * 60 * 60) })
  .withMigration({
    type: 'uniswapV4',
    fee: 3000,
    tickSpacing: 60,
    streamableFees: {
      lockDuration: 365 * 24 * 60 * 60,
      beneficiaries: [
        { address: '0x...', percentage: 5000 },
        { address: '0x...', percentage: 5000 },
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

Multicurve auctions use a Uniswap V4-style initializer that seeds liquidity across multiple curves in a single pool. This enables richer distributions and can be combined with any supported migration path (V2, V3, or V4).

```typescript
import { MulticurveBuilder } from '@whetstone-research/doppler-sdk'
import { parseEther } from 'viem'

const params = new MulticurveBuilder(base.id)
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/metadata.json' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('900000'), numeraire: '0x...' })
  .withMulticurveAuction({
    fee: 3000,
    tickSpacing: 60,
    curves: [
      { tickLower: -120000, tickUpper: -90000, numPositions: 8, shares: parseEther('0.4') },
      { tickLower: -90000, tickUpper: -70000, numPositions: 8, shares: parseEther('0.6') },
    ],
    // Optional: lock fee revenue to beneficiaries (shares in WAD)
    lockableBeneficiaries: [
      { beneficiary: '0x...', shares: parseEther('0.05') },
    ],
  })
  .withGovernance({ type: 'default' })
  // Choose a migration path (V2, V3, or V4). Example uses V2
  .withMigration({ type: 'uniswapV2' })
  // Optional address overrides if not provided by chain config
  // .withV4MulticurveInitializer('0xInitializer...')
  .withUserAddress('0x...')
  .build()

const result = await sdk.factory.createMulticurve(params)
console.log('Pool address:', result.poolAddress)
console.log('Token address:', result.tokenAddress)

// Or simulate to preview addresses without sending a transaction
const { asset, pool } = await sdk.factory.simulateCreateMulticurve(params)
```

#### Transaction gas override
- You can pass a gas limit to factory create calls via the `gas` field on `CreateStaticAuctionParams`/`CreateDynamicAuctionParams`.
- If omitted, the SDK uses a default gas limit of 13,500,000 for the `create()` transaction.



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
      { address: '0x...', percentage: 10000 }, // 100%
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

### Hook Address Mining (V4)

For optimal gas efficiency with Uniswap V4, you can mine hook addresses:

```typescript
// This feature is coming soon
const minedAddress = await sdk.mineHookAddress({
  prefix: '0x00', // Target prefix for gas optimization
  deployer: '0x...', // Doppler deployer address
});
```

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

# Run tests
pnpm test

# Development mode with watch
pnpm dev
```

## Migration from Previous SDKs

If you're migrating from `doppler-v3-sdk` or `doppler-v4-sdk`, see our [Migration Guide](./docs/migration-guide.md).

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
