import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StaticAuction } from '../../entities/auction/StaticAuction'
import { createMockPublicClient } from '../mocks/clients'
import { mockAddresses, mockTokenAddress, mockPoolAddress } from '../mocks/addresses'
import type { PoolInfo } from '../../types'

vi.mock('../../addresses', () => ({
  getAddresses: vi.fn(() => mockAddresses)
}))

describe('StaticAuction', () => {
  let auction: StaticAuction
  let publicClient: ReturnType<typeof createMockPublicClient>

  beforeEach(() => {
    publicClient = createMockPublicClient()
    // Mock getChainId
    publicClient.getChainId = vi.fn().mockResolvedValue(1)
    auction = new StaticAuction(publicClient, mockPoolAddress)
  })

  describe('getPoolInfo', () => {
    it('should fetch pool information correctly', async () => {
      const mockAssetData = {
        poolOrHook: mockPoolAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: mockAddresses.v2Migrator,
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: 1640995200n,
      }

      // Mock the pool contract calls in the correct order
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          79228162514264337593543950336n, // sqrtPriceX96
          0, // tick
          0, // observationIndex
          1, // observationCardinality
          1, // observationCardinalityNext
          0, // feeProtocol
          true, // unlocked
        ]) // slot0
        .mockResolvedValueOnce(1000000000000000000n) // liquidity
        .mockResolvedValueOnce(mockTokenAddress) // token0
        .mockResolvedValueOnce(mockAddresses.weth) // token1
        .mockResolvedValueOnce(3000) // fee
        .mockResolvedValueOnce(mockAssetData) // getAssetData for token0
        .mockResolvedValueOnce(mockAssetData) // getAssetData for token1

      const poolInfo = await auction.getPoolInfo()

      expect(poolInfo).toEqual({
        address: mockPoolAddress,
        tokenAddress: mockTokenAddress,
        numeraireAddress: mockAddresses.weth,
        fee: 3000,
        liquidity: 1000000000000000000n,
        sqrtPriceX96: 79228162514264337593543950336n,
      })
    })

    it('should determine token0/token1 ordering correctly', async () => {
      const mockAssetData = {
        poolOrHook: mockPoolAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: mockAddresses.v2Migrator,
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: 1640995200n,
      }

      // Mock with token1 as the auction token
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          79228162514264337593543950336n, // sqrtPriceX96
          0, // tick
          0, // observationIndex
          1, // observationCardinality
          1, // observationCardinalityNext
          0, // feeProtocol
          true, // unlocked
        ])
        .mockResolvedValueOnce(1000000000000000000n)
        .mockResolvedValueOnce(mockAddresses.weth) // token0
        .mockResolvedValueOnce(mockTokenAddress) // token1
        .mockResolvedValueOnce(3000)
        .mockResolvedValueOnce({ poolOrHook: '0x0000000000000000000000000000000000000000' }) // getAssetData for token0 (not the asset)
        .mockResolvedValueOnce(mockAssetData) // getAssetData for token1 (is the asset)

      const poolInfo = await auction.getPoolInfo()

      expect(poolInfo.tokenAddress).toBe(mockTokenAddress)
      expect(poolInfo.numeraireAddress).toBe(mockAddresses.weth)
    })
  })

  describe('getTokenAddress', () => {
    it('should return the auction token address', async () => {
      const mockAssetData = {
        poolOrHook: mockPoolAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: mockAddresses.v2Migrator,
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: 1640995200n,
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          79228162514264337593543950336n, // sqrtPriceX96
          0, // tick
          0, // observationIndex
          1, // observationCardinality
          1, // observationCardinalityNext
          0, // feeProtocol
          true, // unlocked
        ])
        .mockResolvedValueOnce(1000000000000000000n)
        .mockResolvedValueOnce(mockTokenAddress)
        .mockResolvedValueOnce(mockAddresses.weth)
        .mockResolvedValueOnce(3000)
        .mockResolvedValueOnce(mockAssetData)
        .mockResolvedValueOnce(mockAssetData)

      const tokenAddress = await auction.getTokenAddress()
      expect(tokenAddress).toBe(mockTokenAddress)
    })
  })

  describe('hasGraduated', () => {
    it('should check graduation status through Airlock', async () => {
      const mockAssetData = {
        poolOrHook: mockPoolAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: '0x0000000000000000000000000000000000000000', // Graduated means migrator is zero
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: 1640995200n, // 2022-01-01
      }

      // First get token address
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          79228162514264337593543950336n, // sqrtPriceX96
          0, // tick
          0, // observationIndex
          1, // observationCardinality
          1, // observationCardinalityNext
          0, // feeProtocol
          true, // unlocked
        ])
        .mockResolvedValueOnce(1000000000000000000n)
        .mockResolvedValueOnce(mockTokenAddress)
        .mockResolvedValueOnce(mockAddresses.weth)
        .mockResolvedValueOnce(3000)
        .mockResolvedValueOnce(mockAssetData)
        .mockResolvedValueOnce(mockAssetData)
        .mockResolvedValueOnce(mockAssetData) // getAssetData for hasGraduated

      const hasGraduated = await auction.hasGraduated()
      expect(hasGraduated).toBe(true) // More than 7 days and has proceeds
    })

    it('should return false if not enough time has passed', async () => {
      const mockAssetData = {
        poolOrHook: mockPoolAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: mockAddresses.v2Migrator,
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: BigInt(Math.floor(Date.now() / 1000) - 3600), // 1 hour ago
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          79228162514264337593543950336n, // sqrtPriceX96
          0, // tick
          0, // observationIndex
          1, // observationCardinality
          1, // observationCardinalityNext
          0, // feeProtocol
          true, // unlocked
        ])
        .mockResolvedValueOnce(1000000000000000000n)
        .mockResolvedValueOnce(mockTokenAddress)
        .mockResolvedValueOnce(mockAddresses.weth)
        .mockResolvedValueOnce(3000)
        .mockResolvedValueOnce(mockAssetData)
        .mockResolvedValueOnce(mockAssetData)
        .mockResolvedValueOnce(mockAssetData)

      const hasGraduated = await auction.hasGraduated()
      expect(hasGraduated).toBe(false)
    })
  })

  describe('getCurrentPrice', () => {
    it('should calculate price from sqrtPriceX96 when token is token0', async () => {
      const mockAssetData = {
        poolOrHook: mockPoolAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: mockAddresses.v2Migrator,
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: 1640995200n,
      }

      // Mock getChainId which is called in getPoolInfo
      publicClient.getChainId = vi.fn().mockResolvedValue(1)
      
      vi.mocked(publicClient.readContract)
        // First call to getPoolInfo() inside getCurrentPrice()
        .mockResolvedValueOnce([
          79228162514264337593543950336n, // sqrtPriceX96: sqrt(1) * 2^96
          0, // tick
          0, // observationIndex
          1, // observationCardinality
          1, // observationCardinalityNext
          0, // feeProtocol
          true, // unlocked
        ]) // slot0
        .mockResolvedValueOnce(1000000000000000000n) // liquidity
        .mockResolvedValueOnce(mockTokenAddress) // token0
        .mockResolvedValueOnce(mockAddresses.weth) // token1
        .mockResolvedValueOnce(3000) // fee
        .mockResolvedValueOnce(mockAssetData) // getAssetData for token0 (is the auction token)
        // Then getCurrentPrice needs token0 and token1 again
        .mockResolvedValueOnce(mockTokenAddress) // token0
        .mockResolvedValueOnce(mockAddresses.weth) // token1

      const price = await auction.getCurrentPrice()
      expect(price).toBe(1n) // Price of 1
    })

    it('should calculate inverted price when token is token1', async () => {
      const mockAssetData = {
        poolOrHook: mockPoolAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: mockAddresses.v2Migrator,
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: 1640995200n,
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          158456325028528675187087900672n, // sqrtPriceX96: sqrt(4) * 2^96
          0, // tick
          0, // observationIndex
          1, // observationCardinality
          1, // observationCardinalityNext
          0, // feeProtocol
          true, // unlocked
        ])
        .mockResolvedValueOnce(1000000000000000000n)
        .mockResolvedValueOnce(mockAddresses.weth) // token0
        .mockResolvedValueOnce(mockTokenAddress) // token1
        .mockResolvedValueOnce(3000)
        .mockResolvedValueOnce({ poolOrHook: '0x0000000000000000000000000000000000000000' }) // token0 is not the asset
        .mockResolvedValueOnce(mockAssetData) // token1 is the asset

      const price = await auction.getCurrentPrice()
      // When token is token1, price should be inverted
      // sqrtPriceX96 = sqrt(4) * 2^96, so price0 = 4
      // price1 = 1/4, but with integer math we need to use Q96
      // Expected: (2^96)^2 / 4 = very large number
      expect(price).toBeGreaterThan(0n)
    })
  })

  describe('getTotalLiquidity', () => {
    it('should return the pool liquidity', async () => {
      const mockAssetData = {
        poolOrHook: mockPoolAddress,
        governor: '0x0000000000000000000000000000000000000000',
        liquidityMigrator: mockAddresses.v2Migrator,
        numeraire: mockAddresses.weth,
        totalSales: 500000000000000000000000n,
        totalProceeds: 100000000000000000000n,
        deploymentTime: 1640995200n,
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(123456789000000000000n) // liquidity

      const liquidity = await auction.getTotalLiquidity()
      expect(liquidity).toBe(123456789000000000000n)
    })
  })
})