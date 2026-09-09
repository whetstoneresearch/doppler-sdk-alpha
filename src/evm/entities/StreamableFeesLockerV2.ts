import {
  isAddressEqual,
  parseEventLogs,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import { streamableFeesLockerV2Abi } from '../abis';
import { DEAD_ADDRESS } from '../constants';
import type { SupportedPublicClient, V4PoolKey } from '../types';
import { normalizePoolKey } from '../utils/poolKey';

export interface StreamableFeesStream {
  poolKey: V4PoolKey;
  recipient: Address;
  startDate: number;
  lockDuration: number;
  unlockDate: number;
  isUnlocked: boolean;
}

export class StreamableFeesLockerV2 {
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

  async getStream(poolId: Hex): Promise<StreamableFeesStream> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: streamableFeesLockerV2Abi,
      functionName: 'streams',
      args: [poolId],
    });
    const [poolKey, recipient, startDate, lockDuration, isUnlocked] = result;
    return {
      poolKey: normalizePoolKey(poolKey),
      recipient,
      startDate,
      lockDuration,
      unlockDate: isAddressEqual(recipient, DEAD_ADDRESS)
        ? 0
        : startDate + lockDuration,
      isUnlocked,
    };
  }

  async getBeneficiaryShares(
    poolId: Hex,
    beneficiary: Address,
  ): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: streamableFeesLockerV2Abi,
      functionName: 'getShares',
      args: [poolId, beneficiary],
    });
  }

  async getCumulatedFees(
    poolId: Hex,
  ): Promise<{ fees0: bigint; fees1: bigint }> {
    const [fees0, fees1] = await Promise.all([
      this.rpc.readContract({
        address: this.address,
        abi: streamableFeesLockerV2Abi,
        functionName: 'getCumulatedFees0',
        args: [poolId],
      }),
      this.rpc.readContract({
        address: this.address,
        abi: streamableFeesLockerV2Abi,
        functionName: 'getCumulatedFees1',
        args: [poolId],
      }),
    ]);
    return { fees0, fees1 };
  }

  async collectFees(
    poolId: Hex,
  ): Promise<{ fees0: bigint; fees1: bigint; transactionHash: Hash }> {
    const walletClient = this.walletClient;
    if (!walletClient) {
      throw new Error('Wallet client required to collect streamable fees');
    }
    const { request } = await this.rpc.simulateContract({
      address: this.address,
      abi: streamableFeesLockerV2Abi,
      functionName: 'collectFees',
      args: [poolId],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await this.waitForSuccessfulReceipt(hash, 'collectFees');
    const events = parseEventLogs({
      abi: streamableFeesLockerV2Abi,
      eventName: 'Collect',
      logs: receipt.logs.filter(({ address }) =>
        isAddressEqual(address, this.address),
      ),
    }).filter(({ args }) => args.poolId.toLowerCase() === poolId.toLowerCase());
    if (events.length !== 1) {
      throw new Error(
        `StreamableFeesLockerV2 collectFees transaction ${hash} emitted ${events.length} matching Collect events; expected exactly one`,
      );
    }
    const { fees0, fees1 } = events[0].args;
    return { fees0, fees1, transactionHash: hash };
  }

  async unlock(poolId: Hex): Promise<{ transactionHash: Hash }> {
    const walletClient = this.walletClient;
    if (!walletClient) {
      throw new Error('Wallet client required to unlock streamable liquidity');
    }
    const { request } = await this.rpc.simulateContract({
      address: this.address,
      abi: streamableFeesLockerV2Abi,
      functionName: 'unlock',
      args: [poolId],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.waitForSuccessfulReceipt(hash, 'unlock');
    return { transactionHash: hash };
  }

  private async waitForSuccessfulReceipt(
    hash: Hash,
    operation: string,
  ): Promise<TransactionReceipt> {
    const receipt = await this.rpc.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });
    if (receipt.status !== 'success') {
      throw new Error(
        `StreamableFeesLockerV2 ${operation} transaction ${hash} failed with receipt status ${receipt.status}`,
      );
    }
    return receipt;
  }
}
