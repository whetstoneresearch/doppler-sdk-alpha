import { type Address, type PublicClient, type WalletClient, type Hash, type Hex } from 'viem'
import { LockablePoolStatus, type MulticurvePoolState, type SupportedPublicClient, type V4PoolKey } from '../../types'
import { v4MulticurveInitializerAbi, v4MulticurveMigratorAbi, streamableFeesLockerAbi } from '../../abis'
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

    if (!addresses.v4MulticurveInitializer && !addresses.v4ScheduledMulticurveInitializer) {
      throw new Error('V4 multicurve initializer and scheduled multicurve initializer address not configured for this chain')
    }

    const initializerAddress = addresses.v4ScheduledMulticurveInitializer ?? addresses.v4MulticurveInitializer

    if (!initializerAddress) {
      throw new Error('V4 multicurve initializer or scheduled multicurve initializer address not configured for this chain')
    }

    const stateData = await this.rpc.readContract({
      address: initializerAddress,
      abi: v4MulticurveInitializerAbi,
      functionName: 'getState',
      args: [this.poolAddress],
    })

    // Parse the returned tuple into a strongly typed PoolKey
    const [numeraire, status, rawPoolKey, farTick] = stateData as readonly [
      Address,
      number,
      {
        currency0: Address
        currency1: Address
        fee: number
        tickSpacing: number
        hooks: Address
      } & readonly [Address, Address, number, number, Address],
      number
    ]

    const poolKey = this.parsePoolKey(rawPoolKey)

    return {
      asset: this.poolAddress,
      numeraire,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      status,
      poolKey,
      farTick: Number(farTick),
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

    if (!addresses.v4MulticurveInitializer && !addresses.v4ScheduledMulticurveInitializer) {
      throw new Error('V4 multicurve initializer and scheduled multicurve initializer address not configured for this chain')
    }

    // Get pool state to retrieve pool parameters
    const state = await this.getState()

    const initializerAddress = addresses.v4ScheduledMulticurveInitializer ??  addresses.v4MulticurveInitializer

    if (!initializerAddress) {
      throw new Error('V4 multicurve initializer or scheduled multicurve initializer address not configured for this chain')
    }

    if (state.status === LockablePoolStatus.Locked) {
      const poolId = computePoolId(state.poolKey)
      return this.collectFeesFromContract(initializerAddress, v4MulticurveInitializerAbi, poolId)
    }

    if (state.status === LockablePoolStatus.Exited) {
      if (!addresses.v4Migrator) {
        throw new Error('V4 multicurve migrator address not configured for this chain')
      }

      const assetData = await this.rpc.readContract({
        address: addresses.v4Migrator,
        abi: v4MulticurveMigratorAbi,
        functionName: 'getAssetData',
        args: [state.poolKey.currency0, state.poolKey.currency1],
      })

      const migratorPoolKey = this.parsePoolKey((assetData as any).poolKey ?? (assetData as any)[1])
      const poolId = computePoolId(migratorPoolKey)

      const beneficiaries =
        (assetData as any).beneficiaries ?? (assetData as any)[4] ?? []
      if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
        throw new Error('Migrated multicurve pool has no beneficiaries configured')
      }

      const lockerAddress = await this.resolveLockerAddress(addresses.v4Migrator, addresses.streamableFeesLocker)

      const streamData = await this.rpc.readContract({
        address: lockerAddress,
        abi: streamableFeesLockerAbi,
        functionName: 'streams',
        args: [poolId],
      })

      const startDate = Number((streamData as any).startDate ?? (streamData as any)[2] ?? 0)
      if (startDate === 0) {
        throw new Error('Migrated multicurve stream not initialized')
      }

      return this.collectFeesFromContract(lockerAddress, streamableFeesLockerAbi, poolId)
    }

    throw new Error('Multicurve pool is not locked or migrated')
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

  private parsePoolKey(rawPoolKey: unknown): V4PoolKey {
    const poolKeyStruct = rawPoolKey as any
    return {
      currency0: (poolKeyStruct.currency0 ?? poolKeyStruct[0]) as Address,
      currency1: (poolKeyStruct.currency1 ?? poolKeyStruct[1]) as Address,
      fee: Number(poolKeyStruct.fee ?? poolKeyStruct[2]),
      tickSpacing: Number(poolKeyStruct.tickSpacing ?? poolKeyStruct[3]),
      hooks: (poolKeyStruct.hooks ?? poolKeyStruct[4]) as Address,
    }
  }

  private async resolveLockerAddress(migratorAddress: Address, configuredLocker?: Address): Promise<Address> {
    if (configuredLocker) {
      return configuredLocker
    }

    const lockerAddress = await this.rpc.readContract({
      address: migratorAddress,
      abi: v4MulticurveMigratorAbi,
      functionName: 'locker',
      args: [],
    })

    return lockerAddress as Address
  }

  private async collectFeesFromContract(
    contractAddress: Address,
    abi: typeof v4MulticurveInitializerAbi | typeof streamableFeesLockerAbi,
    poolId: Hex
  ): Promise<{ fees0: bigint; fees1: bigint; transactionHash: Hash }> {
    const { request, result } = await this.rpc.simulateContract({
      address: contractAddress,
      abi,
      functionName: 'collectFees',
      args: [poolId],
      account: this.walletClient!.account,
    })

    const hash = await this.walletClient!.writeContract(request)

    await this.rpc.waitForTransactionReceipt({ hash, confirmations: 1 })

    const [fees0, fees1] = result as readonly [bigint, bigint]

    return {
      fees0,
      fees1,
      transactionHash: hash,
    }
  }
}
