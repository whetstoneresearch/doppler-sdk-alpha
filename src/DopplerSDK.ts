import type { Address, PublicClient, WalletClient } from 'viem'
import type { DopplerSDKConfig, HookInfo, PoolInfo } from './types'
import { DopplerFactory } from './entities/DopplerFactory'
import { StaticAuction, DynamicAuction } from './entities/auction'

export class DopplerSDK {
  private publicClient: PublicClient
  private walletClient?: WalletClient
  private chainId: number
  private _factory?: DopplerFactory
  private _quoter?: any // Will be Quoter instance

  constructor(config: DopplerSDKConfig) {
    this.publicClient = config.publicClient
    this.walletClient = config.walletClient
    this.chainId = config.chainId
  }

  /**
   * Get the factory instance for creating auctions
   */
  get factory(): DopplerFactory {
    if (!this._factory) {
      this._factory = new DopplerFactory(this.publicClient, this.walletClient, this.chainId)
    }
    return this._factory
  }

  /**
   * Get the quoter instance for price queries
   */
  get quoter(): any {
    if (!this._quoter) {
      // TODO: Initialize Quoter with client and chainId
      throw new Error('Quoter not yet implemented')
    }
    return this._quoter
  }

  /**
   * Get a StaticAuction instance for interacting with a static auction pool
   * @param poolAddress The address of the Uniswap V3 pool
   */
  async getStaticAuction(poolAddress: Address): Promise<StaticAuction> {
    return new StaticAuction(this.publicClient, poolAddress)
  }

  /**
   * Get a DynamicAuction instance for interacting with a dynamic auction hook
   * @param hookAddress The address of the Uniswap V4 hook
   */
  async getDynamicAuction(hookAddress: Address): Promise<DynamicAuction> {
    return new DynamicAuction(this.publicClient, hookAddress)
  }

  /**
   * Get information about a static auction pool
   * @param poolAddress The address of the pool
   */
  async getPoolInfo(poolAddress: Address): Promise<PoolInfo> {
    // TODO: Fetch and return pool information
    throw new Error('getPoolInfo not yet implemented')
  }

  /**
   * Get information about a dynamic auction hook
   * @param hookAddress The address of the hook
   */
  async getHookInfo(hookAddress: Address): Promise<HookInfo> {
    // TODO: Fetch and return hook information
    throw new Error('getHookInfo not yet implemented')
  }

  /**
   * Get the current chain ID
   */
  getChainId(): number {
    return this.chainId
  }

  /**
   * Get the underlying clients
   */
  getClients(): { publicClient: PublicClient; walletClient?: WalletClient } {
    return {
      publicClient: this.publicClient,
      walletClient: this.walletClient
    }
  }
}