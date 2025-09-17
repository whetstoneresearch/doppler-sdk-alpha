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

export const DEFAULT_AIRLOCK_BENEFICIARY_BPS = 500

export const createAirlockBeneficiary = (
  owner: Address,
  percentage: number = DEFAULT_AIRLOCK_BENEFICIARY_BPS
): BeneficiaryData => ({
  address: owner,
  percentage,
})

export const getAirlockBeneficiary = async (
  publicClient: unknown,
  percentage: number = DEFAULT_AIRLOCK_BENEFICIARY_BPS
): Promise<BeneficiaryData> => {
  const owner = await getAirlockOwner(publicClient)
  return createAirlockBeneficiary(owner, percentage)
}
