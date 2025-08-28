import { type Address } from 'viem'
import { quoterV2Abi, uniswapV2Router02Abi, v4QuoterAbi } from '../../abis'
import { getAddresses } from '../../addresses'
import type { SupportedPublicClient } from '../../types'

/**
 * Unified Quoter for getting price quotes across Uniswap V2, V3, and V4
 * 
 * This class provides a unified interface for price discovery across all
 * supported Uniswap versions, abstracting away the differences between
 * V2 router, V3 quoter, and V4 quoter contracts.
 */
export class Quoter {
  private publicClient: SupportedPublicClient
  private chainId: number
  
  constructor(publicClient: SupportedPublicClient, chainId: number) {
    this.publicClient = publicClient
    this.chainId = chainId
  }
  
  /**
   * Get a price quote for swapping an exact amount of input tokens on Uniswap V3
   * @param params Parameters for the quote
   * @returns Quote result including output amount and price impact
   */
  async quoteExactInputV3(params: {
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    fee: number
    sqrtPriceLimitX96?: bigint
  }): Promise<{
    amountOut: bigint
    sqrtPriceX96After: bigint
    initializedTicksCrossed: number
    gasEstimate: bigint
  }> {
    const addresses = getAddresses(this.chainId)
    
    const { result } = await this.publicClient.simulateContract({
      address: addresses.v3Quoter,
      abi: quoterV2Abi,
      functionName: 'quoteExactInputSingle',
      args: [{
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        fee: params.fee,
        sqrtPriceLimitX96: params.sqrtPriceLimitX96 ?? BigInt(0),
      }],
    })
    
    return {
      amountOut: result[0],
      sqrtPriceX96After: result[1],
      initializedTicksCrossed: result[2],
      gasEstimate: result[3],
    }
  }
  
  /**
   * Get a price quote for receiving an exact amount of output tokens on Uniswap V3
   * @param params Parameters for the quote
   * @returns Quote result including required input amount
   */
  async quoteExactOutputV3(params: {
    tokenIn: Address
    tokenOut: Address
    amountOut: bigint
    fee: number
    sqrtPriceLimitX96?: bigint
  }): Promise<{
    amountIn: bigint
    sqrtPriceX96After: bigint
    initializedTicksCrossed: number
    gasEstimate: bigint
  }> {
    const addresses = getAddresses(this.chainId)
    
    const { result } = await this.publicClient.simulateContract({
      address: addresses.v3Quoter,
      abi: quoterV2Abi,
      functionName: 'quoteExactOutputSingle',
      args: [{
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        fee: params.fee,
        amountOut: params.amountOut,
        sqrtPriceLimitX96: params.sqrtPriceLimitX96 ?? BigInt(0),
      }],
    })
    
    return {
      amountIn: result[0],
      sqrtPriceX96After: result[1],
      initializedTicksCrossed: result[2],
      gasEstimate: result[3],
    }
  }
  
  /**
   * Get a price quote for swapping an exact amount of input tokens on Uniswap V2
   * @param params Parameters for the quote
   * @returns Array of amounts for each step in the path
   */
  async quoteExactInputV2(params: {
    amountIn: bigint
    path: Address[]
  }): Promise<bigint[]> {
    const addresses = getAddresses(this.chainId)
    
    if (!addresses.univ2Router02) {
      throw new Error('Uniswap V2 Router not available on this chain')
    }
    
    const result = await this.publicClient.readContract({
      address: addresses.univ2Router02,
      abi: uniswapV2Router02Abi,
      functionName: 'getAmountsOut',
      args: [params.amountIn, params.path],
    })
    
    return [...result] // Convert readonly array to mutable array
  }
  
  /**
   * Get a price quote for receiving an exact amount of output tokens on Uniswap V2
   * @param params Parameters for the quote
   * @returns Array of amounts for each step in the path
   */
  async quoteExactOutputV2(params: {
    amountOut: bigint
    path: Address[]
  }): Promise<bigint[]> {
    const addresses = getAddresses(this.chainId)
    
    if (!addresses.univ2Router02) {
      throw new Error('Uniswap V2 Router not available on this chain')
    }
    
    const result = await this.publicClient.readContract({
      address: addresses.univ2Router02,
      abi: uniswapV2Router02Abi,
      functionName: 'getAmountsIn',
      args: [params.amountOut, params.path],
    })
    
    return [...result] // Convert readonly array to mutable array
  }
  
  /**
   * Get a price quote for swapping an exact amount of input tokens on Uniswap V4
   * @param params Parameters for the quote
   * @returns Quote result for V4 pools
   */
  async quoteExactInputV4(params: {
    poolKey: {
      currency0: Address
      currency1: Address
      fee: number
      tickSpacing: number
      hooks: Address
    }
    zeroForOne: boolean
    exactAmount: bigint
    hookData?: string
  }): Promise<{
    amountOut: bigint
    gasEstimate: bigint
  }> {
    const addresses = getAddresses(this.chainId)
    
    // Use v4Quoter if available, otherwise use dopplerLens (they're the same contract)
    const quoterAddress = addresses.dopplerLens
    
    if (!quoterAddress) {
      throw new Error('No V4 quoter available on this chain')
    }
    
    try {
      // First try simulateContract for better gas estimation
      const { result } = await this.publicClient.simulateContract({
        address: quoterAddress,
        abi: v4QuoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [{
          poolKey: params.poolKey,
          zeroForOne: params.zeroForOne,
          exactAmount: params.exactAmount,
          hookData: (params.hookData ?? '0x') as `0x${string}`,
        }],
      })
      
      return {
        amountOut: result[0],
        gasEstimate: result[1],
      }
    } catch (simulateError) {
      // If simulation fails, throw the error
      // Most V4 quoters need simulation, not direct reads
      throw simulateError
    }
  }

  /**
   * Get a price quote for receiving an exact amount of output tokens on Uniswap V4
   * @param params Parameters for the quote
   * @returns Quote result for V4 pools
   */
  async quoteExactOutputV4(params: {
    poolKey: {
      currency0: Address
      currency1: Address
      fee: number
      tickSpacing: number
      hooks: Address
    }
    zeroForOne: boolean
    exactAmount: bigint
    hookData?: string
  }): Promise<{
    amountIn: bigint
    gasEstimate: bigint
  }> {
    const addresses = getAddresses(this.chainId)
    
    // Use v4Quoter if available, otherwise use dopplerLens (they're the same contract)
    const quoterAddress = addresses.dopplerLens
    
    if (!quoterAddress) {
      throw new Error('No V4 quoter available on this chain')
    }
    
    const { result } = await this.publicClient.simulateContract({
      address: quoterAddress,
      abi: v4QuoterAbi,
      functionName: 'quoteExactOutputSingle',
      args: [{
        poolKey: params.poolKey,
        zeroForOne: params.zeroForOne,
        exactAmount: params.exactAmount,
        hookData: (params.hookData ?? '0x') as `0x${string}`,
      }],
    })
    
    return {
      amountIn: result[0],
      gasEstimate: result[1],
    }
  }
}
