// Core contract ABIs needed for static and dynamic auctions

export const airlockAbi = [
  {
    type: "event",
    name: "Create",
    inputs: [
      { name: "poolOrHook", type: "address", indexed: true, internalType: "address" },
      { name: "asset", type: "address", indexed: true, internalType: "address" },
      { name: "numeraire", type: "address", indexed: true, internalType: "address" },
      { name: "integrator", type: "address", indexed: false, internalType: "address" },
      { name: "poolInitializer", type: "address", indexed: false, internalType: "address" },
      { name: "liquidityMigrator", type: "address", indexed: false, internalType: "address" },
      { name: "governance", type: "address", indexed: false, internalType: "address" }
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "getAssetData",
    inputs: [
      { name: "asset", type: "address", internalType: "address" }
    ],
    outputs: [
      { 
        name: "assetData", 
        type: "tuple", 
        internalType: "struct IAirlock.AssetData",
        components: [
          { name: "poolOrHook", type: "address", internalType: "address" },
          { name: "governor", type: "address", internalType: "address" },
          { name: "liquidityMigrator", type: "address", internalType: "address" },
          { name: "numeraire", type: "address", internalType: "address" },
          { name: "totalSales", type: "uint256", internalType: "uint256" },
          { name: "totalProceeds", type: "uint256", internalType: "uint256" },
          { name: "deploymentTime", type: "uint256", internalType: "uint256" }
        ]
      }
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "create",
    inputs: [
      { name: "tokenParams", type: "tuple", internalType: "struct ITokenFactory.TokenParams", 
        components: [
          { name: "name", type: "string", internalType: "string" },
          { name: "symbol", type: "string", internalType: "string" },
          { name: "tokenURI", type: "string", internalType: "string" },
          { name: "vestingDuration", type: "uint256", internalType: "uint256" },
          { name: "yearlyMintRate", type: "uint256", internalType: "uint256" },
          { name: "totalSupply", type: "uint256", internalType: "uint256" },
          { name: "initialRecipients", type: "address[]", internalType: "address[]" },
          { name: "initialAmounts", type: "uint256[]", internalType: "uint256[]" }
        ]
      },
      { name: "creationParams", type: "tuple", internalType: "struct IAirlock.CreationParams",
        components: [
          { name: "poolInitializer", type: "address", internalType: "address" },
          { name: "liquidityMigrator", type: "address", internalType: "address" },
          { name: "governor", type: "address", internalType: "address" },
          { name: "numeraire", type: "address", internalType: "address" },
          { name: "integrator", type: "address", internalType: "address" },
          { name: "poolInitializerData", type: "bytes", internalType: "bytes" },
          { name: "liquidityMigratorData", type: "bytes", internalType: "bytes" }
        ]
      }
    ],
    outputs: [
      { name: "pool", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" }
    ],
    stateMutability: "payable",
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
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
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
      {
        name: "",
        type: "tuple",
        components: [
          { name: "lastEpoch", type: "uint40" },
          { name: "tickAccumulator", type: "int256" },
          { name: "totalTokensSold", type: "uint256" },
          { name: "totalProceeds", type: "uint256" },
          { name: "totalTokensSoldLastEpoch", type: "uint256" },
          { name: "feesAccrued", type: "tuple", components: [
            { name: "amount0", type: "int128" },
            { name: "amount1", type: "int128" }
          ]}
        ]
      }
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
      {
        name: "",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" }
        ]
      }
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