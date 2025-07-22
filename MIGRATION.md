# Migration Guide: V4 SDK to Unified SDK

This guide helps you migrate from the `doppler-v4-sdk` to the new unified `@doppler/sdk`.

## Overview

The unified SDK consolidates both V3 and V4 functionality into a single package with a cleaner API. Most concepts remain the same, but import paths and some method names have changed.

## Installation

Replace the old SDK:

```bash
# Remove old SDK
npm uninstall doppler-v4-sdk

# Install unified SDK
npm install @doppler/sdk
```

## Import Changes

### V4 SDK
```typescript
import { ReadWriteFactory, ReadDoppler, ReadDerc20 } from 'doppler-v4-sdk';
import { DOPPLER_V4_ADDRESSES } from 'doppler-v4-sdk/addresses';
import { createDrift } from '@delvtech/drift';
```

### Unified SDK
```typescript
import { DopplerSDK, Derc20 } from '@doppler/sdk';
// No need to import addresses or drift - they're handled internally
```

## Initialization

### V4 SDK
```typescript
import { createDrift } from '@delvtech/drift';
import { ReadWriteFactory } from 'doppler-v4-sdk';
import { DOPPLER_V4_ADDRESSES } from 'doppler-v4-sdk/addresses';

const drift = createDrift({
  rpc: publicClient,
  signer: walletClient,
});

const factory = new ReadWriteFactory(
  DOPPLER_V4_ADDRESSES[chainId].airlock,
  drift
);
```

### Unified SDK
```typescript
import { DopplerSDK } from '@doppler/sdk';

const sdk = new DopplerSDK({
  publicClient,
  walletClient,
  chainId,
});

// Access factory through SDK
const factory = sdk.factory;
```

## Creating Pools with buildConfig

### V4 SDK
```typescript
import { DOPPLER_V4_ADDRESSES } from 'doppler-v4-sdk/addresses';
import { parseEther } from 'viem';

const addresses = DOPPLER_V4_ADDRESSES[chainId];

const { createParams, hook, token } = factory.buildConfig({
  // Token details
  name: "Community Token",
  symbol: "COMM",
  totalSupply: parseEther("1000000"),
  numTokensToSell: parseEther("500000"),
  tokenURI: "https://example.com/metadata.json",
  
  // Time parameters
  blockTimestamp: Math.floor(Date.now() / 1000),
  startTimeOffset: 0,
  duration: 30, // 30 days
  epochLength: 3600, // 1 hour
  
  // Price parameters
  numeraire: wethAddress,
  priceRange: { startPrice: 0.001, endPrice: 0.01 },
  tickSpacing: 60,
  fee: 3000,
  
  // Sale parameters
  minProceeds: parseEther("100"),
  maxProceeds: parseEther("10000"),
  
  // Vesting
  yearlyMintRate: parseEther("0.02"),
  vestingDuration: BigInt(365 * 24 * 60 * 60),
  recipients: [recipient1, recipient2],
  amounts: [parseEther("50000"), parseEther("50000")],
  
  // Migration
  liquidityMigratorData: encodedMigratorData,
  
  integrator: integratorAddress,
}, addresses);

// Create the pool
const txHash = await factory.create(createParams);
```

### Unified SDK
```typescript
import { parseEther } from 'viem';

// Build config with minimal parameters
const config = sdk.factory.buildDynamicAuctionConfig({
  // Token details (same as V4)
  name: "Community Token",
  symbol: "COMM",
  totalSupply: parseEther("1000000"),
  numTokensToSell: parseEther("500000"),
  tokenURI: "https://example.com/metadata.json",
  
  // Price parameters (simplified)
  priceRange: { startPrice: 0.001, endPrice: 0.01 },
  tickSpacing: 60,
  fee: 3000,
  
  // Sale parameters (same)
  minProceeds: parseEther("100"),
  maxProceeds: parseEther("10000"),
  
  // Vesting (simplified)
  vestingDuration: BigInt(365 * 24 * 60 * 60),
  recipients: [recipient1, recipient2],
  amounts: [parseEther("50000"), parseEther("50000")],
  
  // Migration (structured)
  migration: {
    type: 'uniswapV4',
    fee: 3000,
    tickSpacing: 60,
    streamableFees: {
      lockDuration: 365 * 24 * 60 * 60,
      beneficiaries: [
        { address: beneficiary1, percentage: 5000 },
        { address: beneficiary2, percentage: 5000 },
      ],
    },
  },
  
  // Optional parameters with defaults:
  // duration: 30,             // defaults to 7 days
  // epochLength: 3600,        // defaults to 1 hour
  // numeraire: undefined,     // defaults to zero address
  // yearlyMintRate: undefined,// defaults to 2%
  // integrator: undefined,    // defaults to dead address
}, userAddress);

// Create the auction directly
const result = await sdk.factory.createDynamicAuction(config);
console.log('Hook address:', result.hookAddress);
console.log('Token address:', result.tokenAddress);
console.log('Pool ID:', result.poolId);
```

