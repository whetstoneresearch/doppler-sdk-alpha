import { describe, it, expect } from 'vitest'
import { parseEther } from 'viem'
import {
  calculateTickRange,
  calculateTokensToSell,
  calculateGamma,
  estimatePriceAtEpoch,
  formatTickAsPrice,
  calculateMarketCap,
  calculateFDV,
  estimateSlippage
} from '../../utils/priceHelpers'

describe('priceHelpers', () => {
  describe('calculateTickRange', () => {
    it('should calculate tick range for price range', () => {
      // Price range: 0.0001 ETH to 0.001 ETH per token
      const { startTick, endTick } = calculateTickRange(0.0001, 0.001, 60)
      
      // Start tick should be lower (higher token/ETH price)
      expect(startTick).toBeLessThan(endTick)
      // Should be aligned to tick spacing
      expect(startTick % 60).toBe(0)
      expect(endTick % 60).toBe(0)
    })

    it('should handle different tick spacings', () => {
      const range10 = calculateTickRange(0.001, 0.01, 10)
      const range60 = calculateTickRange(0.001, 0.01, 60)
      
      expect(range10.startTick % 10).toBe(0)
      expect(range60.startTick % 60).toBe(0)
    })
  })

  describe('calculateTokensToSell', () => {
    it('should calculate tokens needed for target raise', () => {
      // Want to raise 100 ETH at 0.001 ETH per token
      const tokensToSell = calculateTokensToSell(100, 0.001)
      const expected = parseEther('100000') // 100 / 0.001 = 100,000 tokens
      expect(tokensToSell).toBe(expected)
    })

    it('should handle fractional amounts', () => {
      // Want to raise 50 ETH at 0.0003 ETH per token
      const tokensToSell = calculateTokensToSell(50, 0.0003)
      const expectedApprox = 50 / 0.0003 // ~166,666.67 tokens
      const actualNumber = Number(tokensToSell) / 1e18
      expect(actualNumber).toBeCloseTo(expectedApprox, 10)
    })
  })

  describe('calculateGamma', () => {
    it('should calculate gamma for dynamic auction', () => {
      const startTick = -92103
      const endTick = -69080
      const durationDays = 7
      const epochLengthHours = 1
      
      const gamma = calculateGamma(startTick, endTick, durationDays, epochLengthHours)
      
      const totalEpochs = 7 * 24 // 168 epochs
      const tickRange = Math.abs(endTick - startTick) // 23023
      const expectedGamma = Math.floor(tickRange / totalEpochs) // ~137
      
      expect(gamma).toBe(expectedGamma)
    })

    it('should handle different epoch lengths', () => {
      const gamma1h = calculateGamma(-100000, -80000, 7, 1)
      const gamma4h = calculateGamma(-100000, -80000, 7, 4)
      
      // 4-hour epochs mean 4x fewer epochs, so gamma should be ~4x larger
      expect(gamma4h).toBeCloseTo(gamma1h * 4, 0)
    })
  })

  describe('estimatePriceAtEpoch', () => {
    it('should estimate price at different epochs', () => {
      const startTick = -92103
      const gamma = 100
      
      // At epoch 0
      const price0 = estimatePriceAtEpoch(startTick, gamma, 0)
      
      // At epoch 10 (price should increase)
      const price10 = estimatePriceAtEpoch(startTick, gamma, 10)
      
      expect(price10).toBeGreaterThan(price0)
    })

    it('should handle decreasing prices', () => {
      const startTick = -69080
      const gamma = 100
      
      const price0 = estimatePriceAtEpoch(startTick, gamma, 0, 18, 18, false)
      const price10 = estimatePriceAtEpoch(startTick, gamma, 10, 18, 18, false)
      
      expect(price10).toBeLessThan(price0)
    })
  })

  describe('formatTickAsPrice', () => {
    it('should format tick as readable price', () => {
      // Tick representing ~0.001 ETH per token
      const formatted = formatTickAsPrice(-69080, 'TEST', 'ETH')
      expect(formatted).toContain('ETH per TEST')
      expect(formatted).toMatch(/0\.00\d+/)
    })

    it('should use scientific notation for very small prices', () => {
      // Very negative tick = very low price
      const formatted = formatTickAsPrice(-200000, 'TEST', 'ETH')
      expect(formatted).toMatch(/\d\.\d+e-\d+/)
    })

    it('should format large prices with 2 decimals', () => {
      // Positive tick = high price
      const formatted = formatTickAsPrice(69080, 'TEST', 'ETH')
      expect(formatted).toMatch(/\d+\.\d{2} ETH per TEST/)
    })
  })

  describe('calculateMarketCap', () => {
    it('should calculate market cap in ETH', () => {
      const totalSupply = parseEther('1000000') // 1M tokens
      const pricePerToken = 0.001 // 0.001 ETH per token
      
      const marketCap = calculateMarketCap(totalSupply, pricePerToken)
      expect(marketCap.eth).toBe('1000.00 ETH')
    })

    it('should include USD value when ETH price provided', () => {
      const totalSupply = parseEther('1000000')
      const pricePerToken = 0.001
      const ethPrice = 2000 // $2000 per ETH
      
      const marketCap = calculateMarketCap(totalSupply, pricePerToken, ethPrice)
      expect(marketCap.eth).toBe('1000.00 ETH')
      expect(marketCap.usd).toBe('$2,000,000')
    })
  })

  describe('calculateFDV', () => {
    it('should calculate fully diluted valuation', () => {
      const totalSupply = parseEther('10000000') // 10M total supply
      const pricePerToken = 0.0005
      
      const fdv = calculateFDV(totalSupply, pricePerToken)
      expect(fdv.eth).toBe('5000.00 ETH')
    })
  })

  describe('estimateSlippage', () => {
    it('should estimate slippage for trades', () => {
      const amountIn = parseEther('10') // 10 ETH trade
      const liquidity = parseEther('1000') // 1000 units of liquidity
      const currentTick = 0
      const fee = 3000 // 0.3%
      
      const slippage = estimateSlippage(amountIn, liquidity, currentTick, fee)
      
      // 10 ETH into 1000 liquidity should have ~1% impact * fee adjustment
      expect(slippage).toBeGreaterThan(0)
      expect(slippage).toBeLessThan(100)
    })

    it('should cap slippage at 100%', () => {
      const hugeAmount = parseEther('100000')
      const tinyLiquidity = parseEther('1')
      
      const slippage = estimateSlippage(hugeAmount, tinyLiquidity, 0, 3000)
      expect(slippage).toBe(100)
    })
  })
})