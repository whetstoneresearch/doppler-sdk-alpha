import { describe, expect, it } from 'vitest'
import {
  type Address,
  type Hex,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  getAddress,
  parseEther,
} from 'viem'
import { mineTokenAddress } from '../src/utils/tokenAddressMiner'
import { DERC20Bytecode } from '../src/abis'

const TOKEN_FACTORY = '0x0000000000000000000000000000000000000fac' as Address
const AIRLOCK = '0x000000000000000000000000000000000000a11c' as Address

const STANDARD_TOKEN_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
  { type: 'uint256' },
  { type: 'address[]' },
  { type: 'uint256[]' },
  { type: 'string' },
] as const

function computeCreate2Address(salt: `0x${string}`, initCodeHash: `0x${string}`, deployer: Address): Address {
  const encoded = encodePacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, salt, initCodeHash]
  )
  return getAddress(`0x${keccak256(encoded).slice(-40)}`)
}

describe('mineTokenAddress for multicurve auctions', () => {
  it('mines vanity token address for multicurve with standard token', () => {
    const initialSupply = parseEther('1000000')
    const tokenData = encodeAbiParameters(
      STANDARD_TOKEN_ABI,
      [
        'Multicurve Token',
        'MULTI',
        1000n,
        30n,
        [AIRLOCK],
        [parseEther('100000')],
        'ipfs://multicurve',
      ]
    )

    const result = mineTokenAddress({
      prefix: 'cafe',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: AIRLOCK,
      owner: AIRLOCK,
      tokenData,
      maxIterations: 500_000,
    })

    // Verify the prefix
    expect(result.tokenAddress.slice(2).toLowerCase().startsWith('cafe')).toBe(true)
    expect(result.iterations).toBeGreaterThan(0)
    expect(result.iterations).toBeLessThanOrEqual(500_000)

    // Verify the CREATE2 computation is correct
    const initHashData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'address[]' },
        { type: 'uint256[]' },
        { type: 'string' },
      ],
      [
        'Multicurve Token',
        'MULTI',
        initialSupply,
        AIRLOCK,
        AIRLOCK,
        1000n,
        30n,
        [AIRLOCK],
        [parseEther('100000')],
        'ipfs://multicurve',
      ]
    )
    const initHash = keccak256(
      encodePacked(['bytes', 'bytes'], [DERC20Bytecode as Hex, initHashData])
    )
    const manualAddress = computeCreate2Address(result.salt, initHash, TOKEN_FACTORY)
    expect(manualAddress).toBe(result.tokenAddress)
  })

  it('finds different salts for different prefixes', () => {
    const initialSupply = parseEther('1000000')
    const tokenData = encodeAbiParameters(
      STANDARD_TOKEN_ABI,
      [
        'Multicurve Token',
        'MULTI',
        1000n,
        30n,
        [AIRLOCK],
        [parseEther('100000')],
        'ipfs://multicurve',
      ]
    )

    const result1 = mineTokenAddress({
      prefix: 'a',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: AIRLOCK,
      owner: AIRLOCK,
      tokenData,
      maxIterations: 100_000,
    })

    const result2 = mineTokenAddress({
      prefix: 'b',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: AIRLOCK,
      owner: AIRLOCK,
      tokenData,
      maxIterations: 100_000,
    })

    // Different prefixes should yield different salts and addresses
    expect(result1.salt).not.toBe(result2.salt)
    expect(result1.tokenAddress).not.toBe(result2.tokenAddress)

    // But both should match their respective prefixes
    expect(result1.tokenAddress.slice(2).toLowerCase().startsWith('a')).toBe(true)
    expect(result2.tokenAddress.slice(2).toLowerCase().startsWith('b')).toBe(true)
  })

  it('mines with configurable start salt', () => {
    const initialSupply = parseEther('1000000')
    const tokenData = encodeAbiParameters(
      STANDARD_TOKEN_ABI,
      [
        'Multicurve Token',
        'MULTI',
        1000n,
        30n,
        [AIRLOCK],
        [parseEther('100000')],
        'ipfs://multicurve',
      ]
    )

    // Mine starting from salt 10000
    const result = mineTokenAddress({
      prefix: '1',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: AIRLOCK,
      owner: AIRLOCK,
      tokenData,
      startSalt: 10000n,
      maxIterations: 100_000,
    })

    expect(result.tokenAddress.slice(2).toLowerCase().startsWith('1')).toBe(true)
    expect(result.iterations).toBeGreaterThan(0)

    // The salt should be >= 10000 since we started there
    const saltValue = BigInt(result.salt)
    expect(saltValue).toBeGreaterThanOrEqual(10000n)
  })

  it('respects iteration limit', () => {
    const initialSupply = parseEther('1000000')
    const tokenData = encodeAbiParameters(
      STANDARD_TOKEN_ABI,
      [
        'Multicurve Token',
        'MULTI',
        1000n,
        30n,
        [AIRLOCK],
        [parseEther('100000')],
        'ipfs://multicurve',
      ]
    )

    // Use a very rare prefix with low iteration limit
    expect(() =>
      mineTokenAddress({
        prefix: 'deadbeef',
        tokenFactory: TOKEN_FACTORY,
        initialSupply,
        recipient: AIRLOCK,
        owner: AIRLOCK,
        tokenData,
        maxIterations: 10, // Very low limit
      })
    ).toThrowError(/could not find salt/i)
  })
})
