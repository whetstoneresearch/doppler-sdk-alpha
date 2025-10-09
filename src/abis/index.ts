// Core contract ABIs needed for static and dynamic auctions

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
] as const

export const uniswapV3InitializerAbi = [
  {
    type: "function",
    name: "encodePoolInitializerData",
    inputs: [
      { name: "params", type: "tuple", 
        components: [
          { name: "numTokensToSell", type: "uint256" },
          { name: "startTick", type: "int24" },
          { name: "endTick", type: "int24" },
          { name: "fee", type: "uint24" }
        ]
      }
    ],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "pure",
  },
] as const

export const v2MigratorAbi = [
  {
    type: "function",
    name: "encodeLiquidityMigratorData",
    inputs: [],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "pure",
  },
] as const

export const v3MigratorAbi = [
  {
    type: "function",
    name: "encodeLiquidityMigratorData",
    inputs: [
      { name: "fee", type: "uint24" },
      { name: "tickSpacing", type: "int24" }
    ],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "pure",
  },
] as const

export const v4MigratorAbi = [
  {
    type: "function",
    name: "encodeLiquidityMigratorData",
    inputs: [
      { name: "fee", type: "uint24" },
      { name: "tickSpacing", type: "int24" },
      { name: "lockDuration", type: "uint256" },
      { name: "beneficiaries", type: "address[]" },
      { name: "percentages", type: "uint256[]" }
    ],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "pure",
  },
] as const

export const uniswapV3PoolAbi = [
  {
    type: "function",
    name: "slot0",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" }
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "liquidity",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token0",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token1",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "fee",
    inputs: [],
    outputs: [{ name: "", type: "uint24" }],
    stateMutability: "view",
  },
] as const