## Key Differences in buildConfig

### 1. Simplified Time Parameters
- **V4 SDK**: Required `blockTimestamp` and `startTimeOffset`
- **Unified SDK**: Optional `blockTimestamp`, no `startTimeOffset` needed

### 2. Default Values
The unified SDK provides more defaults:
- `duration`: 7 days (vs required in V4)
- `epochLength`: 3600 seconds (vs required in V4)
- `numeraire`: Zero address (vs required in V4)
- `yearlyMintRate`: 2% (vs required in V4)
- `numPdSlugs`: 5 (same as V4)

### 3. Migration Configuration
- **V4 SDK**: Raw `liquidityMigratorData` bytes
- **Unified SDK**: Structured `MigrationConfig` with type safety

### 4. Return Values
- **V4 SDK**: Returns `{ createParams, hook, token }`
- **Unified SDK**: `buildConfig` returns complete params, `create` returns addresses and poolId

## Direct Pool Creation (Without buildConfig)

### V4 SDK
```typescript
// Manual parameter encoding required
const poolInitializerData = encodeAbiParameters([...], [...]);
const tokenFactoryData = encodeAbiParameters([...], [...]);
const governanceFactoryData = encodeAbiParameters([...], [...]);

const createParams = {
  initialSupply: parseEther("1000000"),
  numTokensToSell: parseEther("500000"),
  numeraire: wethAddress,
  tokenFactory: addresses.tokenFactory,
  tokenFactoryData,
  governanceFactory: addresses.governanceFactory,
  governanceFactoryData,
  poolInitializer: addresses.v4Initializer,
  poolInitializerData,
  liquidityMigrator: addresses.v4Migrator,
  liquidityMigratorData,
  integrator: integratorAddress,
  salt,
};

await factory.create(createParams);
```

### Unified SDK
```typescript
// Structured parameters, no manual encoding needed
await sdk.factory.createDynamicAuction({
  token: {
    name: "My Token",
    symbol: "MTK",
    tokenURI: "https://example.com/metadata.json",
    yearlyMintRate: parseEther("0.02"), // Optional
  },
  sale: {
    initialSupply: parseEther("1000000"),
    numTokensToSell: parseEther("500000"),
    numeraire: wethAddress,
  },
  auction: {
    duration: 7,
    epochLength: 3600,
    startTick: -92103,
    endTick: -69080,
    gamma: 60, // Optional, auto-calculated if not provided
    minProceeds: parseEther("100"),
    maxProceeds: parseEther("1000"),
    numPdSlugs: 5, // Optional
  },
  pool: {
    fee: 3000,
    tickSpacing: 60,
  },
  governance: {
    initialVotingDelay: 7200,        // Optional
    initialVotingPeriod: 50400,      // Optional
    initialProposalThreshold: 0n,    // Optional
  },
  migration: {
    type: 'uniswapV4',
    fee: 3000,
    tickSpacing: 60,
    streamableFees: {
      lockDuration: 365 * 24 * 60 * 60,
      beneficiaries: [...],
    },
  },
  userAddress,
});
```

## Interacting with Deployed Pools

### V4 SDK
```typescript
import { ReadDoppler } from 'doppler-v4-sdk';

const doppler = new ReadDoppler(hookAddress, drift);
const state = await doppler.state();
const currentEpoch = await doppler.currentEpoch();
```

### Unified SDK
```typescript
const auction = await sdk.getDynamicAuction(hookAddress);
const hookInfo = await auction.getHookInfo();
const currentEpoch = await auction.getCurrentEpoch();

// HookInfo includes all state data
console.log('Total proceeds:', hookInfo.totalProceeds);
console.log('Current epoch:', hookInfo.currentEpoch);
```

## Token Interactions

### V4 SDK
```typescript
import { ReadWriteDerc20 } from 'doppler-v4-sdk';

const token = new ReadWriteDerc20(tokenAddress, drift);
const balance = await token.balanceOf(userAddress);
await token.transfer(recipient, amount);
```

### Unified SDK
```typescript
import { Derc20 } from '@doppler/sdk';

const token = new Derc20(publicClient, walletClient, tokenAddress);
const balance = await token.getBalanceOf(userAddress);
await token.transfer(recipient, amount);

// Additional vesting features
const vestingData = await token.getVestingData(userAddress);
await token.release(vestableAmount);
```

## Price Quotes

### V4 SDK
```typescript
import { ReadQuoter } from 'doppler-v4-sdk';

const quoter = new ReadQuoter(quoterAddress, drift);
// Limited quoting functionality
```

### Unified SDK
```typescript
const quoter = sdk.quoter;

// Quote on any Uniswap version
const quoteV3 = await quoter.quoteV3ExactInputSingle({
  tokenIn: tokenAddress,
  tokenOut: wethAddress,
  amountIn: parseEther('1000'),
  fee: 3000,
  sqrtPriceLimitX96: 0n,
});

const quoteV2 = await quoter.quoteV2ExactInputSingle({
  tokenIn: tokenAddress,
  tokenOut: wethAddress,
  amountIn: parseEther('1000'),
});
```

