import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MulticurvePool } from '../../entities/auction/MulticurvePool'
import { createMockPublicClient, createMockWalletClient } from '../mocks/clients'
import { mockAddresses } from '../mocks/addresses'
import type { Address } from 'viem'
import { LockablePoolStatus } from '../../types'
import { computePoolId } from '../../utils/poolKey'

vi.mock('../../addresses', () => ({
  getAddresses: vi.fn(() => mockAddresses)
}))

describe('MulticurvePool', () => {
  const mockPoolAddress = '0x1234567890123456789012345678901234567890' as Address
  const mockNumeraire = '0x4200000000000000000000000000000000000006' as Address
  const mockHook = '0xcccccccccccccccccccccccccccccccccccccccc' as Address
  const mockPoolKey = {
    currency0: mockPoolAddress,
    currency1: mockNumeraire,
    fee: 3000,
    tickSpacing: 60,
    hooks: mockHook,
  }
  const mockFarTick = 120

  let publicClient: ReturnType<typeof createMockPublicClient>
  let walletClient: ReturnType<typeof createMockWalletClient>
  let multicurvePool: MulticurvePool

  beforeEach(() => {
    publicClient = createMockPublicClient()
    walletClient = createMockWalletClient()
    multicurvePool = new MulticurvePool(publicClient, walletClient, mockPoolAddress)
    vi.clearAllMocks()
  })

  describe('getAddress', () => {
    it('should return the pool address', () => {
      expect(multicurvePool.getAddress()).toBe(mockPoolAddress)
    })
  })

  describe('getState', () => {
    it('should fetch and return pool state', async () => {
      const mockState = {
        asset: mockPoolAddress,
        numeraire: mockNumeraire,
        fee: 3000,
        tickSpacing: 60,
        status: LockablePoolStatus.Initialized,
        poolKey: mockPoolKey,
        farTick: mockFarTick,
      }

      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        mockPoolKey,
        mockFarTick,
      ] as any)

      const state = await multicurvePool.getState()

      expect(state).toEqual(mockState)
      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.v4MulticurveInitializer,
          functionName: 'getState',
          args: [mockPoolAddress],
        })
      )
    })

    it('should throw error if v4MulticurveInitializer address is not configured', async () => {
      const { getAddresses } = await import('../../addresses')
      vi.mocked(getAddresses).mockReturnValueOnce({
        ...mockAddresses,
        v4MulticurveInitializer: undefined,
      } as any)

      await expect(multicurvePool.getState()).rejects.toThrow(
        'V4 multicurve initializer address not configured for this chain'
      )
    })
  })

  describe('collectFees', () => {
    it('should collect fees and return amounts with transaction hash', async () => {
      const mockFees0 = 1000n
      const mockFees1 = 2000n
      const mockTxHash = '0xabcdef1234567890'
      const expectedPoolId = computePoolId(mockPoolKey)

      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Locked,
        mockPoolKey,
        mockFarTick,
      ] as any)

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.v4MulticurveInitializer,
          functionName: 'collectFees',
          args: [expectedPoolId],
        },
        result: [mockFees0, mockFees1],
      } as any)

      vi.mocked(walletClient.writeContract).mockResolvedValueOnce(mockTxHash as `0x${string}`)
      vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce({} as any)

      const result = await multicurvePool.collectFees()

      expect(result).toEqual({
        fees0: mockFees0,
        fees1: mockFees1,
        transactionHash: mockTxHash,
      })

      expect(publicClient.simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.v4MulticurveInitializer,
          functionName: 'collectFees',
          args: [expectedPoolId],
        })
      )

      expect(walletClient.writeContract).toHaveBeenCalled()
      expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: mockTxHash,
          confirmations: 1,
        })
      )
    })

    it('should throw error if wallet client is not provided', async () => {
      const multicurvePoolWithoutWallet = new MulticurvePool(publicClient, undefined, mockPoolAddress)

      await expect(multicurvePoolWithoutWallet.collectFees()).rejects.toThrow(
        'Wallet client required to collect fees'
      )
    })

    it('should throw error if v4MulticurveInitializer address is not configured', async () => {
      const { getAddresses } = await import('../../addresses')
      vi.mocked(getAddresses).mockReturnValueOnce({
        ...mockAddresses,
        v4MulticurveInitializer: undefined,
      } as any)

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'V4 multicurve initializer address not configured for this chain'
      )
    })
  })

  describe('getTokenAddress', () => {
    it('should return the asset address from state', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        mockPoolKey,
        mockFarTick,
      ] as any)

      const tokenAddress = await multicurvePool.getTokenAddress()

      expect(tokenAddress).toBe(mockPoolAddress)
    })
  })

  describe('getNumeraireAddress', () => {
    it('should return the numeraire address from state', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        mockPoolKey,
        mockFarTick,
      ] as any)

      const numeraireAddress = await multicurvePool.getNumeraireAddress()

      expect(numeraireAddress).toBe(mockNumeraire)
    })
  })
})
