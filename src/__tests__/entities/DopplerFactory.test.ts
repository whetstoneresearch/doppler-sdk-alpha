import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DopplerFactory } from '../../entities/DopplerFactory'
import { createMockPublicClient, createMockWalletClient, createMockTransactionReceipt } from '../mocks/clients'
import { mockAddresses, mockTokenAddress, mockPoolAddress } from '../mocks/addresses'
import type { CreateStaticAuctionParams, CreateDynamicAuctionParams } from '../../types'
import { parseEther, keccak256, toHex, type Address } from 'viem'

vi.mock('../../addresses', () => ({
  getAddresses: vi.fn(() => mockAddresses)
}))

describe('DopplerFactory', () => {
  let factory: DopplerFactory
  let publicClient: ReturnType<typeof createMockPublicClient>
  let walletClient: ReturnType<typeof createMockWalletClient>

  beforeEach(() => {
    publicClient = createMockPublicClient()
    walletClient = createMockWalletClient()
    factory = new DopplerFactory(publicClient, walletClient, 1) // mainnet
  })

  describe('createStaticAuction', () => {
    const validParams: CreateStaticAuctionParams = {
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

    it('should validate parameters', async () => {
      const invalidParams = {
        ...validParams,
        sale: {
          ...validParams.sale,
          numTokensToSell: parseEther('2000000'), // More than initial supply
        },
      }

      await expect(factory.createStaticAuction(invalidParams)).rejects.toThrow(
        'Cannot sell more tokens than initial supply'
      )
    })

    it('should create a static auction successfully', async () => {
      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      // Create proper event signature for Create event
      const eventSignature = keccak256(toHex('Create(address,address,address,address,address,address,address)'))
      const mockLogs = [
        {
          address: mockAddresses.airlock,
          topics: [
            eventSignature, // Event signature
            `0x000000000000000000000000${mockPoolAddress.slice(2)}`, // poolOrHook
            `0x000000000000000000000000${mockTokenAddress.slice(2)}`, // asset
            `0x000000000000000000000000${mockAddresses.weth.slice(2)}`, // numeraire
          ],
          data: '0x' as `0x${string}`,
        },
      ]

      // Mock the contract calls
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.airlock,
          functionName: 'create',
          args: [{}, {}],
        },
        result: [mockTokenAddress, mockPoolAddress],
      } as any)

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)

      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceipt(mockLogs)
      )

      const result = await factory.createStaticAuction(validParams)

      expect(result).toEqual({
        poolAddress: mockPoolAddress,
        tokenAddress: mockTokenAddress,
        transactionHash: mockTxHash,
      })

      expect(publicClient.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.airlock,
          functionName: 'create',
        })
      )
    })

    it('should encode migration data correctly for V2', async () => {
      const params = { ...validParams, migration: { type: 'uniswapV2' as const } }
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const eventSignature = keccak256(toHex('Create(address,address,address,address,address,address,address)'))
      
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}, {}] },
        result: [mockPoolAddress, mockTokenAddress],
      } as any)
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceipt([{
          address: mockAddresses.airlock,
          topics: [eventSignature, `0x000000000000000000000000${mockPoolAddress.slice(2)}`, `0x000000000000000000000000${mockTokenAddress.slice(2)}`, `0x000000000000000000000000${mockAddresses.weth.slice(2)}`],
          data: '0x' as `0x${string}`,
        }])
      )

      await factory.createStaticAuction(params)

      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0]
      expect((call as any).args[0].liquidityMigrator).toBe(mockAddresses.v2Migrator)
      expect((call as any).args[0].liquidityMigratorData).toBe('0x')
    })

    it('should encode migration data correctly for V3', async () => {
      const params = {
        ...validParams,
        migration: { type: 'uniswapV3' as const, fee: 3000, tickSpacing: 60 },
      }
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const eventSignature = keccak256(toHex('Create(address,address,address,address,address,address,address)'))
      
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}, {}] },
        result: [mockPoolAddress, mockTokenAddress],
      } as any)
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceipt([{
          address: mockAddresses.airlock,
          topics: [eventSignature, `0x000000000000000000000000${mockPoolAddress.slice(2)}`, `0x000000000000000000000000${mockTokenAddress.slice(2)}`, `0x000000000000000000000000${mockAddresses.weth.slice(2)}`],
          data: '0x' as `0x${string}`,
        }])
      )

      await factory.createStaticAuction(params)

      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0]
      expect((call as any).args[0].liquidityMigrator).toBe(mockAddresses.v3Migrator)
      // Should contain encoded V3 migration data
      expect((call as any).args[0].liquidityMigratorData).toMatch(/^0x[a-fA-F0-9]+$/)
      expect((call as any).args[0].liquidityMigratorData).not.toBe('0x')
    })
  })

  describe('createDynamicAuction', () => {
    const validParams: CreateDynamicAuctionParams = {
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
      auction: {
        duration: 7, // days
        epochLength: 3600, // 1 hour
        startTick: -92103, // ~0.0001 ETH per token
        endTick: -69080, // ~0.001 ETH per token
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
          lockDuration: 365 * 24 * 60 * 60, // 1 year
          beneficiaries: [
            { address: '0x1234567890123456789012345678901234567890' as Address, percentage: 10000 }, // 100%
          ],
        },
      },
      userAddress: '0x1234567890123456789012345678901234567890',
    }

    it('should validate duration', async () => {
      const invalidParams = {
        ...validParams,
        auction: {
          ...validParams.auction,
          duration: -1, // Negative duration
        },
      }

      await expect(factory.createDynamicAuction(invalidParams)).rejects.toThrow(
        'Auction duration must be positive'
      )
    })

    it('should calculate gamma if not provided', async () => {
      const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      const eventSignature = keccak256(toHex('Create(address,address,address,address,address,address,address)'))
      
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}, {}] },
        result: [mockPoolAddress, mockTokenAddress],
      } as any)
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceipt([{
          address: mockAddresses.airlock,
          topics: [eventSignature, `0x000000000000000000000000${mockPoolAddress.slice(2)}`, `0x000000000000000000000000${mockTokenAddress.slice(2)}`, `0x000000000000000000000000${mockAddresses.weth.slice(2)}`],
          data: '0x' as `0x${string}`,
        }])
      )

      await factory.createDynamicAuction(validParams)

      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0]
      const poolInitializerData = (call as any).args[0].poolInitializerData
      
      // Should contain encoded data with calculated gamma
      expect(poolInitializerData).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(poolInitializerData.length).toBeGreaterThan(2)
    })

    it('should create a dynamic auction successfully', async () => {
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const eventSignature = keccak256(toHex('Create(address,address,address,address,address,address,address)'))
      const mockLogs = [
        {
          address: mockAddresses.airlock,
          topics: [
            eventSignature,
            `0x000000000000000000000000${mockPoolAddress.slice(2)}`,
            `0x000000000000000000000000${mockTokenAddress.slice(2)}`,
            `0x000000000000000000000000${mockAddresses.weth.slice(2)}`,
          ],
          data: '0x' as `0x${string}`,
        },
      ]

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}, {}] },
        result: [mockPoolAddress, mockTokenAddress],
      } as any)
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceipt(mockLogs)
      )

      const result = await factory.createDynamicAuction(validParams)

      expect(result).toEqual({
        hookAddress: mockPoolAddress,
        tokenAddress: mockTokenAddress,
        poolId: expect.any(String),
        transactionHash: mockTxHash,
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle missing wallet client', async () => {
      factory = new DopplerFactory(publicClient, undefined, 1)
      
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

      await expect(factory.createStaticAuction(params)).rejects.toThrow(
        'Wallet client required for write operations'
      )
    })

    it('should handle transaction receipt without Create event', async () => {
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}, {}] },
        result: [mockTokenAddress, mockPoolAddress],
      } as any)
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(
        createMockTransactionReceipt([]) // No logs
      )

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

      const result = await factory.createStaticAuction(params)
      
      // Should fall back to using simulation result
      expect(result).toEqual({
        poolAddress: mockPoolAddress,
        tokenAddress: mockTokenAddress,
        transactionHash: mockTxHash,
      })
    })
  })
})
