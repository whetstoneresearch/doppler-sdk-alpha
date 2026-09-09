import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  type Address,
  type Hex,
} from 'viem';
import { dopplerHookMigratorAbi } from '../../../../src/evm/abis';
import { computePoolId } from '../../../../src/evm';
import { DopplerHookMigrator } from '../../../../src/evm/entities/DopplerHookMigrator';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';

const migratorAddress = '0x0000000000000000000000000000000000000011';
const asset = '0x0000000000000000000000000000000000000012';
const numeraire = '0x0000000000000000000000000000000000000013';
const recipient = '0x0000000000000000000000000000000000000014';
const destination = '0x0000000000000000000000000000000000000015';
const lockerAddress = '0x0000000000000000000000000000000000000016';
const poolId = `0x${'11'.repeat(32)}` as const;
const transactionHash = `0x${'22'.repeat(32)}` as const;
const poolKey = {
  currency0: asset,
  currency1: numeraire,
  fee: 3000,
  tickSpacing: 60,
  hooks: migratorAddress,
} as const;

function createRefundClaimedLog({
  emitter = migratorAddress,
  id = poolId,
  to = destination,
  amount0 = 15n,
  amount1 = 17n,
}: {
  emitter?: Address;
  id?: Hex;
  to?: Address;
  amount0?: bigint;
  amount1?: bigint;
} = {}) {
  return {
    address: emitter,
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }],
      [amount0, amount1],
    ),
    topics: encodeEventTopics({
      abi: dopplerHookMigratorAbi,
      eventName: 'MigrationRefundClaimed',
      args: { poolId: id, recipient, to },
    }),
  };
}

describe('DopplerHookMigrator', () => {
  const publicClient = createMockPublicClient();
  const walletClient = createMockWalletClient();
  let migrator: DopplerHookMigrator;

  beforeEach(() => {
    vi.resetAllMocks();
    migrator = new DopplerHookMigrator(
      publicClient,
      walletClient,
      migratorAddress,
    );
  });

  it('reads migration refunds and aggregate liabilities', async () => {
    publicClient.readContract
      .mockResolvedValueOnce([recipient, asset, numeraire, 12n, 0n])
      .mockResolvedValueOnce(12n)
      .mockResolvedValueOnce(lockerAddress);

    await expect(migrator.getMigrationRefund(poolId)).resolves.toEqual({
      recipient,
      currency0: asset,
      currency1: numeraire,
      amount0: 12n,
      amount1: 0n,
      exists: true,
    });
    await expect(
      migrator.getTotalClaimableMigrationRefund(asset),
    ).resolves.toBe(12n);
    await expect(migrator.getLockerAddress()).resolves.toBe(lockerAddress);
  });

  it('derives the migration pool ID from the recorded pair and pool key', async () => {
    publicClient.readContract
      .mockResolvedValueOnce([asset, numeraire])
      .mockResolvedValueOnce([true, poolKey]);

    await expect(migrator.getMigrationPoolId(asset)).resolves.toBe(
      computePoolId(poolKey),
    );
  });

  it('rejects an asset without a recorded pair', async () => {
    publicClient.readContract.mockResolvedValueOnce([
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
    ]);

    await expect(migrator.getMigrationPoolId(asset)).rejects.toThrow(
      'No DopplerHookMigrator pool found',
    );
  });

  it('returns the mined refund amounts, ignoring stale reads and unrelated logs', async () => {
    publicClient.readContract.mockResolvedValue([
      recipient,
      asset,
      numeraire,
      5n,
      7n,
    ]);
    publicClient.simulateContract.mockResolvedValueOnce({
      request: { functionName: 'claimMigrationRefund' },
    });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'success',
      logs: [
        createRefundClaimedLog({ emitter: asset, amount0: 99n }),
        createRefundClaimedLog({ id: transactionHash, amount0: 98n }),
        createRefundClaimedLog({ to: asset, amount0: 97n }),
        createRefundClaimedLog(),
      ],
    });

    await expect(
      migrator.claimMigrationRefund(poolId, destination),
    ).resolves.toEqual({ amount0: 15n, amount1: 17n, transactionHash });
  });

  it('rejects a reverted refund claim instead of returning pre-read amounts', async () => {
    publicClient.readContract.mockResolvedValue([
      recipient,
      asset,
      numeraire,
      5n,
      7n,
    ]);
    publicClient.simulateContract.mockResolvedValueOnce({ request: {} });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'reverted',
      logs: [],
    });

    await expect(
      migrator.claimMigrationRefund(poolId, destination),
    ).rejects.toThrow(/claimMigrationRefund.*reverted/);
  });

  it.each([
    ['missing', []],
    ['foreign emitter', [createRefundClaimedLog({ emitter: asset })]],
    ['wrong pool', [createRefundClaimedLog({ id: transactionHash })]],
    ['wrong destination', [createRefundClaimedLog({ to: asset })]],
    ['ambiguous', [createRefundClaimedLog(), createRefundClaimedLog()]],
  ])('rejects %s refund claim events', async (_case, logs) => {
    publicClient.readContract.mockResolvedValue([
      recipient,
      asset,
      numeraire,
      5n,
      7n,
    ]);
    publicClient.simulateContract.mockResolvedValueOnce({ request: {} });
    vi.mocked(walletClient.writeContract).mockResolvedValueOnce(
      transactionHash,
    );
    publicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: 'success',
      logs,
    });

    await expect(
      migrator.claimMigrationRefund(poolId, destination),
    ).rejects.toThrow(/MigrationRefundClaimed.*expected exactly one/);
  });

  it('requires a wallet and a nonzero destination', async () => {
    const readOnly = new DopplerHookMigrator(
      publicClient,
      undefined,
      migratorAddress,
    );
    await expect(
      readOnly.claimMigrationRefund(poolId, destination),
    ).rejects.toThrow('Wallet client required');
    await expect(
      migrator.claimMigrationRefund(
        poolId,
        '0x0000000000000000000000000000000000000000',
      ),
    ).rejects.toThrow('must not be the zero address');
  });
});
