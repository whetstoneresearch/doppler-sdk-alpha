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
  const mockMigratorHook = '0xdddddddddddddddddddddddddddddddddddddddd' as Address
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

    it('should collect fees from locker when pool has migrated', async () => {
      const mockFees0 = 500n
      const mockFees1 = 750n
      const mockTxHash = '0xfeedfacecafebeef'
      const migratedPoolKey = {
        ...mockPoolKey,
        hooks: mockMigratorHook,
      }
      const expectedPoolId = computePoolId(migratedPoolKey)

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          mockNumeraire,
          LockablePoolStatus.Exited,
          mockPoolKey,
          mockFarTick,
        ] as any)
        .mockResolvedValueOnce([
          true,
          migratedPoolKey,
          3600,
          [],
          [
            {
              beneficiary: mockPoolAddress,
              shares: 10n,
            },
          ],
        ] as any)
        .mockResolvedValueOnce([
          migratedPoolKey,
          mockPoolAddress,
          123,
          3600,
          false,
          [],
          [],
        ] as any)

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockAddresses.streamableFeesLocker,
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
          address: mockAddresses.streamableFeesLocker,
          functionName: 'collectFees',
          args: [expectedPoolId],
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

    it('should throw error if v4 multicurve migrator is missing for migrated pool', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Exited,
        mockPoolKey,
        mockFarTick,
      ] as any)

      const { getAddresses } = await import('../../addresses')
      vi.mocked(getAddresses).mockReturnValueOnce({
        ...mockAddresses,
        v4Migrator: undefined,
      } as any)

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'V4 multicurve migrator address not configured for this chain'
      )
    })

    it('should throw error if migrated multicurve pool has no beneficiaries configured', async () => {
      const migratedPoolKey = {
        ...mockPoolKey,
        hooks: mockMigratorHook,
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          mockNumeraire,
          LockablePoolStatus.Exited,
          mockPoolKey,
          mockFarTick,
        ] as any)
        .mockResolvedValueOnce([
          true,
          migratedPoolKey,
          3600,
          [],
          [],
        ] as any)

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'Migrated multicurve pool has no beneficiaries configured'
      )
    })

    it('should throw error if migrated multicurve stream has not been initialized yet', async () => {
      const migratedPoolKey = {
        ...mockPoolKey,
        hooks: mockMigratorHook,
      }

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          mockNumeraire,
          LockablePoolStatus.Exited,
          mockPoolKey,
          mockFarTick,
        ] as any)
        .mockResolvedValueOnce([
          true,
          migratedPoolKey,
          3600,
          [],
          [
            {
              beneficiary: mockPoolAddress,
              shares: 10n,
            },
          ],
        ] as any)
        .mockResolvedValueOnce([
          migratedPoolKey,
          mockPoolAddress,
          0,
          3600,
          false,
          [],
          [],
        ] as any)

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'Migrated multicurve stream not initialized'
      )
    })

    it('should resolve locker from migrator when not provided in addresses', async () => {
      const migratedPoolKey = {
        ...mockPoolKey,
        hooks: mockMigratorHook,
      }
      const expectedPoolId = computePoolId(migratedPoolKey)
      const mockLockerAddress = '0x9999999999999999999999999999999999999999' as Address
      const mockFees0 = 100n
      const mockFees1 = 200n
      const mockTxHash = '0xdecafbaddecafbad'

      const { getAddresses } = await import('../../addresses')
      vi.mocked(getAddresses).mockReturnValueOnce({
        ...mockAddresses,
        streamableFeesLocker: undefined,
      } as any)

      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce([
          mockNumeraire,
          LockablePoolStatus.Exited,
          mockPoolKey,
          mockFarTick,
        ] as any)
        .mockResolvedValueOnce([
          true,
          migratedPoolKey,
          3600,
          [],
          [
            {
              beneficiary: mockPoolAddress,
              shares: 10n,
            },
          ],
        ] as any)
        .mockResolvedValueOnce(mockLockerAddress as any)
        .mockResolvedValueOnce([
          migratedPoolKey,
          mockPoolAddress,
          123,
          3600,
          false,
          [],
          [],
        ] as any)

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: {
          address: mockLockerAddress,
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

      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddresses.v4Migrator,
          functionName: 'locker',
        })
      )
    })

    it('should throw error if pool is not locked or migrated', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce([
        mockNumeraire,
        LockablePoolStatus.Initialized,
        mockPoolKey,
        mockFarTick,
      ] as any)

      await expect(multicurvePool.collectFees()).rejects.toThrow(
        'Multicurve pool is not locked or migrated'
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
