import { Address } from 'viem';
import { DopplerAddresses } from './types';

export const DOPPLER_ADDRESSES: { [chainId: number]: DopplerAddresses } = {
  // unichain sepolia
  1301: {
    airlock: '0x9d4454b023096f34b160d6b654540c56a1f81688' as Address,
    tokenFactory: '0x5eb3bc0a489c5a8288765d2336659ebca68fcd00' as Address,
    dopplerFactory: '0x4c5859f0f772848b2d91f1d83e2fe57935348029' as Address,
    governanceFactory: '0x36c02da8a0983159322a80ffe9f24b1acff8b570' as Address,
    migrator: '0x809d550fca64d94bd9f66e60752a544199cfac3d' as Address,
    poolManager: '0xc81462fec8b23319f288047f8a03a57682a35c1a' as Address,
    stateView: '0xde04c804dc75e90d8a64e5589092a1d6692efa45' as Address,
    customRouter: '0x8f86403a4de0bb5791fa46b8e795c547942fe4cf' as Address,
  },
};
