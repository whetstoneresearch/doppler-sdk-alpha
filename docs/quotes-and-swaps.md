# Quotes and Swaps (Unified SDK)

This guide shows how to get price quotes and execute swaps using the unified `@whetstone-research/doppler-sdk` across Uniswap V2, V3, and V4 (including Doppler dynamic auctions).

- Quoting uses the SDK `Quoter` for V2/V3/V4.
- Executing swaps uses the Uniswap Universal Router. For convenience, we show examples with the `doppler-router` helpers used in the miniapp.

## Setup

```ts
import { DopplerSDK, Quoter, getAddresses, DYNAMIC_FEE_FLAG } from '@whetstone-research/doppler-sdk'
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem'
import { base } from 'viem/chains'

const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
const walletClient  = createWalletClient({ chain: base, transport: http(rpcUrl), account })

const sdk = new DopplerSDK({ publicClient, walletClient, chainId: base.id })
const quoter = new Quoter(publicClient, base.id)
const addresses = getAddresses(base.id)
```

---

## Quoting

### V3: Exact Input (Single Pool)

```ts
const { amountOut, sqrtPriceX96After } = await quoter.quoteExactInputV3({
  tokenIn:  tokenInAddress,
  tokenOut: tokenOutAddress,
  amountIn: parseUnits('1.0', inDecimals),
  fee: 3000,                 // 0.3%
  sqrtPriceLimitX96: 0n,     // optional
})
```

### V3: Exact Output (Single Pool)

```ts
const { amountIn } = await quoter.quoteExactOutputV3({
  tokenIn:  tokenInAddress,
  tokenOut: tokenOutAddress,
  amountOut: parseUnits('100', outDecimals),
  fee: 3000,
})
```

### V2: Exact Input (Path)

```ts
// Simple 2-hop path (tokenIn -> tokenOut). Multi-hop supported.
const amounts = await quoter.quoteExactInputV2({
  amountIn: parseUnits('1.0', inDecimals),
  path: [tokenInAddress, tokenOutAddress],
})
const amountOut = amounts[amounts.length - 1]
```

### V4 (Dynamic Auctions): Exact Input

For Doppler V4 dynamic auctions, build a `poolKey` and determine direction with `zeroForOne`:

```ts
import { Address } from 'viem'

// Sort to get currency0/currency1 as in V4 (lexicographically ascending)
const [currency0, currency1] = [baseToken as Address, quoteToken as Address]
  .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))

const poolKey = {
  currency0,
  currency1,
  fee: DYNAMIC_FEE_FLAG, // Doppler dynamic auctions use the dynamic fee flag
  tickSpacing: 8,        // Typical for Doppler auctions; use actual value if known
  hooks: hookAddress as Address,
}

// Direction: swap 0->1 when tokenIn is currency0
const zeroForOne = (tokenInAddress.toLowerCase() === currency0.toLowerCase())

const { amountOut } = await quoter.quoteExactInputV4({
  poolKey,
  zeroForOne,
  exactAmount: parseUnits('1.0', inDecimals),
  hookData: '0x', // usually empty for Doppler swaps
})
```

Notes:
- Use your pool’s actual `tickSpacing` if available from the indexer or hook config.
- `hookData` is typically `0x` for Doppler swaps.

---

## Executing Swaps (Universal Router)

The SDK exposes addresses for the Uniswap Universal Router via `getAddresses(chainId)`. To build inputs, the miniapp uses `doppler-router` helpers; you can do the same or craft bytes manually.

Install helpers:

```bash
npm install doppler-router
```

### V4 Dynamic Auction: Swap Exact In Single

```ts
import { CommandBuilder, V4ActionBuilder, V4ActionType } from 'doppler-router'
import { zeroAddress, maxUint256, parseUnits } from 'viem'

// 1) Build poolKey and zeroForOne as in the quoting example
const [currency0, currency1] = [baseToken as Address, quoteToken as Address]
  .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
const poolKey = { currency0, currency1, fee: DYNAMIC_FEE_FLAG, tickSpacing: 8, hooks: hookAddress as Address }
const zeroForOne = (tokenInAddress.toLowerCase() === currency0.toLowerCase())
const amountIn = parseUnits('1.0', inDecimals)
const minAmountOut = 0n // add slippage logic as needed

// 2) Build V4 swap actions
const actionBuilder = new V4ActionBuilder()
const [actions, params] = actionBuilder
  .addSwapExactInSingle(poolKey, zeroForOne, amountIn, minAmountOut, '0x')
  // Settle and take ensures outputs are transferred correctly
  .addAction(V4ActionType.SETTLE_ALL, [zeroForOne ? poolKey.currency0 : poolKey.currency1, maxUint256])
  .addAction(V4ActionType.TAKE_ALL,   [zeroForOne ? poolKey.currency1 : poolKey.currency0, 0])
  .build()

// 3) Encode Universal Router command
const [commands, inputs] = new CommandBuilder().addV4Swap(actions, params).build()

// 4) Minimal Universal Router ABI with execute()
const universalRouterAbi = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs',   type: 'bytes[]' },
    ],
    outputs: [],
  },
] as const

// 5) Execute
const txHash = await walletClient.writeContract({
  address: addresses.universalRouter,
  abi: universalRouterAbi,
  functionName: 'execute',
  args: [commands, inputs],
  // Send ETH when swapping from native currency (currency0 usually WETH/native)
  value: zeroForOne ? amountIn : 0n,
})
const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
```

