import {
  getAddress,
  isAddressEqual,
  parseEventLogs,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { dopplerHookMigratorAbi } from '../abis';
import type { SupportedPublicClient, V4PoolKey } from '../types';
import { computePoolId, normalizePoolKey } from '../utils/poolKey';

export interface MigrationRefund {
  recipient: Address;
  currency0: Address;
  currency1: Address;
  amount0: bigint;
  amount1: bigint;
  exists: boolean;
}

export class DopplerHookMigrator {
  private readonly client: SupportedPublicClient;
  private readonly walletClient?: WalletClient;
  private readonly address: Address;

  private get rpc(): PublicClient {
    return this.client as PublicClient;
  }

  constructor(
    client: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    address: Address,
  ) {
    this.client = client;
    this.walletClient = walletClient;
    this.address = address;
  }

  getAddress(): Address {
    return this.address;
  }

  async getMigrationRefund(poolId: Hex): Promise<MigrationRefund> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: dopplerHookMigratorAbi,
      functionName: 'getMigrationRefund',
      args: [poolId],
    });
    const [recipient, currency0, currency1, amount0, amount1] = result;
    return {
      recipient: getAddress(recipient),
      currency0: getAddress(currency0),
      currency1: getAddress(currency1),
      amount0,
      amount1,
      exists: amount0 !== 0n || amount1 !== 0n,
    };
  }

  async getTotalClaimableMigrationRefund(currency: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerHookMigratorAbi,
      functionName: 'getTotalClaimableMigrationRefund',
      args: [currency],
    });
  }

  async getLockerAddress(): Promise<Address> {
    return getAddress(
      await this.rpc.readContract({
        address: this.address,
        abi: dopplerHookMigratorAbi,
        functionName: 'locker',
      }),
    );
  }

  async getMigrationPoolId(asset: Address): Promise<Hex> {
    const pair = await this.rpc.readContract({
      address: this.address,
      abi: dopplerHookMigratorAbi,
      functionName: 'getPair',
      args: [asset],
    });
    const [token0, token1] = pair;
    if (token0 === zeroAddress && token1 === zeroAddress) {
      throw new Error(`No DopplerHookMigrator pool found for asset ${asset}`);
    }

    const assetData = await this.rpc.readContract({
      address: this.address,
      abi: dopplerHookMigratorAbi,
      functionName: 'getAssetData',
      args: [token0, token1],
    });
    return computePoolId(normalizePoolKey(assetData[1]) as V4PoolKey);
  }

  async claimMigrationRefund(
    poolId: Hex,
    to: Address,
  ): Promise<{ amount0: bigint; amount1: bigint; transactionHash: Hash }> {
    if (to === zeroAddress) {
      throw new Error(
        'Migration refund destination must not be the zero address',
      );
    }
    const walletClient = this.walletClient;
    if (!walletClient) {
      throw new Error('Wallet client required to claim a migration refund');
    }

    const { request } = await this.rpc.simulateContract({
      address: this.address,
      abi: dopplerHookMigratorAbi,
      functionName: 'claimMigrationRefund',
      args: [poolId, to],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await this.rpc.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });
    if (receipt.status !== 'success') {
      throw new Error(
        `DopplerHookMigrator claimMigrationRefund transaction ${hash} failed with receipt status ${receipt.status}`,
      );
    }
    const events = parseEventLogs({
      abi: dopplerHookMigratorAbi,
      eventName: 'MigrationRefundClaimed',
      logs: receipt.logs.filter(({ address }) =>
        isAddressEqual(address, this.address),
      ),
    }).filter(
      ({ args }) =>
        args.poolId.toLowerCase() === poolId.toLowerCase() &&
        isAddressEqual(args.to, to),
    );
    if (events.length !== 1) {
      throw new Error(
        `DopplerHookMigrator claimMigrationRefund transaction ${hash} emitted ${events.length} matching MigrationRefundClaimed events; expected exactly one`,
      );
    }
    const { amount0, amount1 } = events[0].args;
    return { amount0, amount1, transactionHash: hash };
  }
}
