import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

/**
 * Fork test configuration
 *
 * Runs tests against Anvil forks of live networks.
 * Requires ALCHEMY_API_KEY or chain-specific RPC URLs.
 * Set ANVIL_FORK_ENABLED=true to enable fork mode.
 *
 * Usage: ANVIL_FORK_ENABLED=true pnpm test:fork
 *
 * To run tests for a specific chain only:
 *   TEST_CHAIN=base pnpm test:fork
 *   TEST_CHAIN=base-sepolia pnpm test:fork
 *   TEST_CHAIN=mainnet pnpm test:fork
 *   TEST_CHAIN=monad pnpm test:fork
 *   TEST_CHAIN=arbitrum pnpm test:fork
 */

// Determine which tests to include based on TEST_CHAIN env var
function getIncludePatterns(): string[] {
  const testChain = process.env.TEST_CHAIN;

  if (!testChain) {
    // Run all fork tests
    return ['test/evm/fork/**/*.test.ts', 'test/evm/integration/**/*.test.ts'];
  }

  // Map chain names to chain-specific fork test patterns.
  const chainPatterns: Record<string, string[]> = {
    base: [
      'test/evm/fork/base/**/*.test.ts',
      'test/evm/integration/**/*.test.ts',
    ],
    'base-sepolia': [
      'test/evm/fork/base-sepolia/**/*.test.ts',
      'test/evm/integration/**/*.test.ts',
    ],
    mainnet: ['test/evm/fork/mainnet/**/*.test.ts'],
    monad: ['test/evm/fork/**/*.monad-mainnet.test.ts'],
    arbitrum: ['test/evm/fork/arbitrum/**/*.test.ts'],
  };

  return (
    chainPatterns[testChain] || [
      'test/evm/fork/**/*.test.ts',
      'test/evm/integration/**/*.test.ts',
    ]
  );
}

const base = baseConfig as any;
const baseTest = base.test ?? {};

export default defineConfig({
  ...base,
  test: {
    ...baseTest,
    include: getIncludePatterns(),
    exclude: [
      'node_modules/',
      'dist/',
      'test/evm/setup/**',
      'test/evm/unit/**',
      'test/evm/e2e/**',
    ],
    // Fork tests run sequentially to share Anvil state
    maxConcurrency: 1,
    fileParallelism: false,
    // Longer timeout for fork operations
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Global setup starts Anvil
    globalSetup: ['./test/evm/setup/globalSetup.ts'],
    // Setup file for custom matchers and snapshot hooks
    setupFiles: ['./test/evm/setup/vitest.setup.ts'],
    // Env vars for fork mode
    env: {
      ...(baseTest.env ?? {}),
      ANVIL_FORK_ENABLED: 'true',
    },
  },
});
