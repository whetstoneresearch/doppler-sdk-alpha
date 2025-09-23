import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DopplerSDK } from '../../DopplerSDK'
import { createMockPublicClient, createMockWalletClient } from '../mocks/clients'
import { mockAddresses, mockTokenAddress, mockPoolAddress, mockHookAddress } from '../mocks/addresses'
import { parseEther, type Address } from 'viem'
import type { CreateStaticAuctionParams, CreateMulticurveParams } from '../../types'

// Ensure addresses include a Bundler for these tests
vi.mock('../../addresses', () => ({
  getAddresses: vi.fn(() => mockAddresses)
}))

describe('Bundler integration', () => {
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
    vi.clearAllMocks()
  })

  function staticParams(): CreateStaticAuctionParams {
    return {
      token: {
        name: 'Prebuy Token',
        symbol: 'PBUY',
        tokenURI: 'ipfs://hash',
      },
      sale: {
        initialSupply: parseEther('1000000000'),
        numTokensToSell: parseEther('900000000'),
        numeraire: mockAddresses.weth,
      },
      pool: {
        startTick: 175000,
        endTick: 225000,
        fee: 10000,
      },
      governance: { noOp: true },
      migration: { type: 'uniswapV2' },
      userAddress: '0x1234567890123456789012345678901234567890' as Address,
    }
  }

  function multicurveParams(): CreateMulticurveParams {
    return {
      token: {
        name: 'Multicurve Token',
        symbol: 'MULTI',
        tokenURI: 'ipfs://multi',
      },
      sale: {
        initialSupply: parseEther('1000000000'),
        numTokensToSell: parseEther('500000000'),
        numeraire: mockAddresses.weth,
      },
      pool: {
        fee: 3000,
        tickSpacing: 60,
        curves: [
          {
            tickLower: -60000,
            tickUpper: 60000,
            numPositions: 8,
            shares: parseEther('1'),
          },
        ],
      },
      governance: { type: 'default' },
      migration: { type: 'uniswapV2' },
      userAddress: '0x1234567890123456789012345678901234567890' as Address,
    }
  }

  describe('Static pre-buy via Bundler', () => {
    it('simulates create and exact-out pre-buy', async () => {
      // 1) simulate create → return [asset, pool]
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}] },
        result: [mockTokenAddress, mockPoolAddress],
      } as any)

      const { createParams, asset, pool } = await sdk.factory.simulateCreateStaticAuction(staticParams())
      expect(asset).toBe(mockTokenAddress)
      expect(pool).toBe(mockPoolAddress)

      // 2) simulate bundle exact output → return amountIn
      const expectedAmountIn = parseEther('1.23')
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        result: expectedAmountIn,
      } as any)

      const amountIn = await sdk.factory.simulateBundleExactOutput(createParams, {
        tokenIn: mockAddresses.weth,
        tokenOut: asset,
        amount: parseEther('1000'),
        fee: 10_000,
        sqrtPriceLimitX96: 0n,
      })
      expect(amountIn).toBe(expectedAmountIn)

      // Verify simulate called with Bundler
      const callArgs = vi.mocked(publicClient.simulateContract).mock.calls[1][0]
      expect(callArgs.address).toBe(mockAddresses.bundler)
      expect(callArgs.functionName).toBe('simulateBundleExactOut')
    })

    it('bundles create + pre-buy using Universal Router commands', async () => {
      // Simulate create
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.airlock, functionName: 'create', args: [{}] },
        result: [mockTokenAddress, mockPoolAddress],
      } as any)
      const { createParams, asset } = await sdk.factory.simulateCreateStaticAuction(staticParams())

      // Next call to simulateContract should be for Bundler.bundle
      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        request: { address: mockAddresses.bundler, functionName: 'bundle', args: [] },
      } as any)

      // Mock write
      vi.mocked(walletClient.writeContract).mockResolvedValueOnce('0xabc' as any)

      const commands = '0x1234' as `0x${string}`
      const inputs = ['0xabcd'] as `0x${string}`[]
      const tx = await sdk.factory.bundle(createParams, commands, inputs, { value: parseEther('1') })
      expect(tx).toBe('0xabc')

      // Verify simulate called for Bundler.bundle
      const bundlerCall = vi.mocked(publicClient.simulateContract).mock.calls[1][0]
      expect(bundlerCall.address).toBe(mockAddresses.bundler)
      expect(bundlerCall.functionName).toBe('bundle')

      // Sanity: ensure we used the predicted token as output path in a real flow
      expect(asset).toBe(mockTokenAddress)
    })
  })

  describe('Multicurve bundler helpers', () => {
    it('simulates multicurve bundle exact-out and normalizes the pool key', async () => {
      const createParams = sdk.factory.encodeCreateMulticurveParams(multicurveParams())

      const poolKeyTuple = [
        mockAddresses.weth,
        mockTokenAddress,
        3_000n,
        60n,
        mockHookAddress,
      ] as const

      const expectedAmountIn = parseEther('5')
      const expectedGas = 123n

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        result: [mockTokenAddress, poolKeyTuple, expectedAmountIn, expectedGas],
      } as any)

      const quote = await sdk.factory.simulateMulticurveBundleExactOut(createParams, {
        exactAmountOut: parseEther('100'),
        hookData: '0xdead' as `0x${string}`,
      })

      expect(quote).toEqual({
        asset: mockTokenAddress,
        poolKey: {
          currency0: mockAddresses.weth,
          currency1: mockTokenAddress,
          fee: 3000,
          tickSpacing: 60,
          hooks: mockHookAddress,
        },
        amountIn: expectedAmountIn,
        gasEstimate: expectedGas,
      })

      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0]
      expect(call.address).toBe(mockAddresses.bundler)
      expect(call.functionName).toBe('simulateMulticurveBundleExactOut')
      expect(call.args?.[1]).toBe(parseEther('100'))
    })

    it('simulates multicurve bundle exact-in and handles object responses', async () => {
      const createParams = sdk.factory.encodeCreateMulticurveParams(multicurveParams())

      vi.mocked(publicClient.simulateContract).mockResolvedValueOnce({
        result: {
          asset: mockTokenAddress,
          poolKey: {
            currency0: mockAddresses.weth,
            currency1: mockTokenAddress,
            fee: 500n,
            tickSpacing: 12n,
            hooks: mockHookAddress,
          },
          amountOut: 42n,
          gasEstimate: 987n,
        },
      } as any)

      const quote = await sdk.factory.simulateMulticurveBundleExactIn(createParams, {
        exactAmountIn: 10n,
        hookData: '0xbeef' as `0x${string}`,
      })

      expect(quote).toEqual({
        asset: mockTokenAddress,
        poolKey: {
          currency0: mockAddresses.weth,
          currency1: mockTokenAddress,
          fee: 500,
          tickSpacing: 12,
          hooks: mockHookAddress,
        },
        amountOut: 42n,
        gasEstimate: 987n,
      })

      const call = vi.mocked(publicClient.simulateContract).mock.calls[0][0]
      expect(call.address).toBe(mockAddresses.bundler)
      expect(call.functionName).toBe('simulateMulticurveBundleExactIn')
      expect(call.args?.[1]).toBe(10n)
    })

    it('rejects zero-value exact-in multicurve bundle simulations', async () => {
      const createParams = sdk.factory.encodeCreateMulticurveParams(multicurveParams())

      await expect(
        sdk.factory.simulateMulticurveBundleExactIn(createParams, {
          exactAmountIn: 0n,
        })
      ).rejects.toThrow(/must be greater than zero/)
      expect(publicClient.simulateContract).not.toHaveBeenCalled()
    })
  })
})
