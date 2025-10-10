import { describe, expect, it } from 'vitest'
import {
  type Address,
  type Hash,
  type Hex,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  getAddress,
} from 'viem'
import { mineTokenAddress } from '../src/utils/tokenAddressMiner'
import { DERC20Bytecode, DopplerDN404Bytecode } from '../src/abis'

const TOKEN_FACTORY = '0x0000000000000000000000000000000000000fac' as Address
const RECIPIENT = '0x000000000000000000000000000000000000beef' as Address
const OWNER = '0x000000000000000000000000000000000000c0de' as Address
const HOOK_DEPLOYER = '0x000000000000000000000000000000000000dEaD' as Address

const STANDARD_TOKEN_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
  { type: 'uint256' },
  { type: 'address[]' },
  { type: 'uint256[]' },
  { type: 'string' },
] as const

const DOPPLER404_TOKEN_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
] as const

function computeCreate2Address(salt: Hash, initCodeHash: Hash, deployer: Address): Address {
  const encoded = encodePacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, salt, initCodeHash]
  )
  return getAddress(`0x${keccak256(encoded).slice(-40)}`)
}

describe('mineTokenAddress', () => {
  it('mines a matching prefix for standard tokens', () => {
    const initialSupply = 1_000_000n
    const tokenData = encodeAbiParameters(
      STANDARD_TOKEN_ABI,
      [
        'Vanity Token',
        'VNY',
        1000n,
        30n,
        [RECIPIENT],
        [100n],
        'ipfs://token',
      ]
    )

    const result = mineTokenAddress({
      prefix: '0',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: RECIPIENT,
      owner: OWNER,
      tokenData,
    })

    expect(result.tokenAddress.slice(2).toLowerCase().startsWith('0')).toBe(true)
    expect(result.iterations).toBeGreaterThan(0)

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
        'Vanity Token',
        'VNY',
        initialSupply,
        RECIPIENT,
        OWNER,
        1000n,
        30n,
        [RECIPIENT],
        [100n],
        'ipfs://token',
      ]
    )
    const initHash = keccak256(
      encodePacked(['bytes', 'bytes'], [DERC20Bytecode as Hex, initHashData])
    ) as Hash
    const manualAddress = computeCreate2Address(result.salt, initHash, TOKEN_FACTORY)
    expect(manualAddress).toBe(result.tokenAddress)
  })

  it('mines doppler404 token addresses', () => {
    const initialSupply = 42_000n
    const tokenData = encodeAbiParameters(
      DOPPLER404_TOKEN_ABI,
      ['Vanity404', 'VNY404', 'ipfs://metadata', 1000n]
    )

    const result = mineTokenAddress({
      prefix: '1',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: RECIPIENT,
      owner: OWNER,
      tokenData,
      tokenVariant: 'doppler404',
    })

    expect(result.tokenAddress.slice(2).toLowerCase().startsWith('1')).toBe(true)

    const initHashData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'string' },
      ],
      ['Vanity404', 'VNY404', initialSupply, RECIPIENT, OWNER, 'ipfs://metadata']
    )
    const initHash = keccak256(
      encodePacked(['bytes', 'bytes'], [DopplerDN404Bytecode as Hex, initHashData])
    ) as Hash
    const manualAddress = computeCreate2Address(result.salt, initHash, TOKEN_FACTORY)
    expect(manualAddress).toBe(result.tokenAddress)
  })

  it('returns hook address when hook configuration is provided', () => {
    const initialSupply = 250_000n
    const tokenData = encodeAbiParameters(
      STANDARD_TOKEN_ABI,
      [
        'Hook Vanity',
        'HVNY',
        1500n,
        60n,
        [RECIPIENT],
        [500n],
        'ipfs://hook-token',
      ]
    )

    const hookInitHash = keccak256(
      encodePacked(['bytes'], ['0xfeedface'])
    ) as Hash

    const result = mineTokenAddress({
      prefix: '12',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: RECIPIENT,
      owner: OWNER,
      tokenData,
      hook: {
        deployer: HOOK_DEPLOYER,
        initCodeHash: hookInitHash,
        prefix: 'a',
      },
      maxIterations: 500_000,
    })

    expect(result.hookAddress).toBeDefined()
    expect(result.hookAddress!.slice(2).toLowerCase().startsWith('a')).toBe(true)

    const recomputedHook = getAddress(
      `0x${keccak256(
        encodePacked(
          ['bytes1', 'address', 'bytes32', 'bytes32'],
          ['0xff', HOOK_DEPLOYER, result.salt, hookInitHash]
        )
      ).slice(-40)}`
    )

    expect(recomputedHook).toBe(result.hookAddress)
  })

  it('throws when prefix cannot be mined within iteration limit', () => {
    const initialSupply = 1_000_000n
    const tokenData = encodeAbiParameters(
      STANDARD_TOKEN_ABI,
      [
        'Vanity Token',
        'VNY',
        1000n,
        30n,
        [RECIPIENT],
        [100n],
        'ipfs://token',
      ]
    )

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
        'Vanity Token',
        'VNY',
        initialSupply,
        RECIPIENT,
        OWNER,
        1000n,
        30n,
        [RECIPIENT],
        [100n],
        'ipfs://token',
      ]
    )
    const initHash = keccak256(
      encodePacked(['bytes', 'bytes'], [DERC20Bytecode as Hex, initHashData])
    ) as Hash
    const firstCandidate = computeCreate2Address(
      '0x'.padEnd(66, '0') as Hash,
      initHash,
      TOKEN_FACTORY
    )
    const impossiblePrefix = firstCandidate.slice(2, 6) === 'dead' ? 'feed' : 'dead'

    expect(() =>
      mineTokenAddress({
        prefix: impossiblePrefix,
        tokenFactory: TOKEN_FACTORY,
        initialSupply,
        recipient: RECIPIENT,
        owner: OWNER,
        tokenData,
        maxIterations: 1,
      })
    ).toThrowError(/could not find salt/i)
  })
})
