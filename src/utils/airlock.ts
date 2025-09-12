import type { PublicClient, Address } from 'viem'
import { ADDRESSES, type SupportedChainId } from '../addresses'

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
  const chainId = client.chain?.id as SupportedChainId
  const airlockAddress = ADDRESSES[chainId].airlock

  const owner = await client.readContract({
    address: airlockAddress,
    abi: airlockAbi,
    functionName: 'owner',
  })

  if (!owner) throw new Error('Airlock owner not found')
  return owner as Address
}
