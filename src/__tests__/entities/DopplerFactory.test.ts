import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DopplerFactory } from '../../entities/DopplerFactory'
import { createMockPublicClient, createMockWalletClient, createMockTransactionReceipt } from '../mocks/clients'
import { mockAddresses, mockTokenAddress, mockPoolAddress } from '../mocks/addresses'
import type { CreateStaticAuctionParams, CreateDynamicAuctionParams, CreateMulticurveParams } from '../../types'
import { parseEther, keccak256, toHex, decodeAbiParameters, type Address } from 'viem'
import { MIN_TICK, MAX_TICK, isToken0Expected } from '../../utils'
import { DAY_SECONDS } from '../../constants'

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

  describe('encodeCreateMulticurveParams', () => {
    const multicurveParams = (): CreateMulticurveParams => ({
      token: {
        name: 'MC Token',
        symbol: 'MCT',
        tokenURI: 'https://example.com/mc-token',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('400000'),
        numeraire: mockAddresses.weth,
      },
      pool: {
        fee: 3000,
        tickSpacing: 60,
        curves: [
          {
            tickLower: -140000,
            tickUpper: -70000,
            numPositions: 8,
            shares: parseEther('0.6'),
          },
          {
            tickLower: -90000,
            tickUpper: -50000,
            numPositions: 4,
            shares: parseEther('0.3'),
          },
        ],
      },
      governance: { type: 'default' },
      migration: { type: 'uniswapV2' },
      userAddress: '0x1234567890123456789012345678901234567890' as Address,
    })

    it('appends a fallback curve when shares total less than 100%', () => {
      const params = multicurveParams()
      const createParams = factory.encodeCreateMulticurveParams(params)

      const [poolInitData] = decodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              {
                name: 'curves',
                type: 'tuple[]',
                components: [
                  { name: 'tickLower', type: 'int24' },
                  { name: 'tickUpper', type: 'int24' },
                  { name: 'numPositions', type: 'uint16' },
                  { name: 'shares', type: 'uint256' },
                ],
              },
              {
                name: 'beneficiaries',
                type: 'tuple[]',
                components: [
                  { name: 'beneficiary', type: 'address' },
                  { name: 'shares', type: 'uint96' },
                ],
              },
            ],
          },
        ],
        createParams.poolInitializerData,
      ) as any

      const curves = poolInitData.curves as Array<{ tickLower: bigint; tickUpper: bigint; numPositions: number | bigint; shares: bigint }>
      const tickSpacing = Number(poolInitData.tickSpacing)
      expect(curves).toHaveLength(params.pool.curves.length + 1)

      const fallback = curves[curves.length - 1]
      const expectedShare = parseEther('1') - params.pool.curves.reduce((acc, curve) => acc + curve.shares, 0n)
      const expectedTickUpper = Math.floor(MAX_TICK / tickSpacing) * tickSpacing
      const mostPositiveTickUpper = params.pool.curves.reduce((max, curve) => Math.max(max, curve.tickUpper), params.pool.curves[0]!.tickUpper)

      expect(fallback.shares).toBe(expectedShare)
      expect(Number(fallback.tickLower)).toBe(mostPositiveTickUpper)
      expect(Number(fallback.tickUpper)).toBe(expectedTickUpper)
      expect(Number(fallback.numPositions)).toBe(params.pool.curves[params.pool.curves.length - 1]!.numPositions)
    })

    it('allows curves with non-positive ticks and logs warning', () => {
      const params = multicurveParams()
      params.pool.curves = [
        {
          tickLower: -120000,
          tickUpper: 0,
          numPositions: 2,
          shares: parseEther('0.5'),
        },
      ]

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(() => factory.encodeCreateMulticurveParams(params)).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith('Warning: Using negative or zero ticks in multicurve configuration. Please verify this is intentional before proceeding.')
      consoleSpy.mockRestore()
    })
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
        startTick: 174960,
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

    it('should validate tick spacing alignment when ticks provided manually', async () => {
      const invalidParams = {
        ...validParams,
        pool: {
          ...validParams.pool,
          startTick: validParams.pool.startTick + 30, // Not divisible by 60
        },
      }

      await expect(factory.createStaticAuction(invalidParams)).rejects.toThrow(
        'Pool ticks must be multiples of tick spacing 60 for fee tier 3000'
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
      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(async () => 9_500_000n)
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

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 9_500_000n })
      )

      expect(publicClient.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.airlock,
          functionName: 'create',
        })
      )
    })

    it('should honor explicit gas override when creating a static auction', async () => {
      const mockTxHash = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'

      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(async () => 9_500_000n)
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
        createMockTransactionReceipt([])
      )

      await factory.createStaticAuction({ ...validParams, gas: 21_000_000n })

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 21_000_000n })
      )
    })

    it('should encode migration data correctly for V2', async () => {
      const params = { ...validParams, migration: { type: 'uniswapV2' as const } }
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const eventSignature = keccak256(toHex('Create(address,address,address,address,address,address,address)'))
      
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}, {}] },
        result: [mockTokenAddress, mockPoolAddress],
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
        migration: { type: 'uniswapV3' as const, fee: 3000, tickSpacing: 65 },
      }
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      const eventSignature = keccak256(toHex('Create(address,address,address,address,address,address,address)'))
      
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}, {}] },
        result: [mockTokenAddress, mockPoolAddress],
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

    it('should include gas estimate when simulating static auction', async () => {
      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(async () => 11_000_000n)
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {},
        result: [mockTokenAddress, mockPoolAddress],
      } as any)

      const result = await factory.simulateCreateStaticAuction(validParams)

      expect(result.gasEstimate).toBe(11_000_000n)
      expect(result.asset).toBe(mockTokenAddress)
      expect(result.pool).toBe(mockPoolAddress)
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
        duration: 7 * DAY_SECONDS,
        epochLength: 3600, // 1 hour
        startTick: isToken0Expected(mockAddresses.weth) ? 92103 : -92103, // ~0.0001 ETH per token
        endTick: isToken0Expected(mockAddresses.weth) ? 69080 : -69080, // ~0.001 ETH per token
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
            { beneficiary: '0x1234567890123456789012345678901234567890' as Address, shares: parseEther('1') }, // 100%
          ],
        },
      },
      userAddress: '0x1234567890123456789012345678901234567890',
    }

    it('should validate descending ticks for token0', async () => {
      const invalidParams = {
        ...validParams,
        auction: {
          ...validParams.auction,
          startTick: -92103,
          endTick: -69080,
        },
        sale: {
          ...validParams.sale,
          numeraire: '0xffffffffffffffffffffffffffffffffffffffff' as Address
        },
      }

      await expect(factory.createDynamicAuction(invalidParams)).rejects.toThrow(
        'Start tick must be greater than end tick if base token is currency0'
      )
    })

    it('should validate ascending ticks for token1', async () => {
      const invalidParams = {
        ...validParams,
        auction: {
          ...validParams.auction,
          startTick: 92103,
          endTick: 69080,
        },
        sale: {
          ...validParams.sale,
          numeraire: '0x0000000000000000000000000000000000000000' as Address
        },
      }

      await expect(factory.createDynamicAuction(invalidParams)).rejects.toThrow(
        'Start tick must be less than end tick if base token is currency1'
      )
    })

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
        result: [mockTokenAddress, mockPoolAddress],
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
        result: [mockTokenAddress, mockPoolAddress],
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

      expect(publicClient.estimateContractGas).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'create' })
      )
      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 13_500_000n })
      )
    })

    it('should simulate dynamic auction creation and compute poolId', async () => {
      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(async () => 12_250_000n)
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {},
        result: [mockTokenAddress, mockPoolAddress],
      } as any)

      const { createParams, hookAddress, tokenAddress, poolId, gasEstimate } = await factory.simulateCreateDynamicAuction(
        validParams
      )

      expect(createParams).toBeDefined()
      expect(hookAddress).toBe(mockPoolAddress)
      expect(tokenAddress).toBe(mockTokenAddress)
      expect(typeof poolId).toBe('string')
      expect(poolId.startsWith('0x')).toBe(true)
      expect(gasEstimate).toBe(12_250_000n)
    })

    it('should allow overriding gas when creating a dynamic auction', async () => {
      const mockTxHash = '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed'

      vi.mocked(publicClient.estimateContractGas).mockImplementationOnce(async () => 10_000_000n)
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}, {}] },
        result: [mockTokenAddress, mockPoolAddress],
      } as any)
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce(createMockTransactionReceipt([]))

      await factory.createDynamicAuction({ ...validParams, gas: 18_000_000n })

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 18_000_000n })
      )
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
        pool: { startTick: 174960, endTick: 225000, fee: 3000 },
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
        pool: { startTick: 174960, endTick: 225000, fee: 3000 },
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
