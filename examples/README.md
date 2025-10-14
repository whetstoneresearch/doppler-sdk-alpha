# Doppler SDK Examples

This directory contains practical examples demonstrating how to use the Doppler SDK for various token launch scenarios.

## Examples

### 1. [Static Auction with V2 Migration](./static-auction-v2.ts)
Create a simple token launch using a static price range on Uniswap V3, then migrate to Uniswap V2.

### 2. [Dynamic Auction with V4 Migration](./dynamic-auction-v4.ts)
Create a gradual Dutch auction that adjusts price over time based on demand.

### 3. [Multicurve Initializer (V4)](./multicurve-initializer.ts)
Create a pool seeded with multiple curves in one initializer call. Use any standard migration path (V2/V3/V4).

### 4. [Multicurve with Lockable Beneficiaries](./multicurve-lockable-beneficiaries.ts)
Create a multicurve auction with fee streaming to multiple beneficiaries. Uses NoOp migration (no post-auction migration) to keep liquidity locked while distributing fees.

### 5. [Multicurve Fee Collection](./multicurve-collect-fees.ts)
Collect and distribute trading fees from a multicurve pool with lockable beneficiaries. Demonstrates how beneficiaries can claim accumulated fees from swap activity.

### 6. [Multicurve Pre-Buy with WETH](./multicurve-prebuy-weth.ts)
Atomically create a multicurve auction and pre-buy tokens using WETH (not ETH) with Permit2 signatures. Demonstrates using `doppler-router` to build Universal Router commands for V4 swaps.

### 7. [Multicurve Quote & Swap](./multicurve-quote-and-swap.ts)
Launch a multicurve auction, get a V4 quote, and execute a swap on the new pool.

### 8. [Auction Monitoring](./auction-monitoring.ts)
Monitor an existing auction for graduation status and key metrics.

### 9. [Token Interaction](./token-interaction.ts)
Interact with launched tokens - check balances, approve spending, and release vested tokens.

### 10. [Price Quoter](./price-quoter.ts)
Get price quotes across different Uniswap versions for optimal trading.

### 11. [Scheduled Multicurve Launch](./multicurve-scheduled-launch.ts)
Create a multicurve auction that queues until a future start time using the scheduled initializer on Base.

## Prerequisites

Before running these examples, ensure you have:

1. **Node.js** (v18 or higher)
2. **A wallet** with private key
3. **ETH or native tokens** for gas fees
4. **RPC endpoint** for your target chain

## Setup

1. Install dependencies:
```bash
npm install doppler-sdk viem

# For multicurve pre-buy example (optional)
npm install doppler-router
```

2. Set up environment variables:
```bash
# Create a .env file
cp .env.example .env

# Add your configuration
PRIVATE_KEY=your_private_key_here
RPC_URL=https://your-rpc-endpoint
```

3. Run an example:
```bash
npx ts-node examples/static-auction-v2.ts
```

## Common Patterns

### SDK Initialization
```typescript
import { DopplerSDK } from 'doppler-sdk'
import { createPublicClient, createWalletClient, http } from 'viem'
import { base } from 'viem/chains'

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL)
})

const walletClient = createWalletClient({
  chain: base,
  transport: http(process.env.RPC_URL),
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
})

const sdk = new DopplerSDK({
  publicClient,
  walletClient,
  chainId: base.id
})
```

### Error Handling
All SDK methods can throw errors. Always wrap calls in try-catch blocks:

```typescript
try {
  const result = await sdk.factory.createStaticAuction(params)
  console.log('Success:', result)
} catch (error) {
  console.error('Failed to create auction:', error.message)
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
  data: encodedData
})
```

## Support

For questions or issues:
- Read the [SDK documentation](../README.md)
- Check the [migration guide](../docs/MIGRATION.md)
- Open an issue on [GitHub](https://github.com/doppler-sdk/issues)
