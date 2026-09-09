import { describe, it, expect } from 'vitest';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { DopplerSDK } from '../../../../src/evm';

// Only run when explicitly enabled to avoid flaky network tests in CI
const RUN_FORK_TESTS = process.env.RUN_FORK_TESTS === '1';
const BASE_RPC_URL = process.env.BASE_RPC_URL;

const shouldRun = RUN_FORK_TESTS && Boolean(BASE_RPC_URL);
const maybeDescribe = shouldRun ? describe : describe.skip;

maybeDescribe(
  'Fork/Live - DynamicAuction state() decoding is backward compatible',
  () => {
    // Use raw client for fork tests (they run with dedicated RPC)
    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL!),
    });

    const sdk = new DopplerSDK({ publicClient, chainId: base.id });

    // Issue #6 supplied token addresses, not hook addresses.
    const tokenAddresses = [
      '0x87b2050fae7306d4144031c417e11e937bbaf48e', // recent
      '0x5cdeb399d27a2bfa31df1348fb2c11d4b54eda3d', // old
    ] as const;

    for (const tokenAddress of tokenAddresses) {
      it(`decodes historical hook state for token ${tokenAddress}`, async () => {
        const { poolOrHook } = await sdk.getAirlockAssetData(tokenAddress);
        const auction = await sdk.getDynamicAuction(poolOrHook);
        const info = await auction.getHookInfo();
        expect(info.totalProceeds).toBeTypeOf('bigint');
        expect(info.totalTokensSold).toBeTypeOf('bigint');
      }, 30_000);
    }
  },
);
