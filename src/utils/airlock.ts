import type { PublicClient, Address } from 'viem'
import { ADDRESSES, type SupportedChainId } from '../addresses'
import type { BeneficiaryData } from '../types'

const airlockAbi = [
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
] as const;

export const getAirlockOwner = async (publicClient: unknown): Promise<Address> => {
  const client = publicClient as PublicClient
  const chainId = client.chain?.id as SupportedChainId | undefined
  if (!chainId || !ADDRESSES[chainId]) {
    throw new Error('Unsupported chain ID for airlock owner lookup')
  }

  const airlockAddress = ADDRESSES[chainId].airlock

  const owner = await client.readContract({
    address: airlockAddress,
    abi: airlockAbi,
    functionName: 'owner',
  })

  if (!owner) throw new Error('Airlock owner not found')
  return owner as Address
}

// Default airlock beneficiary shares (5% = 0.05e18 WAD)
export const DEFAULT_AIRLOCK_BENEFICIARY_SHARES = BigInt(5e16) // 5% in WAD

export const createAirlockBeneficiary = (
  owner: Address,
  shares: bigint = DEFAULT_AIRLOCK_BENEFICIARY_SHARES
): BeneficiaryData => ({
  beneficiary: owner,
  shares,
})

export const getAirlockBeneficiary = async (
  publicClient: unknown,
  shares: bigint = DEFAULT_AIRLOCK_BENEFICIARY_SHARES
): Promise<BeneficiaryData> => {
  const owner = await getAirlockOwner(publicClient)
  return createAirlockBeneficiary(owner, shares)
}
