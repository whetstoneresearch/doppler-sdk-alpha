import { vi } from 'vitest';
import {
  ContractFunctionRevertedError,
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionResult,
  multicall3Abi,
  type Address,
  type Hex,
  zeroAddress,
} from 'viem';
import { MulticurvePool } from '@/entities/auction/MulticurvePool';
import { feeClaimsInitializerAbi } from '@/abis';
import { DYNAMIC_FEE_FLAG } from '@/constants';
import { LockablePoolStatus } from '@/types';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '@test/setup/fixtures/clients';
import { mockAddresses } from '@test/setup/fixtures/addresses';

export type MockPublicClient = ReturnType<typeof createMockPublicClient> & {
  call: ReturnType<typeof vi.fn>;
  readContract: ReturnType<typeof vi.fn>;
  simulateContract: ReturnType<typeof vi.fn>;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
};

export type MockWalletClient = ReturnType<typeof createMockWalletClient>;

export type PendingFeeValues = {
  simulatedFees0: bigint;
  simulatedFees1: bigint;
  shares: bigint;
  cumulatedFees0: bigint;
  cumulatedFees1: bigint;
  lastCumulatedFees0: bigint;
  lastCumulatedFees1: bigint;
};

export type AggregateResult = {
  success: boolean;
  returnData: Hex;
};

export const mockTokenAddress =
  '0x1234567890123456789012345678901234567890' as Address;
export const mockNumeraire =
  '0x4200000000000000000000000000000000000006' as Address;
export const mockHook = '0xcccccccccccccccccccccccccccccccccccccccc' as Address;
export const mockDopplerHookInitializer =
  '0x7777777777777777777777777777777777777777' as Address;
export const mockRehypeHook =
  '0x9999999999999999999999999999999999999999' as Address;
export const mockScheduledInitializer =
  '0x8888888888888888888888888888888888888888' as Address;
export const mockDecayInitializer =
  '0x9999999999999999999999999999999999999999' as Address;
export const mockBeneficiary =
  '0x0000000000000000000000000000000000000abc' as Address;

export const expectedPendingFeeCallOrder = [
  'collectFees',
  'getShares',
  'getCumulatedFees0',
  'getCumulatedFees1',
  'getLastCumulatedFees0',
  'getLastCumulatedFees1',
] as const;

type PendingFeeCallName = (typeof expectedPendingFeeCallOrder)[number];

const absentPoolErrorAbi = [
  { type: 'error', name: 'PoolNotInitialized', inputs: [] },
] as const;

export const mockPoolKey = {
  currency0: mockTokenAddress,
  currency1: mockNumeraire,
  fee: 3000,
  tickSpacing: 60,
  hooks: mockHook,
};

export const mockDynamicPoolKey = {
  ...mockPoolKey,
  fee: DYNAMIC_FEE_FLAG,
};

export const mockFarTick = 120;

export const defaultAddresses = {
  ...mockAddresses,
  dopplerHookInitializer: undefined,
};

export function createZeroState() {
  return [
    zeroAddress,
    0,
    {
      currency0: zeroAddress,
      currency1: zeroAddress,
      fee: 0,
      tickSpacing: 0,
      hooks: zeroAddress,
    },
    0,
  ] as const;
}

export function createState(
  status: LockablePoolStatus = LockablePoolStatus.Initialized,
) {
  return [mockNumeraire, status, mockPoolKey, mockFarTick] as const;
}

export function buildPendingFeeAggregateResults(
  values: PendingFeeValues,
): readonly AggregateResult[] {
  return [
    encodeCallResult('collectFees', [
      values.simulatedFees0,
      values.simulatedFees1,
    ]),
    encodeCallResult('getShares', values.shares),
    encodeCallResult('getCumulatedFees0', values.cumulatedFees0),
    encodeCallResult('getCumulatedFees1', values.cumulatedFees1),
    encodeCallResult('getLastCumulatedFees0', values.lastCumulatedFees0),
    encodeCallResult('getLastCumulatedFees1', values.lastCumulatedFees1),
  ];
}

export function encodePendingFeeAggregateResults(
  results: readonly AggregateResult[],
): Hex {
  return encodeFunctionResult({
    abi: multicall3Abi,
    functionName: 'aggregate3',
    result: results,
  });
}

export function decodePendingFeeAggregateCalls(data: Hex) {
  return decodeFunctionData({
    abi: multicall3Abi,
    data,
  }).args[0];
}

export function decodePendingFeeInnerCall(data: Hex) {
  const decoded = decodeFunctionData({
    abi: feeClaimsInitializerAbi,
    data,
  });

  return {
    functionName: decoded.functionName,
    args: decoded.args,
  };
}

export function createAbsentPoolDiscoveryError(): ContractFunctionRevertedError {
  return new ContractFunctionRevertedError({
    abi: absentPoolErrorAbi,
    functionName: 'getState',
    data: encodeErrorResult({
      abi: absentPoolErrorAbi,
      errorName: 'PoolNotInitialized',
    }),
  });
}

export async function createMulticurvePoolHarness(
  recordedInitializer?: Address,
) {
  const publicClient = createMockPublicClient() as MockPublicClient;
  const walletClient = createMockWalletClient();
  const multicurvePool = new MulticurvePool(
    publicClient,
    walletClient,
    mockTokenAddress,
    recordedInitializer,
  );

  vi.clearAllMocks();
  const { getAddresses } = await import('@/addresses');
  vi.mocked(getAddresses).mockReturnValue(defaultAddresses);

  return {
    publicClient,
    walletClient,
    multicurvePool,
  };
}

function encodeCallResult(
  functionName: PendingFeeCallName,
  value: bigint | readonly [bigint, bigint],
): AggregateResult {
  return {
    success: true,
    returnData: encodeInnerResult(functionName, value),
  };
}

function encodeInnerResult(
  functionName: PendingFeeCallName,
  value: bigint | readonly [bigint, bigint],
): Hex {
  switch (functionName) {
    case 'collectFees':
      return encodeFunctionResult({
        abi: feeClaimsInitializerAbi,
        functionName,
        result: value as readonly [bigint, bigint],
      });
    case 'getShares':
    case 'getCumulatedFees0':
    case 'getCumulatedFees1':
    case 'getLastCumulatedFees0':
    case 'getLastCumulatedFees1':
      return encodeFunctionResult({
        abi: feeClaimsInitializerAbi,
        functionName,
        result: value as bigint,
      });
  }
}
