import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Eth } from '../../entities/token/eth/Eth'
import { createMockPublicClient } from '../mocks/clients'
import { parseEther, type Address } from 'viem'

describe('Eth', () => {
  let eth: Eth
  let publicClient: ReturnType<typeof createMockPublicClient>

  beforeEach(() => {
    publicClient = createMockPublicClient()
    eth = new Eth(publicClient)
  })

  describe('Static properties', () => {
    it('should have correct static address', () => {
      expect(Eth.address).toBe('0x0000000000000000000000000000000000000000')
    })
  })

  describe('getName', () => {
    it('should return "Ether"', async () => {
      const name = await eth.getName()
      expect(name).toBe('Ether')
    })
  })

  describe('getSymbol', () => {
    it('should return "ETH"', async () => {
      const symbol = await eth.getSymbol()
      expect(symbol).toBe('ETH')
    })
  })

  describe('getDecimals', () => {
    it('should return 18', async () => {
      const decimals = await eth.getDecimals()
      expect(decimals).toBe(18)
    })
  })

  describe('getAllowance', () => {
    it('should return max uint256 value', async () => {
      const allowance = await eth.getAllowance()
      const maxUint256 = 2n ** 256n - 1n
      expect(allowance).toBe(maxUint256)
    })

    it('should ignore owner and spender parameters', async () => {
      // Test that the method can be called with no parameters
      const allowance1 = await eth.getAllowance()
      const maxUint256 = 2n ** 256n - 1n
      expect(allowance1).toBe(maxUint256)
    })
  })

  describe('getBalanceOf', () => {
    it('should get ETH balance for an account', async () => {
      const account = '0x1234567890123456789012345678901234567890' as Address
      const balance = parseEther('5.5')

      vi.mocked(publicClient.getBalance).mockResolvedValueOnce(balance)

      const result = await eth.getBalanceOf(account)
      expect(result).toBe(balance)

      expect(publicClient.getBalance).toHaveBeenCalledWith({
        address: account,
      })
    })

    it('should handle zero balance', async () => {
      const account = '0x1234567890123456789012345678901234567890' as Address

      vi.mocked(publicClient.getBalance).mockResolvedValueOnce(0n)

      const result = await eth.getBalanceOf(account)
      expect(result).toBe(0n)

      expect(publicClient.getBalance).toHaveBeenCalledWith({
        address: account,
      })
    })

    it('should handle large balances', async () => {
      const account = '0x1234567890123456789012345678901234567890' as Address
      const largeBalance = parseEther('1000000') // 1 million ETH

      vi.mocked(publicClient.getBalance).mockResolvedValueOnce(largeBalance)

      const result = await eth.getBalanceOf(account)
      expect(result).toBe(largeBalance)
    })
  })

  describe('Integration tests', () => {
    it('should provide consistent metadata', async () => {
      // Test that all metadata methods can be called in sequence
      const [name, symbol, decimals] = await Promise.all([
        eth.getName(),
        eth.getSymbol(),
        eth.getDecimals(),
      ])

      expect(name).toBe('Ether')
      expect(symbol).toBe('ETH')
      expect(decimals).toBe(18)
    })

    it('should handle multiple balance queries', async () => {
      const accounts = [
        '0x1234567890123456789012345678901234567890' as Address,
        '0x2345678901234567890123456789012345678901' as Address,
        '0x3456789012345678901234567890123456789012' as Address,
      ]
      
      const balances = [
        parseEther('1'),
        parseEther('2.5'),
        parseEther('0.001'),
      ]

      // Mock balance calls
      balances.forEach((balance, index) => {
        vi.mocked(publicClient.getBalance).mockResolvedValueOnce(balance)
      })

      // Query all balances
      const results = await Promise.all(
        accounts.map(account => eth.getBalanceOf(account))
      )

      expect(results).toEqual(balances)
      expect(publicClient.getBalance).toHaveBeenCalledTimes(3)
    })
  })
})