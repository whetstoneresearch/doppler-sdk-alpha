import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { ChainAddresses } from '../../../../src/evm/addresses';

// Mock addresses for testing - all checksummed for consistency with decodeEventLog
export const mockAddresses: ChainAddresses = {
  airlock: getAddress('0x1000000000000000000000000000000000000001') as Address,
  tokenFactory: getAddress(
    '0x2000000000000000000000000000000000000002',
  ) as Address,
  derc20V2Factory: getAddress(
    '0x2000000000000000000000000000000000000003',
  ) as Address,
  derc20V2Implementation: getAddress(
    '0x2000000000000000000000000000000000000004',
  ) as Address,
  dopplerERC20V1Factory: getAddress(
    '0x2000000000000000000000000000000000000005',
  ) as Address,
  dopplerERC20V1Implementation: getAddress(
    '0x2000000000000000000000000000000000000006',
  ) as Address,
  doppler404Factory: getAddress(
    '0x2000000000000000000000000000000000000007',
  ) as Address,
  v3Initializer: getAddress(
    '0x3000000000000000000000000000000000000003',
  ) as Address,
  dopplerDeployer: getAddress(
    '0x4000000000000000000000000000000000000004',
  ) as Address,
  v2Migrator: getAddress(
    '0x5000000000000000000000000000000000000005',
  ) as Address,
  v2MigratorSplit: getAddress(
    '0x5000000000000000000000000000000000000027',
  ) as Address,
  v4Initializer: getAddress(
    '0x7000000000000000000000000000000000000007',
  ) as Address,
  v4MulticurveInitializer: getAddress(
    '0x7100000000000000000000000000000000000007',
  ) as Address,
  v4ScheduledMulticurveInitializer: getAddress(
    '0x7150000000000000000000000000000000000007',
  ) as Address,
  v4DecayMulticurveInitializer: getAddress(
    '0x7200000000000000000000000000000000000007',
  ) as Address,
  dopplerHookInitializer: getAddress(
    '0x7250000000000000000000000000000000000007',
  ) as Address,
  rehypeDopplerHookInitializer: getAddress(
    '0x7300000000000000000000000000000000000007',
  ) as Address,
  rehypeDopplerHook: getAddress(
    '0x7300000000000000000000000000000000000007',
  ) as Address,
  v4Migrator: getAddress(
    '0x8000000000000000000000000000000000000008',
  ) as Address,
  v4MigratorSplit: getAddress(
    '0x8000000000000000000000000000000000000028',
  ) as Address,
  dopplerHookMigrator: getAddress(
    '0x8100000000000000000000000000000000000008',
  ) as Address,
  v4MigratorHook: getAddress(
    '0x9000000000000000000000000000000000000009',
  ) as Address,
  streamableFeesLocker: getAddress(
    '0xa000000000000000000000000000000000000010',
  ) as Address,
  streamableFeesLockerV2: getAddress(
    '0xa000000000000000000000000000000000000012',
  ) as Address,
  poolManager: getAddress(
    '0xb000000000000000000000000000000000000011',
  ) as Address,
  weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address, // Already checksummed
  v3Quoter: getAddress('0xd000000000000000000000000000000000000013') as Address,
  uniswapV2Factory: getAddress(
    '0x1900000000000000000000000000000000000026',
  ) as Address,
  uniswapV3Factory: getAddress(
    '0x1900000000000000000000000000000000000027',
  ) as Address,
  univ2Router02: getAddress(
    '0xf000000000000000000000000000000000000015',
  ) as Address,
  dopplerLens: getAddress(
    '0x1300000000000000000000000000000000000018',
  ) as Address,
  uniswapV4Quoter: getAddress(
    '0x1300000000000000000000000000000000000018',
  ) as Address,
  governanceFactory: getAddress(
    '0x1500000000000000000000000000000000000020',
  ) as Address,
  noOpGovernanceFactory: getAddress(
    '0x1500000000000000000000000000000000000024',
  ) as Address,
  noOpMigrator: getAddress(
    '0x1500000000000000000000000000000000000028',
  ) as Address,
  launchpadGovernanceFactory: getAddress(
    '0x1500000000000000000000000000000000000025',
  ) as Address,
  universalRouter: getAddress(
    '0x1600000000000000000000000000000000000021',
  ) as Address,
  permit2: getAddress('0x1700000000000000000000000000000000000022') as Address,
  bundler: getAddress('0x1800000000000000000000000000000000000023') as Address,
};

// Must be < WETH (0xC02a...) so that mineTokenOrder succeeds for static auctions
// where WETH numeraire is > halfMaxUint160, meaning token should be currency0 (smaller address)
export const mockTokenAddress = getAddress(
  '0x0aaa000000000000000000000000000000000001',
) as Address;
export const mockPoolAddress = getAddress(
  '0xbbbb000000000000000000000000000000000002',
) as Address;
export const mockHookAddress = getAddress(
  '0xcccc000000000000000000000000000000000003',
) as Address;
export const mockGovernanceAddress = getAddress(
  '0xdddd000000000000000000000000000000000004',
) as Address;
export const mockTimelockAddress = getAddress(
  '0xeeee000000000000000000000000000000000005',
) as Address;
export const mockV2PoolAddress = getAddress(
  '0xffff000000000000000000000000000000000006',
) as Address;

// Add a type extension for test use
export const mockAddressesWithExtras = {
  ...mockAddresses,
  token: mockTokenAddress,
  hook: mockHookAddress,
  governance: mockGovernanceAddress,
  timelock: mockTimelockAddress,
  v2Pool: mockV2PoolAddress,
  user: '0x1234567890123456789012345678901234567890' as Address,
};
