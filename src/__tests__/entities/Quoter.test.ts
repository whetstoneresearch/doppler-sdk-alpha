import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Quoter } from '../../entities/quoter/Quoter'
import { createMockPublicClient } from '../mocks/clients'
import { mockAddresses } from '../mocks/addresses'
import { parseEther } from 'viem'

vi.mock('../../addresses', () => ({
  getAddresses: vi.fn(() => mockAddresses)
}))

describe('Quoter', () => {
  let quoter: Quoter
  let publicClient: ReturnType<typeof createMockPublicClient>

  beforeEach(() => {
    publicClient = createMockPublicClient()
    quoter = new Quoter(publicClient, 1) // mainnet
  })

  describe('quoteExactInputV3', () => {
    it('should quote exact input for V3 swap', async () => {
      const mockResult = {
        result: [
          parseEther('2'), // amountOut
          BigInt('158456325028528675187087900672'), // sqrtPriceX96After
          10, // initializedTicksCrossed
          BigInt(150000), // gasEstimate
        ],
      }

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce(mockResult as any)

      const result = await quoter.quoteExactInputV3({
        tokenIn: mockAddresses.weth,
        tokenOut: '0x1234567890123456789012345678901234567890',
        amountIn: parseEther('1'),
        fee: 3000,
      })

      expect(result).toEqual({
        amountOut: parseEther('2'),
        sqrtPriceX96After: BigInt('158456325028528675187087900672'),
        initializedTicksCrossed: 10,
        gasEstimate: BigInt(150000),
      })

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockAddresses.v3Quoter,
        abi: expect.any(Array),
        functionName: 'quoteExactInputSingle',
        args: [
          {
            tokenIn: mockAddresses.weth,
            tokenOut: '0x1234567890123456789012345678901234567890',
            amountIn: parseEther('1'),
            fee: 3000,
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
      })
    })

    it('should handle sqrtPriceLimitX96', async () => {
      const mockResult = {
        result: [
          parseEther('1.8'), // amountOut
          BigInt('150000000000000000000000000000'), // sqrtPriceX96After
          5, // initializedTicksCrossed
          BigInt(120000), // gasEstimate
        ],
      }

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce(mockResult as any)

      const sqrtPriceLimit = BigInt('200000000000000000000000000000')
      const result = await quoter.quoteExactInputV3({
        tokenIn: mockAddresses.weth,
        tokenOut: '0x1234567890123456789012345678901234567890',
        amountIn: parseEther('1'),
        fee: 3000,
        sqrtPriceLimitX96: sqrtPriceLimit,
      })

      expect(result.amountOut).toBe(parseEther('1.8'))
      
      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0]
      expect((call as any).args[0].sqrtPriceLimitX96).toBe(sqrtPriceLimit)
    })
  })

  describe('quoteExactOutputV3', () => {
    it('should quote exact output for V3 swap', async () => {
      const mockResult = {
        result: [
          parseEther('0.5'), // amountIn
          BigInt('158456325028528675187087900672'), // sqrtPriceX96After
          8, // initializedTicksCrossed
          BigInt(140000), // gasEstimate
        ],
      }

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce(mockResult as any)

      const result = await quoter.quoteExactOutputV3({
        tokenIn: mockAddresses.weth,
        tokenOut: '0x1234567890123456789012345678901234567890',
        amountOut: parseEther('1'),
        fee: 3000,
      })

      expect(result).toEqual({
        amountIn: parseEther('0.5'),
        sqrtPriceX96After: BigInt('158456325028528675187087900672'),
        initializedTicksCrossed: 8,
        gasEstimate: BigInt(140000),
      })

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockAddresses.v3Quoter,
        abi: expect.any(Array),
        functionName: 'quoteExactOutputSingle',
        args: [
          {
            tokenIn: mockAddresses.weth,
            tokenOut: '0x1234567890123456789012345678901234567890',
            fee: 3000,
            amountOut: parseEther('1'),
            sqrtPriceLimitX96: BigInt(0),
          },
        ],
      })
    })
  })

  describe('quoteExactInputV2', () => {
    it('should quote exact input for V2 swap', async () => {
      const mockAmounts = [parseEther('1'), parseEther('2000')] // 1 ETH -> 2000 USDC
      
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(mockAmounts as any)

      const path: `0x${string}`[] = [mockAddresses.weth, '0x1234567890123456789012345678901234567890']
      const result = await quoter.quoteExactInputV2({
        amountIn: parseEther('1'),
        path,
      })

      expect(result).toEqual(mockAmounts)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockAddresses.univ2Router02,
        abi: expect.any(Array),
        functionName: 'getAmountsOut',
        args: [parseEther('1'), path],
      })
    })

    it('should handle multi-hop paths', async () => {
      const mockAmounts = [
        parseEther('1'), // Input
        parseEther('2000'), // WETH -> USDC
        parseEther('1995'), // USDC -> DAI
      ]
      
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(mockAmounts as any)

      const path: `0x${string}`[] = [
        mockAddresses.weth,
        '0x1234567890123456789012345678901234567890', // USDC
        '0x2345678901234567890123456789012345678901', // DAI
      ]
      const result = await quoter.quoteExactInputV2({
        amountIn: parseEther('1'),
        path,
      })

      expect(result).toEqual(mockAmounts)
      expect(result).toHaveLength(3)
    })

    it('should throw error if V2 router not available', async () => {
      // Mock a chain without V2 router
      vi.mocked(publicClient.readContract).mockImplementation(() => {
        throw new Error('Uniswap V2 Router not available on this chain')
      })
      
      quoter = new Quoter(publicClient, 999) // Non-existent chain

      await expect(
        quoter.quoteExactInputV2({
          amountIn: parseEther('1'),
          path: [mockAddresses.weth, '0x1234567890123456789012345678901234567890'],
        })
      ).rejects.toThrow()
    })
  })

  describe('quoteExactOutputV2', () => {
    it('should quote exact output for V2 swap', async () => {
      const mockAmounts = [parseEther('0.5'), parseEther('1000')] // Need 0.5 ETH for 1000 USDC
      
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(mockAmounts as any)

      const path: `0x${string}`[] = [mockAddresses.weth, '0x1234567890123456789012345678901234567890']
      const result = await quoter.quoteExactOutputV2({
        amountOut: parseEther('1000'),
        path,
      })

      expect(result).toEqual(mockAmounts)

      expect(publicClient.readContract).toHaveBeenCalledWith({
        address: mockAddresses.univ2Router02,
        abi: expect.any(Array),
        functionName: 'getAmountsIn',
        args: [parseEther('1000'), path],
      })
    })
  })

  describe('quoteExactInputV4', () => {
    it('should quote exact input for V4 swap', async () => {
      const mockResult = {
        result: [
          parseEther('2'), // amountOut
          BigInt(200000), // gasEstimate
        ],
      }

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce(mockResult as any)

      const poolKey = {
        currency0: mockAddresses.weth,
        currency1: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        fee: 3000,
        tickSpacing: 60,
        hooks: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      }

      const result = await quoter.quoteExactInputV4({
        poolKey,
        zeroForOne: true,
        exactAmount: parseEther('1'),
      })

      expect(result).toEqual({
        amountOut: parseEther('2'),
        gasEstimate: BigInt(200000),
      })

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockAddresses.dopplerLens,
        abi: expect.any(Array),
        functionName: 'quoteExactInputSingle',
        args: [
          {
            poolKey,
            zeroForOne: true,
            exactAmount: parseEther('1'),
            hookData: '0x',
          },
        ],
      })
    })

    it('should handle hookData', async () => {
      const mockResult = {
        result: [parseEther('1.95'), BigInt(180000)],
      }

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce(mockResult as any)

      const hookData = '0xdeadbeef'
      const result = await quoter.quoteExactInputV4({
        poolKey: {
          currency0: mockAddresses.weth,
          currency1: '0x1234567890123456789012345678901234567890' as `0x${string}`,
          fee: 3000,
          tickSpacing: 60,
          hooks: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        },
        zeroForOne: true,
        exactAmount: parseEther('1'),
        hookData,
      })

      expect(result.amountOut).toBe(parseEther('1.95'))
      
      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0]
      expect((call as any).args[0].hookData).toBe(hookData)
    })
  })

  describe('quoteExactOutputV4', () => {
    it('should quote exact output for V4 swap', async () => {
      const mockResult = {
        result: [
          parseEther('0.55'), // amountIn
          BigInt(190000), // gasEstimate
        ],
      }

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce(mockResult as any)

      const poolKey = {
        currency0: mockAddresses.weth,
        currency1: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        fee: 3000,
        tickSpacing: 60,
        hooks: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      }

      const result = await quoter.quoteExactOutputV4({
        poolKey,
        zeroForOne: true,
        exactAmount: parseEther('1'),
      })

      expect(result).toEqual({
        amountIn: parseEther('0.55'),
        gasEstimate: BigInt(190000),
      })

      expect(publicClient.simulateContract).toHaveBeenCalledWith({
        address: mockAddresses.dopplerLens,
        abi: expect.any(Array),
        functionName: 'quoteExactOutputSingle',
        args: [
          {
            poolKey,
            zeroForOne: true,
            exactAmount: parseEther('1'),
            hookData: '0x',
          },
        ],
      })
    })
  })
})