import {
  type Address,
  type Hex,
  type WalletClient,
  type PublicClient,
} from 'viem';
import { dopplerERC20V1Abi } from '../../../abis';
import { SupportedPublicClient } from '../../../types';

const availableVestedAmountAbi = [
  {
    type: 'function',
    name: 'computeAvailableVestedAmount',
    inputs: [{ name: 'beneficiary', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'total', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export class DopplerERC20V1 {
  protected publicClient: SupportedPublicClient;
  protected walletClient?: WalletClient;
  protected address: Address;
  protected get rpc(): PublicClient {
    return this.publicClient as PublicClient;
  }

  protected static splitSignature(signature: Hex): {
    v: number;
    r: Hex;
    s: Hex;
  } {
    const sig = signature.toLowerCase() as Hex;
    const r = `0x${sig.slice(2, 66)}` as Hex;
    const s = `0x${sig.slice(66, 130)}` as Hex;
    let v = parseInt(sig.slice(130, 132), 16);
    if (v < 27) v += 27;
    return { v, r, s };
  }

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    address: Address,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.address = address;
  }

  async getName(): Promise<string> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'name',
    });
  }

  async getSymbol(): Promise<string> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'symbol',
    });
  }

  async getDecimals(): Promise<number> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'decimals',
    });
  }

  async getTokenURI(): Promise<string> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'tokenURI',
    });
  }

  async getBalanceOf(account: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'balanceOf',
      args: [account],
    });
  }

  async getTotalSupply(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'totalSupply',
    });
  }

  async getAllowance(owner: Address, spender: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'allowance',
      args: [owner, spender],
    });
  }

  async getNonce(owner: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'nonces',
      args: [owner],
    });
  }

  async getDomainSeparator(): Promise<Hex> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'DOMAIN_SEPARATOR',
    });
  }

  async getDelegates(account: Address): Promise<Address> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'delegates',
      args: [account],
    });
  }

  async getVotes(account: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'getVotes',
      args: [account],
    });
  }

  async getPastVotes(account: Address, timepoint: bigint): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'getPastVotes',
      args: [account, timepoint],
    });
  }
  /**
   * Get historical voting-unit supply at a token clock timepoint.
   * Read CLOCK_MODE to determine whether a deployment uses timestamps or blocks.
   */
  async getPastTotalSupply(timepoint: bigint): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'getPastTotalSupply',
      args: [timepoint],
    });
  }

  async getVotesTotalSupply(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'getVotesTotalSupply',
    });
  }

  async getPastVotesTotalSupply(timepoint: bigint): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'getPastVotesTotalSupply',
      args: [timepoint],
    });
  }

  async getClock(): Promise<number> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'clock',
    });
    return Number(result);
  }

  async getClockMode(): Promise<string> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'CLOCK_MODE',
    });
  }

  async getCheckpointCount(account: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'checkpointCount',
      args: [account],
    });
  }

  async getCheckpointAt(
    account: Address,
    index: bigint,
  ): Promise<{ checkpointClock: number; checkpointValue: bigint }> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'checkpointAt',
      args: [account, index],
    });

    return {
      checkpointClock: Number(result[0]),
      checkpointValue: result[1],
    };
  }

  async getOwner(): Promise<Address> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'owner',
    });
  }

  async getOwnershipHandoverExpiresAt(pendingOwner: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'ownershipHandoverExpiresAt',
      args: [pendingOwner],
    });
  }

  async getPool(): Promise<Address> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'pool',
    });
  }

  async isPoolLocked(): Promise<boolean> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'isPoolLocked',
    });
  }

  async getVestingStart(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'vestingStart',
    });
  }

  async getVestedTotalAmount(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'vestedTotalAmount',
    });
  }
  /** Get a beneficiary's vesting allocation that has not been released. */
  async getTotalUnreleasedOf(beneficiary: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'totalUnreleasedOf',
      args: [beneficiary],
    });
  }

  async getVestingScheduleCount(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'vestingScheduleCount',
    });
  }

  async getVestingSchedule(scheduleId: bigint): Promise<{
    cliffDuration: bigint;
    duration: bigint;
  }> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'vestingSchedules',
      args: [scheduleId],
    });

    return {
      cliffDuration: BigInt(result[0]),
      duration: BigInt(result[1]),
    };
  }

  async getScheduleIdsOf(beneficiary: Address): Promise<bigint[]> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'getScheduleIdsOf',
      args: [beneficiary],
    });
    return Array.from(result);
  }

  async getTotalAllocatedOf(beneficiary: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'totalAllocatedOf',
      args: [beneficiary],
    });
  }

  async getAvailableVestedAmountForSchedule(
    beneficiary: Address,
    scheduleId: bigint,
  ): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'computeAvailableVestedAmount',
      args: [beneficiary, scheduleId],
    });
  }

  async getAvailableVestedAmount(beneficiary: Address): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: availableVestedAmountAbi,
      functionName: 'computeAvailableVestedAmount',
      args: [beneficiary],
    });
  }

  async getVestingDataForSchedule(
    beneficiary: Address,
    scheduleId: bigint,
  ): Promise<{
    totalAmount: bigint;
    releasedAmount: bigint;
  }> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'vestingOf',
      args: [beneficiary, scheduleId],
    });

    return {
      totalAmount: result[0],
      releasedAmount: result[1],
    };
  }

  async getMaxBalanceLimit(): Promise<bigint> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'maxBalanceLimit',
    });
  }

  async getBalanceLimitEnd(): Promise<number> {
    const result = await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'balanceLimitEnd',
    });
    return Number(result);
  }

  async isBalanceLimitActive(): Promise<boolean> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'isBalanceLimitActive',
    });
  }

  async getController(): Promise<Address> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'controller',
    });
  }

  async isExcludedFromBalanceLimit(account: Address): Promise<boolean> {
    return await this.rpc.readContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName: 'isExcludedFromBalanceLimit',
      args: [account],
    });
  }

  async approve(
    spender: Address,
    value: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('approve', [spender, value], options);
  }

  async permit(
    owner: Address,
    spender: Address,
    value: bigint,
    deadline: bigint,
    signature: Hex,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`>;
  async permit(
    owner: Address,
    spender: Address,
    value: bigint,
    deadline: bigint,
    v: number,
    r: Hex,
    s: Hex,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`>;
  async permit(
    owner: Address,
    spender: Address,
    value: bigint,
    deadline: bigint,
    signatureOrV: Hex | number,
    rOrOptions?: Hex | { gas?: bigint },
    s?: Hex,
    maybeOptions?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    const {
      v,
      r,
      s: signatureS,
    } = typeof signatureOrV === 'number'
      ? { v: signatureOrV, r: rOrOptions as Hex, s: s as Hex }
      : DopplerERC20V1.splitSignature(signatureOrV);
    const options =
      typeof signatureOrV === 'number'
        ? maybeOptions
        : (rOrOptions as { gas?: bigint } | undefined);

    return await this.write(
      'permit',
      [owner, spender, value, deadline, v, r, signatureS],
      options,
    );
  }

  async transfer(
    to: Address,
    value: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('transfer', [to, value], options);
  }

  async transferFrom(
    from: Address,
    to: Address,
    value: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('transferFrom', [from, to, value], options);
  }

  async delegate(
    delegatee: Address,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('delegate', [delegatee], options);
  }

  async delegateBySig(
    delegatee: Address,
    expiry: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const accountAddress = this.getWalletAccountAddress();
    const [nonce, name] = await Promise.all([
      this.getNonce(accountAddress),
      this.getName(),
    ]);
    const chainId =
      (this.rpc.chain?.id as number | undefined) ??
      (await this.rpc.getChainId());

    const signature = await this.signTypedData({
      domain: {
        name,
        version: '1',
        chainId,
        verifyingContract: this.address,
      },
      types: {
        Delegation: [
          { name: 'delegatee', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
        ],
      },
      primaryType: 'Delegation',
      message: { delegatee, nonce, expiry },
      account: accountAddress,
    });

    const { v, r, s } = DopplerERC20V1.splitSignature(signature);
    return await this.write(
      'delegateBySig',
      [delegatee, nonce, expiry, v, r, s],
      options,
    );
  }

  async transferOwnership(
    newOwner: Address,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('transferOwnership', [newOwner], options);
  }

  async renounceOwnership(options?: { gas?: bigint }): Promise<`0x${string}`> {
    return await this.write('renounceOwnership', [], options);
  }

  async requestOwnershipHandover(options?: {
    gas?: bigint;
  }): Promise<`0x${string}`> {
    return await this.write('requestOwnershipHandover', [], options);
  }

  async cancelOwnershipHandover(options?: {
    gas?: bigint;
  }): Promise<`0x${string}`> {
    return await this.write('cancelOwnershipHandover', [], options);
  }

  async completeOwnershipHandover(
    pendingOwner: Address,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write(
      'completeOwnershipHandover',
      [pendingOwner],
      options,
    );
  }

  async lockPool(
    pool: Address,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('lockPool', [pool], options);
  }

  async unlockPool(options?: { gas?: bigint }): Promise<`0x${string}`> {
    return await this.write('unlockPool', [], options);
  }

  async burn(
    amount: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('burn', [amount], options);
  }

  async release(
    amount: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('release', [amount], options);
  }

  async releaseSchedule(
    scheduleId: bigint,
    amount: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('release', [scheduleId, amount], options);
  }

  async releaseFor(
    beneficiary: Address,
    amount: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`>;
  async releaseFor(
    beneficiary: Address,
    scheduleId: bigint,
    amount: bigint,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`>;
  async releaseFor(
    beneficiary: Address,
    amountOrScheduleId: bigint,
    amountOrOptions?: bigint | { gas?: bigint },
    maybeOptions?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    const hasSchedule = typeof amountOrOptions === 'bigint';
    const args = hasSchedule
      ? [beneficiary, amountOrScheduleId, amountOrOptions]
      : [beneficiary, amountOrScheduleId];
    const options = hasSchedule ? maybeOptions : amountOrOptions;
    return await this.write('releaseFor', args, options);
  }

  async disableBalanceLimit(options?: {
    gas?: bigint;
  }): Promise<`0x${string}`> {
    return await this.write('disableBalanceLimit', [], options);
  }

  async updateTokenURI(
    tokenURI: string,
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    return await this.write('updateTokenURI', [tokenURI], options);
  }

  private getWalletAccountAddress(): Address {
    const account = this.walletClient?.account as unknown;
    if (typeof account === 'string') return account as Address;
    if (account && typeof account === 'object' && 'address' in account) {
      return (account as { address: Address }).address;
    }
    throw new Error('Invalid wallet account');
  }

  private async signTypedData(parameters: unknown): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const signTypedData = this.walletClient.signTypedData as unknown as (
      parameters: unknown,
    ) => Promise<Hex>;
    return await signTypedData(parameters);
  }

  private async write(
    functionName: string,
    args: readonly unknown[],
    options?: { gas?: bigint },
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const simulateContract = this.rpc.simulateContract as unknown as (
      parameters: unknown,
    ) => Promise<{ request: Record<string, unknown> }>;
    const writeContract = this.walletClient.writeContract as unknown as (
      parameters: unknown,
    ) => Promise<`0x${string}`>;

    const { request } = await simulateContract({
      address: this.address,
      abi: dopplerERC20V1Abi,
      functionName,
      args,
      account: this.walletClient.account,
    });

    return await writeContract(
      options?.gas ? { ...request, gas: options.gas } : request,
    );
  }
}
