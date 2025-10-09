import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { vi } from 'vitest';
import type { Address, WalletClient } from 'viem';
import { SupportedPublicClient } from '../../types';
import {
  mockAddresses,
  mockHookAddress,
  mockPoolAddress,
  mockTokenAddress,
} from './addresses';

// Mock viem clients for testing
export const createMockPublicClient = (): SupportedPublicClient => {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  // Mock the readContract method
  client.readContract = vi.fn();
  client.getTransactionReceipt = vi.fn();
  client.waitForTransactionReceipt = vi.fn();
  client.getBalance = vi.fn();
  client.estimateContractGas = vi.fn();
  client.getBytecode = vi.fn().mockResolvedValue('0x6000e2e9faa107087b0600');
  client.getBlock = vi.fn().mockResolvedValue({ timestamp: 1_700_000_000n });
  client.getChainId = vi.fn().mockResolvedValue(1);

  const defaultCreateResult: readonly Address[] = [
    mockTokenAddress,
    mockPoolAddress,
    mockAddresses.governance,
    mockAddresses.timelock,
    mockAddresses.v2Pool,
  ];

  client.simulateContract = vi.fn(async (call: any) => {
    const { address, abi, functionName, args } = call ?? {};

    switch (functionName) {
      case 'create':
        return {
          request: { address, abi, functionName, args },
          result: defaultCreateResult,
        };
      case 'simulateBundleExactOut':
        return {
          request: { address, abi, functionName, args },
          result: 0n,
        };
      case 'simulateMulticurveBundleExactOut':
        return {
          request: { address, abi, functionName, args },
          result: [
            mockTokenAddress,
            [
              mockAddresses.weth,
              mockTokenAddress,
              3000,
              60,
              mockHookAddress,
            ],
            0n,
            0n,
          ],
        };
      case 'simulateMulticurveBundleExactIn':
        return {
          request: { address, abi, functionName, args },
          result: [
            mockTokenAddress,
            {
              currency0: mockAddresses.weth,
              currency1: mockTokenAddress,
              fee: 3000n,
              tickSpacing: 60n,
              hooks: mockHookAddress,
            },
            0n,
            0n,
          ],
        };
      case 'bundle':
        return {
          request: { address, abi, functionName, args },
        };
      default:
        return {
          request: { address, abi, functionName, args },
          result: undefined,
        };
    }
  });

  return client;
};

export const createMockWalletClient = (): WalletClient => {
  const client = createWalletClient({
    chain: mainnet,
    transport: http(),
    account: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  });

  // Mock the writeContract method
  client.writeContract = vi.fn();
  client.account = {
    address: '0x0000000000000000000000000000000000000001' as `0x${string}`,
    type: 'json-rpc',
  };

  return client;
};

// Helper to create a mock transaction receipt
export const createMockTransactionReceipt = (logs: any[] = []) => ({
  transactionHash:
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
  blockHash:
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`,
  blockNumber: 12345678n,
  contractAddress: null,
  from: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  gasUsed: 100000n,
  logs,
  status: 'success' as const,
  to: '0x0000000000000000000000000000000000000002' as `0x${string}`,
  transactionIndex: 0,
  cumulativeGasUsed: 100000n,
  effectiveGasPrice: 1000000000n,
  logsBloom: '0x' as `0x${string}`,
  type: 'legacy' as const,
});
