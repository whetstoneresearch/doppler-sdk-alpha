# Migration Guide

This guide helps you migrate from `doppler-v3-sdk` or `doppler-v4-sdk` to the unified `@doppler/sdk`.

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
npm install @doppler/sdk viem
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
import { DopplerSDK } from '@doppler/sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  chain: base,
  transport: http(rpcUrl),
  account: privateKeyAccount(privateKey),
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

#### After
```typescript
const result = await sdk.factory.createStaticAuction({
  token: {
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/token',
  },
  sale: {
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('500000'),
    numeraire: wethAddress,
  },
  pool: {
    startTick: -92103,
    endTick: -69080,
    fee: 3000,
  },
  migration: {
    type: 'uniswapV4',
    fee: 3000,
    tickSpacing: 60,
    streamableFees: {
      lockDuration: 365 * 24 * 60 * 60,
      beneficiaries: sortedBeneficiaries,
    },
  },
  vesting: {
    duration: 0,
    recipients: [],
  },
  integrator: integratorAddress,
  userAddress: governorAddress,
});
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

#### After
```typescript
const result = await sdk.factory.createDynamicAuction({
  token: {
    name: 'My Token',
    symbol: 'MTK',
    tokenURI: 'https://example.com/token',
  },
  sale: {
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('500000'),
    numeraire: wethAddress,
  },
  auction: {
    duration: 7, // days
    epochLength: 3600, // seconds
    priceRange: {
      startPrice: 0.0001,
      endPrice: 0.01,
    },
    minProceeds: parseEther('50'),
    maxProceeds: parseEther('500'),
    // gamma is auto-calculated if not provided
  },
  pool: {
    fee: 3000,
    tickSpacing: 60,
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
  userAddress: governorAddress,
});
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
import { Derc20 } from '@doppler/v3-sdk';

const token = new Derc20(tokenAddress, signer);
const balance = await token.balanceOf(address);
```

### After
```typescript
import { Derc20 } from '@doppler/sdk';

const token = new Derc20(publicClient, walletClient, tokenAddress);
const balance = await token.getBalanceOf(address);
const vestingData = await token.getVestingData(address);
```

## Quoter Changes

### Before
```typescript
import { Quoter } from '@doppler/v3-sdk';

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

## Key Differences

1. **Terminology**: V3/V4 → Static/Dynamic auctions
2. **Configuration**: Explicit, type-safe configuration objects
3. **Migration Config**: No more manual encoding of migration data
4. **Chain Management**: Chain ID passed once during SDK initialization
5. **Contract Addresses**: Automatically resolved based on chain
6. **Error Handling**: Better error messages with validation
7. **BigInt Usage**: All numeric values use native BigInt
8. **Event Parsing**: Automatic parsing of transaction receipts

## Common Gotchas

1. **viem vs ethers**: The new SDK uses viem. Key differences:
   - `parseEther` is imported from viem, not ethers
   - Addresses must be checksummed (`0x...` format)
   - BigInt is used instead of BigNumber

2. **Async Methods**: All SDK methods are async, even getters:
   ```typescript
   // Wrong
   const name = token.name();
   
   // Correct
   const name = await token.getName();
   ```

3. **Beneficiaries Required**: V4 migrations now require at least one beneficiary:
   ```typescript
   migration: {
     type: 'uniswapV4',
     streamableFees: {
       beneficiaries: [
         { address: '0x...', percentage: 10000 } // 100%
       ]
     }
   }
   ```

4. **Hook Address Mining**: Currently handled automatically, manual mining coming soon

## Getting Help

- [GitHub Issues](https://github.com/doppler-protocol/sdk/issues)
- [Discord Community](https://discord.gg/doppler)
- [Documentation](https://docs.doppler.finance)

## Example Migration

Here's a complete example migrating a V3 pool creation:

```typescript
// Old V3 SDK
import { ReadWriteFactory } from '@doppler/v3-sdk';
import { ethers } from 'ethers';

async function createV3Pool() {
  const provider = new ethers.providers.JsonRpcProvider();
  const signer = new ethers.Wallet(privateKey, provider);
  const factory = new ReadWriteFactory(signer, 1);
  
  const result = await factory.create({
    // ... 20+ parameters
  });
  
  return result;
}

// New Unified SDK
import { DopplerSDK } from '@doppler/sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

async function createStaticAuction() {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  });
  
  const walletClient = createWalletClient({
    chain: mainnet,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  });
  
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: mainnet.id,
  });
  
  const result = await sdk.factory.createStaticAuction({
    token: { name: 'Token', symbol: 'TKN', tokenURI: '...' },
    sale: { initialSupply: 1000000n, numTokensToSell: 500000n, numeraire: '0x...' },
    pool: { startTick: -92103, endTick: -69080, fee: 3000 },
    migration: { type: 'uniswapV2' },
    userAddress: '0x...',
  });
  
  return result;
}
```