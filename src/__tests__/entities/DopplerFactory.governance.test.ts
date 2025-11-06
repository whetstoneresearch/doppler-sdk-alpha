import { beforeEach, describe, expect, it, vi } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import { parseEther, type Address } from 'viem'
import { DopplerFactory } from '../../entities/DopplerFactory'
import { CHAIN_IDS } from '../../addresses'
import type {
  SupportedPublicClient,
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
} from '../../types'
import { isToken0Expected } from '../../utils'

describe('DopplerFactory governance encoding', () => {
  let factory: DopplerFactory
  let publicClient: SupportedPublicClient
  let simulateContractMock: ReturnType<typeof vi.fn>
  let getBlockMock: ReturnType<typeof vi.fn>
  const account = privateKeyToAccount('0x1234567890123456789012345678901234567890123456789012345678901234')

  beforeEach(() => {
    simulateContractMock = vi.fn().mockResolvedValue({
      result: [
        '0xffffffffffffffffffffffffffffffffffffffff',
        '0x0000000000000000000000000000000000000001',
      ],
    })
    getBlockMock = vi.fn().mockResolvedValue({ timestamp: 1n })

    publicClient = {
      simulateContract: simulateContractMock,
      getBlock: getBlockMock,
    } as unknown as SupportedPublicClient

    factory = new DopplerFactory(publicClient, undefined, CHAIN_IDS.BASE_SEPOLIA)
  })

  it('omits governance payload for static auctions with noOp governance', async () => {
    const params: CreateStaticAuctionParams = {
      token: {
        name: 'NoOp Token',
        symbol: 'NOP',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: '0x4200000000000000000000000000000000000006' as Address,
      },
      pool: {
        startTick: -276400,
        endTick: -276200,
        fee: 10000,
      },
      governance: { type: 'noOp' },
      migration: {
        type: 'uniswapV3',
        fee: 10000,
        tickSpacing: 200,
      },
      userAddress: account.address,
    }

    const result = await factory.encodeCreateStaticAuctionParams(params)

    expect(result.governanceFactoryData).toBe('0x')
  })

  it('omits governance payload for dynamic auctions with noOp governance', async () => {
    const numeraire = '0x4200000000000000000000000000000000000006' as Address
    const token0Expected = isToken0Expected(numeraire)

    const params: CreateDynamicAuctionParams = {
      token: {
        name: 'NoOp Dynamic Token',
        symbol: 'NOD',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('2000000'),
        numTokensToSell: parseEther('750000'),
        numeraire,
      },
      auction: {
        duration: 7 * 24 * 60 * 60,
        epochLength: 3600,
        startTick: token0Expected ? 92103 : -92103,
        endTick: token0Expected ? 69080 : -69080,
        gamma: 1200,
        minProceeds: parseEther('100'),
        maxProceeds: parseEther('5000'),
      },
      pool: {
        fee: 3000,
        tickSpacing: 60,
      },
      governance: { type: 'noOp' },
      migration: {
        type: 'uniswapV4',
        fee: 3000,
        tickSpacing: 60,
        streamableFees: {
          lockDuration: 7 * 24 * 60 * 60,
          beneficiaries: [{ beneficiary: account.address, shares: parseEther('1') }],
        },
      },
      userAddress: account.address,
      startTimeOffset: 45,
      blockTimestamp: 1,
    }

    const { createParams } = await factory.encodeCreateDynamicAuctionParams(params)

    expect(createParams.governanceFactoryData).toBe('0x')
  })

  it('omits governance payload for multicurve auctions with noOp governance', () => {
    const params: CreateMulticurveParams = {
      token: {
        name: 'NoOp Multi Token',
        symbol: 'NOM',
        tokenURI: 'https://example.com/token.json',
      },
      sale: {
        initialSupply: parseEther('3000000'),
        numTokensToSell: parseEther('1000000'),
        numeraire: '0x4200000000000000000000000000000000000006' as Address,
      },
      pool: {
        fee: 3000,
        tickSpacing: 60,
        curves: [
          {
            tickLower: 1000,
            tickUpper: 5000,
            numPositions: 4,
            shares: parseEther('0.5'),
          },
          {
            tickLower: 5000,
            tickUpper: 9000,
            numPositions: 4,
            shares: parseEther('0.5'),
          },
        ],
      },
      governance: { type: 'noOp' },
      migration: { type: 'uniswapV2' },
      userAddress: account.address,
    }

    const createParams = factory.encodeCreateMulticurveParams(params)

    expect(createParams.governanceFactoryData).toBe('0x')
  })
})