export const derc20Abi = [
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  // OpenZeppelin Votes (governance) — delegation + queries
  {
    type: "function",
    name: "delegate",
    inputs: [
      { name: "delegatee", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "delegateBySig",
    inputs: [
      { name: "delegatee", type: "address", internalType: "address" },
      { name: "nonce", type: "uint256", internalType: "uint256" },
      { name: "expiry", type: "uint256", internalType: "uint256" },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "delegates",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "", type: "address", internalType: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVotes",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPastVotes",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "timepoint", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPastTotalSupply",
    inputs: [
      { name: "timepoint", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nonces",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
    ],
    outputs: [
      { name: "", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    inputs: [],
    outputs: [
      { name: "", type: "bytes32", internalType: "bytes32" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: 'function',
    name: 'computeAvailableVestedAmount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: "function",
    name: "currentYearStart",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVestingDataOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [
      { name: "totalAmount", type: "uint256", internalType: "uint256" },
      { name: "releasedAmount", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isPoolUnlocked",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastMintTimestamp",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pool",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "release",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address", internalType: "address" },
      { name: "to", type: "address", internalType: "address" },
      { name: "value", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "vestedTotalAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vestingDuration",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vestingStart",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "yearlyMintRate",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const

export const uniswapV4InitializerAbi = [
  {
    type: "function",
    name: "encodePoolInitializerData",
    inputs: [
      { name: "params", type: "tuple", 
        components: [
          { name: "minimumProceeds", type: "uint256" },
          { name: "maximumProceeds", type: "uint256" },
          { name: "startingTime", type: "uint256" },
          { name: "endingTime", type: "uint256" },
          { name: "startingTick", type: "int24" },
          { name: "endingTick", type: "int24" },
          { name: "epochLength", type: "uint256" },
          { name: "gamma", type: "int24" },
          { name: "isToken0", type: "bool" },
          { name: "numPDSlugs", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" }
        ]
      }
    ],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "pure",
  },
] as const

export const dopplerHookAbi = [
  {
    type: "function",
    name: "state",
    inputs: [],
    outputs: [
      { name: "lastEpoch", type: "uint40" },
      { name: "tickAccumulator", type: "int256" },
      { name: "totalTokensSold", type: "uint256" },
      { name: "totalProceeds", type: "uint256" },
      { name: "totalTokensSoldLastEpoch", type: "uint256" },
      // BalanceDelta is encoded as a single int256 in the compiled ABI.
      { name: "feesAccrued", type: "int256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "earlyExit",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "insufficientProceeds",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "poolKey",
    inputs: [],
    outputs: [
      { name: "currency0", type: "address" },
      { name: "currency1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickSpacing", type: "int24" },
      { name: "hooks", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "startingTime",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "endingTime",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "epochLength",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "minimumProceeds",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maximumProceeds",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "numTokensToSell",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "startingTick",
    inputs: [],
    outputs: [{ name: "", type: "int24" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "endingTick",
    inputs: [],
    outputs: [{ name: "", type: "int24" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "gamma",
    inputs: [],
    outputs: [{ name: "", type: "int24" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isToken0",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "numPDSlugs",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const

export const quoterV2Abi = [
  {
    inputs: [
      { internalType: "address", name: "_factory", type: "address" },
      { internalType: "address", name: "_WETH9", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "WETH9",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "factory",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes", name: "path", type: "bytes" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
    ],
    name: "quoteExactInput",
    outputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      {
        internalType: "uint160[]",
        name: "sqrtPriceX96AfterList",
        type: "uint160[]",
      },
      {
        internalType: "uint32[]",
        name: "initializedTicksCrossedList",
        type: "uint32[]",
      },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "tokenIn", type: "address" },
          { internalType: "address", name: "tokenOut", type: "address" },
          { internalType: "uint256", name: "amountIn", type: "uint256" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          {
            internalType: "uint160",
            name: "sqrtPriceLimitX96",
            type: "uint160",
          },
        ],
        internalType: "struct IQuoterV2.QuoteExactInputSingleParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactInputSingle",
    outputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "uint160", name: "sqrtPriceX96After", type: "uint160" },
      {
        internalType: "uint32",
        name: "initializedTicksCrossed",
        type: "uint32",
      },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes", name: "path", type: "bytes" },
      { internalType: "uint256", name: "amountOut", type: "uint256" },
    ],
    name: "quoteExactOutput",
    outputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      {
        internalType: "uint160[]",
        name: "sqrtPriceX96AfterList",
        type: "uint160[]",
      },
      {
        internalType: "uint32[]",
        name: "initializedTicksCrossedList",
        type: "uint32[]",
      },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "tokenIn", type: "address" },
          { internalType: "address", name: "tokenOut", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          {
            internalType: "uint160",
            name: "sqrtPriceLimitX96",
            type: "uint160",
          },
        ],
        internalType: "struct IQuoterV2.QuoteExactOutputSingleParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "quoteExactOutputSingle",
    outputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint160", name: "sqrtPriceX96After", type: "uint160" },
      {
        internalType: "uint32",
        name: "initializedTicksCrossed",
        type: "uint32",
      },
      { internalType: "uint256", name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "int256", name: "amount0Delta", type: "int256" },
      { internalType: "int256", name: "amount1Delta", type: "int256" },
      { internalType: "bytes", name: "_data", type: "bytes" },
    ],
    name: "uniswapV3SwapCallback",
    outputs: [],
    stateMutability: "view",
    type: "function",
  },
] as const

export const uniswapV2Router02Abi = [
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountOut", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
    ],
    name: "getAmountsIn",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const

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
] as const

export const lockableUniswapV3InitializerAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'airlock_', type: 'address', internalType: 'address' },
      { name: 'factory_', type: 'address', internalType: 'contract IUniswapV3Factory' },
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
    outputs: [{ name: '', type: 'address', internalType: 'contract IUniswapV3Factory' }],
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
      { name: 'totalTokensOnBondingCurve', type: 'uint256', internalType: 'uint256' },
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
      { name: 'totalTokensOnBondingCurve', type: 'uint256', internalType: 'uint256' },
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
      { name: 'beneficiary', type: 'address', indexed: true, internalType: 'address' },
      { name: 'fees0', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'fees1', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Create',
    inputs: [
      { name: 'poolOrHook', type: 'address', indexed: true, internalType: 'address' },
      { name: 'asset', type: 'address', indexed: true, internalType: 'address' },
      { name: 'numeraire', type: 'address', indexed: true, internalType: 'address' },
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
] as const

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
      { name: 'beneficiary', type: 'address', indexed: true, internalType: 'address' },
      { name: 'fees0', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'fees1', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Create',
    inputs: [
      { name: 'poolOrHook', type: 'address', indexed: true, internalType: 'address' },
      { name: 'asset', type: 'address', indexed: true, internalType: 'address' },
      { name: 'numeraire', type: 'address', indexed: true, internalType: 'address' },
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
  { type: 'error', name: 'SenderNotAirlock', inputs: [] },
  { type: 'error', name: 'UnorderedBeneficiaries', inputs: [] },
  { type: 'error', name: 'InvalidShares', inputs: [] },
  { type: 'error', name: 'InvalidTotalShares', inputs: [] },
  { type: 'error', name: 'InvalidProtocolOwnerShares', inputs: [] },
  { type: 'error', name: 'InvalidProtocolOwnerBeneficiary', inputs: [] },
] as const

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
] as const

// Minimal Bundler ABI used for atomic create + swap flows ("bundle")
// Matches the V3 Bundler contract interface used in prior SDKs
export const bundlerAbi = [
  {
    type: 'function',
    name: 'bundle',
    inputs: [
      {
        name: 'createData',
        type: 'tuple',
        internalType: 'struct CreateParams',
        components: [
          { name: 'initialSupply', type: 'uint256', internalType: 'uint256' },
          { name: 'numTokensToSell', type: 'uint256', internalType: 'uint256' },
          { name: 'numeraire', type: 'address', internalType: 'address' },
          { name: 'tokenFactory', type: 'address', internalType: 'contract ITokenFactory' },
          { name: 'tokenFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'governanceFactory', type: 'address', internalType: 'contract IGovernanceFactory' },
          { name: 'governanceFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'poolInitializer', type: 'address', internalType: 'contract IPoolInitializer' },
          { name: 'poolInitializerData', type: 'bytes', internalType: 'bytes' },
          { name: 'liquidityMigrator', type: 'address', internalType: 'contract ILiquidityMigrator' },
          { name: 'liquidityMigratorData', type: 'bytes', internalType: 'bytes' },
          { name: 'integrator', type: 'address', internalType: 'address' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
      { name: 'commands', type: 'bytes', internalType: 'bytes' },
      { name: 'inputs', type: 'bytes[]', internalType: 'bytes[]' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'simulateBundleExactIn',
    inputs: [
      {
        name: 'createData',
        type: 'tuple',
        internalType: 'struct CreateParams',
        components: [
          { name: 'initialSupply', type: 'uint256', internalType: 'uint256' },
          { name: 'numTokensToSell', type: 'uint256', internalType: 'uint256' },
          { name: 'numeraire', type: 'address', internalType: 'address' },
          { name: 'tokenFactory', type: 'address', internalType: 'contract ITokenFactory' },
          { name: 'tokenFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'governanceFactory', type: 'address', internalType: 'contract IGovernanceFactory' },
          { name: 'governanceFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'poolInitializer', type: 'address', internalType: 'contract IPoolInitializer' },
          { name: 'poolInitializerData', type: 'bytes', internalType: 'bytes' },
          { name: 'liquidityMigrator', type: 'address', internalType: 'contract ILiquidityMigrator' },
          { name: 'liquidityMigratorData', type: 'bytes', internalType: 'bytes' },
          { name: 'integrator', type: 'address', internalType: 'address' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IQuoterV2.QuoteExactInputSingleParams',
        components: [
          { name: 'tokenIn', type: 'address', internalType: 'address' },
          { name: 'tokenOut', type: 'address', internalType: 'address' },
          { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160', internalType: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'simulateBundleExactOut',
    inputs: [
      {
        name: 'createData',
        type: 'tuple',
        internalType: 'struct CreateParams',
        components: [
          { name: 'initialSupply', type: 'uint256', internalType: 'uint256' },
          { name: 'numTokensToSell', type: 'uint256', internalType: 'uint256' },
          { name: 'numeraire', type: 'address', internalType: 'address' },
          { name: 'tokenFactory', type: 'address', internalType: 'contract ITokenFactory' },
          { name: 'tokenFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'governanceFactory', type: 'address', internalType: 'contract IGovernanceFactory' },
          { name: 'governanceFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'poolInitializer', type: 'address', internalType: 'contract IPoolInitializer' },
          { name: 'poolInitializerData', type: 'bytes', internalType: 'bytes' },
          { name: 'liquidityMigrator', type: 'address', internalType: 'contract ILiquidityMigrator' },
          { name: 'liquidityMigratorData', type: 'bytes', internalType: 'bytes' },
          { name: 'integrator', type: 'address', internalType: 'address' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IQuoterV2.QuoteExactOutputSingleParams',
        components: [
          { name: 'tokenIn', type: 'address', internalType: 'address' },
          { name: 'tokenOut', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160', internalType: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountIn', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'simulateMulticurveBundleExactOut',
    inputs: [
      {
        name: 'createData',
        type: 'tuple',
        internalType: 'struct CreateParams',
        components: [
          { name: 'initialSupply', type: 'uint256', internalType: 'uint256' },
          { name: 'numTokensToSell', type: 'uint256', internalType: 'uint256' },
          { name: 'numeraire', type: 'address', internalType: 'address' },
          { name: 'tokenFactory', type: 'address', internalType: 'contract ITokenFactory' },
          { name: 'tokenFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'governanceFactory', type: 'address', internalType: 'contract IGovernanceFactory' },
          { name: 'governanceFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'poolInitializer', type: 'address', internalType: 'contract IPoolInitializer' },
          { name: 'poolInitializerData', type: 'bytes', internalType: 'bytes' },
          { name: 'liquidityMigrator', type: 'address', internalType: 'contract ILiquidityMigrator' },
          { name: 'liquidityMigratorData', type: 'bytes', internalType: 'bytes' },
          { name: 'integrator', type: 'address', internalType: 'address' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
      { name: 'exactAmountOut', type: 'uint128', internalType: 'uint128' },
      { name: 'hookData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
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
      { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
      { name: 'gasEstimate', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'simulateMulticurveBundleExactIn',
    inputs: [
      {
        name: 'createData',
        type: 'tuple',
        internalType: 'struct CreateParams',
        components: [
          { name: 'initialSupply', type: 'uint256', internalType: 'uint256' },
          { name: 'numTokensToSell', type: 'uint256', internalType: 'uint256' },
          { name: 'numeraire', type: 'address', internalType: 'address' },
          { name: 'tokenFactory', type: 'address', internalType: 'contract ITokenFactory' },
          { name: 'tokenFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'governanceFactory', type: 'address', internalType: 'contract IGovernanceFactory' },
          { name: 'governanceFactoryData', type: 'bytes', internalType: 'bytes' },
          { name: 'poolInitializer', type: 'address', internalType: 'contract IPoolInitializer' },
          { name: 'poolInitializerData', type: 'bytes', internalType: 'bytes' },
          { name: 'liquidityMigrator', type: 'address', internalType: 'contract ILiquidityMigrator' },
          { name: 'liquidityMigratorData', type: 'bytes', internalType: 'bytes' },
          { name: 'integrator', type: 'address', internalType: 'address' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
      { name: 'exactAmountIn', type: 'uint128', internalType: 'uint128' },
      { name: 'hookData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [
      { name: 'asset', type: 'address', internalType: 'address' },
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
      { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
      { name: 'gasEstimate', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'error', name: 'InvalidAddresses', inputs: [] },
  { type: 'error', name: 'InvalidBundleData', inputs: [] },
  { type: 'error', name: 'InvalidOutputToken', inputs: [] },
] as const

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
          { name: 'sqrtPriceLimitX96', type: 'uint160', internalType: 'uint160' },
        ],
      },
      { name: 'hookData', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [
      { name: 'swapDelta', type: 'int256', internalType: 'BalanceDelta' },
    ],
    stateMutability: 'nonpayable',
  },
] as const

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
] as const

// Export bytecodes for CREATE2 address calculation
export { DERC20Bytecode, DopplerBytecode, DopplerDN404Bytecode } from './bytecodes'