## Migration Data Encoding

### V4 SDK
```typescript
// Manual encoding for V4 migrator
const v4MigratorData = await factory.encodeV4MigratorData({
  fee: 3000,
  tickSpacing: 60,
  lockDuration: 365 * 24 * 60 * 60,
  beneficiaries: [
    { beneficiary: addr1, shares: parseEther("0.5") },
    { beneficiary: addr2, shares: parseEther("0.5") },
  ],
});
```

### Unified SDK
```typescript
// Structured migration config (no manual encoding)
const migration: MigrationConfig = {
  type: 'uniswapV4',
  fee: 3000,
  tickSpacing: 60,
  streamableFees: {
    lockDuration: 365 * 24 * 60 * 60,
    beneficiaries: [
      { address: addr1, percentage: 5000 }, // 50%
      { address: addr2, percentage: 5000 }, // 50%
    ],
  },
};
```

## Error Handling

Both SDKs throw similar errors, but the unified SDK provides more descriptive messages:

### V4 SDK
```typescript
try {
  await factory.create(params);
} catch (error) {
  // Generic contract errors
}
```

### Unified SDK
```typescript
try {
  await sdk.factory.createDynamicAuction(params);
} catch (error) {
  // More descriptive errors:
  // "Either priceRange or tickRange must be provided"
  // "Total beneficiary percentages must sum to 10000"
  // "Computed gamma must be divisible by tick spacing"
}
```

## Complete Migration Example

Here's a complete example migrating a typical V4 SDK pool creation:

### Before (V4 SDK)
```typescript
import { ReadWriteFactory } from 'doppler-v4-sdk';
import { DOPPLER_V4_ADDRESSES } from 'doppler-v4-sdk/addresses';
import { createDrift } from '@delvtech/drift';
import { parseEther } from 'viem';

// Setup
const drift = createDrift({ rpc: publicClient, signer: walletClient });
const factory = new ReadWriteFactory(DOPPLER_V4_ADDRESSES[chainId].airlock, drift);

// Build config
const { createParams } = factory.buildConfig({
  name: "Example Token",
  symbol: "EXT",
  totalSupply: parseEther("1000000"),
  numTokensToSell: parseEther("900000"),
  tokenURI: "ipfs://...",
  blockTimestamp: Math.floor(Date.now() / 1000),
  startTimeOffset: 0,
  duration: 30,
  epochLength: 3600,
  numeraire: wethAddress,
  priceRange: { startPrice: 0.001, endPrice: 0.01 },
  tickSpacing: 60,
  fee: 3000,
  minProceeds: parseEther("100"),
  maxProceeds: parseEther("10000"),
  yearlyMintRate: parseEther("0.02"),
  vestingDuration: BigInt(365 * 24 * 60 * 60),
  recipients: [teamAddress],
  amounts: [parseEther("100000")],
  integrator: myAddress,
}, DOPPLER_V4_ADDRESSES[chainId]);

// Create pool
const txHash = await factory.create(createParams);
```

### After (Unified SDK)
```typescript
import { DopplerSDK } from '@doppler/sdk';
import { parseEther } from 'viem';

// Setup (simpler)
const sdk = new DopplerSDK({ publicClient, walletClient, chainId });

// Build config (cleaner API with defaults)
const config = sdk.factory.buildDynamicAuctionConfig({
  name: "Example Token",
  symbol: "EXT",
  totalSupply: parseEther("1000000"),
  numTokensToSell: parseEther("900000"),
  tokenURI: "ipfs://...",
  priceRange: { startPrice: 0.001, endPrice: 0.01 },
  tickSpacing: 60,
  fee: 3000,
  minProceeds: parseEther("100"),
  maxProceeds: parseEther("10000"),
  vestingDuration: BigInt(365 * 24 * 60 * 60),
  recipients: [teamAddress],
  amounts: [parseEther("100000")],
  migration: { type: 'uniswapV2' },
  // duration, epochLength, numeraire, yearlyMintRate use defaults
}, myAddress);

// Create auction (returns more info)
const result = await sdk.factory.createDynamicAuction(config);
console.log('Created hook:', result.hookAddress);
console.log('Created token:', result.tokenAddress);
console.log('Pool ID:', result.poolId);
```

## Summary of Benefits

1. **Simpler API**: No need to manage drift, addresses, or encode parameters
2. **Better Defaults**: Most parameters have sensible defaults
3. **Type Safety**: Structured configs instead of raw bytes
4. **Unified Interface**: Same SDK handles both V3 and V4 functionality
5. **Better Return Values**: Get hook address, token address, and pool ID directly
6. **Cleaner Imports**: Single package to import from

The unified SDK maintains compatibility with all V4 functionality while providing a cleaner, more intuitive API.