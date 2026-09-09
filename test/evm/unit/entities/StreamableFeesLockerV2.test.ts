import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Hex,
} from 'viem';
import { streamableFeesLockerV2Abi } from '../../../../src/evm/abis';
import { StreamableFeesLockerV2 } from '../../../../src/evm/entities/StreamableFeesLockerV2';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';

const lockerAddress = '0x0000000000000000000000000000000000000021';
const asset = '0x0000000000000000000000000000000000000022';
const numeraire = '0x0000000000000000000000000000000000000023';
const recipient = '0x0000000000000000000000000000000000000024';
const poolId = `0x${'33'.repeat(32)}` as const;
const transactionHash = `0x${'44'.repeat(32)}` as const;
const poolKey = {
  currency0: asset,
  currency1: numeraire,
  fee: 3000,
  tickSpacing: 60,
  hooks: '0x0000000000000000000000000000000000000026',
} as const;

function createCollectLog({
  emitter = lockerAddress,
  id = poolId,
  fees0 = 21n,
  fees1 = 23n,
}: {
  emitter?: Address;
  id?: Hex;
  fees0?: bigint;
  fees1?: bigint;
} = {}) {
  return {
    address: emitter,
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }],
      [fees0, fees1],
    ),
    topics: encodeEventTopics({
      abi: streamableFeesLockerV2Abi,
      eventName: 'Collect',
      args: { poolId: id },
    }),
  };
}

function createUnlockLog({
  emitter = lockerAddress,
  id = poolId,
}: { emitter?: Address; id?: Hex } = {}) {
  return {
    address: emitter,
    data: encodeAbiParameters([{ type: 'address' }], [recipient]),
    topics: encodeEventTopics({
      abi: streamableFeesLockerV2Abi,
      eventName: 'Unlock',
      args: { poolId: id },
    }),
  };
}

describe('StreamableFeesLockerV2', () => {
  const publicClient = createMockPublicClient();
  const walletClient = createMockWalletClient();
  let locker: StreamableFeesLockerV2;

  beforeEach(() => {
    vi.resetAllMocks();
    locker = new StreamableFeesLockerV2(
      publicClient,
      walletClient,
      lockerAddress,
    );
  });

  it('computes an ordinary stream unlock timestamp in seconds', async () => {
    publicClient.readContract.mockResolvedValueOnce([
      poolKey,
      recipient,
      100,
      50,
      false,
    ]);

    await expect(locker.getStream(poolId)).resolves.toEqual({
      poolKey,
      recipient,
      startDate: 100,
      lockDuration: 50,
      unlockDate: 150,
      isUnlocked: false,
    });
  });

  it('reports the permanent-lock sentinel for a dead recipient regardless of casing', async () => {
    publicClient.readContract.mockResolvedValueOnce([
      poolKey,
      '0x000000000000000000000000000000000000dead',
      1_700_000_000,
      86_400,
      false,
    ]);

    await expect(locker.getStream(poolId)).resolves.toMatchObject({
      startDate: 1_700_000_000,
      lockDuration: 86_400,
      unlockDate: 0,
      isUnlocked: false,
    });
  });

  it('returns mined collection amounts rather than simulated fees or unrelated logs', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: { functionName: 'collectFees' },
      result: [11n, 13n],
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'success',
      logs: [
        createCollectLog({ emitter: asset, fees0: 99n }),
        createCollectLog({ id: transactionHash, fees0: 98n }),
        createUnlockLog(),
        createCollectLog(),
      ],
    });

    await expect(locker.collectFees(poolId)).resolves.toEqual({
      fees0: 21n,
      fees1: 23n,
      transactionHash,
    });
  });

  it('resolves unlock with the transaction hash after a successful receipt', async () => {
    publicClient.simulateContract.mockResolvedValueOnce({
      request: { functionName: 'unlock' },
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'success',
      logs: [],
    });

    await expect(locker.unlock(poolId)).resolves.toEqual({ transactionHash });
  });

  it.each(['collectFees', 'unlock'] as const)(
    'rejects reverted %s receipts',
    async (operation) => {
      publicClient.simulateContract.mockResolvedValueOnce({
        request: {},
        result: [11n, 13n],
      });
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        transactionHash,
      );
      publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
        status: 'reverted',
        logs: [],
      });

      await expect(locker[operation](poolId)).rejects.toThrow(
        /receipt status reverted/,
      );
    },
  );

  it.each([
    ['missing', []],
    ['foreign emitter', [createCollectLog({ emitter: asset })]],
    ['wrong pool', [createCollectLog({ id: transactionHash })]],
    ['wrong event', [createUnlockLog()]],
    ['ambiguous', [createCollectLog(), createCollectLog()]],
  ])(
    'rejects %s collection events rather than falling back to simulation',
    async (_case, logs) => {
      publicClient.simulateContract.mockResolvedValueOnce({
        request: {},
        result: [11n, 13n],
      });
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
        transactionHash,
      );
      publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
        status: 'success',
        logs,
      });

      await expect(locker.collectFees(poolId)).rejects.toThrow(
        /Collect.*expected exactly one/,
      );
    },
  );

  it('requires a wallet for collection and unlock', async () => {
    const readOnly = new StreamableFeesLockerV2(
      publicClient,
      undefined,
      lockerAddress,
    );
    await expect(readOnly.collectFees(poolId)).rejects.toThrow(
      'Wallet client required',
    );
    await expect(readOnly.unlock(poolId)).rejects.toThrow(
      'Wallet client required',
    );
  });
});
