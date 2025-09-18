import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { vi } from 'vitest';
import type { WalletClient } from 'viem';
import { SupportedPublicClient } from '../../types';

// Mock viem clients for testing
export const createMockPublicClient = (): SupportedPublicClient => {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  // Mock the readContract method
  client.readContract = vi.fn();
  client.simulateContract = vi.fn();
  client.getTransactionReceipt = vi.fn();
  client.waitForTransactionReceipt = vi.fn();
  client.getBalance = vi.fn();
  client.estimateContractGas = vi.fn();

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
