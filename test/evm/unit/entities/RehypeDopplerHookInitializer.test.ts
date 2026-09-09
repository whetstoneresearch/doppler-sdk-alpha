import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  custom,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  getAddress,
  type Address,
  type Hex,
} from 'viem';
import { rehypeDopplerHookInitializerAbi } from '@/abis';
import { WAD, ZERO_ADDRESS } from '@/constants';
import { DopplerSDK } from '@/DopplerSDK';
import { RehypeDopplerHookInitializer } from '@/entities/auction/RehypeDopplerHookInitializer';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '@test/setup/fixtures/clients';
import {
  buildPendingFeeAggregateResults,
  decodePendingFeeAggregateCalls,
  decodePendingFeeInnerCall,
  encodePendingFeeAggregateResults,
  expectedPendingFeeCallOrder,
} from './multicurve/multicurvePoolTestHelpers';

type RehypeTestClient = ReturnType<typeof createMockPublicClient> & {
  call: ReturnType<typeof vi.fn>;
  simulateContract: ReturnType<typeof vi.fn>;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
};

const hookAddress = '0x9999999999999999999999999999999999999999' as Address;
const beneficiary = '0x0000000000000000000000000000000000000abc' as Address;
const replacementBeneficiary =
  '0x0000000000000000000000000000000000000def' as Address;
const poolId =
  '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex;
const transactionHash =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex;
const asset = '0x0000000000000000000000000000000000000123' as Address;
const integrator = '0x0000000000000000000000000000000000000456' as Address;
const destination = '0x0000000000000000000000000000000000000789' as Address;

function createIntegratorFeesClaimedLog({
  emitter = hookAddress,
  fees0 = 33n,
  fees1 = 44n,
}: {
  emitter?: Address;
  fees0?: bigint;
  fees1?: bigint;
} = {}) {
  return {
    address: emitter,
    data: encodeAbiParameters(
      [{ type: 'uint128' }, { type: 'uint128' }],
      [fees0, fees1],
    ),
    topics: encodeEventTopics({
      abi: rehypeDopplerHookInitializerAbi,
      eventName: 'IntegratorFeesClaimed',
      args: { poolId, integrator, to: destination },
    }),
  };
}

