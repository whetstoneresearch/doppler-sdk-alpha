import { type Address, type PublicClient, type WalletClient, type Hash } from 'viem'
import type { MulticurvePoolState, SupportedPublicClient, V4PoolKey } from '../../types'
import { v4MulticurveInitializerAbi } from '../../abis'
import { getAddresses } from '../../addresses'
import type { SupportedChainId } from '../../addresses'
import { computePoolId } from '../../utils/poolKey'

/**
 * MulticurvePool class for interacting with V4 multicurve pools
 *
 * Multicurve pools use the V4 multicurve initializer which supports:
 * - Multiple bonding curves with different price ranges
 * - Fee collection for configured beneficiaries
 * - No-migration lockable liquidity
 */
export class MulticurvePool {
  private client: SupportedPublicClient
  private walletClient?: WalletClient
  private poolAddress: Address
  private get rpc(): PublicClient {
    return this.client as PublicClient
  }

  constructor(client: SupportedPublicClient, walletClient: WalletClient | undefined, poolAddress: Address) {
    this.client = client
    this.walletClient = walletClient
    this.poolAddress = poolAddress
  }

  /**
   * Get the pool address
   */
  getAddress(): Address {
    return this.poolAddress
  }

  /**
   * Get current pool state from the multicurve initializer
   */
  async getState(): Promise<MulticurvePoolState> {
    const chainId = await this.rpc.getChainId()
    const addresses = getAddresses(chainId as SupportedChainId)

    if (!addresses.v4MulticurveInitializer) {
      throw new Error('V4 multicurve initializer address not configured for this chain')
    }

    const stateData = await this.rpc.readContract({
      address: addresses.v4MulticurveInitializer,
      abi: v4MulticurveInitializerAbi,
      functionName: 'getState',
      args: [this.poolAddress],
    })

    // Parse the returned tuple
    const [asset, numeraire, fee, tickSpacing, totalTokensOnBondingCurve, status] = stateData as readonly [
      Address,
      Address,
      number,
      number,
      bigint,
      number
    ]

    return {
      asset,
      numeraire,
      fee,
      tickSpacing,
      totalTokensOnBondingCurve,
      status,
    }
  }

  /**
   * Collect fees from the pool and distribute to beneficiaries
   *
   * This function can be called by any beneficiary to trigger fee collection
   * and distribution. Fees are automatically distributed according to the
   * configured beneficiary shares.
   *
   * @returns Object containing the amounts of fees0 and fees1 distributed, and the transaction hash
   */
  async collectFees(): Promise<{ fees0: bigint; fees1: bigint; transactionHash: Hash }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required to collect fees')
    }

    const chainId = await this.rpc.getChainId()
    const addresses = getAddresses(chainId as SupportedChainId)

    if (!addresses.v4MulticurveInitializer) {
      throw new Error('V4 multicurve initializer address not configured for this chain')
    }

    // Get pool state to retrieve pool parameters
    const state = await this.getState()

    // Get the hook address from the multicurve initializer contract
    const hookAddress = await this.rpc.readContract({
      address: addresses.v4MulticurveInitializer,
      abi: v4MulticurveInitializerAbi,
      functionName: 'HOOK',
    })

    // Construct the PoolKey
    // In Uniswap V4, currency0 must be < currency1
    const currency0 = state.asset.toLowerCase() < state.numeraire.toLowerCase() ? state.asset : state.numeraire
    const currency1 = state.asset.toLowerCase() < state.numeraire.toLowerCase() ? state.numeraire : state.asset

    const poolKey: V4PoolKey = {
      currency0,
      currency1,
      fee: state.fee,
      tickSpacing: state.tickSpacing,
      hooks: hookAddress,
    }

    // Compute the poolId from the poolKey
    const poolId = computePoolId(poolKey)

    // Simulate the transaction to get the return values
    const { request, result } = await this.rpc.simulateContract({
      address: addresses.v4MulticurveInitializer,
      abi: v4MulticurveInitializerAbi,
      functionName: 'collectFees',
      args: [poolId],
      account: this.walletClient.account,
    })

    // Execute the transaction
    const hash = await this.walletClient.writeContract(request)

    // Wait for confirmation
    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 })

    // Parse the result (fees0, fees1)
    const [fees0, fees1] = result as readonly [bigint, bigint]

    return {
      fees0,
      fees1,
      transactionHash: hash,
    }
  }

  /**
   * Get the token address for this pool
   */
  async getTokenAddress(): Promise<Address> {
    const state = await this.getState()
    return state.asset
  }

  /**
   * Get the numeraire address for this pool
   */
  async getNumeraireAddress(): Promise<Address> {
    const state = await this.getState()
    return state.numeraire
  }
}
