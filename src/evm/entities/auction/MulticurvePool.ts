import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Hash,
} from 'viem';
import {
  type MulticurveDecayFeeSchedule,
  type MulticurvePoolState,
  type SupportedPublicClient,
} from '../../types';
import { getAddresses } from '../../addresses';
import type { SupportedChainId } from '../../addresses';
import type { MulticurvePendingFees } from './multicurve/multicurvePendingFees';
import {
  findMulticurveInitializerForPool,
  type InitializerDiscoveryClient,
} from './multicurve/multicurveInitializerDiscovery';
import { collectMulticurveFees } from './multicurve/multicurveFeeCollection';
import { getMulticurveFeeSchedule } from './multicurve/multicurveFeeSchedule';
import {
  getPendingFeesForMulticurvePool,
  type MulticurvePendingFeesClient,
} from './multicurve/multicurvePendingFeeReader';
export type { MulticurvePendingFees } from './multicurve/multicurvePendingFees';

/**
 * MulticurvePool class for interacting with V4 multicurve pools
 *
 * Multicurve pools use the V4 multicurve initializer which supports:
 * - Multiple bonding curves with different price ranges
 * - Fee collection for configured beneficiaries
 * - No-migration lockable liquidity
 *
 * Note: V4 pools don't have their own contract addresses. The token address
 * is used as the lookup key to retrieve pool state from the initializer contract.
 *
 * Terminology: The contracts call the created token "asset" (paired against "numeraire", e.g., WETH).
 * We use "tokenAddress" in the SDK for consistency.
 */
export class MulticurvePool {
  private client: SupportedPublicClient;
  private walletClient?: WalletClient;
  private tokenAddress: Address;
  private recordedInitializer?: Address;
  private get rpc(): PublicClient {
    return this.client as PublicClient;
  }

  constructor(
    client: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    tokenAddress: Address,
    recordedInitializer?: Address,
  ) {
    this.client = client;
    this.walletClient = walletClient;
    this.tokenAddress = tokenAddress;
    this.recordedInitializer = recordedInitializer;
  }

  /**
   * Get the token address for this pool
   * This is also the lookup key used to retrieve pool state from the initializer
   * (Called "asset" in the contracts, but we use "tokenAddress" for SDK consistency)
   */
  getTokenAddress(): Address {
    return this.tokenAddress;
  }

  /**
   * Get current pool state from the multicurve initializer
   *
   * Automatically discovers which initializer (standard, scheduled, decay, or
   * doppler-hook) contains the pool.
   */
  async getState(): Promise<MulticurvePoolState> {
    const { state } = await this.findInitializerForPool();
    return state;
  }

  /**
   * Find which initializer contains this pool and return both the address and state.
   *
   * Tries v4MulticurveInitializer first (more common), then falls back to
   * v4ScheduledMulticurveInitializer, v4DecayMulticurveInitializer, and
   * dopplerHookInitializer if needed.
   */
  private async findInitializerForPool() {
    const chainId = await this.rpc.getChainId();
    const addresses = getAddresses(chainId as SupportedChainId);

    return findMulticurveInitializerForPool({
      client: this.rpc as InitializerDiscoveryClient,
      tokenAddress: this.tokenAddress,
      addresses,
      recordedInitializer: this.recordedInitializer,
    });
  }

  /**
   * Collect fees from a locked initializer-side pool.
   *
   * This function can be called by any account to pull pool fees into the
   * initializer. If the caller is a configured beneficiary, their pending share
   * is released as part of the same transaction.
   *
   * @returns Object containing the contract's collectFees return values and the transaction hash.
   * The returned fee amounts are newly collected pool fees, not necessarily the caller's beneficiary payout.
   */
  async collectFees(): Promise<{
    fees0: bigint;
    fees1: bigint;
    transactionHash: Hash;
  }> {
    const walletClient = this.walletClient;
    if (!walletClient) {
      throw new Error('Wallet client required to collect fees');
    }

    const chainId = await this.rpc.getChainId();
    const addresses = getAddresses(chainId as SupportedChainId);

    const { initializerAddress, state } = await this.findInitializerForPool();

    return collectMulticurveFees({
      client: this.rpc,
      walletClient,
      initializerAddress,
      state,
      addresses,
    });
  }

  /**
   * Preview pending fees for a beneficiary on an initializer-side multicurve pool.
   */
  async getPendingFees(beneficiary: Address): Promise<MulticurvePendingFees> {
    return getPendingFeesForMulticurvePool({
      client: this.rpc as MulticurvePendingFeesClient,
      beneficiary,
      poolContext: await this.findInitializerForPool(),
    });
  }

  /**
   * Get the numeraire address for this pool
   */
  async getNumeraireAddress(): Promise<Address> {
    const state = await this.getState();
    return state.numeraire;
  }

  /**
   * Get the decay fee schedule for dynamic-fee multicurve pools.
   *
   * Returns `null` when the pool is not using dynamic fees.
   */
  async getFeeSchedule(): Promise<MulticurveDecayFeeSchedule | null> {
    const { state } = await this.findInitializerForPool();
    return getMulticurveFeeSchedule(this.rpc, state);
  }
}
