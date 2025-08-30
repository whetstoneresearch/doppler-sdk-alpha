import { type Address, zeroAddress } from 'viem'
import { SupportedPublicClient } from '@/types'

/**
 * A class providing read-only access to Ethereum (ETH) token information and balances.
 *
 * @remarks
 * This class implements a consistent interface with other token implementations (like DERC20)
 * but handles ETH-specific behavior such as:
 * - Hardcoded token metadata (name, symbol, decimals)
 * - Simulating unlimited allowance for ETH transfers
 * - Querying native ETH balances through viem
 */
export class Eth {
  private publicClient: SupportedPublicClient
  
  /** Static ETH address identifier (zero address) */
  static readonly address = zeroAddress
  
  constructor(publicClient: SupportedPublicClient) {
    this.publicClient = publicClient
  }
  
  /**
   * Get the human-readable name of the token
   * @returns Promise resolving to "Ether" (hardcoded ETH name)
   */
  async getName(): Promise<string> {
    return "Ether"
  }
  
  /**
   * Get the ticker symbol of the token
   * @returns Promise resolving to "ETH" (hardcoded ETH symbol)
   */
  async getSymbol(): Promise<string> {
    return "ETH"
  }
  
  /**
   * Get the number of decimal places used by the token
   * @returns Promise resolving to 18 (standard ETH decimals)
   */
  async getDecimals(): Promise<number> {
    return 18
  }
  
  /**
   * Get the allowance granted to a spender (always returns maximum value)
   * @returns Promise resolving to 2^256 - 1 (simulates unlimited ETH allowance)
   *
   * @remarks
   * ETH doesn't have an allowance mechanism, so this returns max uint256 value
   * to represent unlimited approval in systems expecting ERC20-like interfaces
   */
  async getAllowance(): Promise<bigint> {
    return 2n ** 256n - 1n
  }
  
  /**
   * Get the ETH balance of a specified account
   * @param account - Address of the account to query
   * @returns Promise resolving to the account's ETH balance in wei
   */
  async getBalanceOf(account: Address): Promise<bigint> {
    return await this.publicClient.getBalance({
      address: account,
    })
  }
}
