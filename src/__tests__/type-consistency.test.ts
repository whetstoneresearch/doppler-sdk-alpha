import { describe, it, expect } from 'vitest'
import type { CreateDynamicAuctionParams, DynamicAuctionConfig } from '../types'

describe('Type Consistency', () => {
  it('should have pool parameters separate from auction config', () => {
    // This test verifies the type structure is correct
    const params: CreateDynamicAuctionParams = {
      token: {
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'https://example.com/token'
      },
      sale: {
        initialSupply: 1000000n,
        numTokensToSell: 500000n,
        numeraire: '0x0000000000000000000000000000000000000000'
      },
      auction: {
        duration: 7,
        epochLength: 3600,
        startTick: -92103,
        endTick: -69080,
        minProceeds: 100n,
        maxProceeds: 1000n
      },
      pool: {
        fee: 3000,
        tickSpacing: 60
      },
      governance: { noOp: true },
      migration: {
        type: 'uniswapV2'
      },
      userAddress: '0x0000000000000000000000000000000000000001'
    }

    // Verify pool parameters are in the pool object
    expect(params.pool.fee).toBe(3000)
    expect(params.pool.tickSpacing).toBe(60)
    
    // Verify auction config doesn't have fee or tickSpacing
    const auctionConfig: DynamicAuctionConfig = params.auction
    expect('fee' in auctionConfig).toBe(false)
    expect('tickSpacing' in auctionConfig).toBe(false)
  })
})