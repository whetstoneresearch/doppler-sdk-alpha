import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPublicClient, createWalletClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { DopplerFactory, type MigrationEncoder } from '../../entities/DopplerFactory'
import { CHAIN_IDS } from '../../addresses'
import type { MigrationConfig, CreateStaticAuctionParams } from '../../types'

describe('DopplerFactory Custom Migration Encoder', () => {
  let factory: DopplerFactory
  let customEncoder: MigrationEncoder
  let mockCreateParams: CreateStaticAuctionParams

  beforeEach(() => {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http()
    })

    const account = privateKeyToAccount('0x1234567890123456789012345678901234567890123456789012345678901234')
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http()
    })

    // Create a custom encoder that returns a specific hex value
    customEncoder = vi.fn((config: MigrationConfig) => {
      return `0x${'custom'.padEnd(64, '0')}` as `0x${string}`
    })

    factory = new DopplerFactory(publicClient, walletClient, CHAIN_IDS.BASE_SEPOLIA)
      .withCustomMigrationEncoder(customEncoder)

    mockCreateParams = {
      token: {
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'https://example.com/token.json'
      },
      sale: {
        initialSupply: BigInt('1000000000000000000000000000'), // 1B tokens
        numTokensToSell: BigInt('900000000000000000000000000'), // 900M tokens
        numeraire: '0x4200000000000000000000000000000000000006' // WETH on Base
      },
      pool: {
        startTick: -276320,
        endTick: -276300,
        fee: 10000
      },
      governance: { type: 'default' },
      migration: {
        type: 'uniswapV2'
      },
      userAddress: account.address
    }
  })

  it('should use custom migration encoder when provided', () => {
    // Call encodeCreateStaticAuctionParams to trigger migration data encoding
    const result = factory.encodeCreateStaticAuctionParams(mockCreateParams)

    // Verify the custom encoder was called
    expect(customEncoder).toHaveBeenCalledWith(mockCreateParams.migration)
    expect(customEncoder).toHaveBeenCalledTimes(1)

    // Verify the result contains our custom migration data
    expect(result.liquidityMigratorData).toBe(`0x${'custom'.padEnd(64, '0')}`)
  })

  it('should fall back to default encoding when no custom encoder provided', () => {
    // Create factory without custom encoder
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http()
    })

    const account = privateKeyToAccount('0x1234567890123456789012345678901234567890123456789012345678901234')
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http()
    })

    const defaultFactory = new DopplerFactory(publicClient, walletClient, CHAIN_IDS.BASE_SEPOLIA)

    const result = defaultFactory.encodeCreateStaticAuctionParams(mockCreateParams)

    // For uniswapV2 migration, default encoder returns '0x'
    expect(result.liquidityMigratorData).toBe('0x')
  })

  it('should handle V3 migration with custom encoder', () => {
    const v3Migration: MigrationConfig = {
      type: 'uniswapV3',
      fee: 3000,
      tickSpacing: 60
    }

    const paramsWithV3 = {
      ...mockCreateParams,
      migration: v3Migration
    }

    const result = factory.encodeCreateStaticAuctionParams(paramsWithV3)

    // Verify custom encoder was called with V3 migration config
    expect(customEncoder).toHaveBeenCalledWith(v3Migration)
    expect(result.liquidityMigratorData).toBe(`0x${'custom'.padEnd(64, '0')}`)
  })

  it('should handle V4 migration with custom encoder', () => {
    const v4Migration: MigrationConfig = {
      type: 'uniswapV4',
      fee: 3000,
      tickSpacing: 60,
      streamableFees: {
        lockDuration: 86400, // 1 day
        beneficiaries: [
          { address: mockCreateParams.userAddress, percentage: 10000 } // 100%
        ]
      }
    }

    const paramsWithV4 = {
      ...mockCreateParams,
      migration: v4Migration
    }

    const result = factory.encodeCreateStaticAuctionParams(paramsWithV4)

    // Verify custom encoder was called with V4 migration config
    expect(customEncoder).toHaveBeenCalledWith(v4Migration)
    expect(result.liquidityMigratorData).toBe(`0x${'custom'.padEnd(64, '0')}`)
  })

  it('should support fluent method chaining', () => {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http()
    })

    const account = privateKeyToAccount('0x1234567890123456789012345678901234567890123456789012345678901234')
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http()
    })

    const mockEncoder: MigrationEncoder = vi.fn(() => '0xtest' as `0x${string}`)

    // Test that withCustomMigrationEncoder returns the factory instance for chaining
    const chainedFactory = new DopplerFactory(publicClient, walletClient, CHAIN_IDS.BASE_SEPOLIA)
      .withCustomMigrationEncoder(mockEncoder)

    expect(chainedFactory).toBeInstanceOf(DopplerFactory)

    // Verify the encoder works
    const result = chainedFactory.encodeCreateStaticAuctionParams(mockCreateParams)
    expect(mockEncoder).toHaveBeenCalledWith(mockCreateParams.migration)
    expect(result.liquidityMigratorData).toBe('0xtest')
  })
})