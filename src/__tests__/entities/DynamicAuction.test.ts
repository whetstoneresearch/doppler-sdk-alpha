import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DynamicAuction } from '../../entities/auction/DynamicAuction'
import { createMockPublicClient } from '../mocks/clients'
import { mockAddresses, mockTokenAddress, mockHookAddress } from '../mocks/addresses'
import type { HookInfo } from '../../types'
import { encodeAbiParameters, keccak256 } from 'viem'

vi.mock('../../addresses', () => ({
  getAddresses: vi.fn(() => mockAddresses)
}))

describe('DynamicAuction', () => {
  let auction: DynamicAuction
  let publicClient: ReturnType<typeof createMockPublicClient>

  beforeEach(() => {
    publicClient = createMockPublicClient()
    publicClient.getChainId = vi.fn().mockResolvedValue(1)
    auction = new DynamicAuction(publicClient, mockHookAddress)
  })

  describe('getHookInfo', () => {
    it('should fetch hook information correctly', async () => {
      const mockPoolKey = {
        currency0: mockTokenAddress,
        currency1: mockAddresses.weth,
        fee: 3000,
        tickSpacing: 60,
        hooks: mockHookAddress,
      }

      const mockState = {
        lastEpoch: 5,
        tickAccumulator: 1000000n,
        totalTokensSold: 250000000000000000000000n,
        totalProceeds: 50000000000000000000n,
        totalTokensSoldLastEpoch: 50000000000000000000000n,
        feesAccrued: { amount0: 100n, amount1: 200n },
      }

      // Mock all the hook contract calls in the correct order
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(mockState) // state
        .mockResolvedValueOnce(false) // earlyExit
        .mockResolvedValueOnce(false) // insufficientProceeds
        .mockResolvedValueOnce(mockPoolKey) // poolKey
        .mockResolvedValueOnce(1640995200n) // startingTime
        .mockResolvedValueOnce(1641600000n) // endingTime
        .mockResolvedValueOnce(3600n) // epochLength
        .mockResolvedValueOnce(10000000000000000000n) // minimumProceeds
        .mockResolvedValueOnce(1000000000000000000000n) // maximumProceeds
        .mockResolvedValueOnce(500000000000000000000000n) // numTokensToSell

      const hookInfo = await auction.getHookInfo()

      // Compute expected poolId
      const encoded = encodeAbiParameters(
        [
          { type: 'address' },
          { type: 'address' },
          { type: 'uint24' },
          { type: 'int24' },
          { type: 'address' },
        ],
        [
          mockPoolKey.currency0,
          mockPoolKey.currency1,
          mockPoolKey.fee,
          mockPoolKey.tickSpacing,
          mockPoolKey.hooks,
        ]
      )
      const expectedPoolId = keccak256(encoded)

      expect(hookInfo).toEqual({
        hookAddress: mockHookAddress,
        tokenAddress: mockTokenAddress,
        numeraireAddress: mockAddresses.weth,
        poolId: expectedPoolId,
        currentEpoch: expect.any(Number),
        totalProceeds: 50000000000000000000n,
        totalTokensSold: 250000000000000000000000n,
        earlyExit: false,
        insufficientProceeds: false,
        startingTime: 1640995200n,
        endingTime: 1641600000n,
        epochLength: 3600n,
        minimumProceeds: 10000000000000000000n,
        maximumProceeds: 1000000000000000000000n,
      })

      // Verify all expected calls were made
      expect(publicClient.readContract).toHaveBeenCalledTimes(10)
    })
  })

  describe('getTokenAddress', () => {
    it('should return currency0 when isToken0 is true', async () => {
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce({
          currency0: mockTokenAddress,
          currency1: mockAddresses.weth,
          fee: 3000,
          tickSpacing: 60,
          hooks: mockHookAddress,
        }) // poolKey
        .mockResolvedValueOnce(true) // isToken0

      const tokenAddress = await auction.getTokenAddress()
      expect(tokenAddress).toBe(mockTokenAddress)
    })

    it('should return currency1 when isToken0 is false', async () => {
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce({
          currency0: mockAddresses.weth,
          currency1: mockTokenAddress,
          fee: 3000,
          tickSpacing: 60,
          hooks: mockHookAddress,
        }) // poolKey
        .mockResolvedValueOnce(false) // isToken0

      const tokenAddress = await auction.getTokenAddress()
      expect(tokenAddress).toBe(mockTokenAddress)
    })
  })

  describe('getPoolId', () => {
    it('should compute pool ID from pool key', async () => {
      const mockPoolKey = {
        currency0: mockTokenAddress,
        currency1: mockAddresses.weth,
        fee: 3000,
        tickSpacing: 60,
        hooks: mockHookAddress,
      }

      vi.mocked(publicClient.readContract).mockResolvedValueOnce(mockPoolKey)

      const poolId = await auction.getPoolId()
      
      // Pool ID should be a 32-byte hex string
      expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(poolId.length).toBe(66) // '0x' + 64 hex chars
    })
  })

  describe('hasGraduated', () => {
    it('should check graduation status through hook state and Airlock', async () => {
      const mockAssetData = {
        poolOrHook: mockHookAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: '0x0000000000000000000000000000000000000000', // Graduated means migrator is zero
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: 1640995200n, // 2022-01-01
      }

      // First get token address
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce({
          currency0: mockTokenAddress,
          currency1: mockAddresses.weth,
          fee: 3000,
          tickSpacing: 60,
          hooks: mockHookAddress,
        }) // poolKey
        .mockResolvedValueOnce(true) // isToken0
        .mockResolvedValueOnce(mockAssetData) // getAssetData

      const hasGraduated = await auction.hasGraduated()
      expect(hasGraduated).toBe(true) // More than 7 days and has proceeds
    })

    it('should return false if not enough time has passed', async () => {
      const mockAssetData = {
        poolOrHook: mockHookAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: mockAddresses.v4Migrator,
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: BigInt(Math.floor(Date.now() / 1000) - 3600), // 1 hour ago
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce({
          currency0: mockTokenAddress,
          currency1: mockAddresses.weth,
          fee: 3000,
          tickSpacing: 60,
          hooks: mockHookAddress,
        })
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(mockAssetData)

      const hasGraduated = await auction.hasGraduated()
      expect(hasGraduated).toBe(false)
    })
  })

  describe('getCurrentEpoch', () => {
    it('should calculate current epoch correctly', async () => {
      const startingTime = 1640995200n // 2022-01-01 00:00:00
      const epochLength = 3600n // 1 hour
      const currentTime = 1640998800 // 2022-01-01 01:00:00

      vi.spyOn(Date, 'now').mockReturnValue(currentTime * 1000)
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(startingTime)
        .mockResolvedValueOnce(epochLength)

      const epoch = await auction.getCurrentEpoch()
      expect(epoch).toBe(1) // Second epoch (0-indexed)
    })

    it('should return 0 for time before start', async () => {
      const startingTime = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour in future
      const epochLength = 3600n

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(startingTime)
        .mockResolvedValueOnce(epochLength)

      const epoch = await auction.getCurrentEpoch()
      expect(epoch).toBe(0)
    })
  })

  describe('getCurrentPrice', () => {
    it('should return the current tick from state', async () => {
      const mockState = {
        lastEpoch: 5n,
        tickAccumulator: 1000000n,
        totalTokensSold: 250000000000000000000000n,
        totalProceeds: 50000000000000000000n,
        totalTokensSoldLastEpoch: 50000000000000000000000n,
        feesAccrued: { amount0: 100n, amount1: 200n },
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(mockState) // state
        .mockResolvedValueOnce(-92103) // startingTick
        .mockResolvedValueOnce(-69080) // endingTick
        .mockResolvedValueOnce(100) // gamma
        .mockResolvedValueOnce(BigInt(Math.floor(Date.now() / 1000) - 3600)) // startingTime (1 hour ago)
        .mockResolvedValueOnce(3600n) // epochLength

      const tick = await auction.getCurrentPrice()
      
      // Should calculate current tick based on epoch and gamma
      // Since we're 1 hour (1 epoch) in, tick moves by gamma (100)
      expect(tick).toBe(-92003n) // startingTick + (1 epoch * 100 gamma)
    })

    it('should handle zero epochs', async () => {
      const mockState = {
        lastEpoch: 0n,
        tickAccumulator: 0n,
        totalTokensSold: 0n,
        totalProceeds: 0n,
        totalTokensSoldLastEpoch: 0n,
        feesAccrued: { amount0: 0n, amount1: 0n },
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(mockState) // state
        .mockResolvedValueOnce(-92103) // startingTick
        .mockResolvedValueOnce(-69080) // endingTick
        .mockResolvedValueOnce(100) // gamma
        .mockResolvedValueOnce(BigInt(Math.floor(Date.now() / 1000))) // startingTime (now)
        .mockResolvedValueOnce(3600n) // epochLength

      const tick = await auction.getCurrentPrice()
      expect(tick).toBe(-92103n) // Should be startingTick when at epoch 0
    })
  })

  describe('getTotalProceeds', () => {
    it('should return total proceeds from state', async () => {
      const mockState = {
        lastEpoch: 5,
        tickAccumulator: 1000000n,
        totalTokensSold: 250000000000000000000000n,
        totalProceeds: 50000000000000000000n,
        totalTokensSoldLastEpoch: 50000000000000000000000n,
        feesAccrued: { amount0: 100n, amount1: 200n },
      }

      vi.mocked(publicClient.readContract).mockResolvedValueOnce(mockState)

      const proceeds = await auction.getTotalProceeds()
      expect(proceeds).toBe(50000000000000000000n)
    })
  })

  describe('hasEndedEarly', () => {
    it('should return early exit status', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(true)

      const hasEnded = await auction.hasEndedEarly()
      expect(hasEnded).toBe(true)
    })

    it('should return false when not ended early', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(false)

      const hasEnded = await auction.hasEndedEarly()
      expect(hasEnded).toBe(false)
    })
  })
})