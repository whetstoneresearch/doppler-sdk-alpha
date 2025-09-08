import { describe, it, expect } from 'vitest'
import { createPublicClient, http, type Address, encodeFunctionData } from 'viem'
import { base } from 'viem/chains'
import { Quoter } from '../../entities/quoter/Quoter'
import { quoterV2Abi } from '../../abis'
import { getAddresses } from '../../addresses'

// Integration test that hits Base mainnet public RPC to verify
// V3 exact-output quoting works end-to-end with real on-chain data.
describe('V3 Quoter (Base mainnet)', () => {
  it('quotes exact output with provided params', async () => {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL || undefined), // defaults to https://mainnet.base.org
    })

    const quoter = new Quoter(publicClient as any, base.id)

    const tokenIn = '0xd89fdcB6c8D107f27CEe4452Ccfb70Dc4F9768a7' as Address
    const tokenOut = '0x7f932885C068fc4a8a01a7c71B7D800FE8a471f7' as Address

    // Log the inputs and encoded calldata for manual reproduction.
    const addresses = getAddresses(base.id)
    const args = [{
      tokenIn,
      tokenOut,
      amount: 10001000000000000000n,
      fee: 10000,
      sqrtPriceLimitX96: 0n,
    }]
    const calldata = encodeFunctionData({
      abi: quoterV2Abi,
      functionName: 'quoteExactOutputSingle',
      args,
    })

    // eslint-disable-next-line no-console
    console.log('[Base V3 quote] quoter:', addresses.v3Quoter)
    // stringify bigints
    const argsPrintable = Object.fromEntries(
      Object.entries(args[0] as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === 'bigint' ? v.toString() : v,
      ]),
    )
    // eslint-disable-next-line no-console
    console.log('[Base V3 quote] args object:', JSON.stringify(argsPrintable, null, 2))
    // eslint-disable-next-line no-console
    console.log('[Base V3 quote] encoded calldata:', calldata)

    const res = await quoter.quoteExactOutputV3({
      tokenIn,
      tokenOut,
      amountOut: 10001000000000000000n,
      fee: 10000,
      sqrtPriceLimitX96: 0n,
    })

    expect(res.amountIn).toBeTypeOf('bigint')
    expect(res.amountIn > 0n).toBe(true)
  }, 30000)
})
