import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DopplerFactory } from '../../entities/DopplerFactory'
import { createMockPublicClient, createMockWalletClient } from '../mocks/clients'
import { mockAddresses } from '../mocks/addresses'
import type { CreateDynamicAuctionParams } from '../../types'
import { parseEther, type Address, decodeAbiParameters } from 'viem'

vi.mock('../../addresses', () => ({
  getAddresses: vi.fn(() => mockAddresses)
}))

describe('DopplerFactory - Token Ordering Mining', () => {
  let factory: DopplerFactory
  let publicClient: ReturnType<typeof createMockPublicClient>
  let walletClient: ReturnType<typeof createMockWalletClient>

  beforeEach(() => {
    publicClient = createMockPublicClient()
    walletClient = createMockWalletClient()
    factory = new DopplerFactory(publicClient, walletClient, 1) // mainnet
  })

  const createDynamicAuctionParams = (numeraire: Address): CreateDynamicAuctionParams => ({
    token: {
      name: 'Test Token',
      symbol: 'TEST',
      tokenURI: 'https://example.com/token',
    },
    sale: {
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('500000'),
      numeraire,
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
    governance: { type: 'default' },
    migration: { type: 'uniswapV2' },
    userAddress: '0x1234567890123456789012345678901234567890' as Address,
  })

  describe('Normal numeraire (small address)', () => {
    it('should mine token as token1 (greater than numeraire) for low addresses', async () => {
      // Use a low address (below halfMaxUint160)
      const lowNumeraire = `0x${'1'.repeat(40)}` as Address

      const params = createDynamicAuctionParams(lowNumeraire)

      const result = await factory.encodeCreateDynamicAuctionParams(params)

      // Extract token address from result
      const tokenAddress = result.tokenAddress
      const numeraireAddress = params.sale.numeraire

      // Verify token address is greater than numeraire address
      const tokenBigInt = BigInt(tokenAddress)
      const numeraireBigInt = BigInt(numeraireAddress)

      expect(tokenBigInt).toBeGreaterThan(numeraireBigInt)

      // Decode poolInitializerData to check isToken0 flag
      const decoded = decodeAbiParameters(
        [
          { type: 'uint256' }, // minimumProceeds
          { type: 'uint256' }, // maximumProceeds
          { type: 'uint256' }, // startingTime
          { type: 'uint256' }, // endingTime
          { type: 'int24' },   // startingTick
          { type: 'int24' },   // endingTick
          { type: 'uint256' }, // epochLength
          { type: 'int24' },   // gamma
          { type: 'bool' },    // isToken0
          { type: 'uint256' }, // numPDSlugs
          { type: 'uint24' },  // fee
          { type: 'int24' },   // tickSpacing
        ],
        result.createParams.poolInitializerData
      )

      const isToken0 = decoded[8] as boolean

      // For normal numeraire, token should be token1 (isToken0 = false)
      expect(isToken0).toBe(false)
    })

    it('should mine token as token0 (less than numeraire) for WETH', async () => {
      // WETH address (0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) is > halfMaxUint160
      const params = createDynamicAuctionParams(mockAddresses.weth)

      const result = await factory.encodeCreateDynamicAuctionParams(params)

      const tokenAddress = result.tokenAddress
      const numeraireAddress = params.sale.numeraire

      // Verify token address is less than numeraire address for high-value numeraires
      const tokenBigInt = BigInt(tokenAddress)
      const numeraireBigInt = BigInt(numeraireAddress)

      expect(tokenBigInt).toBeLessThan(numeraireBigInt)

      const decoded = decodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'int24' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'bool' },
          { type: 'uint256' },
          { type: 'uint24' },
          { type: 'int24' },
        ],
        result.createParams.poolInitializerData
      )

      const isToken0 = decoded[8] as boolean

      // For WETH (high address), token should be token0 (isToken0 = true)
      expect(isToken0).toBe(true)
    })

    it('should mine token as token1 for zero address (ETH)', async () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000' as Address
      const params = createDynamicAuctionParams(zeroAddress)

      const result = await factory.encodeCreateDynamicAuctionParams(params)

      const tokenAddress = result.tokenAddress
      const tokenBigInt = BigInt(tokenAddress)

      // Token should be greater than 0
      expect(tokenBigInt).toBeGreaterThan(0n)

      // Decode to check isToken0 flag
      const decoded = decodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'int24' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'bool' },
          { type: 'uint256' },
          { type: 'uint24' },
          { type: 'int24' },
        ],
        result.createParams.poolInitializerData
      )

      const isToken0 = decoded[8] as boolean
      expect(isToken0).toBe(false)
    })
  })

  describe('Various numeraire addresses', () => {
    it('should mine token as token1 for mid-range addresses', async () => {
      // Use a mid-range address (below halfMaxUint160)
      const midAddress = `0x${'7'.repeat(40)}` as Address

      const params = createDynamicAuctionParams(midAddress)

      const result = await factory.encodeCreateDynamicAuctionParams(params)

      const tokenAddress = result.tokenAddress
      const tokenBigInt = BigInt(tokenAddress)
      const numeraireBigInt = BigInt(midAddress)

      expect(tokenBigInt).toBeGreaterThan(numeraireBigInt)

      const decoded = decodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'int24' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'bool' },
          { type: 'uint256' },
          { type: 'uint24' },
          { type: 'int24' },
        ],
        result.createParams.poolInitializerData
      )

      const isToken0 = decoded[8] as boolean
      expect(isToken0).toBe(false)
    })

    it('should mine token as token0 for high-value addresses > halfMaxUint160', async () => {
      // Use an address > halfMaxUint160 (2^159 - 1)
      // 0x8000... is > 2^159
      const highAddress = `0x${'f'.repeat(40)}` as Address

      const params = createDynamicAuctionParams(highAddress)

      const result = await factory.encodeCreateDynamicAuctionParams(params)

      const tokenAddress = result.tokenAddress
      const tokenBigInt = BigInt(tokenAddress)
      const numeraireBigInt = BigInt(highAddress)

      // For high addresses > halfMaxUint160, token should be < numeraire (token0)
      expect(tokenBigInt).toBeLessThan(numeraireBigInt)

      const decoded = decodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'int24' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'bool' },
          { type: 'uint256' },
          { type: 'uint24' },
          { type: 'int24' },
        ],
        result.createParams.poolInitializerData
      )

      const isToken0 = decoded[8] as boolean
      // For high addresses, isToken0 should be true
      expect(isToken0).toBe(true)
    })

    it('should handle edge case at exactly halfMaxUint160', async () => {
      const halfMaxUint160 = (2n ** 159n) - 1n
      const edgeAddress = `0x${halfMaxUint160.toString(16).padStart(40, '0')}` as Address

      const params = createDynamicAuctionParams(edgeAddress)

      const result = await factory.encodeCreateDynamicAuctionParams(params)

      const tokenBigInt = BigInt(result.tokenAddress)
      const numeraireBigInt = BigInt(edgeAddress)

      // At exactly halfMaxUint160, should be false (token1), so token > numeraire
      expect(tokenBigInt).toBeGreaterThan(numeraireBigInt)

      const decoded = decodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'int24' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'bool' },
          { type: 'uint256' },
          { type: 'uint24' },
          { type: 'int24' },
        ],
        result.createParams.poolInitializerData
      )

      const isToken0 = decoded[8] as boolean
      expect(isToken0).toBe(false)
    })

    it('should handle edge case just above halfMaxUint160', async () => {
      const halfMaxUint160 = (2n ** 159n) - 1n
      const justAbove = `0x${(halfMaxUint160 + 1n).toString(16).padStart(40, '0')}` as Address

      const params = createDynamicAuctionParams(justAbove)

      const result = await factory.encodeCreateDynamicAuctionParams(params)

      const tokenBigInt = BigInt(result.tokenAddress)
      const numeraireBigInt = BigInt(justAbove)

      // Just above halfMaxUint160, should be true (token0), so token < numeraire
      expect(tokenBigInt).toBeLessThan(numeraireBigInt)

      const decoded = decodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'int24' },
          { type: 'uint256' },
          { type: 'int24' },
          { type: 'bool' },
          { type: 'uint256' },
          { type: 'uint24' },
          { type: 'int24' },
        ],
        result.createParams.poolInitializerData
      )

      const isToken0 = decoded[8] as boolean
      expect(isToken0).toBe(true)
    })
  })

  describe('Mining success within iteration limit', () => {
    it('should find valid salt for WETH numeraire within reasonable iterations', async () => {
      const params = createDynamicAuctionParams(mockAddresses.weth)

      // Should not throw an error (would throw if mining fails)
      const result = await factory.encodeCreateDynamicAuctionParams(params)

      expect(result.createParams.salt).toBeDefined()
      expect(result.createParams.salt).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(result.hookAddress).toBeDefined()
      expect(result.tokenAddress).toBeDefined()
    })

    it('should find valid salt for various numeraire addresses', async () => {
      const halfMaxUint160 = (2n ** 159n) - 1n

      const testCases = [
        {
          numeraire: mockAddresses.weth,
          description: 'WETH (high address)',
          expectTokenGreater: false  // token < numeraire for high addresses
        },
        {
          numeraire: `0x${'1'.repeat(40)}` as Address,
          description: 'low address',
          expectTokenGreater: true  // token > numeraire for low addresses
        },
        {
          numeraire: `0x${'a'.repeat(40)}` as Address,
          description: 'high address',
          expectTokenGreater: false  // token < numeraire for high addresses
        },
      ]

      for (const testCase of testCases) {
        const params = createDynamicAuctionParams(testCase.numeraire)
        const result = await factory.encodeCreateDynamicAuctionParams(params)

        expect(result.createParams.salt).toBeDefined()
        expect(result.hookAddress).toBeDefined()
        expect(result.tokenAddress).toBeDefined()

        const tokenBigInt = BigInt(result.tokenAddress)
        const numeraireBigInt = BigInt(testCase.numeraire)

        // Verify correct token ordering based on numeraire value
        if (testCase.expectTokenGreater) {
          expect(tokenBigInt).toBeGreaterThan(numeraireBigInt)
        } else {
          expect(tokenBigInt).toBeLessThan(numeraireBigInt)
        }
      }
    })
  })
})
