import { describe, it, expect } from 'vitest'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { DopplerSDK } from '../../index'

// Only run when explicitly enabled to avoid flaky network tests in CI
const RUN = process.env.RUN_FORK_TESTS === '1'
const maybeDescribe = RUN ? describe : describe.skip

maybeDescribe('Fork/Live - DynamicAuction state() decoding is backward compatible', () => {
  const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'

  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  })

  const sdk = new DopplerSDK({ publicClient, chainId: base.id })

  // Provided in GitHub issue #6: one recent hook, one old hook
  const hookAddresses = [
    '0x87b2050fae7306d4144031c417e11e937bbaf48e', // recent
    '0x5cdeb399d27a2bfa31df1348fb2c11d4b54eda3d', // old
  ] as const

  for (const hookAddress of hookAddresses) {
    it(`decodes state() via SDK fallback for ${hookAddress}`, async () => {
      const auction = await sdk.getDynamicAuction(hookAddress)
      // Access private for testing purposes to isolate state() decoding
      const state = await (auction as any).readHookState()
      expect((state as any).totalProceeds).toBeTypeOf('bigint')
      expect((state as any).totalTokensSold).toBeTypeOf('bigint')
    }, 30_000)
  }
})