describe('RehypeDopplerHookInitializer', () => {
  let publicClient: RehypeTestClient;
  let walletClient: ReturnType<typeof createMockWalletClient>;
  let initializer: RehypeDopplerHookInitializer;

  beforeEach(() => {
    publicClient = createMockPublicClient() as RehypeTestClient;
    walletClient = createMockWalletClient();
    initializer = new RehypeDopplerHookInitializer(
      publicClient,
      walletClient,
      hookAddress,
    );
  });

  it('is returned by the canonical SDK accessor', async () => {
    const sdk = new DopplerSDK({
      chainId: 1,
      publicClient,
      walletClient,
    });

    const result = await sdk.getRehypeDopplerHookInitializer(hookAddress);

    expect(result).toBeInstanceOf(RehypeDopplerHookInitializer);
    expect(result.getAddress()).toBe(hookAddress);
  });

  it('previews beneficiary fees using FeesManager accounting', async () => {
    publicClient.call.mockResolvedValueOnce({
      data: encodePendingFeeAggregateResults(
        buildPendingFeeAggregateResults({
          simulatedFees0: 300n,
          simulatedFees1: 600n,
          shares: WAD / 2n,
          cumulatedFees0: 1_300n,
          cumulatedFees1: 2_600n,
          lastCumulatedFees0: 100n,
          lastCumulatedFees1: 400n,
        }),
      ),
    });

    await expect(
      initializer.getPendingFees(poolId, beneficiary),
    ).resolves.toEqual({ fees0: 600n, fees1: 1_100n });

    const aggregateRequest = publicClient.call.mock.calls[0]?.[0];
    if (!aggregateRequest) {
      throw new Error('Expected pending-fee aggregate3 call');
    }
    const aggregateCalls = decodePendingFeeAggregateCalls(
      aggregateRequest.data,
    );
    expect(aggregateCalls.map(({ target }) => target)).toEqual(
      Array(expectedPendingFeeCallOrder.length).fill(hookAddress),
    );
    expect(
      aggregateCalls.map(({ callData }) => decodePendingFeeInnerCall(callData)),
    ).toEqual([
      { functionName: 'collectFees', args: [poolId] },
      {
        functionName: 'getShares',
        args: [poolId, getAddress(beneficiary)],
      },
      { functionName: 'getCumulatedFees0', args: [poolId] },
      { functionName: 'getCumulatedFees1', args: [poolId] },
      {
        functionName: 'getLastCumulatedFees0',
        args: [poolId, getAddress(beneficiary)],
      },
      {
        functionName: 'getLastCumulatedFees1',
        args: [poolId, getAddress(beneficiary)],
      },
    ]);
  });

  it('claims by pool id and returns the FeesManager collect values', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: {
        address: hookAddress,
        functionName: 'collectFees',
        args: [poolId],
      },
      result: [11n, 22n],
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({});

    await expect(initializer.claimFees(poolId)).resolves.toEqual({
      fees0: 11n,
      fees1: 22n,
      transactionHash,
    });
    expect(publicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'collectFees',
        args: [poolId],
      }),
    );
  });

  it('passes a gas override when claiming fees', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: {
        address: hookAddress,
        functionName: 'collectFees',
        args: [poolId],
      },
      result: [11n, 22n],
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({});

    await initializer.claimFees(poolId, { gas: 150_000n });

    expect(walletClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ gas: 150_000n }),
    );
  });

  it('decodes the missing-beneficiaries error when claiming a legacy pool', async () => {
    // Given
    const revertData = encodeErrorResult({
      abi: rehypeDopplerHookInitializerAbi,
      errorName: 'FeeBeneficiariesNotConfigured',
    });
    const revertingClient = createPublicClient({
      transport: custom({
        request: () =>
          Promise.reject({
            code: 3,
            message: 'execution reverted',
            data: revertData,
          }),
      }),
    });
    const revertingInitializer = new RehypeDopplerHookInitializer(
      revertingClient,
      walletClient,
      hookAddress,
    );

    // When
    let caughtError: unknown;
    try {
      await revertingInitializer.claimFees(poolId);
    } catch (error) {
      if (!(error instanceof BaseError)) {
        throw error;
      }
      caughtError = error;
    }

    // Then
    expect(caughtError).toBeInstanceOf(BaseError);
    if (!(caughtError instanceof BaseError)) {
      throw caughtError;
    }
    const revertedError = caughtError.walk(
      (error) => error instanceof ContractFunctionRevertedError,
    );
    expect(revertedError).toBeInstanceOf(ContractFunctionRevertedError);
    if (!(revertedError instanceof ContractFunctionRevertedError)) {
      throw revertedError;
    }
    expect(revertedError.data?.errorName).toBe('FeeBeneficiariesNotConfigured');
  });

  it('updates a beneficiary through FeesManager', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: {
        address: hookAddress,
        functionName: 'updateBeneficiary',
        args: [poolId, replacementBeneficiary],
      },
      result: undefined,
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({});

    await expect(
      initializer.updateBeneficiary(poolId, replacementBeneficiary),
    ).resolves.toEqual({ transactionHash });
    expect(publicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'updateBeneficiary',
        args: [poolId, replacementBeneficiary],
      }),
    );
  });

  it('sets the complete fee distribution matrix', async () => {
    const distribution = {
      assetFeesToAssetBuybackWad: WAD / 10n,
      assetFeesToNumeraireBuybackWad: (WAD * 2n) / 10n,
      assetFeesToBeneficiaryWad: (WAD * 3n) / 10n,
      assetFeesToLpWad: (WAD * 4n) / 10n,
      numeraireFeesToAssetBuybackWad: (WAD * 4n) / 10n,
      numeraireFeesToNumeraireBuybackWad: (WAD * 3n) / 10n,
      numeraireFeesToBeneficiaryWad: (WAD * 2n) / 10n,
      numeraireFeesToLpWad: WAD / 10n,
    };
    publicClient.simulateContract.mockResolvedValueOnce({
      request: {
        address: hookAddress,
        functionName: 'setFeeDistribution',
      },
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({});

    await expect(
      initializer.setFeeDistribution(poolId, distribution),
    ).resolves.toEqual({ transactionHash });
    expect(publicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'setFeeDistribution',
        args: [poolId, ...Object.values(distribution)],
      }),
    );
  });

  it('rejects transferring beneficiary shares to the zero address', async () => {
    // Given / When
    const update = initializer.updateBeneficiary(poolId, ZERO_ADDRESS);

    // Then
    await expect(update).rejects.toThrow(
      'Rehype beneficiary cannot be updated to the zero address',
    );
    expect(publicClient.simulateContract).not.toHaveBeenCalled();
  });

  it('reads Rehype integrator configuration and balances', async () => {
    vi.mocked(publicClient.readContract)
      .mockResolvedValueOnce(200_000)
      .mockResolvedValueOnce([integrator, 500_000_000, 250_000_000, true])
      .mockResolvedValueOnce([11n, 22n])
      .mockResolvedValueOnce({ fees0: 33n, fees1: 44n });
    await expect(initializer.getIntegratorFeeShare(poolId)).resolves.toBe(
      200_000,
    );
    await expect(
      initializer.getIntegratorRoutingConfig(poolId),
    ).resolves.toEqual({
      integrator,
      assetFeesToNumeraireRatio: 500_000_000,
      numeraireFeesToAssetRatio: 250_000_000,
      automaticPayout: true,
    });
    await expect(initializer.getPendingIntegratorFees(poolId)).resolves.toEqual(
      {
        fees0: 11n,
        fees1: 22n,
      },
    );
    await expect(
      initializer.getClaimableIntegratorFees(poolId),
    ).resolves.toEqual({ fees0: 33n, fees1: 44n });
    expect(publicClient.readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        functionName: 'getIntegratorFeeShare',
        args: [poolId],
      }),
    );
    expect(publicClient.readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        functionName: 'getIntegratorRoutingConfig',
        args: [poolId],
      }),
    );
    expect(publicClient.readContract).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        functionName: 'getPendingIntegratorFees',
        args: [poolId],
      }),
    );
    expect(publicClient.readContract).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        functionName: 'getClaimableIntegratorFees',
        args: [poolId],
      }),
    );
  });

  it('accepts the maximum conversion ratio in either position', async () => {
    publicClient.simulateContract.mockResolvedValue({
      request: { address: hookAddress },
    });
    vi.mocked(walletClient.writeContract).mockResolvedValue(transactionHash);
    publicClient.waitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      logs: [],
    });

    await expect(
      initializer.setIntegratorConversionRatios(poolId, 1_000_000_000, 0),
    ).resolves.toEqual({ transactionHash });
    await expect(
      initializer.setIntegratorConversionRatios(poolId, 0, 1_000_000_000),
    ).resolves.toEqual({ transactionHash });

    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        functionName: 'setIntegratorConversionRatios',
        args: [poolId, 1_000_000_000, 0],
      }),
    );
    expect(publicClient.simulateContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        functionName: 'setIntegratorConversionRatios',
        args: [poolId, 0, 1_000_000_000],
      }),
    );
  });

  it('returns mined integrator fees instead of stale simulation values', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: { address: hookAddress },
      result: [11n, 22n],
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'success',
      logs: [createIntegratorFeesClaimedLog()],
    });

    await expect(
      initializer.claimIntegratorFees(asset, destination),
    ).resolves.toEqual({ fees0: 33n, fees1: 44n, transactionHash });
    expect(publicClient.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'claimIntegratorFees',
        args: [asset, destination],
      }),
    );
  });

  it('rejects reverted integrator management receipts with the operation and hash', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: { address: hookAddress },
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'reverted',
      logs: [],
    });

    await expect(
      initializer.setIntegratorAutomaticPayout(poolId, true),
    ).rejects.toThrow(
      `setIntegratorAutomaticPayout transaction ${transactionHash} failed`,
    );
  });

  it('rejects reverted integrator claim receipts with the operation and hash', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: { address: hookAddress },
      result: [11n, 22n],
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'reverted',
      logs: [],
    });

    await expect(
      initializer.claimIntegratorFees(asset, destination),
    ).rejects.toThrow(
      `claimIntegratorFees transaction ${transactionHash} failed`,
    );
  });

  it.each([
    ['missing', [], 0],
    ['foreign', [createIntegratorFeesClaimedLog({ emitter: beneficiary })], 0],
    [
      'ambiguous',
      [
        createIntegratorFeesClaimedLog(),
        createIntegratorFeesClaimedLog({ fees0: 55n, fees1: 66n }),
      ],
      2,
    ],
  ])('rejects %s IntegratorFeesClaimed events', async (_case, logs, count) => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: { address: hookAddress },
      result: [11n, 22n],
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'success',
      logs,
    });

    await expect(
      initializer.claimIntegratorFees(asset, destination),
    ).rejects.toThrow(
      `transaction ${transactionHash} emitted ${count} IntegratorFeesClaimed events; expected exactly one`,
    );
  });

  it('rejects invalid integrator management inputs before simulation', async () => {
    await expect(
      initializer.setIntegratorConversionRatios(poolId, 1_000_000_001, 0),
    ).rejects.toThrow('assetFeesToNumeraireRatio');
    await expect(
      initializer.setIntegratorConversionRatios(poolId, 0, 1_000_000_001),
    ).rejects.toThrow('numeraireFeesToAssetRatio');
    await expect(
      initializer.setIntegrator(poolId, ZERO_ADDRESS),
    ).rejects.toThrow('must be a non-zero address');
    await expect(
      initializer.claimIntegratorFees(asset, ZERO_ADDRESS),
    ).rejects.toThrow('must be a non-zero address');
    expect(publicClient.simulateContract).not.toHaveBeenCalled();
  });

  it('requires a wallet for integrator management', async () => {
    const readOnly = new RehypeDopplerHookInitializer(
      publicClient,
      undefined,
      hookAddress,
    );

    await expect(
      readOnly.setIntegratorAutomaticPayout(poolId, true),
    ).rejects.toThrow(
      'Wallet client required to set rehype integrator automatic payout',
    );
  });
});
