import {
  isAddress,
  isAddressEqual,
  parseEventLogs,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import type {
  RehypeFeeDistributionInfo,
  SupportedPublicClient,
} from '../../types';
import { feesManagerAbi, rehypeDopplerHookInitializerAbi } from '../../abis';
import { ZERO_ADDRESS } from '../../constants';
import { decodeBalanceDelta } from '../../utils';
import { callAggregate3 } from '../../utils/multicall3';
import {
  normalizeRehypeFeeDistributionInfo,
  normalizeRehypeFeeSchedule,
  normalizeRehypeHookFees,
  normalizeRehypeIntegratorFees,
  normalizeRehypeIntegratorRoutingConfig,
  normalizeRehypePoolInfo,
  type RehypeFeeSchedule,
  type RehypeHookFees,
  type RehypeIntegratorFees,
  type RehypeIntegratorRoutingConfig,
  type RehypePoolInfo,
} from './contractResults';
import {
  calculatePendingFees,
  createPendingFeePreviewCalls,
  type MulticurvePendingFees,
} from './multicurve/multicurvePendingFees';

const rehypeFeesManagerAbi = [
  ...feesManagerAbi,
  { type: 'error', name: 'FeeBeneficiariesNotConfigured', inputs: [] },
] as const;

const INTEGRATOR_CONVERSION_RATIO_DENOMINATOR = 1_000_000_000;

export class RehypeDopplerHookInitializer {
  private readonly client: SupportedPublicClient;
  private readonly walletClient?: WalletClient;
  private readonly hookAddress: Address;

  private get rpc(): PublicClient {
    return this.client as PublicClient;
  }

  constructor(
    client: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    hookAddress: Address,
  ) {
    this.client = client;
    this.walletClient = walletClient;
    this.hookAddress = hookAddress;
  }

  getAddress(): Address {
    return this.hookAddress;
  }

  async collectFees(asset: Address): Promise<{
    amount0: bigint;
    amount1: bigint;
    transactionHash: Hash;
  }> {
    const walletClient = this.requireWalletClient(
      'Wallet client required to collect rehype fees',
    );
    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'collectFees',
      args: [asset],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    const decoded = decodeBalanceDelta(result as bigint);
    return { ...decoded, transactionHash: hash };
  }

  /**
   * Collect fees and release the caller's pending beneficiary share.
   *
   * @returns The FeesManager `collectFees` return values and transaction hash.
   * The fee amounts are newly collected pool fees, not necessarily the caller's
   * beneficiary payout.
   */
  async claimFees(
    poolId: Hex,
    options?: { gas?: bigint },
  ): Promise<{
    fees0: bigint;
    fees1: bigint;
    transactionHash: Hash;
  }> {
    const walletClient = this.requireWalletClient(
      'Wallet client required to claim rehype beneficiary fees',
    );
    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeFeesManagerAbi,
      functionName: 'collectFees',
      args: [poolId],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(
      options?.gas === undefined ? request : { ...request, gas: options.gas },
    );
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    const [fees0, fees1] = result;
    return { fees0, fees1, transactionHash: hash };
  }

  async getPendingFees(
    poolId: Hex,
    beneficiary: Address,
  ): Promise<MulticurvePendingFees> {
    const calls = createPendingFeePreviewCalls(
      this.hookAddress,
      poolId,
      beneficiary,
    );
    return calculatePendingFees(await callAggregate3(this.rpc, calls));
  }

  async updateBeneficiary(
    poolId: Hex,
    newBeneficiary: Address,
  ): Promise<{ transactionHash: Hash }> {
    if (newBeneficiary.toLowerCase() === ZERO_ADDRESS) {
      throw new Error(
        'Rehype beneficiary cannot be updated to the zero address',
      );
    }
    const walletClient = this.requireWalletClient(
      'Wallet client required to update rehype beneficiary',
    );
    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: feesManagerAbi,
      functionName: 'updateBeneficiary',
      args: [poolId, newBeneficiary],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    return { transactionHash: hash };
  }

  async claimAirlockOwnerFees(asset: Address): Promise<{
    fees0: bigint;
    fees1: bigint;
    transactionHash: Hash;
  }> {
    const walletClient = this.requireWalletClient(
      'Wallet client required to claim rehype owner fees',
    );
    const { request, result } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'claimAirlockOwnerFees',
      args: [asset],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    const [fees0, fees1] = result;
    return { fees0, fees1, transactionHash: hash };
  }

  /**
   * Replace a pool's complete fee distribution matrix.
   *
   * The connected wallet must be the pool's configured fee distribution
   * controller (`buybackDst`). The asset-fee allocations and numeraire-fee
   * allocations must each sum to WAD.
   *
   * @returns The confirmed transaction hash.
   */
  async setFeeDistribution(
    poolId: Hex,
    feeDistributionInfo: RehypeFeeDistributionInfo,
  ): Promise<{ transactionHash: Hash }> {
    const walletClient = this.requireWalletClient(
      'Wallet client required to set rehype fee distribution',
    );
    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'setFeeDistribution',
      args: [
        poolId,
        feeDistributionInfo.assetFeesToAssetBuybackWad,
        feeDistributionInfo.assetFeesToNumeraireBuybackWad,
        feeDistributionInfo.assetFeesToBeneficiaryWad,
        feeDistributionInfo.assetFeesToLpWad,
        feeDistributionInfo.numeraireFeesToAssetBuybackWad,
        feeDistributionInfo.numeraireFeesToNumeraireBuybackWad,
        feeDistributionInfo.numeraireFeesToBeneficiaryWad,
        feeDistributionInfo.numeraireFeesToLpWad,
      ],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 });
    return { transactionHash: hash };
  }

  async getFeeDistributionInfo(
    poolId: Hex,
  ): Promise<RehypeFeeDistributionInfo> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getFeeDistributionInfo',
      args: [poolId],
    });
    return normalizeRehypeFeeDistributionInfo(result);
  }

  async getFeeRoutingMode(poolId: Hex): Promise<number> {
    const mode = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getFeeRoutingMode',
      args: [poolId],
    });
    return Number(mode);
  }

  async getFeeSchedule(poolId: Hex): Promise<RehypeFeeSchedule> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getFeeSchedule',
      args: [poolId],
    });
    return normalizeRehypeFeeSchedule(result);
  }

  async getIntegratorFeeShare(poolId: Hex): Promise<number> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getIntegratorFeeShare',
      args: [poolId],
    });
    return Number(result);
  }

  async getIntegratorRoutingConfig(
    poolId: Hex,
  ): Promise<RehypeIntegratorRoutingConfig> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getIntegratorRoutingConfig',
      args: [poolId],
    });
    return normalizeRehypeIntegratorRoutingConfig(result);
  }

  async getPendingIntegratorFees(poolId: Hex): Promise<RehypeIntegratorFees> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getPendingIntegratorFees',
      args: [poolId],
    });
    return normalizeRehypeIntegratorFees(
      result,
      'Rehype getPendingIntegratorFees',
    );
  }

  async getClaimableIntegratorFees(poolId: Hex): Promise<RehypeIntegratorFees> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getClaimableIntegratorFees',
      args: [poolId],
    });
    return normalizeRehypeIntegratorFees(
      result,
      'Rehype getClaimableIntegratorFees',
    );
  }

  async setIntegratorConversionRatios(
    poolId: Hex,
    assetFeesToNumeraireRatio: number,
    numeraireFeesToAssetRatio: number,
  ): Promise<{ transactionHash: Hash }> {
    assertIntegratorConversionRatio(
      assetFeesToNumeraireRatio,
      'assetFeesToNumeraireRatio',
    );
    assertIntegratorConversionRatio(
      numeraireFeesToAssetRatio,
      'numeraireFeesToAssetRatio',
    );
    const walletClient = this.requireWalletClient(
      'Wallet client required to set rehype integrator conversion ratios',
    );
    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'setIntegratorConversionRatios',
      args: [poolId, assetFeesToNumeraireRatio, numeraireFeesToAssetRatio],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.waitForSuccessfulReceipt(hash, 'setIntegratorConversionRatios');
    return { transactionHash: hash };
  }

  async setIntegratorAutomaticPayout(
    poolId: Hex,
    automaticPayout: boolean,
  ): Promise<{ transactionHash: Hash }> {
    const walletClient = this.requireWalletClient(
      'Wallet client required to set rehype integrator automatic payout',
    );
    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'setIntegratorAutomaticPayout',
      args: [poolId, automaticPayout],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.waitForSuccessfulReceipt(hash, 'setIntegratorAutomaticPayout');
    return { transactionHash: hash };
  }

  async setIntegrator(
    poolId: Hex,
    newIntegrator: Address,
  ): Promise<{ transactionHash: Hash }> {
    assertNonZeroAddress(newIntegrator, 'Rehype integrator');
    const walletClient = this.requireWalletClient(
      'Wallet client required to rotate rehype integrator',
    );
    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'setIntegrator',
      args: [poolId, newIntegrator],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    await this.waitForSuccessfulReceipt(hash, 'setIntegrator');
    return { transactionHash: hash };
  }

  async claimIntegratorFees(
    asset: Address,
    to: Address,
  ): Promise<{
    fees0: bigint;
    fees1: bigint;
    transactionHash: Hash;
  }> {
    assertNonZeroAddress(to, 'Rehype integrator claim destination');
    const walletClient = this.requireWalletClient(
      'Wallet client required to claim rehype integrator fees',
    );
    const { request } = await this.rpc.simulateContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'claimIntegratorFees',
      args: [asset, to],
      account: walletClient.account,
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await this.waitForSuccessfulReceipt(
      hash,
      'claimIntegratorFees',
    );
    const events = parseEventLogs({
      abi: rehypeDopplerHookInitializerAbi,
      eventName: 'IntegratorFeesClaimed',
      logs: receipt.logs.filter(({ address }) =>
        isAddressEqual(address, this.hookAddress),
      ),
    });
    if (events.length !== 1) {
      throw new Error(
        `Rehype claimIntegratorFees transaction ${hash} emitted ${events.length} IntegratorFeesClaimed events; expected exactly one`,
      );
    }
    const { fees0, fees1 } = events[0].args;
    return { fees0, fees1, transactionHash: hash };
  }

  async getHookFees(poolId: Hex): Promise<RehypeHookFees> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getHookFees',
      args: [poolId],
    });
    return normalizeRehypeHookFees(result);
  }

  async getPoolInfo(poolId: Hex): Promise<RehypePoolInfo> {
    const result = await this.rpc.readContract({
      address: this.hookAddress,
      abi: rehypeDopplerHookInitializerAbi,
      functionName: 'getPoolInfo',
      args: [poolId],
    });
    return normalizeRehypePoolInfo(result);
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
        `Rehype ${operation} transaction ${hash} failed with receipt status ${receipt.status}`,
      );
    }
    return receipt;
  }

  private requireWalletClient(message: string): WalletClient {
    if (!this.walletClient) {
      throw new Error(message);
    }
    return this.walletClient;
  }
}

function assertIntegratorConversionRatio(value: number, label: string): void {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > INTEGRATOR_CONVERSION_RATIO_DENOMINATOR
  ) {
    throw new Error(
      `Rehype ${label} must be an integer between 0 and ${INTEGRATOR_CONVERSION_RATIO_DENOMINATOR}`,
    );
  }
}

function assertNonZeroAddress(address: Address, label: string): void {
  if (
    !isAddress(address, { strict: false }) ||
    address.toLowerCase() === ZERO_ADDRESS
  ) {
    throw new Error(`${label} must be a non-zero address`);
  }
}
