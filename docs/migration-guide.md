# Migration Guide

This guide helps you migrate from `doppler-v3-sdk` or `doppler-v4-sdk` to the unified `@whetstone-research/doppler-sdk` using the builder pattern.

## Overview of Changes

The new SDK consolidates both V3 and V4 functionality into a single package with clearer terminology:

- **V3 → Static Auctions**: Fixed price range liquidity bootstrapping
- **V4 → Dynamic Auctions**: Gradual Dutch auctions with Uniswap V4 hooks
- **Unified API**: Single SDK instance handles both auction types
- **Improved Types**: Discriminated unions for type-safe configurations
- **viem Integration**: Replaced ethers.js with viem for better performance

## Installation

Remove the old packages and install the new unified SDK:

```bash
# Remove old packages
npm uninstall @doppler/v3-sdk @doppler/v4-sdk ethers

# Install new packages
npm install @whetstone-research/doppler-sdk viem
```

## Initialization Changes

### Before (V3 SDK)
```typescript
import { ReadWriteFactory } from '@doppler/v3-sdk';
import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const signer = new ethers.Wallet(privateKey, provider);

const factory = new ReadWriteFactory(signer, chainId);
```

### Before (V4 SDK)
```typescript
import { ReadWriteFactory } from '@doppler/v4-sdk';
import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const signer = new ethers.Wallet(privateKey, provider);

const factory = new ReadWriteFactory(signer, chainId);
```

### After (Unified SDK)
```typescript
import { DopplerSDK } from '@whetstone-research/doppler-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  chain: base,
  transport: http(rpcUrl),
  account: privateKeyToAccount(privateKey),
});

const sdk = new DopplerSDK({
  publicClient,
  walletClient,
  chainId: base.id,
});
```

## Creating Auctions

### Static Auctions (Previously V3)

#### Before
```typescript
// Manually encode migration data
const liquidityMigratorData = await factory.encodeV4MigratorData({
  fee: 3000,
  tickSpacing: 60,
  lockDuration: 365 * 24 * 60 * 60,
  beneficiaries: sortedBeneficiaries,
});

const { poolAddress, tokenAddress } = await factory.create({
  name: 'My Token',
  symbol: 'MTK',
  tokenURI: 'https://example.com/token',
  vestingDuration: 0,
  yearlyMintRate: 0,
  totalSupply: parseEther('1000000'),
  numTokensToSell: parseEther('500000'),
  startTick: -92103,
  endTick: -69080,
  fee: 3000,
  numeraire: wethAddress,
  initialRecipients: [],
  initialAmounts: [],
  contracts: {
    governor: governorAddress,
    tokenFactory: addresses.tokenFactory,
    poolInitializer: addresses.v3Initializer,
    liquidityMigrator: addresses.v4Migrator,
    airlock: addresses.airlock,
  },
  integrator: integratorAddress,
  liquidityMigratorData,
});
```

#### After (Builder pattern)
```typescript
import { StaticAuctionBuilder } from '@whetstone-research/doppler-sdk'

const params = new StaticAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/token' })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('500000'),
    numeraire: wethAddress,
  })
  .poolByTicks({ startTick: -92103, endTick: -69080, fee: 3000 })
  .withMigration({
    type: 'uniswapV4',
    fee: 3000,
    tickSpacing: 60,
    streamableFees: { lockDuration: 365 * 24 * 60 * 60, beneficiaries: sortedBeneficiaries },
  })
  .withVesting({ duration: 0n })
  .withIntegrator(integratorAddress)
  .withUserAddress(governorAddress)
  .build()

const result = await sdk.factory.createStaticAuction(params)
```

### Dynamic Auctions (Previously V4)

#### Before
```typescript
// Calculate gamma manually
const gamma = calculateGamma(...);

// Mine hook address
const minedAddress = await hookAddressMiner.mine({
  dopplerDeployer: addresses.dopplerDeployer,
  prefix: '0x00',
});

const { hookAddress, tokenAddress } = await factory.create({
  name: 'My Token',
  symbol: 'MTK',
  tokenURI: 'https://example.com/token',
  // ... many parameters
  poolInitializerData: encodePoolInitializerData({
    minimumProceeds,
    maximumProceeds,
    startingTime,
    endingTime,
    startingTick,
    endingTick,
    epochLength,
    gamma,
    isToken0,
    numPDSlugs,
    fee,
    tickSpacing,
  }),
});
```

#### After (Builder pattern)
```typescript
import { DynamicAuctionBuilder } from '@whetstone-research/doppler-sdk'

const params = new DynamicAuctionBuilder()
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'https://example.com/token' })
  .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('500000'), numeraire: wethAddress })
  .poolConfig({ fee: 3000, tickSpacing: 60 })
  .auctionByPriceRange({
    priceRange: { startPrice: 0.0001, endPrice: 0.01 },
    minProceeds: parseEther('50'),
    maxProceeds: parseEther('500'),
    durationDays: 7,
    epochLength: 3600,
  })
  .withMigration({
    type: 'uniswapV4',
    fee: 3000,
    tickSpacing: 60,
    streamableFees: { lockDuration: 365 * 24 * 60 * 60, beneficiaries: [...] },
  })
  .withUserAddress(governorAddress)
  .build()

const result = await sdk.factory.createDynamicAuction(params)
```

## Interacting with Auctions

### Before (Both SDKs)
```typescript
// Manual contract calls with ethers
const pool = new ethers.Contract(poolAddress, poolAbi, provider);
const slot0 = await pool.slot0();
const liquidity = await pool.liquidity();
```

### After (Unified SDK)
```typescript
// Static Auction
const staticAuction = await sdk.getStaticAuction(poolAddress);
const poolInfo = await staticAuction.getPoolInfo();
const hasGraduated = await staticAuction.hasGraduated();

// Dynamic Auction
const dynamicAuction = await sdk.getDynamicAuction(hookAddress);
const hookInfo = await dynamicAuction.getHookInfo();
const currentEpoch = await dynamicAuction.getCurrentEpoch();
```

## Token Interactions

### Before
```typescript
import { Derc20 } from 'doppler-v3-sdk';

const token = new Derc20(tokenAddress, signer);
const balance = await token.balanceOf(address);
```

### After (Unified SDK)
```typescript
import { Derc20 } from '@whetstone-research/doppler-sdk';

const token = new Derc20(publicClient, walletClient, tokenAddress);
const balance = await token.getBalanceOf(address);
const vestingData = await token.getVestingData(address);
```

## Quoter Changes

### Before
```typescript
import { Quoter } from 'doppler-v3-sdk';

const quoter = new Quoter(signer, chainId);
const quote = await quoter.quoteExactInputSingle({
  tokenIn,
  tokenOut,
  fee,
  amountIn,
  sqrtPriceLimitX96,
});
```

### After
```typescript
const quoter = sdk.quoter;
const quote = await quoter.quoteV3ExactInputSingle({
  tokenIn,
  tokenOut,
  fee,
  amountIn,
  sqrtPriceLimitX96: 0n,
});
```

