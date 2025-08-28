import { type Address, getAddress } from 'viem'
import type { PoolInfo, SupportedPublicClient } from '../../types'
import { uniswapV3PoolAbi, airlockAbi } from '../../abis'
import { getAddresses } from '../../addresses'

/**
 * StaticAuction class for interacting with static auctions (Uniswap V3 based)
 * 
 * Static auctions use a fixed price range on Uniswap V3 for initial liquidity bootstrapping.
 * This is ideal for simple, predictable price discovery events.
 */
export class StaticAuction {
  private client: SupportedPublicClient
  private poolAddress: Address
  
  constructor(client: SupportedPublicClient, poolAddress: Address) {
    this.client = client
    this.poolAddress = poolAddress
  }
  
  /**
   * Get the pool address
   */
  getAddress(): Address {
    return this.poolAddress
  }
  
  /**
   * Get current pool information
   */
  async getPoolInfo(): Promise<PoolInfo> {
    // Fetch all pool data in parallel
    const [slot0, liquidity, token0, token1, fee] = await Promise.all([
      this.client.readContract({
        address: this.poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: 'slot0',
      }),
      this.client.readContract({
        address: this.poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: 'liquidity',
      }),
      this.client.readContract({
        address: this.poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: 'token0',
      }),
      this.client.readContract({
        address: this.poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: 'token1',
      }),
      this.client.readContract({
        address: this.poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: 'fee',
      }),
    ])
    
    // Determine which token is the auction token and which is numeraire
    // This requires checking with the Airlock contract
    const chainId = await this.client.getChainId()
    const addresses = getAddresses(chainId)
    
    const assetData = await this.client.readContract({
      address: addresses.airlock,
      abi: airlockAbi,
      functionName: 'getAssetData',
      args: [token0],
    })
    
    // The getAssetData returns: [numeraire, timelock, governance, liquidityMigrator, poolInitializer, pool, migrationPool, numTokensToSell, totalSupply, integrator]
    // If token0 has asset data in Airlock (pool is not zero), it's the auction token
    const isToken0AuctionToken = assetData[5] !== getAddress('0x0000000000000000000000000000000000000000')
    
    return {
      address: this.poolAddress,
      tokenAddress: isToken0AuctionToken ? token0 : token1,
      numeraireAddress: isToken0AuctionToken ? token1 : token0,
      fee,
      liquidity,
      sqrtPriceX96: slot0[0], // First element is sqrtPriceX96
    }
  }
  
  /**
   * Get the token address for this auction
   */
  async getTokenAddress(): Promise<Address> {
    const poolInfo = await this.getPoolInfo()
    return poolInfo.tokenAddress
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
    
    // The getAssetData returns: [numeraire, timelock, governance, liquidityMigrator, poolInitializer, pool, migrationPool, numTokensToSell, totalSupply, integrator]
    // Check if the asset is graduated (liquidityMigrator is set to address(0))
    return assetData[3] === getAddress('0x0000000000000000000000000000000000000000')
  }
  
  /**
   * Get the current price in the pool
   * Returns the price of token in terms of numeraire (token/numeraire)
   */
  async getCurrentPrice(): Promise<bigint> {
    const poolInfo = await this.getPoolInfo()
    
    // Get token ordering
    const [token0, token1] = await Promise.all([
      this.client.readContract({
        address: this.poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: 'token0',
      }),
      this.client.readContract({
        address: this.poolAddress,
        abi: uniswapV3PoolAbi,
        functionName: 'token1',
      }),
    ])
    
    // Calculate price from sqrtPriceX96
    // sqrtPriceX96 = sqrt(price) * 2^96
    // price = (sqrtPriceX96 / 2^96)^2
    const sqrtPriceX96 = poolInfo.sqrtPriceX96
    const Q96 = BigInt(2) ** BigInt(96)
    
    // price0 = amount of token1 per token0
    const sqrtPriceX96Squared = sqrtPriceX96 * sqrtPriceX96
    const Q96Squared = Q96 * Q96
    const price0 = sqrtPriceX96Squared / Q96Squared
    
    // Return price based on which token is the auction token
    if (poolInfo.tokenAddress === token0) {
      // Auction token is token0, return price in terms of token1 (numeraire)
      return price0
    } else {
      // Auction token is token1, return reciprocal price
      // price1 = 1 / price0 (with precision handling)
      return Q96Squared / price0
    }
  }
  
  /**
   * Get total liquidity in the pool
   */
  async getTotalLiquidity(): Promise<bigint> {
    return await this.client.readContract({
      address: this.poolAddress,
      abi: uniswapV3PoolAbi,
      functionName: 'liquidity',
    })
  }
}