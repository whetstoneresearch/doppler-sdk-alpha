import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Derc20 } from '../../entities/token/derc20/Derc20'
import { createMockPublicClient, createMockWalletClient } from '../mocks/clients'
import { mockTokenAddress } from '../mocks/addresses'
import { parseEther, type Address } from 'viem'

describe('Derc20', () => {
  let derc20: Derc20
  let publicClient: ReturnType<typeof createMockPublicClient>
  let walletClient: ReturnType<typeof createMockWalletClient>

  beforeEach(() => {
    publicClient = createMockPublicClient()
    walletClient = createMockWalletClient()
    derc20 = new Derc20(publicClient, walletClient, mockTokenAddress)
  })

  describe('Read methods', () => {
    it('should get token name', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce('Test Token')

      const name = await derc20.getName()
      expect(name).toBe('Test Token')

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'name',
      })
    })

    it('should get token symbol', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce('TEST')

      const symbol = await derc20.getSymbol()
      expect(symbol).toBe('TEST')

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'symbol',
      })
    })

    it('should get token decimals', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(18)

      const decimals = await derc20.getDecimals()
      expect(decimals).toBe(18)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'decimals',
      })
    })

    it('should get token URI', async () => {
      const uri = 'https://example.com/token'
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(uri)

      const tokenURI = await derc20.getTokenURI()
      expect(tokenURI).toBe(uri)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'tokenURI',
      })
    })

    it('should get allowance', async () => {
      const owner = '0x1234567890123456789012345678901234567890' as Address
      const spender = '0x2345678901234567890123456789012345678901' as Address
      const allowanceAmount = parseEther('100')

      vi.mocked(publicClient.readContract).mockResolvedValueOnce(allowanceAmount)

      const allowance = await derc20.getAllowance(owner, spender)
      expect(allowance).toBe(allowanceAmount)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'allowance',
        args: [owner, spender],
      })
    })

    it('should get balance of account', async () => {
      const account = '0x1234567890123456789012345678901234567890' as Address
      const balance = parseEther('500')

      vi.mocked(publicClient.readContract).mockResolvedValueOnce(balance)

      const result = await derc20.getBalanceOf(account)
      expect(result).toBe(balance)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'balanceOf',
        args: [account],
      })
    })

    it('should get total supply', async () => {
      const supply = parseEther('1000000')
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(supply)

      const totalSupply = await derc20.getTotalSupply()
      expect(totalSupply).toBe(supply)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'totalSupply',
      })
    })

    it('should get vesting duration', async () => {
      const duration = BigInt(365 * 24 * 60 * 60) // 1 year
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(duration)

      const vestingDuration = await derc20.getVestingDuration()
      expect(vestingDuration).toBe(duration)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'vestingDuration',
      })
    })

    it('should get vesting start', async () => {
      const timestamp = BigInt(1640995200) // 2022-01-01
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(timestamp)

      const vestingStart = await derc20.getVestingStart()
      expect(vestingStart).toBe(timestamp)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'vestingStart',
      })
    })

    it('should get vested total amount', async () => {
      const amount = parseEther('100000')
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(amount)

      const vestedTotal = await derc20.getVestedTotalAmount()
      expect(vestedTotal).toBe(amount)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'vestedTotalAmount',
      })
    })

    it('should compute available vested amount', async () => {
      const account = '0x1234567890123456789012345678901234567890' as Address
      const available = parseEther('5000')

      vi.mocked(publicClient.readContract).mockResolvedValueOnce(available)

      const result = await derc20.getAvailableVestedAmount(account)
      expect(result).toBe(available)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'computeAvailableVestedAmount',
        args: [account],
      })
    })

    it('should get yearly mint rate', async () => {
      const rate = parseEther('50000')
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(rate)

      const mintRate = await derc20.getYearlyMintRate()
      expect(mintRate).toBe(rate)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'yearlyMintRate',
      })
    })

    it('should get pool address', async () => {
      const poolAddress = '0x3456789012345678901234567890123456789012' as Address
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(poolAddress)

      const pool = await derc20.getPool()
      expect(pool).toBe(poolAddress)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'pool',
      })
    })

    it('should check if pool is unlocked', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(true)

      const isUnlocked = await derc20.getIsPoolUnlocked()
      expect(isUnlocked).toBe(true)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'isPoolUnlocked',
      })
    })

    it('should get current year start', async () => {
      const timestamp = BigInt(1672531200) // 2023-01-01
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(timestamp)

      const yearStart = await derc20.getCurrentYearStart()
      expect(yearStart).toBe(timestamp)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'currentYearStart',
      })
    })

    it('should get last mint timestamp', async () => {
      const timestamp = BigInt(1675209600) // 2023-02-01
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(timestamp)

      const lastMint = await derc20.getLastMintTimestamp()
      expect(lastMint).toBe(timestamp)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'lastMintTimestamp',
      })
    })

    it('should get vesting data for account', async () => {
      const account = '0x1234567890123456789012345678901234567890' as Address
      const totalAmount = parseEther('10000')
      const releasedAmount = parseEther('2500')

      vi.mocked(publicClient.readContract).mockResolvedValueOnce([totalAmount, releasedAmount] as any)

      const vestingData = await derc20.getVestingData(account)
      expect(vestingData).toEqual({
        totalAmount,
        releasedAmount,
      })

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'getVestingDataOf',
        args: [account],
      })
    })
  })

  describe('Write methods', () => {
    it('should approve spending', async () => {
      const spender = '0x2345678901234567890123456789012345678901' as Address
      const amount = parseEther('100')
      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockTokenAddress,
          functionName: 'approve',
          args: [spender, amount],
        },
      } as any)

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)

      const txHash = await derc20.approve(spender, amount)
      expect(txHash).toBe(mockTxHash)

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'approve',
        args: [spender, amount],
        account: walletClient.account,
      })
    })

    it('should release vested tokens', async () => {
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockTokenAddress,
          functionName: 'release',
          args: [],
        },
      } as any)

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)

      const txHash = await derc20.release()
      expect(txHash).toBe(mockTxHash)

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockTokenAddress,
        abi: expect.any(Array),
        functionName: 'release',
        args: [],
        account: walletClient.account,
      })
    })

    it('should throw error without wallet client', async () => {
      const derc20ReadOnly = new Derc20(publicClient, undefined, mockTokenAddress)

      await expect(
        derc20ReadOnly.approve('0x2345678901234567890123456789012345678901', parseEther('100'))
      ).rejects.toThrow('Wallet client required for write operations')

      await expect(derc20ReadOnly.release()).rejects.toThrow('Wallet client required for write operations')
    })
  })
})
