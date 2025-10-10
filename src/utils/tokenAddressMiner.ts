import {
  type Address,
  type Hash,
  type Hex,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  getAddress,
  decodeAbiParameters,
} from 'viem'
import { DERC20Bytecode, DopplerDN404Bytecode } from '../abis'

const DEFAULT_MAX_ITERATIONS = 1_000_000

export type TokenVariant = 'standard' | 'doppler404'

export interface TokenAddressHookConfig {
  deployer: Address
  initCodeHash: Hash
  prefix?: string
}

export interface TokenAddressMiningParams {
  prefix: string
  tokenFactory: Address
  initialSupply: bigint
  recipient: Address
  owner: Address
  tokenData: Hex
  tokenVariant?: TokenVariant
  customBytecode?: Hex
  maxIterations?: number
  startSalt?: bigint
  hook?: TokenAddressHookConfig
}

export interface TokenAddressMiningResult {
  salt: Hash
  tokenAddress: Address
  iterations: number
  hookAddress?: Address
}

const STANDARD_TOKEN_DATA_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
  { type: 'uint256' },
  { type: 'address[]' },
  { type: 'uint256[]' },
  { type: 'string' },
] as const

const DOPPLER404_TOKEN_DATA_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
] as const

function normalizePrefix(prefix: string): string {
  const normalized = prefix.trim().toLowerCase().replace(/^0x/, '')
  if (normalized.length === 0) {
    throw new Error('TokenAddressMiner: prefix must contain at least one hex character')
  }
  if (normalized.length > 40) {
    throw new Error('TokenAddressMiner: prefix cannot exceed 40 hex characters')
  }
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    throw new Error('TokenAddressMiner: prefix must be a hexadecimal string')
  }
  return normalized
}

function computeCreate2Address(salt: Hash, initCodeHash: Hash, deployer: Address): Address {
  const encoded = encodePacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, salt, initCodeHash]
  )
  return getAddress(`0x${keccak256(encoded).slice(-40)}`)
}

function buildTokenInitHash(params: {
  variant: TokenVariant
  tokenData: Hex
  initialSupply: bigint
  recipient: Address
  owner: Address
  customBytecode?: Hex
}): Hash {
  const { variant, tokenData, initialSupply, recipient, owner, customBytecode } = params

  if (variant === 'doppler404') {
    const [name, symbol, baseURI] = decodeAbiParameters(
      DOPPLER404_TOKEN_DATA_ABI,
      tokenData
    ) as readonly [string, string, string, bigint | undefined]

    const initHashData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'string' },
      ],
      [name, symbol, initialSupply, recipient, owner, baseURI]
    )

    return keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [(customBytecode ?? (DopplerDN404Bytecode as Hex)), initHashData]
      )
    ) as Hash
  }

  const [
    name,
    symbol,
    yearlyMintRate,
    vestingDuration,
    vestingRecipients,
    vestingAmounts,
    tokenURI,
  ] = decodeAbiParameters(STANDARD_TOKEN_DATA_ABI, tokenData) as readonly [
    string,
    string,
    bigint,
    bigint,
    readonly Address[],
    readonly bigint[],
    string
  ]

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
      name,
      symbol,
      initialSupply,
      recipient,
      owner,
      yearlyMintRate,
      vestingDuration,
      Array.from(vestingRecipients),
      Array.from(vestingAmounts),
      tokenURI,
    ]
  )

  return keccak256(
    encodePacked(
      ['bytes', 'bytes'],
      [(customBytecode ?? (DERC20Bytecode as Hex)), initHashData]
    )
  ) as Hash
}

export function mineTokenAddress(params: TokenAddressMiningParams): TokenAddressMiningResult {
  const {
    prefix,
    tokenFactory,
    initialSupply,
    recipient,
    owner,
    tokenData,
    tokenVariant = 'standard',
    customBytecode,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    startSalt = 0n,
    hook,
  } = params

  if (maxIterations <= 0 || !Number.isFinite(maxIterations)) {
    throw new Error('TokenAddressMiner: maxIterations must be a positive finite number')
  }
  if (startSalt < 0n) {
    throw new Error('TokenAddressMiner: startSalt cannot be negative')
  }

  const normalizedPrefix = normalizePrefix(prefix)
  const tokenInitHash = buildTokenInitHash({
    variant: tokenVariant,
    tokenData,
    initialSupply,
    recipient,
    owner,
    customBytecode,
  })

  const hookConfig = hook
    ? {
        deployer: hook.deployer,
        initCodeHash: hook.initCodeHash,
        prefix: hook.prefix ? normalizePrefix(hook.prefix) : undefined,
      }
    : undefined

  const maxSalt = startSalt + BigInt(maxIterations)
  let iterations = 0

  for (let salt = startSalt; salt < maxSalt; salt++) {
    const saltHex = `0x${salt.toString(16).padStart(64, '0')}` as Hash
    const candidate = computeCreate2Address(saltHex, tokenInitHash, tokenFactory)
    iterations++
    if (candidate.slice(2).toLowerCase().startsWith(normalizedPrefix)) {
      let hookAddress: Address | undefined
      if (hookConfig) {
        hookAddress = computeCreate2Address(
          saltHex,
          hookConfig.initCodeHash,
          hookConfig.deployer
        )
        if (
          hookConfig.prefix &&
          !hookAddress.slice(2).toLowerCase().startsWith(hookConfig.prefix)
        ) {
          continue
        }
      }
      return {
        salt: saltHex,
        tokenAddress: candidate,
        iterations,
        hookAddress,
      }
    }
  }

  throw new Error(
    `TokenAddressMiner: could not find salt matching prefix ${prefix} within ${maxIterations} iterations`
  )
}
