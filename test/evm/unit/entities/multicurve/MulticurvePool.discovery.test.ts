import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractFunctionRevertedError, zeroAddress } from 'viem';
import { v4MulticurveInitializerAbi } from '@/abis';
import { DYNAMIC_FEE_FLAG } from '@/constants';
import { LockablePoolStatus } from '@/types';
import { mockAddresses } from '@test/setup/fixtures/addresses';
import {
  createAbsentPoolDiscoveryError,
  createMulticurvePoolHarness,
  createState,
  createZeroState,
  defaultAddresses,
  mockDecayInitializer,
  mockDopplerHookInitializer,
  mockFarTick,
  mockNumeraire,
  mockPoolKey,
  mockRehypeHook,
  mockScheduledInitializer,
  mockTokenAddress,
  type MockPublicClient,
} from './multicurvePoolTestHelpers';
import type { MulticurvePool } from '@/entities/auction/MulticurvePool';

vi.mock('@/addresses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/addresses')>();
  return {
    ...actual,
    getAddresses: vi.fn(() => mockAddresses),
  };
});

const historicalInitializer =
  '0x9999999999999999999999999999999999999999' as const;

describe('MulticurvePool initializer discovery', () => {
  let publicClient: MockPublicClient;
  let multicurvePool: MulticurvePool;

  beforeEach(async () => {
    ({ publicClient, multicurvePool } = await createMulticurvePoolHarness());
  });

  it('fetches and returns pool state', async () => {
    vi.mocked(publicClient.readContract).mockResolvedValueOnce(createState());

    const state = await multicurvePool.getState();

    expect(state).toEqual({
      asset: mockTokenAddress,
      numeraire: mockNumeraire,
      fee: 3000,
      tickSpacing: 60,
      status: LockablePoolStatus.Initialized,
      poolKey: mockPoolKey,
      farTick: mockFarTick,
    });
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockAddresses.v4MulticurveInitializer,
        functionName: 'getState',
        args: [mockTokenAddress],
      }),
    );
  });

  it('uses the initializer recorded by Airlock for historical launches', async () => {
    ({ publicClient, multicurvePool } = await createMulticurvePoolHarness(
      historicalInitializer,
    ));
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(createState())
      .mockResolvedValueOnce(createState());

    const state = await multicurvePool.getState();
    expect(state.poolKey).toEqual(mockPoolKey);
    expect(publicClient.readContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: historicalInitializer,
        functionName: 'getState',
      }),
    );
  });

  it('throws if no initializer addresses are configured', async () => {
    const { getAddresses } = await import('@/addresses');
    vi.mocked(getAddresses).mockReturnValue({
      ...defaultAddresses,
      v4MulticurveInitializer: undefined,
      v4ScheduledMulticurveInitializer: undefined,
      v4DecayMulticurveInitializer: undefined,
    });

    await expect(multicurvePool.getState()).rejects.toThrow(
      'No V4 multicurve initializer addresses configured for this chain',
    );
  });

  it('continues to scheduled initializer for an explicit absent-pool custom error', async () => {
    await mockScheduledInitializerAddress();
    vi.mocked(publicClient.readContract)
      .mockRejectedValueOnce(createAbsentPoolDiscoveryError())
      .mockResolvedValueOnce(createState());

    const state = await multicurvePool.getState();

    expect(state.poolKey).toEqual(mockPoolKey);
    expect(publicClient.readContract).toHaveBeenCalledTimes(2);
    expect(publicClient.readContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: mockScheduledInitializer,
      }),
    );
  });

  it('continues to scheduled initializer after zero-state absence', async () => {
    await mockScheduledInitializerAddress();
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(createZeroState())
      .mockResolvedValueOnce(createState());

    const state = await multicurvePool.getState();

    expect(state.poolKey).toEqual(mockPoolKey);
    expect(publicClient.readContract).toHaveBeenCalledTimes(2);
  });

  it('preserves provider failures during initializer discovery', async () => {
    await mockScheduledInitializerAddress();
    vi.mocked(publicClient.readContract).mockRejectedValueOnce(
      new Error('HTTP request failed'),
    );

    await expect(multicurvePool.getState()).rejects.toThrow(
      'HTTP request failed',
    );
    expect(publicClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('preserves selector or decode failures', async () => {
    await mockScheduledInitializerAddress();
    vi.mocked(publicClient.readContract)
      .mockRejectedValueOnce(new Error('Unknown function selector'))
      .mockResolvedValueOnce(createState());

    await expect(multicurvePool.getState()).rejects.toThrow(
      'Unknown function selector',
    );
    expect(publicClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('preserves structured contract reverts during initializer discovery', async () => {
    await mockScheduledInitializerAddress();
    vi.mocked(publicClient.readContract)
      .mockRejectedValueOnce(
        new ContractFunctionRevertedError({
          abi: v4MulticurveInitializerAbi,
          functionName: 'getState',
          message: 'Pool storage corrupted',
        }),
      )
      .mockResolvedValueOnce(createState());

    await expect(multicurvePool.getState()).rejects.toThrow(
      'Pool storage corrupted',
    );
    expect(publicClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('throws with tried initializers when pool is not found in any', async () => {
    mockScheduledInitializerAddress();
    vi.mocked(publicClient.readContract).mockResolvedValue(createZeroState());

    await expect(multicurvePool.getState()).rejects.toThrow(
      `Pool not found for token ${mockTokenAddress}. Tried initializers:`,
    );
  });

  it('aggregates absent-pool failures when every candidate reverts or returns zero state', async () => {
    const { getAddresses } = await import('@/addresses');
    vi.mocked(getAddresses).mockReturnValue({
      ...defaultAddresses,
      v4ScheduledMulticurveInitializer: mockScheduledInitializer,
      v4DecayMulticurveInitializer: mockDecayInitializer,
    });
    vi.mocked(publicClient.readContract)
      .mockRejectedValueOnce(createAbsentPoolDiscoveryError())
      .mockResolvedValueOnce(createZeroState())
      .mockRejectedValueOnce(createAbsentPoolDiscoveryError());

    try {
      await multicurvePool.getState();
      throw new Error('Expected getState to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(
        `Pool not found for token ${mockTokenAddress}. Tried initializers:`,
      );

      const aggregate = (error as { cause?: { errors?: unknown[] } }).cause;
      expect(aggregate?.errors).toHaveLength(2);
      const messages = (aggregate?.errors ?? []).map(
        (entry) => (entry as Error).message,
      );
      expect(messages[0]).toContain(
        `${mockAddresses.v4MulticurveInitializer} standard getState failed:`,
      );
      expect(messages[0]).toContain('PoolNotInitialized');
      expect(messages[1]).toContain(
        `${mockDecayInitializer} standard getState failed:`,
      );
      expect(messages[1]).toContain('PoolNotInitialized');
    }
  });

  it('falls back to decay initializer when standard and scheduled are zero-state', async () => {
    const { getAddresses } = await import('@/addresses');
    vi.mocked(getAddresses).mockReturnValue({
      ...defaultAddresses,
      v4ScheduledMulticurveInitializer: mockScheduledInitializer,
      v4DecayMulticurveInitializer: mockDecayInitializer,
    });
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(createZeroState())
      .mockResolvedValueOnce(createZeroState())
      .mockResolvedValueOnce(createState());

    const state = await multicurvePool.getState();

    expect(state.poolKey).toEqual(mockPoolKey);
    expect(publicClient.readContract).toHaveBeenCalledTimes(3);
    expect(publicClient.readContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: mockDecayInitializer,
      }),
    );
  });

  it('decodes pool state from DopplerHookInitializer using the rehype layout', async () => {
    const { getAddresses } = await import('@/addresses');
    vi.mocked(getAddresses).mockReturnValue({
      ...defaultAddresses,
      v4MulticurveInitializer: undefined,
      v4ScheduledMulticurveInitializer: undefined,
      v4DecayMulticurveInitializer: undefined,
      dopplerHookInitializer: mockDopplerHookInitializer,
    });
    vi.mocked(publicClient.readContract).mockResolvedValueOnce([
      mockNumeraire,
      400000n,
      mockRehypeHook,
      '0x1234',
      LockablePoolStatus.Locked,
      {
        currency0: mockTokenAddress,
        currency1: mockNumeraire,
        fee: DYNAMIC_FEE_FLAG,
        tickSpacing: 60,
        hooks: mockDopplerHookInitializer,
      },
      mockFarTick,
    ]);

    const state = await multicurvePool.getState();

    expect(state).toEqual({
      asset: mockTokenAddress,
      numeraire: mockNumeraire,
      fee: DYNAMIC_FEE_FLAG,
      tickSpacing: 60,
      status: LockablePoolStatus.Locked,
      poolKey: {
        currency0: mockTokenAddress,
        currency1: mockNumeraire,
        fee: DYNAMIC_FEE_FLAG,
        tickSpacing: 60,
        hooks: mockDopplerHookInitializer,
      },
      farTick: mockFarTick,
    });
    expect(publicClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockDopplerHookInitializer,
        functionName: 'getState',
        args: [mockTokenAddress],
      }),
    );
  });

  async function mockScheduledInitializerAddress() {
    vi.mocked(publicClient.readContract).mockClear();
    const { getAddresses } = await import('@/addresses');
    vi.mocked(getAddresses).mockReturnValue({
      ...defaultAddresses,
      v4ScheduledMulticurveInitializer: mockScheduledInitializer,
    });
  }
});
