import { describe, it, expect } from 'vitest';
import { createPublicClient, http, type Address, type Chain } from 'viem';
import { base, baseSepolia, monadTestnet } from 'viem/chains';
import {
  CHAIN_IDS,
  getAddresses,
  airlockAbi,
  type SupportedChainId,
} from '../src';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

enum ModuleState {
  NotWhitelisted = 0,
  TokenFactory = 1,
  GovernanceFactory = 2,
  PoolInitializer = 3,
  LiquidityMigrator = 4,
}

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

const getAlchemyRpc = (network: string) =>
  ALCHEMY_API_KEY ? `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : undefined;

const CHAINS: Partial<Record<SupportedChainId, { chain: Chain; rpc?: string }>> = {
  [CHAIN_IDS.BASE]: {
    chain: base,
    rpc: getAlchemyRpc('base-mainnet'),
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    chain: baseSepolia,
    rpc: getAlchemyRpc('base-sepolia'),
  },
  [CHAIN_IDS.MONAD_TESTNET]: {
    chain: monadTestnet,
    rpc: getAlchemyRpc('monad-testnet'),
  },
  // [CHAIN_IDS.INK]: {
  //   chain: ink,
  //   rpc: getAlchemyRpc('ink-mainnet'),
  // },
  // [CHAIN_IDS.UNICHAIN]: {
  //   chain: unichain,
  //   rpc: getAlchemyRpc('unichain-mainnet'),
  // },
  // [CHAIN_IDS.UNICHAIN_SEPOLIA]: {
  //   chain: unichainSepolia,
  //   rpc: getAlchemyRpc('unichain-sepolia'),
  // },
};

describe('Airlock Module Whitelisting', () => {
  const supportedChainIds = Object.values(CHAIN_IDS) as SupportedChainId[];

  for (const chainId of supportedChainIds) {
    describe(`Chain ${chainId}`, () => {
      const addresses = getAddresses(chainId);
      const config = CHAINS[chainId];

      if (!config) {
        it.skip(`Chain config not defined for chain ${chainId}`);
        return;
      }

      if (addresses.airlock === ZERO_ADDRESS) {
        it.skip(`Airlock not deployed on chain ${chainId}`);
        return;
      }

      const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpc || config.chain.rpcUrls.default.http[0]),
      });

      (addresses.tokenFactory === ZERO_ADDRESS ? it.skip : it)(
        'should have TokenFactory whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.tokenFactory],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.TokenFactory);
        }
      );

      (addresses.governanceFactory === ZERO_ADDRESS ? it.skip : it)(
        'should have GovernanceFactory whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.governanceFactory],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.GovernanceFactory);
        }
      );

      (addresses.v3Initializer === ZERO_ADDRESS ? it.skip : it)(
        'should have V3Initializer whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v3Initializer],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        }
      );

      (addresses.v4Initializer === ZERO_ADDRESS ? it.skip : it)(
        'should have V4Initializer whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v4Initializer],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        }
      );

      if (
        addresses.lockableV3Initializer &&
        addresses.lockableV3Initializer !== ZERO_ADDRESS
      ) {
        it('should have LockableV3Initializer whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.lockableV3Initializer!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        });
      }

      if (
        addresses.v4MulticurveInitializer &&
        addresses.v4MulticurveInitializer !== ZERO_ADDRESS
      ) {
        it('should have V4MulticurveInitializer whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v4MulticurveInitializer!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        });
      }

      if (
        addresses.v4ScheduledMulticurveInitializer &&
        addresses.v4ScheduledMulticurveInitializer !== ZERO_ADDRESS
      ) {
        it('should have V4ScheduledMulticurveInitializer whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v4ScheduledMulticurveInitializer!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.PoolInitializer);
        });
      }

      (addresses.v2Migrator === ZERO_ADDRESS ? it.skip : it)(
        'should have V2Migrator whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v2Migrator],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.LiquidityMigrator);
        }
      );

      (addresses.v3Migrator === ZERO_ADDRESS ? it.skip : it)(
        'should have V3Migrator whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v3Migrator],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.LiquidityMigrator);
        }
      );

      (addresses.v4Migrator === ZERO_ADDRESS ? it.skip : it)(
        'should have V4Migrator whitelisted',
        async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.v4Migrator],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.LiquidityMigrator);
        }
      );

      if (addresses.noOpMigrator && addresses.noOpMigrator !== ZERO_ADDRESS) {
        it('should have NoOpMigrator whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.noOpMigrator!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.LiquidityMigrator);
        });
      }

      if (
        addresses.noOpGovernanceFactory &&
        addresses.noOpGovernanceFactory !== ZERO_ADDRESS
      ) {
        it('should have NoOpGovernanceFactory whitelisted', async () => {
          const state = (await publicClient.readContract({
            address: addresses.airlock,
            abi: airlockAbi,
            functionName: 'getModuleState',
            args: [addresses.noOpGovernanceFactory!],
          })) as unknown as number;

          expect(Number(state)).toBe(ModuleState.GovernanceFactory);
        });
      }
    });
  }
});
