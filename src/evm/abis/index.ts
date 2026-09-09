import { feesManagerAbi } from './multicurve/feeClaimsAbi';

// Core contract ABIs needed for static and dynamic auctions

export { dopplerDN404Abi } from './dopplerDN404';
export {
  feeClaimsInitializerAbi,
  feesManagerAbi,
} from './multicurve/feeClaimsAbi';

export const airlockAbi = [
  {
    type: 'constructor',
    inputs: [{ name: 'owner_', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    name: 'collectIntegratorFees',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'collectProtocolFees',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'create',
    inputs: [
      {
        name: 'createData',
        type: 'tuple',
        internalType: 'struct CreateParams',
        components: [
          { name: 'initialSupply', type: 'uint256', internalType: 'uint256' },
          { name: 'numTokensToSell', type: 'uint256', internalType: 'uint256' },
          { name: 'numeraire', type: 'address', internalType: 'address' },
          {
            name: 'tokenFactory',
            type: 'address',
            internalType: 'contract ITokenFactory',
          },
          { name: 'tokenFactoryData', type: 'bytes', internalType: 'bytes' },
          {
            name: 'governanceFactory',
            type: 'address',
            internalType: 'contract IGovernanceFactory',
          },
          {
            name: 'governanceFactoryData',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'poolInitializer',
            type: 'address',
            internalType: 'contract IPoolInitializer',
          },
          { name: 'poolInitializerData', type: 'bytes', internalType: 'bytes' },
          {
            name: 'liquidityMigrator',
            type: 'address',
            internalType: 'contract ILiquidityMigrator',
          },
          {
            name: 'liquidityMigratorData',
            type: 'bytes',
            internalType: 'bytes',
          },
          { name: 'integrator', type: 'address', internalType: 'address' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
    outputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      { name: 'pool', type: 'address', internalType: 'address' },
      { name: 'governance', type: 'address', internalType: 'address' },
      { name: 'timelock', type: 'address', internalType: 'address' },
      { name: 'migrationPool', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAssetData',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'numeraire', type: 'address', internalType: 'address' },
      { name: 'timelock', type: 'address', internalType: 'address' },
      { name: 'governance', type: 'address', internalType: 'address' },
      {
        name: 'liquidityMigrator',
        type: 'address',
        internalType: 'contract ILiquidityMigrator',
      },
      {
        name: 'poolInitializer',
        type: 'address',
        internalType: 'contract IPoolInitializer',
      },
      { name: 'pool', type: 'address', internalType: 'address' },
      { name: 'migrationPool', type: 'address', internalType: 'address' },
      { name: 'numTokensToSell', type: 'uint256', internalType: 'uint256' },
      { name: 'totalSupply', type: 'uint256', internalType: 'uint256' },
      { name: 'integrator', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getModuleState',
    inputs: [{ name: 'module', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'state', type: 'uint8', internalType: 'enum ModuleState' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'integratorFees',
    inputs: [
      { name: 'integrator', type: 'address', internalType: 'address' },
      { name: 'token', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'migrate',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'protocolFees',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setModuleState',
    inputs: [
      { name: 'modules', type: 'address[]', internalType: 'address[]' },
      { name: 'states', type: 'uint8[]', internalType: 'enum ModuleState[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Collect',
    inputs: [
      { name: 'to', type: 'address', indexed: true, internalType: 'address' },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Create',
    inputs: [
      {
        name: 'asset',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'numeraire',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'initializer',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'poolOrHook',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Migrate',
    inputs: [
      {
        name: 'asset',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      { name: 'pool', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SetModuleState',
    inputs: [
      {
        name: 'module',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'state',
        type: 'uint8',
        indexed: true,
        internalType: 'enum ModuleState',
      },
    ],
    anonymous: false,
  },
  { type: 'error', name: 'ArrayLengthsMismatch', inputs: [] },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'WrongModuleState',
    inputs: [
      { name: 'module', type: 'address', internalType: 'address' },
      { name: 'expected', type: 'uint8', internalType: 'enum ModuleState' },
      { name: 'actual', type: 'uint8', internalType: 'enum ModuleState' },
    ],
  },
  // Pool initializer errors (included for better error decoding when calls bubble up)
  {
    type: 'error',
    name: 'InvalidTickRange',
    inputs: [
      { name: 'tick', type: 'int24', internalType: 'int24' },
      { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
    ],
  },
  {
    type: 'error',
    name: 'InvalidTickRangeMisordered',
    inputs: [
      { name: 'tickLower', type: 'int24', internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', internalType: 'int24' },
    ],
  },
  {
    type: 'error',
    name: 'InvalidFee',
    inputs: [{ name: 'fee', type: 'uint24', internalType: 'uint24' }],
  },
  {
    type: 'error',
    name: 'CannotMigrateInsufficientTick',
    inputs: [
      { name: 'targetTick', type: 'int24', internalType: 'int24' },
      { name: 'currentTick', type: 'int24', internalType: 'int24' },
    ],
  },
  { type: 'error', name: 'CannotMintZeroLiquidity', inputs: [] },
  {
    type: 'error',
    name: 'MaxShareToBeSoldExceeded',
    inputs: [
      { name: 'value', type: 'uint256', internalType: 'uint256' },
      { name: 'limit', type: 'uint256', internalType: 'uint256' },
    ],
  },
  { type: 'error', name: 'PoolAlreadyExited', inputs: [] },
  { type: 'error', name: 'PoolAlreadyInitialized', inputs: [] },
  { type: 'error', name: 'PoolLocked', inputs: [] },
  { type: 'error', name: 'SenderNotAirlock', inputs: [] },
  { type: 'error', name: 'UnorderedBeneficiaries', inputs: [] },
  { type: 'error', name: 'InvalidShares', inputs: [] },
  { type: 'error', name: 'InvalidTotalShares', inputs: [] },
  { type: 'error', name: 'InvalidProtocolOwnerShares', inputs: [] },
  { type: 'error', name: 'InvalidProtocolOwnerBeneficiary', inputs: [] },
] as const;

export const uniswapV3InitializerAbi = [
  {
    type: 'function',
    name: 'encodePoolInitializerData',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'numTokensToSell', type: 'uint256' },
          { name: 'startTick', type: 'int24' },
          { name: 'endTick', type: 'int24' },
          { name: 'fee', type: 'uint24' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
] as const;

export const v2MigratorAbi = [
  {
    type: 'function',
    name: 'encodeLiquidityMigratorData',
    inputs: [],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
] as const;

export const v3MigratorAbi = [
  {
    type: 'function',
    name: 'encodeLiquidityMigratorData',
    inputs: [
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
] as const;

export const v4MigratorAbi = [
  {
    type: 'function',
    name: 'encodeLiquidityMigratorData',
    inputs: [
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'lockDuration', type: 'uint256' },
      { name: 'beneficiaries', type: 'address[]' },
      { name: 'percentages', type: 'uint256[]' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
  // V4 Migrator errors
  { type: 'error', name: 'TickOutOfRange', inputs: [] },
  { type: 'error', name: 'ZeroLiquidity', inputs: [] },
] as const;

export const uniswapV3PoolAbi = [
  {
    type: 'function',
    name: 'slot0',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'liquidity',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token0',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token1',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'fee',
    inputs: [],
    outputs: [{ name: '', type: 'uint24' }],
    stateMutability: 'view',
  },
] as const;

export const derc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  // OpenZeppelin Votes (governance) — delegation + queries
  {
    type: 'function',
    name: 'delegate',
    inputs: [{ name: 'delegatee', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'delegateBySig',
    inputs: [
      { name: 'delegatee', type: 'address', internalType: 'address' },
      { name: 'nonce', type: 'uint256', internalType: 'uint256' },
      { name: 'expiry', type: 'uint256', internalType: 'uint256' },
      { name: 'v', type: 'uint8', internalType: 'uint8' },
      { name: 'r', type: 'bytes32', internalType: 'bytes32' },
      { name: 's', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'delegates',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVotes',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPastVotes',
    inputs: [
      { name: 'account', type: 'address', internalType: 'address' },
      { name: 'timepoint', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPastTotalSupply',
    inputs: [{ name: 'timepoint', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'computeAvailableVestedAmount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'currentYearStart',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVestingDataOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'totalAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'releasedAmount', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isPoolUnlocked',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastMintTimestamp',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pool',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'release',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address', internalType: 'address' },
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'vestedTotalAmount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingDuration',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingStart',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'yearlyMintRate',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // DERC20 errors
  { type: 'error', name: 'MintingNotStartedYet', inputs: [] },
  { type: 'error', name: 'ExceedsYearlyMintCap', inputs: [] },
  { type: 'error', name: 'NoMintableAmount', inputs: [] },
  { type: 'error', name: 'PoolLocked', inputs: [] },
  { type: 'error', name: 'ArrayLengthsMismatch', inputs: [] },
  { type: 'error', name: 'ReleaseAmountInvalid', inputs: [] },
  {
    type: 'error',
    name: 'MaxPreMintPerAddressExceeded',
    inputs: [
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'limit', type: 'uint256', internalType: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'MaxTotalPreMintExceeded',
    inputs: [
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'limit', type: 'uint256', internalType: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'MaxTotalVestedExceeded',
    inputs: [
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'limit', type: 'uint256', internalType: 'uint256' },
    ],
  },
  { type: 'error', name: 'VestingNotStartedYet', inputs: [] },
  {
    type: 'error',
    name: 'MaxYearlyMintRateExceeded',
    inputs: [
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'limit', type: 'uint256', internalType: 'uint256' },
    ],
  },
] as const;

export const derc20V2Abi = [
  ...derc20Abi,
  {
    type: 'function',
    name: 'computeAvailableVestedAmount',
    inputs: [{ name: 'beneficiary', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'computeAvailableVestedAmount',
    inputs: [
      { name: 'beneficiary', type: 'address', internalType: 'address' },
      { name: 'scheduleId', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getScheduleIdsOf',
    inputs: [{ name: 'beneficiary', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256[]', internalType: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'release',
    inputs: [{ name: 'scheduleId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseFor',
    inputs: [
      { name: 'beneficiary', type: 'address', internalType: 'address' },
      { name: 'scheduleId', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseFor',
    inputs: [{ name: 'beneficiary', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'totalAllocatedOf',
    inputs: [{ name: 'beneficiary', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingOf',
    inputs: [
      { name: 'beneficiary', type: 'address', internalType: 'address' },
      { name: 'scheduleId', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      { name: 'totalAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'releasedAmount', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingScheduleCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingSchedules',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'cliff', type: 'uint64', internalType: 'uint64' },
      { name: 'duration', type: 'uint64', internalType: 'uint64' },
    ],
    stateMutability: 'view',
  },
] as const;

export const dopplerERC20V1Abi = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'CLOCK_MODE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    inputs: [],
    outputs: [
      {
        name: 'result',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceLimitEnd',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint48',
        internalType: 'uint48',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'burn',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelOwnershipHandover',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'checkpointAt',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'i',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'checkpointClock',
        type: 'uint48',
        internalType: 'uint48',
      },
      {
        name: 'checkpointValue',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'checkpointCount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'clock',
    inputs: [],
    outputs: [
      {
        name: 'result',
        type: 'uint48',
        internalType: 'uint48',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'completeOwnershipHandover',
    inputs: [
      {
        name: 'pendingOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'computeAvailableVestedAmount',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'scheduleId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'computeAvailableVestedAmount',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'total',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'controller',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'delegate',
    inputs: [
      {
        name: 'delegatee',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'delegateBySig',
    inputs: [
      {
        name: 'delegatee',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'nonce',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expiry',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'v',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'r',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'delegates',
    inputs: [
      {
        name: 'delegator',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'disableBalanceLimit',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPastVotes',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'timepoint',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPastTotalSupply',
    inputs: [
      {
        name: 'timepoint',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPastVotesTotalSupply',
    inputs: [
      {
        name: 'timepoint',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getScheduleIdsOf',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVotes',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVotesTotalSupply',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      {
        name: 'name_',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'symbol_',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'initialSupply',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'owner_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'schedules',
        type: 'tuple[]',
        internalType: 'struct VestingSchedule[]',
        components: [
          {
            name: 'cliff',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'duration',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
      },
      {
        name: 'beneficiaries',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: 'scheduleIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
      {
        name: 'amounts',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
      {
        name: 'tokenURI_',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'maxBalanceLimit_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'balanceLimitEnd_',
        type: 'uint48',
        internalType: 'uint48',
      },
      {
        name: 'controller_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'excludedFromBalanceLimit',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isBalanceLimitActive',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isExcludedFromBalanceLimit',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'excluded',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isPoolLocked',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lockPool',
    inputs: [
      {
        name: 'pool_',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'maxBalanceLimit',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [
      {
        name: 'result',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownershipHandoverExpiresAt',
    inputs: [
      {
        name: 'pendingOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'permit',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'v',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'r',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pool',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'release',
    inputs: [
      {
        name: 'scheduleId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'release',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseFor',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseFor',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'scheduleId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'requestOwnershipHandover',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalAllocatedOf',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalUnreleasedOf',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [
      {
        name: 'result',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      {
        name: 'from',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'unlockPool',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateTokenURI',
    inputs: [
      {
        name: 'tokenURI_',
        type: 'string',
        internalType: 'string',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'vestedTotalAmount',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingOf',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'scheduleId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'totalAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'releasedAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingScheduleCount',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingSchedules',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'cliff',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'duration',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingStart',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'spender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BalanceLimitDisabled',
    inputs: [
      {
        name: 'expired',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'DelegateChanged',
    inputs: [
      {
        name: 'delegator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'from',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'DelegateVotesChanged',
    inputs: [
      {
        name: 'delegate',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'oldValue',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newValue',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Initialized',
    inputs: [
      {
        name: 'version',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipHandoverCanceled',
    inputs: [
      {
        name: 'pendingOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipHandoverRequested',
    inputs: [
      {
        name: 'pendingOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'oldOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokensReleased',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'scheduleId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      {
        name: 'from',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'UpdateTokenURI',
    inputs: [
      {
        name: 'tokenURI',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VestingAllocated',
    inputs: [
      {
        name: 'beneficiary',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'scheduleId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VestingScheduleCreated',
    inputs: [
      {
        name: 'scheduleId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'cliff',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'duration',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AllowanceOverflow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AllowanceUnderflow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadyInitialized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ArrayLengthsMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BalanceLimitExceeded',
    inputs: [
      {
        name: 'balance',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'limit',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'BalanceLimitNotActive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ERC5805CheckpointIndexOutOfBounds',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ERC5805CheckpointValueOverflow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ERC5805CheckpointValueUnderflow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ERC5805DelegateInvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ERC5805DelegateSignatureExpired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ERC5805FutureLookup',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientAllowance',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientReleasableAmount',
    inputs: [
      {
        name: 'available',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'requested',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidAllocation',
    inputs: [
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidBalanceLimit',
    inputs: [
      {
        name: 'limit',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidBalanceLimitTimestamp',
    inputs: [
      {
        name: 'specified',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'current',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidInitialization',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidPermit',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSchedule',
    inputs: [
      {
        name: 'scheduleId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MaxPreMintPerAddressExceeded',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'limit',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MaxTotalPreMintExceeded',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'limit',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MaxTotalVestedExceeded',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'limit',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'NewOwnerIsZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoHandoverRequest',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoReleasableAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotInitializing',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Permit2AllowanceIsFixedAtInfinity',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PermitExpired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PoolAlreadyLocked',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PoolAlreadyUnlocked',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PoolLocked',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TotalSupplyOverflow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnknownScheduleId',
    inputs: [
      {
        name: 'scheduleId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
] as const;

export const uniswapV4InitializerAbi = [
  {
    type: 'function',
    name: 'encodePoolInitializerData',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'minimumProceeds', type: 'uint256' },
          { name: 'maximumProceeds', type: 'uint256' },
          { name: 'startingTime', type: 'uint256' },
          { name: 'endingTime', type: 'uint256' },
          { name: 'startingTick', type: 'int24' },
          { name: 'endingTick', type: 'int24' },
          { name: 'epochLength', type: 'uint256' },
          { name: 'gamma', type: 'int24' },
          { name: 'isToken0', type: 'bool' },
          { name: 'numPDSlugs', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
        ],
      },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
] as const;

export const dopplerHookAbi = [
  {
    type: 'function',
    name: 'state',
    inputs: [],
    outputs: [
      { name: 'lastEpoch', type: 'uint40' },
      { name: 'tickAccumulator', type: 'int256' },
      { name: 'totalTokensSold', type: 'uint256' },
      { name: 'totalProceeds', type: 'uint256' },
      { name: 'totalTokensSoldLastEpoch', type: 'uint256' },
      // BalanceDelta is encoded as a single int256 in the compiled ABI.
      { name: 'feesAccrued', type: 'int256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'earlyExit',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'insufficientProceeds',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolKey',
    inputs: [],
    outputs: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'startingTime',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'endingTime',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'epochLength',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minimumProceeds',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maximumProceeds',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'numTokensToSell',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'startingTick',
    inputs: [],
    outputs: [{ name: '', type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'endingTick',
    inputs: [],
    outputs: [{ name: '', type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'gamma',
    inputs: [],
    outputs: [{ name: '', type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isToken0',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'numPDSlugs',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Doppler Hook errors
  { type: 'error', name: 'InvalidGamma', inputs: [] },
  { type: 'error', name: 'InvalidTimeRange', inputs: [] },
  { type: 'error', name: 'CannotAddLiquidity', inputs: [] },
  { type: 'error', name: 'CannotSwapBeforeStartTime', inputs: [] },
  { type: 'error', name: 'SwapBelowRange', inputs: [] },
  { type: 'error', name: 'InvalidStartTime', inputs: [] },
  { type: 'error', name: 'InvalidTickRange', inputs: [] },
  { type: 'error', name: 'InvalidTickSpacing', inputs: [] },
  { type: 'error', name: 'InvalidEpochLength', inputs: [] },
  { type: 'error', name: 'InvalidProceedLimits', inputs: [] },
  { type: 'error', name: 'InvalidNumPDSlugs', inputs: [] },
  {
    type: 'error',
    name: 'InvalidSwapAfterMaturitySufficientProceeds',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSwapAfterMaturityInsufficientProceeds',
    inputs: [],
  },
  { type: 'error', name: 'MaximumProceedsReached', inputs: [] },
  { type: 'error', name: 'SenderNotPoolManager', inputs: [] },
  { type: 'error', name: 'AlreadyInitialized', inputs: [] },
  { type: 'error', name: 'SenderNotInitializer', inputs: [] },
  { type: 'error', name: 'CannotMigrate', inputs: [] },
  { type: 'error', name: 'CannotDonate', inputs: [] },
] as const;

export const openingAuctionAbi = [
  {
    type: 'function',
    name: 'phase',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'enum AuctionPhase' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'auctionStartTime',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'auctionEndTime',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'clearingTick',
    inputs: [],
    outputs: [{ name: '', type: 'int24', internalType: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalTokensSold',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalProceeds',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'incentiveTokensTotal',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalAuctionTokens',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalIncentivesClaimed',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'incentivesClaimDeadline',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positions',
    inputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct AuctionPosition',
        components: [
          { name: 'owner', type: 'address', internalType: 'address' },
          { name: 'tickLower', type: 'int24', internalType: 'int24' },
          { name: 'tickUpper', type: 'int24', internalType: 'int24' },
          { name: 'liquidity', type: 'uint128', internalType: 'uint128' },
          {
            name: 'rewardDebtX128',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'hasClaimedIncentives',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isInRange',
    inputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculateIncentives',
    inputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'settleAuction',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimIncentives',
    inputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'estimatedClearingTick',
    inputs: [],
    outputs: [{ name: '', type: 'int24', internalType: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'liquidityAtTick',
    inputs: [{ name: 'tick', type: 'int24', internalType: 'int24' }],
    outputs: [{ name: '', type: 'uint128', internalType: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextPositionId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerPositions',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'index', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isToken0',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolKey',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minLiquidity',
    inputs: [],
    outputs: [{ name: '', type: 'uint128', internalType: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minAcceptableTickToken0',
    inputs: [],
    outputs: [{ name: '', type: 'int24', internalType: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minAcceptableTickToken1',
    inputs: [],
    outputs: [{ name: '', type: 'int24', internalType: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AuctionSettled',
    inputs: [
      {
        name: 'clearingTick',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'tokensSold',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'proceeds',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BidPlaced',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'tickLower',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BidWithdrawn',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IncentivesClaimed',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EstimatedClearingTickUpdated',
    inputs: [
      {
        name: 'newEstimatedClearingTick',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PhaseChanged',
    inputs: [
      { name: 'oldPhase', type: 'uint8', indexed: true, internalType: 'uint8' },
      { name: 'newPhase', type: 'uint8', indexed: true, internalType: 'uint8' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AuctionStarted',
    inputs: [
      {
        name: 'auctionStartTime',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'auctionEndTime',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'totalAuctionTokens',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'incentiveTokensTotal',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TickEnteredRange',
    inputs: [
      { name: 'tick', type: 'int24', indexed: true, internalType: 'int24' },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TickExitedRange',
    inputs: [
      { name: 'tick', type: 'int24', indexed: true, internalType: 'int24' },
      {
        name: 'liquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityAddedToTick',
    inputs: [
      { name: 'tick', type: 'int24', indexed: true, internalType: 'int24' },
      {
        name: 'liquidityAdded',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'totalLiquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityRemovedFromTick',
    inputs: [
      { name: 'tick', type: 'int24', indexed: true, internalType: 'int24' },
      {
        name: 'liquidityRemoved',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'remainingLiquidity',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TimeHarvested',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'harvestedTimeX128',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IncentivesRecovered',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
] as const;

export const openingAuctionInitializerAbi = [
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      { name: 'numeraire', type: 'address', internalType: 'address' },
      {
        name: 'numTokensToSell',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract IPoolManager' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'auctionDeployer',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract OpeningAuctionDeployer',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'dopplerDeployer',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IDopplerDeployer',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionManager',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getState',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'numeraire', type: 'address', internalType: 'address' },
      {
        name: 'auctionStartTime',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'auctionEndTime', type: 'uint256', internalType: 'uint256' },
      { name: 'auctionTokens', type: 'uint256', internalType: 'uint256' },
      { name: 'dopplerTokens', type: 'uint256', internalType: 'uint256' },
      {
        name: 'status',
        type: 'uint8',
        internalType: 'enum OpeningAuctionStatus',
      },
      {
        name: 'openingAuctionHook',
        type: 'address',
        internalType: 'address',
      },
      { name: 'dopplerHook', type: 'address', internalType: 'address' },
      {
        name: 'openingAuctionPoolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      { name: 'dopplerInitData', type: 'bytes', internalType: 'bytes' },
      { name: 'isToken0', type: 'bool', internalType: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOpeningAuctionHook',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDopplerHook',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'completeAuction',
    inputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      { name: 'dopplerSalt', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recoverOpeningAuctionIncentives',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sweepOpeningAuctionIncentives',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'AuctionCompleted',
    inputs: [
      {
        name: 'asset',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'clearingTick',
        type: 'int24',
        indexed: false,
        internalType: 'int24',
      },
      {
        name: 'tokensSold',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'proceeds',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
] as const;

// Placeholder ABI for phase-2 bid-management wrappers.
export const openingAuctionPositionManagerAbi = [
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract IPoolManager' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'modifyLiquidity',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IPoolManager.ModifyLiquidityParams',
        components: [
          { name: 'tickLower', type: 'int24', internalType: 'int24' },
          { name: 'tickUpper', type: 'int24', internalType: 'int24' },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
      { name: 'hookData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: 'delta', type: 'int256', internalType: 'BalanceDelta' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'modifyLiquidity',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IPoolManager.ModifyLiquidityParams',
        components: [
          { name: 'tickLower', type: 'int24', internalType: 'int24' },
          { name: 'tickUpper', type: 'int24', internalType: 'int24' },
          {
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
    outputs: [{ name: 'delta', type: 'int256', internalType: 'BalanceDelta' }],
    stateMutability: 'nonpayable',
  },
  // Common bubbled custom errors for easier revert decoding in SDK consumers.
  {
    type: 'error',
    name: 'WrappedError',
    inputs: [
      { name: 'target', type: 'address', internalType: 'address' },
      { name: 'selector', type: 'bytes4', internalType: 'bytes4' },
      { name: 'reason', type: 'bytes', internalType: 'bytes' },
      { name: 'details', type: 'bytes', internalType: 'bytes' },
    ],
  },
  { type: 'error', name: 'HookCallFailed', inputs: [] },
  { type: 'error', name: 'PositionIsLocked', inputs: [] },
] as const;

export const quoterV2Abi = [
  {
    inputs: [
      { internalType: 'address', name: '_factory', type: 'address' },
      { internalType: 'address', name: '_WETH9', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'WETH9',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'factory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes', name: 'path', type: 'bytes' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
    ],
    name: 'quoteExactInput',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      {
        internalType: 'uint160[]',
        name: 'sqrtPriceX96AfterList',
        type: 'uint160[]',
      },
      {
        internalType: 'uint32[]',
        name: 'initializedTicksCrossedList',
        type: 'uint32[]',
      },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          {
            internalType: 'uint160',
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
          },
        ],
        internalType: 'struct IQuoterV2.QuoteExactInputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
      {
        internalType: 'uint32',
        name: 'initializedTicksCrossed',
        type: 'uint32',
      },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes', name: 'path', type: 'bytes' },
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
    ],
    name: 'quoteExactOutput',
    outputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      {
        internalType: 'uint160[]',
        name: 'sqrtPriceX96AfterList',
        type: 'uint160[]',
      },
      {
        internalType: 'uint32[]',
        name: 'initializedTicksCrossedList',
        type: 'uint32[]',
      },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'tokenIn', type: 'address' },
          { internalType: 'address', name: 'tokenOut', type: 'address' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'uint24', name: 'fee', type: 'uint24' },
          {
            internalType: 'uint160',
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
          },
        ],
        internalType: 'struct IQuoterV2.QuoteExactOutputSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactOutputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
      {
        internalType: 'uint32',
        name: 'initializedTicksCrossed',
        type: 'uint32',
      },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'int256', name: 'amount0Delta', type: 'int256' },
      { internalType: 'int256', name: 'amount1Delta', type: 'int256' },
      { internalType: 'bytes', name: '_data', type: 'bytes' },
    ],
    name: 'uniswapV3SwapCallback',
    outputs: [],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const uniswapV2Router02Abi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsIn',
    outputs: [
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const v4QuoterAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_poolManager',
        type: 'address',
        internalType: 'contract IPoolManager',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IV4Quoter.QuoteExactSingleParams',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            internalType: 'struct PoolKey',
            components: [
              { name: 'currency0', type: 'address', internalType: 'Currency' },
              { name: 'currency1', type: 'address', internalType: 'Currency' },
              { name: 'fee', type: 'uint24', internalType: 'uint24' },
              { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
              {
                name: 'hooks',
                type: 'address',
                internalType: 'contract IHooks',
              },
            ],
          },
          { name: 'zeroForOne', type: 'bool', internalType: 'bool' },
          { name: 'exactAmount', type: 'uint128', internalType: 'uint128' },
          { name: 'hookData', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
      { name: 'gasEstimate', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'quoteExactOutputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IV4Quoter.QuoteExactSingleParams',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            internalType: 'struct PoolKey',
            components: [
              { name: 'currency0', type: 'address', internalType: 'Currency' },
              { name: 'currency1', type: 'address', internalType: 'Currency' },
              { name: 'fee', type: 'uint24', internalType: 'uint24' },
              { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
              {
                name: 'hooks',
                type: 'address',
                internalType: 'contract IHooks',
              },
            ],
          },
          { name: 'zeroForOne', type: 'bool', internalType: 'bool' },
          { name: 'exactAmount', type: 'uint128', internalType: 'uint128' },
          { name: 'hookData', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
      { name: 'gasEstimate', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract IPoolManager' },
    ],
    stateMutability: 'view',
  },
] as const;

export const lockableUniswapV3InitializerAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'airlock_', type: 'address', internalType: 'address' },
      {
        name: 'factory_',
        type: 'address',
        internalType: 'contract IUniswapV3Factory',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'airlock',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract Airlock' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [{ name: 'pool', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'fees0ToDistribute', type: 'uint256', internalType: 'uint256' },
      { name: 'fees1ToDistribute', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'exitLiquidity',
    inputs: [{ name: 'pool', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160', internalType: 'uint160' },
      { name: 'token0', type: 'address', internalType: 'address' },
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'balance0', type: 'uint128', internalType: 'uint128' },
      { name: 'token1', type: 'address', internalType: 'address' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
      { name: 'balance1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'factory',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract IUniswapV3Factory' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getState',
    inputs: [{ name: 'pool', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      { name: 'numeraire', type: 'address', internalType: 'address' },
      { name: 'tickLower', type: 'int24', internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', internalType: 'int24' },
      { name: 'maxShareToBeSold', type: 'uint256', internalType: 'uint256' },
      {
        name: 'totalTokensOnBondingCurve',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'status', type: 'uint8', internalType: 'enum PoolStatus' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      { name: 'numeraire', type: 'address', internalType: 'address' },
      {
        name: 'totalTokensOnBondingCurve',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: '', type: 'bytes32', internalType: 'bytes32' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: 'pool', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'uniswapV3MintCallback',
    inputs: [
      { name: 'amount0Owed', type: 'uint256', internalType: 'uint256' },
      { name: 'amount1Owed', type: 'uint256', internalType: 'uint256' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'encodePoolInitializerData',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'fee', type: 'uint24' },
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'numPositions', type: 'uint16' },
          { name: 'maxShareToBeSold', type: 'uint256' },
          {
            name: 'beneficiaries',
            type: 'tuple[]',
            components: [
              { name: 'beneficiary', type: 'address' },
              { name: 'shares', type: 'uint96' },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    name: 'Collect',
    inputs: [
      { name: 'pool', type: 'address', indexed: true, internalType: 'address' },
      {
        name: 'beneficiary',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'fees0',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'fees1',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Create',
    inputs: [
      {
        name: 'poolOrHook',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'asset',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'numeraire',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Lock',
    inputs: [
      { name: 'pool', type: 'address', indexed: true, internalType: 'address' },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        indexed: false,
        internalType: 'struct BeneficiaryData[]',
        components: [
          { name: 'beneficiary', type: 'address', internalType: 'address' },
          { name: 'shares', type: 'uint96', internalType: 'uint96' },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'CannotMigrateInsufficientTick',
    inputs: [
      { name: 'targetTick', type: 'int24', internalType: 'int24' },
      { name: 'currentTick', type: 'int24', internalType: 'int24' },
    ],
  },
  { type: 'error', name: 'CannotMintZeroLiquidity', inputs: [] },
  {
    type: 'error',
    name: 'InvalidFee',
    inputs: [{ name: 'fee', type: 'uint24', internalType: 'uint24' }],
  },
  {
    type: 'error',
    name: 'InvalidTickRange',
    inputs: [
      { name: 'tick', type: 'int24', internalType: 'int24' },
      { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
    ],
  },
  {
    type: 'error',
    name: 'InvalidTickRangeMisordered',
    inputs: [
      { name: 'tickLower', type: 'int24', internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', internalType: 'int24' },
    ],
  },
  {
    type: 'error',
    name: 'MaxShareToBeSoldExceeded',
    inputs: [
      { name: 'value', type: 'uint256', internalType: 'uint256' },
      { name: 'limit', type: 'uint256', internalType: 'uint256' },
    ],
  },
  { type: 'error', name: 'OnlyPool', inputs: [] },
  { type: 'error', name: 'PoolAlreadyExited', inputs: [] },
  { type: 'error', name: 'PoolAlreadyInitialized', inputs: [] },
  { type: 'error', name: 'PoolLocked', inputs: [] },
  { type: 'error', name: 'SenderNotAirlock', inputs: [] },
  { type: 'error', name: 'UnorderedBeneficiaries', inputs: [] },
  { type: 'error', name: 'InvalidShares', inputs: [] },
  { type: 'error', name: 'InvalidTotalShares', inputs: [] },
  { type: 'error', name: 'InvalidProtocolOwnerShares', inputs: [] },
  { type: 'error', name: 'InvalidProtocolOwnerBeneficiary', inputs: [] },
] as const;

export const v4MulticurveInitializerAbi = [
  {
    type: 'function',
    name: 'airlock',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract Airlock' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'HOOK',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IHooks' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getState',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'numeraire', type: 'address', internalType: 'address' },
      { name: 'status', type: 'uint8', internalType: 'enum PoolStatus' },
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      { name: 'farTick', type: 'int24', internalType: 'int24' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Collect',
    inputs: [
      { name: 'pool', type: 'address', indexed: true, internalType: 'address' },
      {
        name: 'beneficiary',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'fees0',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'fees1',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Create',
    inputs: [
      {
        name: 'poolOrHook',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'asset',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'numeraire',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Lock',
    inputs: [
      { name: 'pool', type: 'address', indexed: true, internalType: 'address' },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        indexed: false,
        internalType: 'struct BeneficiaryData[]',
        components: [
          { name: 'beneficiary', type: 'address', internalType: 'address' },
          { name: 'shares', type: 'uint96', internalType: 'uint96' },
        ],
      },
    ],
    anonymous: false,
  },
  { type: 'error', name: 'PoolLocked', inputs: [] },
  { type: 'error', name: 'PoolNotLocked', inputs: [] },
  { type: 'error', name: 'PoolAlreadyInitialized', inputs: [] },
  { type: 'error', name: 'PoolAlreadyExited', inputs: [] },
  {
    type: 'error',
    name: 'CannotMigrateInsufficientTick',
    inputs: [
      { name: 'targetTick', type: 'int24', internalType: 'int24' },
      { name: 'currentTick', type: 'int24', internalType: 'int24' },
    ],
  },
  { type: 'error', name: 'SenderNotAirlock', inputs: [] },
  { type: 'error', name: 'UnorderedBeneficiaries', inputs: [] },
  { type: 'error', name: 'InvalidShares', inputs: [] },
  { type: 'error', name: 'InvalidTotalShares', inputs: [] },
  { type: 'error', name: 'InvalidProtocolOwnerShares', inputs: [] },
  { type: 'error', name: 'InvalidProtocolOwnerBeneficiary', inputs: [] },
] as const;

export const dopplerHookInitializerAbi = [
  {
    type: 'function',
    name: 'airlock',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract Airlock' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getState',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'numeraire', type: 'address', internalType: 'address' },
      {
        name: 'totalTokensOnBondingCurve',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'dopplerHook', type: 'address', internalType: 'address' },
      {
        name: 'graduationDopplerHookCalldata',
        type: 'bytes',
        internalType: 'bytes',
      },
      { name: 'status', type: 'uint8', internalType: 'enum PoolStatus' },
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      { name: 'farTick', type: 'int24', internalType: 'int24' },
    ],
    stateMutability: 'view',
  },
] as const;

export const decayMulticurveInitializerHookAbi = [
  {
    type: 'function',
    name: 'getFeeScheduleOf',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'startingTime', type: 'uint32', internalType: 'uint32' },
      { name: 'startFee', type: 'uint24', internalType: 'uint24' },
      { name: 'endFee', type: 'uint24', internalType: 'uint24' },
      { name: 'lastFee', type: 'uint24', internalType: 'uint24' },
      { name: 'durationSeconds', type: 'uint32', internalType: 'uint32' },
    ],
    stateMutability: 'view',
  },
] as const;

export const streamableFeesLockerAbi = [
  {
    type: 'function',
    name: 'collectFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'streams',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      { name: 'recipient', type: 'address', internalType: 'address' },
      { name: 'startDate', type: 'uint32', internalType: 'uint32' },
      { name: 'lockDuration', type: 'uint32', internalType: 'uint32' },
      { name: 'isUnlocked', type: 'bool', internalType: 'bool' },
    ],
    stateMutability: 'view',
  },
  // StreamableFeesLocker errors
  { type: 'error', name: 'NonPositionManager', inputs: [] },
  { type: 'error', name: 'NotApprovedMigrator', inputs: [] },
  { type: 'error', name: 'PositionNotFound', inputs: [] },
  { type: 'error', name: 'PositionAlreadyUnlocked', inputs: [] },
  { type: 'error', name: 'InvalidBeneficiary', inputs: [] },
] as const;

export const streamableFeesLockerV2Abi = [
  {
    type: 'function',
    name: 'approvedMigrators',
    inputs: [{ name: 'migrator', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'approved', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getCumulatedFees0',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'cumulatedFees0', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCumulatedFees1',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'cumulatedFees1', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPoolKey',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'currency0', type: 'address', internalType: 'Currency' },
      { name: 'currency1', type: 'address', internalType: 'Currency' },
      { name: 'fee', type: 'uint24', internalType: 'uint24' },
      { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
      { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getShares',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'beneficiary', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'streams',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          {
            name: 'hooks',
            type: 'address',
            internalType: 'contract IHooks',
          },
        ],
      },
      { name: 'recipient', type: 'address', internalType: 'address' },
      { name: 'startDate', type: 'uint32', internalType: 'uint32' },
      { name: 'lockDuration', type: 'uint32', internalType: 'uint32' },
      { name: 'isUnlocked', type: 'bool', internalType: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'unlock',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateBeneficiary',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'newBeneficiary', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Collect',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'fees0',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'fees1',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Unlock',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  { type: 'error', name: 'CallerNotRecipient', inputs: [] },
  { type: 'error', name: 'LockNotExpired', inputs: [] },
  { type: 'error', name: 'StreamAlreadyUnlocked', inputs: [] },
  { type: 'error', name: 'StreamNotFound', inputs: [] },
] as const;

export const v4MulticurveMigratorAbi = [
  {
    type: 'function',
    name: 'getAssetData',
    inputs: [
      { name: 'token0', type: 'address', internalType: 'address' },
      { name: 'token1', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: 'isToken0', type: 'bool', internalType: 'bool' },
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      { name: 'lockDuration', type: 'uint32', internalType: 'uint32' },
      {
        name: 'curves',
        type: 'tuple[]',
        internalType: 'struct Curve[]',
        components: [
          { name: 'tickLower', type: 'int24', internalType: 'int24' },
          { name: 'tickUpper', type: 'int24', internalType: 'int24' },
          { name: 'numPositions', type: 'uint16', internalType: 'uint16' },
          { name: 'shares', type: 'uint256', internalType: 'uint256' },
        ],
      },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        internalType: 'struct BeneficiaryData[]',
        components: [
          { name: 'beneficiary', type: 'address', internalType: 'address' },
          { name: 'shares', type: 'uint96', internalType: 'uint96' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'locker',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract StreamableFeesLockerV2',
      },
    ],
    stateMutability: 'view',
  },
  // V4 Multicurve Migrator errors
  { type: 'error', name: 'PoolNotInitialized', inputs: [] },
] as const;

export const dopplerLensAbi = [
  {
    type: 'function',
    name: 'quoteDopplerLensData',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IV4Quoter.QuoteExactSingleParams',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            internalType: 'struct PoolKey',
            components: [
              { name: 'currency0', type: 'address', internalType: 'Currency' },
              { name: 'currency1', type: 'address', internalType: 'Currency' },
              { name: 'fee', type: 'uint24', internalType: 'uint24' },
              { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
              {
                name: 'hooks',
                type: 'address',
                internalType: 'contract IHooks',
              },
            ],
          },
          { name: 'zeroForOne', type: 'bool', internalType: 'bool' },
          { name: 'exactAmount', type: 'uint128', internalType: 'uint128' },
          { name: 'hookData', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple',
        internalType: 'struct DopplerLensReturnData',
        components: [
          { name: 'sqrtPriceX96', type: 'uint160', internalType: 'uint160' },
          { name: 'amount0', type: 'uint256', internalType: 'uint256' },
          { name: 'amount1', type: 'uint256', internalType: 'uint256' },
          { name: 'tick', type: 'int24', internalType: 'int24' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
] as const;

const bundlerCreateParamsComponents = [
  { name: 'initialSupply', type: 'uint256', internalType: 'uint256' },
  { name: 'numTokensToSell', type: 'uint256', internalType: 'uint256' },
  { name: 'numeraire', type: 'address', internalType: 'address' },
  {
    name: 'tokenFactory',
    type: 'address',
    internalType: 'contract ITokenFactory',
  },
  { name: 'tokenFactoryData', type: 'bytes', internalType: 'bytes' },
  {
    name: 'governanceFactory',
    type: 'address',
    internalType: 'contract IGovernanceFactory',
  },
  {
    name: 'governanceFactoryData',
    type: 'bytes',
    internalType: 'bytes',
  },
  {
    name: 'poolInitializer',
    type: 'address',
    internalType: 'contract IPoolInitializer',
  },
  { name: 'poolInitializerData', type: 'bytes', internalType: 'bytes' },
  {
    name: 'liquidityMigrator',
    type: 'address',
    internalType: 'contract ILiquidityMigrator',
  },
  {
    name: 'liquidityMigratorData',
    type: 'bytes',
    internalType: 'bytes',
  },
  { name: 'integrator', type: 'address', internalType: 'address' },
  { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
] as const;

const bundlerPoolKeyComponents = [
  { name: 'currency0', type: 'address', internalType: 'Currency' },
  { name: 'currency1', type: 'address', internalType: 'Currency' },
  { name: 'fee', type: 'uint24', internalType: 'uint24' },
  { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
  { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
] as const;

export const bundlerAbi = [
  {
    type: 'function',
    name: 'airlock',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract Airlock' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPoolManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingOf',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'recipient', type: 'address', internalType: 'address' },
      { name: 'permissionlessClaim', type: 'bool', internalType: 'bool' },
      { name: 'start', type: 'uint64', internalType: 'uint64' },
      { name: 'cliffDuration', type: 'uint64', internalType: 'uint64' },
      { name: 'vestingDuration', type: 'uint64', internalType: 'uint64' },
      { name: 'totalAmount', type: 'uint128', internalType: 'uint128' },
      { name: 'claimedAmount', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimable',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'bundle',
    inputs: [
      {
        name: 'createData',
        type: 'tuple',
        internalType: 'struct CreateParams',
        components: bundlerCreateParamsComponents,
      },
      {
        name: 'vestingData',
        type: 'tuple',
        internalType: 'struct Bundler.VestingParams',
        components: [
          {
            name: 'permissionlessClaim',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'vestingDuration',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'cliffDuration',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
      },
      { name: 'exactAmountIn', type: 'uint128', internalType: 'uint128' },
      { name: 'recipient', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: bundlerPoolKeyComponents,
      },
      { name: 'governance', type: 'address', internalType: 'address' },
      { name: 'timelock', type: 'address', internalType: 'address' },
      { name: 'amountOut', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'simulateBundle',
    inputs: [
      {
        name: 'createData',
        type: 'tuple',
        internalType: 'struct CreateParams',
        components: bundlerCreateParamsComponents,
      },
      { name: 'exactAmountIn', type: 'uint128', internalType: 'uint128' },
    ],
    outputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: bundlerPoolKeyComponents,
      },
      { name: 'governance', type: 'address', internalType: 'address' },
      { name: 'timelock', type: 'address', internalType: 'address' },
      { name: 'amountOut', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: '_simulateBundle',
    inputs: [
      {
        name: 'createData',
        type: 'tuple',
        internalType: 'struct CreateParams',
        components: bundlerCreateParamsComponents,
      },
      { name: 'exactAmountIn', type: 'uint128', internalType: 'uint128' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unlockCallback',
    inputs: [{ name: 'data', type: 'bytes', internalType: 'bytes' }],
    outputs: [{ name: '', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Bundled',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amountIn',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'amountOut',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'poolKey',
        type: 'tuple',
        indexed: false,
        internalType: 'struct PoolKey',
        components: bundlerPoolKeyComponents,
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VestingCreated',
    inputs: [
      {
        name: 'asset',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'permissionlessClaim',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'totalAmount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'start',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'cliffDuration',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'vestingDuration',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VestingReleased',
    inputs: [
      {
        name: 'asset',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'BundleQuote',
    inputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: bundlerPoolKeyComponents,
      },
      { name: 'governance', type: 'address', internalType: 'address' },
      { name: 'timelock', type: 'address', internalType: 'address' },
      { name: 'amountOut', type: 'uint128', internalType: 'uint128' },
    ],
  },
  {
    type: 'error',
    name: 'ExactInputNotFullySpent',
    inputs: [
      { name: 'expected', type: 'uint256', internalType: 'uint256' },
      { name: 'actual', type: 'uint256', internalType: 'uint256' },
    ],
  },
  { type: 'error', name: 'ExactInputAmountZero', inputs: [] },
  { type: 'error', name: 'InvalidAddress', inputs: [] },
  { type: 'error', name: 'InvalidNativeValue', inputs: [] },
  { type: 'error', name: 'InvalidPool', inputs: [] },
  { type: 'error', name: 'InvalidRecipient', inputs: [] },
  { type: 'error', name: 'InvalidVestingSchedule', inputs: [] },
  { type: 'error', name: 'NoClaimableAmount', inputs: [] },
  { type: 'error', name: 'SenderNotPoolManager', inputs: [] },
  { type: 'error', name: 'SenderNotRecipient', inputs: [] },
  { type: 'error', name: 'SenderNotSelf', inputs: [] },
  {
    type: 'error',
    name: 'SwapQuote',
    inputs: [{ name: 'amountOut', type: 'uint128', internalType: 'uint128' }],
  },
  { type: 'error', name: 'UnexpectedSimulationSuccess', inputs: [] },
  {
    type: 'error',
    name: 'VestingAlreadyExists',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
  },
] as const;

export const poolManagerAbi = [
  {
    type: 'function',
    name: 'swap',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IPoolManager.SwapParams',
        components: [
          { name: 'zeroForOne', type: 'bool', internalType: 'bool' },
          { name: 'amountSpecified', type: 'int256', internalType: 'int256' },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      { name: 'hookData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [
      { name: 'swapDelta', type: 'int256', internalType: 'BalanceDelta' },
    ],
    stateMutability: 'nonpayable',
  },
] as const;

export const weth9Abi = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: 'wad', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const rehypeDopplerHookInitializerAbi = [
  ...feesManagerAbi,
  {
    type: 'function',
    name: 'INITIALIZER',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimAirlockOwnerFees',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'collectFees',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'fees', type: 'int256', internalType: 'BalanceDelta' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getFeeDistributionInfo',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      {
        name: 'assetFeesToAssetBuybackWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'assetFeesToNumeraireBuybackWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'assetFeesToBeneficiaryWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'assetFeesToLpWad', type: 'uint256', internalType: 'uint256' },
      {
        name: 'numeraireFeesToAssetBuybackWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'numeraireFeesToNumeraireBuybackWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'numeraireFeesToBeneficiaryWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'numeraireFeesToLpWad',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeeRoutingMode',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [{ name: '', type: 'uint8', internalType: 'enum FeeRoutingMode' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeeSchedule',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'startingTime', type: 'uint32', internalType: 'uint32' },
      { name: 'startFee', type: 'uint24', internalType: 'uint24' },
      { name: 'endFee', type: 'uint24', internalType: 'uint24' },
      { name: 'lastFee', type: 'uint24', internalType: 'uint24' },
      { name: 'durationSeconds', type: 'uint32', internalType: 'uint32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getIntegratorFeeShare',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [{ name: '', type: 'uint24', internalType: 'uint24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getIntegratorRoutingConfig',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'integrator', type: 'address', internalType: 'address' },
      {
        name: 'assetFeesToNumeraireRatio',
        type: 'uint32',
        internalType: 'uint32',
      },
      {
        name: 'numeraireFeesToAssetRatio',
        type: 'uint32',
        internalType: 'uint32',
      },
      { name: 'automaticPayout', type: 'bool', internalType: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPendingIntegratorFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getClaimableIntegratorFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimIntegratorFees',
    inputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      { name: 'to', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getHookFees',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'fees0', type: 'uint128', internalType: 'uint128' },
      { name: 'fees1', type: 'uint128', internalType: 'uint128' },
      { name: 'beneficiaryFees0', type: 'uint128', internalType: 'uint128' },
      { name: 'beneficiaryFees1', type: 'uint128', internalType: 'uint128' },
      { name: 'airlockOwnerFees0', type: 'uint128', internalType: 'uint128' },
      { name: 'airlockOwnerFees1', type: 'uint128', internalType: 'uint128' },
      { name: 'customFee', type: 'uint24', internalType: 'uint24' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPoolInfo',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
      { name: 'numeraire', type: 'address', internalType: 'address' },
      { name: 'buybackDst', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPosition',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'tickLower', type: 'int24', internalType: 'int24' },
      { name: 'tickUpper', type: 'int24', internalType: 'int24' },
      { name: 'liquidity', type: 'uint128', internalType: 'uint128' },
      { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [
      { name: '', type: 'address', internalType: 'contract IPoolManager' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bundler',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quoter',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract Quoter' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AirlockOwnerFeesClaimed',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'airlockOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'fees0',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'fees1',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeeBeneficiariesSet',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        indexed: false,
        internalType: 'struct BeneficiaryData[]',
        components: [
          {
            name: 'beneficiary',
            type: 'address',
            internalType: 'address',
          },
          { name: 'shares', type: 'uint96', internalType: 'uint96' },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeeScheduleSet',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'startingTime',
        type: 'uint32',
        indexed: false,
        internalType: 'uint32',
      },
      {
        name: 'startFee',
        type: 'uint24',
        indexed: false,
        internalType: 'uint24',
      },
      {
        name: 'endFee',
        type: 'uint24',
        indexed: false,
        internalType: 'uint24',
      },
      {
        name: 'durationSeconds',
        type: 'uint32',
        indexed: false,
        internalType: 'uint32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeeUpdated',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'fee',
        type: 'uint24',
        indexed: false,
        internalType: 'uint24',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntegratorAutomaticPayoutSet',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'automaticPayout',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntegratorConversionRatiosSet',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'assetFeesToNumeraireRatio',
        type: 'uint32',
        indexed: false,
        internalType: 'uint32',
      },
      {
        name: 'numeraireFeesToAssetRatio',
        type: 'uint32',
        indexed: false,
        internalType: 'uint32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntegratorFeeShareSet',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'feeShare',
        type: 'uint24',
        indexed: false,
        internalType: 'uint24',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntegratorFeesClaimed',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'integrator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'fees0',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'fees1',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'IntegratorSet',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'oldIntegrator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newIntegrator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'setIntegratorConversionRatios',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      {
        name: 'assetFeesToNumeraireRatio',
        type: 'uint32',
        internalType: 'uint32',
      },
      {
        name: 'numeraireFeesToAssetRatio',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setIntegratorAutomaticPayout',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'automaticPayout', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setIntegrator',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'newIntegrator', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setFeeDistribution',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      {
        name: 'assetFeesToAssetBuybackWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'assetFeesToNumeraireBuybackWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'assetFeesToBeneficiaryWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'assetFeesToLpWad', type: 'uint256', internalType: 'uint256' },
      {
        name: 'numeraireFeesToAssetBuybackWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'numeraireFeesToNumeraireBuybackWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'numeraireFeesToBeneficiaryWad',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'numeraireFeesToLpWad',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'error', name: 'InvalidIntegrator', inputs: [] },
  { type: 'error', name: 'InvalidIntegratorClaimDestination', inputs: [] },
  { type: 'error', name: 'InvalidIntegratorConversionRatio', inputs: [] },
  { type: 'error', name: 'SenderNotIntegrator', inputs: [] },
  { type: 'error', name: 'FeeBeneficiariesNotConfigured', inputs: [] },
  {
    type: 'error',
    name: 'FeeBeneficiariesNotSupportedInDirectBuyback',
    inputs: [],
  },
  { type: 'error', name: 'FeeDistributionMustAddUpToWAD', inputs: [] },
  { type: 'error', name: 'SenderNotAuthorized', inputs: [] },
  {
    type: 'error',
    name: 'FeeTooHigh',
    inputs: [{ name: 'fee', type: 'uint24', internalType: 'uint24' }],
  },
  { type: 'error', name: 'InsufficientFeeCurrency', inputs: [] },
  {
    type: 'error',
    name: 'InvalidDurationSeconds',
    inputs: [
      {
        name: 'durationSeconds',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidFeeRange',
    inputs: [
      { name: 'startFee', type: 'uint24', internalType: 'uint24' },
      { name: 'endFee', type: 'uint24', internalType: 'uint24' },
    ],
  },
  { type: 'error', name: 'InvalidProtocolOwnerBeneficiary', inputs: [] },
  {
    type: 'error',
    name: 'InvalidProtocolOwnerShares',
    inputs: [
      { name: 'required', type: 'uint96', internalType: 'uint96' },
      { name: 'provided', type: 'uint96', internalType: 'uint96' },
    ],
  },
  { type: 'error', name: 'InvalidShares', inputs: [] },
  { type: 'error', name: 'InvalidTotalShares', inputs: [] },
  { type: 'error', name: 'PoolAlreadyInitialized', inputs: [] },
  { type: 'error', name: 'Reentrancy', inputs: [] },
  { type: 'error', name: 'SenderNotAirlockOwner', inputs: [] },
  { type: 'error', name: 'SenderNotInitializer', inputs: [] },
  { type: 'error', name: 'UnorderedBeneficiaries', inputs: [] },
] as const;

/** @deprecated Use rehypeDopplerHookInitializerAbi instead. */
export const rehypeDopplerHookAbi = rehypeDopplerHookInitializerAbi;

export const dopplerHookMigratorAbi = [
  {
    type: 'function',
    name: 'claimMigrationRefund',
    inputs: [
      { name: 'poolId', type: 'bytes32', internalType: 'PoolId' },
      { name: 'to', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAssetData',
    inputs: [
      { name: 'token0', type: 'address', internalType: 'address' },
      { name: 'token1', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: 'isToken0', type: 'bool', internalType: 'bool' },
      {
        name: 'poolKey',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          {
            name: 'hooks',
            type: 'address',
            internalType: 'contract IHooks',
          },
        ],
      },
      { name: 'lockDuration', type: 'uint32', internalType: 'uint32' },
      {
        name: 'feeOrInitialDynamicFee',
        type: 'uint24',
        internalType: 'uint24',
      },
      { name: 'useDynamicFee', type: 'bool', internalType: 'bool' },
      { name: 'dopplerHook', type: 'address', internalType: 'address' },
      {
        name: 'onInitializationCalldata',
        type: 'bytes',
        internalType: 'bytes',
      },
      { name: 'status', type: 'uint8', internalType: 'enum PoolStatus' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMigrationRefund',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'recipient', type: 'address', internalType: 'address' },
      { name: 'currency0', type: 'address', internalType: 'Currency' },
      { name: 'currency1', type: 'address', internalType: 'Currency' },
      { name: 'amount0', type: 'uint256', internalType: 'uint256' },
      { name: 'amount1', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPair',
    inputs: [{ name: 'asset', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'token0', type: 'address', internalType: 'address' },
      { name: 'token1', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTotalClaimableMigrationRefund',
    inputs: [{ name: 'currency', type: 'address', internalType: 'Currency' }],
    outputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'locker',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract StreamableFeesLockerV2',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'MigrationRefundClaimed',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'to',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount0',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'amount1',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MigrationRefundRecorded',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount0',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'amount1',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  { type: 'error', name: 'CallerNotRefundRecipient', inputs: [] },
  { type: 'error', name: 'InvalidRefundDestination', inputs: [] },
  { type: 'error', name: 'NoMigrationRefund', inputs: [] },
] as const;

// Export bytecodes for CREATE2 address calculation
export {
  DERC20Bytecode,
  DERC2080Bytecode,
  DopplerBytecode,
  DopplerDN404Bytecode,
  DopplerDN404BaseSepoliaBytecode,
  OpeningAuctionBytecode,
  StateViewBytecode,
} from './bytecodes';
