import { type Address, type PublicClient, encodePacked, keccak256, encodeAbiParameters, zeroAddress } from 'viem'
import type { HookInfo, SupportedPublicClient } from '../../types'
import { dopplerHookAbi, airlockAbi } from '../../abis'
import { getAddresses } from '../../addresses'

/**
 * DynamicAuction class for interacting with dynamic auctions (Uniswap V4 hook based)
 * 
 * Dynamic auctions use a Uniswap V4 hook to create a gradual Dutch auction
 * where the price moves dynamically over time according to set parameters.
 */
export class DynamicAuction {
  private client: SupportedPublicClient
  private hookAddress: Address
  
  constructor(client: SupportedPublicClient, hookAddress: Address) {
    this.client = client
    this.hookAddress = hookAddress
  }
  
  /**
   * Get the hook address
   */
  getAddress(): Address {
    return this.hookAddress
  }
  
  /**
   * Get current hook information
   */
  async getHookInfo(): Promise<HookInfo> {
    // Fetch all hook data in parallel
    const [
      state,
      earlyExit,
      insufficientProceeds,
      poolKey,
      startingTime,
      endingTime,
      epochLength,
      minimumProceeds,
      maximumProceeds,
      numTokensToSell,
    ] = await Promise.all([
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'state',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'earlyExit',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'insufficientProceeds',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'poolKey',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'startingTime',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'endingTime',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'epochLength',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'minimumProceeds',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'maximumProceeds',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'numTokensToSell',
      }),
    ])
    
    // Calculate current epoch
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    const elapsedTime = currentTime > startingTime ? currentTime - startingTime : BigInt(0)
    const currentEpoch = epochLength > 0n ? Number(elapsedTime / epochLength) : 0
    
    // Determine token addresses from poolKey
    const isToken0 = poolKey.currency0 !== zeroAddress
    const tokenAddress = isToken0 ? poolKey.currency0 : poolKey.currency1
    const numeraireAddress = isToken0 ? poolKey.currency1 : poolKey.currency0
    
    // Compute pool ID
    const poolId = this.computePoolId(poolKey)
    
    return {
      hookAddress: this.hookAddress,
      tokenAddress,
      numeraireAddress,
      poolId,
      currentEpoch,
      totalProceeds: state.totalProceeds,
      totalTokensSold: state.totalTokensSold,
      earlyExit,
      insufficientProceeds,
      startingTime,
      endingTime,
      epochLength,
      minimumProceeds,
      maximumProceeds,
    }
  }
  
  /**
   * Get the token address for this auction
   */
  async getTokenAddress(): Promise<Address> {
    const poolKey = await this.client.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'poolKey',
    })
    
    const isToken0 = await this.client.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'isToken0',
    })
    
    return isToken0 ? poolKey.currency0 : poolKey.currency1
  }
  
  /**
   * Get the pool ID for this auction
   */
  async getPoolId(): Promise<string> {
    const poolKey = await this.client.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'poolKey',
    })
    
    return this.computePoolId(poolKey)
  }
  
  /**
   * Check if the auction has graduated (ready for migration)
   */
  async hasGraduated(): Promise<boolean> {
    const tokenAddress = await this.getTokenAddress()
    const chainId = await this.client.getChainId()
    const addresses = getAddresses(chainId)
    
    const assetData = await this.client.readContract({
      address: addresses.airlock,
      abi: airlockAbi,
      functionName: 'getAssetData',
      args: [tokenAddress],
    })
    // Check if the asset is graduated (liquidityMigrator is zero)
    const liquidityMigrator = Array.isArray(assetData)
      ? (assetData as any)[3]
      : (assetData as any)?.liquidityMigrator
    return liquidityMigrator === zeroAddress
  }
  
  /**
   * Get the current epoch
   */
  async getCurrentEpoch(): Promise<number> {
    const [startingTime, epochLength] = await Promise.all([
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'startingTime',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'epochLength',
      }),
    ])
    
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    const elapsedTime = currentTime > startingTime ? currentTime - startingTime : BigInt(0)
    
    return Number(elapsedTime / epochLength)
  }
  
  /**
   * Get the current price in the auction
   * Returns the current tick based on the epoch and gamma parameters
   */
  async getCurrentPrice(): Promise<bigint> {
    const [
      state,
      startingTick,
      endingTick,
      gamma,
      startingTime,
      epochLength,
    ] = await Promise.all([
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'state',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'startingTick',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'endingTick',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'gamma',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'startingTime',
      }),
      this.client.readContract({
        address: this.hookAddress,
        abi: dopplerHookAbi,
        functionName: 'epochLength',
      }),
    ])
    
    // Calculate current epoch
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    const elapsedTime = currentTime > startingTime ? currentTime - startingTime : BigInt(0)
    const currentEpoch = epochLength > 0n ? Number(elapsedTime / epochLength) : 0
    
    // Calculate current tick based on the auction progression
    // The tick moves from startingTick towards endingTick based on epochs and gamma
    const direction = endingTick > startingTick ? 1 : -1
    const tickMovement = Math.floor(currentEpoch * gamma * direction)
    const currentTick = Math.floor(startingTick + tickMovement)
    
    // Convert tick to price
    // price = 1.0001^tick
    // For simplicity, returning the tick as bigint for now
    // In production, you'd convert this to actual price using TickMath
    return BigInt(currentTick)
  }
  
  /**
   * Get total proceeds collected so far
   */
  async getTotalProceeds(): Promise<bigint> {
    const state = await this.client.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'state',
    })
    
    return state.totalProceeds
  }
  
  /**
   * Check if the auction ended early due to max proceeds
   */
  async hasEndedEarly(): Promise<boolean> {
    return await this.client.readContract({
      address: this.hookAddress,
      abi: dopplerHookAbi,
      functionName: 'earlyExit',
    })
  }
  
  /**
   * Compute V4 pool ID from pool key components
   */
  private computePoolId(poolKey: {
    currency0: Address
    currency1: Address  
    fee: number
    tickSpacing: number
    hooks: Address
  }): string {
    // V4 pools are identified by the hash of their PoolKey
    const encoded = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' }
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks
      ]
    )
    return keccak256(encoded)
  }
}