Tips:
- For ERC20 inputs, ensure allowance (Permit2 or token approve). See `doppler-router` `getPermitSignature` helper.
- Use a non‑zero `minAmountOut` based on a prior quote and desired slippage.

### V3 and V2 Swaps

The Universal Router also supports V3/V2 swaps. You can:
- Use the `CommandBuilder` to add V3/V2 swap commands similarly, or
- Call the respective pool routers directly (outside the scope of this doc).

The unified SDK’s `Quoter` covers price discovery for all of V2/V3/V4 regardless of which path you choose for execution.

---

## End‑to‑End Pattern (Miniapp)

The `doppler-v4-miniapp` in this repo demonstrates:
- Building V4 `poolKey` and `zeroForOne` from base/quote tokens
- Quoting via `quoter.quoteExactInputV4`
- Executing via Universal Router using `doppler-router` builders

Look at `src/pages/PoolDetails.tsx` for a complete reference implementation.

---

## Create + Pre‑Buy (Bundle)

For static (V3‑style) auctions you can atomically create the pool and execute a pre‑buy in the same transaction via the Bundler. This mirrors the older V3 SDK’s `bundle(...)` flow.

Steps:
- Simulate create to get the predicted token (asset) address and `CreateParams`.
- Decide the amount of tokens to pre‑buy (`amountOut`).
- Use `factory.simulateBundleExactOutput(...)` to learn the required ETH/WETH input (`amountIn`).
- Build Universal Router commands for a V3 exact‑out swap (e.g., with `doppler-router`).
- Call `factory.bundle(...)` with the `CreateParams`, commands, and inputs. Send `value = amountIn` if swapping from ETH.

Example:

```ts
import { CommandBuilder, SwapRouter02Encoder } from 'doppler-router'
import { parseEther } from 'viem'

// 1) Build your static params (builder recommended)
const staticParams = new StaticAuctionBuilder(base.id)
  .tokenConfig({ name: 'My Token', symbol: 'MTK', tokenURI: 'ipfs://...' })
  .saleConfig({ initialSupply: parseEther('1_000_000_000'), numTokensToSell: parseEther('900_000_000'), numeraire: weth })
  .poolByTicks({ fee: 10000 })
  .withGovernance({ useDefaults: true })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(user)
  .build()

// 2) Simulate create → get CreateParams and predicted token address
const { createParams, asset } = await sdk.factory.simulateCreateStaticAuction(staticParams)

// 3) Choose a pre‑buy target amountOut (e.g., 1% of tokens for sale)
const amountOut = staticParams.sale.numTokensToSell / 100n

// 4) Quote required input using the Bundler simulator
const amountIn = await sdk.factory.simulateBundleExactOutput(createParams, {
  tokenIn: weth,
  tokenOut: asset,
  amount: amountOut,
  fee: 10_000,
  sqrtPriceLimitX96: 0n,
})

// 5) Build Universal Router commands for a V3 exact‑out swap
const path = [weth, asset]
const encodedPath = new SwapRouter02Encoder().encodePathExactOutput(path)
const builder = new CommandBuilder()
builder.addWrapEth(addresses.universalRouter, amountIn)
builder.addV3SwapExactOut(user, amountOut, amountIn, encodedPath, false)
const [commands, inputs] = builder.build()

// 6) Atomically create + pre‑buy
const txHash = await sdk.factory.bundle(createParams, commands, inputs, { value: amountIn })
```

Notes:
- Bundling is supported for static (V3‑style) auctions. Dynamic (V4) auctions use the Universal Router directly after creation.
- If buying with ERC‑20 input instead of native ETH, approve/permit as needed and omit `value`.
