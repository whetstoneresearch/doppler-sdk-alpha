import { describe, expect, it } from 'vitest';
import { isAddress, type Address, zeroAddress } from 'viem';
import {
  ADDRESSES,
  CHAIN_IDS,
  getAddresses,
  type ChainAddresses,
} from '../../../src/evm/addresses';
import { GENERATED_DOPPLER_DEPLOYMENTS } from '../../../src/evm/deployments.generated';

const generatedAddressTargetChains = [
  { name: 'mainnet', chainId: CHAIN_IDS.MAINNET },
  { name: 'arbitrum', chainId: CHAIN_IDS.ARBITRUM },
  { name: 'base', chainId: CHAIN_IDS.BASE },
  { name: 'base-sepolia', chainId: CHAIN_IDS.BASE_SEPOLIA },
  { name: 'robinhood', chainId: CHAIN_IDS.ROBINHOOD },
  { name: 'monad-mainnet', chainId: CHAIN_IDS.MONAD_MAINNET },
] as const;

const pinnedTokenFactoryTargetChains = [
  {
    name: 'mainnet',
    chainId: CHAIN_IDS.MAINNET,
    expected: '0xe7Df2A4520C26a2D4Dedb3a7585BFBcd30eABA6e',
  },
  {
    name: 'base',
    chainId: CHAIN_IDS.BASE,
    expected: '0xf0B5141dD9096254B2ca624dff26024f46087229',
  },
  {
    name: 'base-sepolia',
    chainId: CHAIN_IDS.BASE_SEPOLIA,
    expected: '0xf0B5141dD9096254B2ca624dff26024f46087229',
  },
  {
    name: 'monad-mainnet',
    chainId: CHAIN_IDS.MONAD_MAINNET,
    expected: '0xf0B5141dD9096254B2ca624dff26024f46087229',
  },
] as const;

const generatedAddressMappings = [
  ['airlock', 'Airlock'],
  ['derc20V2Factory', 'CloneDERC20VotesV2Factory'],
  ['derc20V2Implementation', 'CloneDERC20VotesV2'],
  ['dopplerERC20V1Factory', 'DopplerERC20V1Factory'],
  ['dopplerERC20V1Implementation', 'DopplerERC20V1'],
  ['v3Initializer', 'UniswapV3Initializer'],
  ['lockableV3Initializer', 'LockableUniswapV3Initializer'],
  ['v4Initializer', 'UniswapV4Initializer'],
  ['v4MulticurveInitializer', 'UniswapV4MulticurveInitializer'],
  [
    'v4ScheduledMulticurveInitializer',
    'UniswapV4ScheduledMulticurveInitializer',
  ],
  ['v4DecayMulticurveInitializer', 'DecayMulticurveInitializer'],
  ['dopplerHookInitializer', 'DopplerHookInitializer'],
  ['rehypeDopplerHookInitializer', 'RehypeDopplerHookInitializer'],
  ['rehypeDopplerHook', 'RehypeDopplerHookInitializer'],
  ['dopplerLens', 'DopplerLensQuoter'],
  ['dopplerDeployer', 'DopplerDeployer'],
  ['v2Migrator', 'UniswapV2Migrator'],
  ['v2MigratorSplit', 'UniswapV2MigratorSplit'],
  ['v4Migrator', 'UniswapV4Migrator'],
  ['v4MigratorSplit', 'UniswapV4MigratorSplit'],
  ['v4MigratorHook', 'UniswapV4MigratorHook'],
  ['dopplerHookMigrator', 'DopplerHookMigrator'],
  ['noOpMigrator', 'NoOpMigrator'],
  ['governanceFactory', 'GovernanceFactory'],
  ['noOpGovernanceFactory', 'NoOpGovernanceFactory'],
  ['launchpadGovernanceFactory', 'LaunchpadGovernanceFactory'],
  ['streamableFeesLocker', 'StreamableFeesLocker'],
  ['streamableFeesLockerV2', 'StreamableFeesLockerV2'],
  ['bundler', 'Bundler'],
] as const satisfies readonly (readonly [keyof ChainAddresses, string])[];

function expectConfiguredAddress(address: Address | undefined): Address {
  expect(address).toBeDefined();
  if (!address) {
    throw new Error('Expected address to be configured');
  }
  expect(address).not.toBe(zeroAddress);
  expect(isAddress(address)).toBe(true);
  return address;
}

describe('address configuration', () => {
  it.each(generatedAddressTargetChains)(
    'returns generated DopplerERC20V1 addresses for $name',
    ({ chainId }) => {
      const addresses = getAddresses(chainId);
      const generated = GENERATED_DOPPLER_DEPLOYMENTS[chainId];

      const factory = expectConfiguredAddress(addresses.dopplerERC20V1Factory);
      const implementation = expectConfiguredAddress(
        addresses.dopplerERC20V1Implementation,
      );

      expect(factory).toBe(generated.DopplerERC20V1Factory);
      expect(implementation).toBe(generated.DopplerERC20V1);
      expect(ADDRESSES[chainId].dopplerERC20V1Factory).toBe(factory);
      expect(ADDRESSES[chainId].dopplerERC20V1Implementation).toBe(
        implementation,
      );
    },
  );

  it.each(pinnedTokenFactoryTargetChains)(
    'returns the pinned deprecated token factory for $name',
    ({ chainId, expected }) => {
      expect(getAddresses(chainId).tokenFactory).toBe(expected);
    },
  );

  it.each(generatedAddressTargetChains)(
    'uses generated Doppler contract addresses for $name',
    ({ chainId }) => {
      const addresses = getAddresses(chainId);
      const generated = GENERATED_DOPPLER_DEPLOYMENTS[
        chainId
      ] as unknown as Record<string, Address | undefined>;

      for (const [property, deploymentKey] of generatedAddressMappings) {
        const generatedAddress = generated[deploymentKey];
        if (generatedAddress !== undefined) {
          expect(addresses[property]).toBe(generatedAddress);
        }
      }
    },
  );
});
