import { SupportedPublicClient } from '@/types';
import { ADDRESSES } from '@/addresses';

const airlockAbi = [
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
] as const;

export const getAirlockOwner = async (
    publicClient: SupportedPublicClient
) => {
    const chain = publicClient.chain.id;
    const airlockAddress = ADDRESSES[chain].airlock;

    const owner = await publicClient.readContract({
        address: airlockAddress,
        abi: airlockAbi,
        functionName: 'owner',
    });

    if (!owner) throw new Error('Airlock owner not found');
    console.log('Airlock owner:', owner);

    return owner as `0x${string}`;
};
