import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DopplerSDK } from '../../DopplerSDK'
import { createMockPublicClient, createMockWalletClient } from '../mocks/clients'
import { mockAddresses, mockTokenAddress, mockPoolAddress } from '../mocks/addresses'
import { parseEther, keccak256, toHex, type Address } from 'viem'
import type { CreateStaticAuctionParams, CreateDynamicAuctionParams } from '../../types'

vi.mock('../../addresses', () => ({
  getAddresses: vi.fn(() => mockAddresses)
}))

describe('SDK Workflows Integration Tests', () => {
  let sdk: DopplerSDK
  let publicClient: ReturnType<typeof createMockPublicClient>
  let walletClient: ReturnType<typeof createMockWalletClient>

  beforeEach(() => {
    publicClient = createMockPublicClient()
    walletClient = createMockWalletClient()
    sdk = new DopplerSDK({
      publicClient,
      walletClient,
      chainId: 1,
    })
  })

  describe('Static Auction Full Workflow', () => {
    it('should create and interact with a static auction', async () => {
      // 1. Create static auction parameters
      const params: CreateStaticAuctionParams = {
        token: {
          name: 'Test Token',
          symbol: 'TEST',
          tokenURI: 'https://example.com/token',
        },
        sale: {
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: mockAddresses.weth,
        },
        pool: {
          startTick: 175000,
          endTick: 225000,
          fee: 3000,
        },
        governance: { noOp: true },
        migration: {
          type: 'uniswapV2',
        },
        userAddress: '0x1234567890123456789012345678901234567890',
      }

      // 2. Mock the factory creation
      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const eventSignature = keccak256(toHex('Create(address,address,address,address,address,address,address)'))
      
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockPoolAddress, mockTokenAddress],
      } as any)

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)

      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce({
        logs: [{
          address: mockAddresses.airlock,
          topics: [
            eventSignature,
            `0x000000000000000000000000${mockPoolAddress.slice(2)}`,
            `0x000000000000000000000000${mockTokenAddress.slice(2)}`,
            `0x000000000000000000000000${mockAddresses.weth.slice(2)}`,
          ],
          data: '0x' as `0x${string}`,
        }],
      } as any)

      // 3. Create the auction
      const result = await sdk.factory.createStaticAuction(params)
      
      expect(result).toEqual({
        poolAddress: mockPoolAddress,
        tokenAddress: mockTokenAddress,
        transactionHash: mockTxHash,
      })

      // 4. Get the auction instance
      const auction = await sdk.getStaticAuction(mockPoolAddress)
      expect(auction.getAddress()).toBe(mockPoolAddress)

      // 5. Mock pool info for interaction
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

      // 6. Get pool info
      const poolInfo = await auction.getPoolInfo()
      expect(poolInfo.tokenAddress).toBe(mockTokenAddress)
      expect(poolInfo.numeraireAddress).toBe(mockAddresses.weth)
      expect(poolInfo.fee).toBe(3000)

      // 7. Check graduation status
      // Mock getTokenAddress call first
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
        .mockResolvedValueOnce(mockAssetData) // getAssetData for hasGraduated

      const hasGraduated = await auction.hasGraduated()
      expect(hasGraduated).toBe(false) // liquidityMigrator is not zero address
    })
  })

  describe('Dynamic Auction Full Workflow', () => {
    it('should create and interact with a dynamic auction', async () => {
      // 1. Create dynamic auction parameters
      const params: CreateDynamicAuctionParams = {
        token: {
          name: 'Dynamic Token',
          symbol: 'DYN',
          tokenURI: 'https://example.com/dynamic',
        },
        sale: {
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('500000'),
          numeraire: mockAddresses.weth,
        },
        auction: {
          duration: 7, // days
          epochLength: 3600, // 1 hour
          startTick: -92103,
          endTick: -69080,
          minProceeds: parseEther('100'),
          maxProceeds: parseEther('10000'),
        },
        pool: {
          fee: 3000,
          tickSpacing: 60,
        },
        governance: { noOp: true },
        migration: {
          type: 'uniswapV4',
          fee: 3000,
          tickSpacing: 60,
          streamableFees: {
            lockDuration: 365 * 24 * 60 * 60,
            beneficiaries: [
              { address: '0x1234567890123456789012345678901234567890' as Address, percentage: 10000 },
            ],
          },
        },
        userAddress: '0x1234567890123456789012345678901234567890',
      }

      // 2. Mock the factory creation
      const mockHookAddress = '0x9876543210987654321098765432109876543210' as Address
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const eventSignature = keccak256(toHex('Create(address,address,address,address,address,address,address)'))
      
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockHookAddress, mockTokenAddress],
      } as any)

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)

      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce({
        logs: [{
          address: mockAddresses.airlock,
          topics: [
            eventSignature,
            `0x000000000000000000000000${mockHookAddress.slice(2)}`,
            `0x000000000000000000000000${mockTokenAddress.slice(2)}`,
            `0x000000000000000000000000${mockAddresses.weth.slice(2)}`,
          ],
          data: '0x' as `0x${string}`,
        }],
      } as any)

      // 3. Create the auction
      const result = await sdk.factory.createDynamicAuction(params)
      
      expect(result.hookAddress).toBe(mockHookAddress)
      expect(result.tokenAddress).toBe(mockTokenAddress)
      expect(result.transactionHash).toBe(mockTxHash)
      expect(result.poolId).toBeDefined()

      // 4. Get the auction instance
      const auction = await sdk.getDynamicAuction(mockHookAddress)
      expect(auction.getAddress()).toBe(mockHookAddress)

      // 5. Mock state for interaction
      const mockState = {
        epochsElapsed: 1n,
        epochLength: 3600n,
        prevTick: -92103,
        currentTick: -92003,
        nextTick: -91903,
        upperSlugTick: -91803,
        lowerSlugTick: -92203,
        upperSlugLiquidity: 1000000n,
        lowerSlugLiquidity: 500000n,
        prevLiquidity: 100000n,
        currentLiquidity: 200000n,
        nextLiquidity: 300000n,
        initialized: true,
        totalProceeds: parseEther('5000'),
        totalTokensSold: parseEther('50000'),
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(mockState) // state
        .mockResolvedValueOnce(-92103) // startingTick
        .mockResolvedValueOnce(-69080) // endingTick
        .mockResolvedValueOnce(100) // gamma
        .mockResolvedValueOnce(BigInt(Math.floor(Date.now() / 1000) - 3600)) // startingTime (1 hour ago)
        .mockResolvedValueOnce(3600n) // epochLength

      // 6. Get current price
      const currentPrice = await auction.getCurrentPrice()
      expect(currentPrice).toBe(BigInt(-92003)) // startingTick + (1 epoch * gamma)

      // 7. Check total proceeds
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(mockState) // state

      const totalProceeds = await auction.getTotalProceeds()
      expect(totalProceeds).toBe(parseEther('5000'))

      // 8. Check if ended early
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(false) // earlyExit

      const hasEndedEarly = await auction.hasEndedEarly()
      expect(hasEndedEarly).toBe(false)
    })
  })

  describe('Token and Quoter Interactions', () => {
    it('should interact with token entities after auction creation', async () => {
      // 1. Get token entity
      const { Derc20 } = await import('../../entities/token/derc20/Derc20')
      const derc20 = new Derc20(publicClient, walletClient, mockTokenAddress)
      
      // 2. Mock token info
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce('Test Token')
        .mockResolvedValueOnce('TEST')
        .mockResolvedValueOnce(18)

      const [name, symbol, decimals] = await Promise.all([
        derc20.getName(),
        derc20.getSymbol(),
        derc20.getDecimals(),
      ])

      expect(name).toBe('Test Token')
      expect(symbol).toBe('TEST')
      expect(decimals).toBe(18)

      // 3. Get ETH entity
      const { Eth } = await import('../../entities/token/eth/Eth')
      const eth = new Eth(publicClient)
      
      // 4. Check ETH metadata
      const ethName = await eth.getName()
      expect(ethName).toBe('Ether')

      // 5. Use quoter for price discovery
      const quoter = sdk.quoter

      // Mock V3 quote
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        result: [
          parseEther('2000'), // 1 ETH = 2000 tokens
          BigInt('158456325028528675187087900672'),
          10,
          BigInt(150000),
        ],
      } as any)

      const quote = await quoter.quoteExactInputV3({
        tokenIn: mockAddresses.weth,
        tokenOut: mockTokenAddress,
        amountIn: parseEther('1'),
        fee: 3000,
      })

      expect(quote.amountOut).toBe(parseEther('2000'))
    })
  })

  describe('Error Handling Workflows', () => {
    it('should handle wallet client errors gracefully', async () => {
      // Create SDK without wallet client
      const readOnlySDK = new DopplerSDK({
        publicClient,
        chainId: 1,
      })

      const params: CreateStaticAuctionParams = {
        token: { name: 'Test', symbol: 'TEST', tokenURI: 'https://example.com' },
        sale: {
          initialSupply: parseEther('1000'),
          numTokensToSell: parseEther('500'),
          numeraire: mockAddresses.weth,
        },
        pool: { startTick: 175000, endTick: 225000, fee: 3000 },
        governance: { noOp: true },
        migration: { type: 'uniswapV2' },
        userAddress: '0x1234567890123456789012345678901234567890',
      }

      await expect(readOnlySDK.factory.createStaticAuction(params)).rejects.toThrow(
        'Wallet client required for write operations'
      )
    })

    it('should handle invalid parameters', async () => {
      const invalidParams: CreateStaticAuctionParams = {
        token: {
          name: 'Test Token',
          symbol: 'TEST',
          tokenURI: 'https://example.com/token',
        },
        sale: {
          initialSupply: parseEther('1000000'),
          numTokensToSell: parseEther('2000000'), // More than initial supply!
          numeraire: mockAddresses.weth,
        },
        pool: {
          startTick: 175000,
          endTick: 225000,
          fee: 3000,
        },
        governance: { noOp: true },
        migration: {
          type: 'uniswapV2',
        },
        userAddress: '0x1234567890123456789012345678901234567890',
      }

      await expect(sdk.factory.createStaticAuction(invalidParams)).rejects.toThrow(
        'Cannot sell more tokens than initial supply'
      )
    })
  })

  describe('Chain-specific Workflows', () => {
    it('should handle chain-specific addresses correctly', async () => {
      // Create SDK for a different chain
      const baseSDK = new DopplerSDK({
        publicClient,
        walletClient,
        chainId: 8453, // Base mainnet
      })

      // The SDK should use chain-specific addresses
      expect(baseSDK.factory).toBeDefined()
      
      // Mock addresses for Base
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock, // Would be Base-specific in real scenario
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockPoolAddress, mockTokenAddress],
      } as any)

      // Should work with chain-specific configuration
      const params: CreateStaticAuctionParams = {
        token: { name: 'Base Token', symbol: 'BASE', tokenURI: 'https://base.example.com' },
        sale: {
          initialSupply: parseEther('1000'),
          numTokensToSell: parseEther('500'),
          numeraire: mockAddresses.weth,
        },
        pool: { startTick: 175000, endTick: 225000, fee: 3000 },
        governance: { noOp: true },
        migration: { type: 'uniswapV2' },
        userAddress: '0x1234567890123456789012345678901234567890',
      }

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce('0x123' as `0x${string}`)
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce({
        logs: [],
      } as any)

      const result = await baseSDK.factory.createStaticAuction(params)
      expect(result.poolAddress).toBe(mockPoolAddress)
    })
  })
})