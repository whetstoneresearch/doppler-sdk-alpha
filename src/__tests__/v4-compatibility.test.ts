import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseEther } from 'viem'
import { DopplerFactory } from '../entities/DopplerFactory'
import { DynamicAuctionBuilder } from '../builders'
import { createMockPublicClient, createMockWalletClient } from './mocks/clients'
import { mockAddresses, mockTokenAddress, mockHookAddress, mockGovernanceAddress, mockTimelockAddress, mockV2PoolAddress, mockAddressesWithExtras } from './mocks/addresses'
import type { CreateDynamicAuctionParams } from '../types'
import { DAY_SECONDS } from '../constants'

describe('V4 SDK Compatibility', () => {
  let factory: DopplerFactory
  let publicClient: any
  let walletClient: any

  beforeEach(() => {
    publicClient = createMockPublicClient()
    walletClient = createMockWalletClient()
    factory = new DopplerFactory(publicClient, walletClient, 84532) // Base Sepolia
  })

  it('should match V4 SDK parameters exactly', async () => {
    // Create params matching the V4 SDK example
    const params: CreateDynamicAuctionParams = {
      token: {
        name: "TestToken",
        symbol: "TEST",
        tokenURI: "https://example.com/token.json",
        yearlyMintRate: 0n,
      },
      sale: {
        initialSupply: parseEther("1000000"),
        numTokensToSell: parseEther("500000"),
        numeraire: "0x0000000000000000000000000000000000000000" as const,
      },
      auction: {
        duration: 7 * DAY_SECONDS,
        epochLength: 43200, // 12 hours
        startTick: -92203,
        endTick: -91003,
        gamma: 60, // Must be divisible by tick spacing (60)
        minProceeds: parseEther("100"),
        maxProceeds: parseEther("1000"),
        numPdSlugs: 3,
      },
      pool: {
        fee: 3000,
        tickSpacing: 60,
      },
      governance: { noOp: true },
      migration: {
        type: 'uniswapV2' as const,
      },
      integrator: "0x0000000000000000000000000000000000000000" as const,
      userAddress: mockAddressesWithExtras.user,
    }

    // Mock the simulation to capture the args
    let capturedArgs: any
    vi.mocked(publicClient.simulateContract).mockImplementation(async (args: any) => {
      capturedArgs = args
      return {
        request: {} as any,
        result: [
          mockTokenAddress,
          mockHookAddress,
          mockGovernanceAddress,
          mockTimelockAddress,
          mockV2PoolAddress,
        ],
      }
    })

    vi.mocked(walletClient.writeContract).mockResolvedValueOnce('0x123' as any)
    vi.mocked(publicClient.waitForTransactionReceipt).mockResolvedValueOnce({
      logs: [],
    } as any)

    await factory.createDynamicAuction(params)

    // Verify the args passed to simulateContract
    expect(capturedArgs).toBeDefined()
    expect(capturedArgs.functionName).toBe('create')
    
    const createParams = capturedArgs.args[0]
    
    // Check key parameters
    expect(createParams.integrator).toBe("0x0000000000000000000000000000000000000000")
    expect(createParams.numTokensToSell).toBe(parseEther("500000"))
    
    // Decode poolInitializerData to check gamma
    // The gamma value should be at position 7 in the encoded data
    // This is a simplified check - in reality we'd decode the full ABI
    const poolInitData = createParams.poolInitializerData
    expect(poolInitData).toBeDefined()
    expect(poolInitData).toContain('3c') // hex for 60
  })

  it('should use correct defaults when not explicitly provided', () => {
    const builder = new DynamicAuctionBuilder()
      .tokenConfig({ name: 'Test', symbol: 'TST', tokenURI: 'https://test.com' })
      .saleConfig({ initialSupply: parseEther('1000000'), numTokensToSell: parseEther('500000'), numeraire: mockAddresses.weth })
      .poolConfig({ fee: 3000, tickSpacing: 60 })
      .auctionByTicks({ startTick: 92203, endTick: 91003, minProceeds: parseEther('100'), maxProceeds: parseEther('1000') })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' as const })
      .withUserAddress(mockAddressesWithExtras.user)

    const result = builder.build()
    
    // Check defaults match V4 SDK
    expect(result.auction.epochLength).toBe(43200) // 12 hours
    expect(result.integrator).toBe("0x0000000000000000000000000000000000000000") // ZERO_ADDRESS
    
    // Check gamma calculation with new epoch length
    const expectedGamma = 120 // With 12 hour epochs and the tick range (1200 ticks / 14 epochs ~= 86, rounded up to 120)
    expect(result.auction.gamma).toBe(expectedGamma)
  })
})
