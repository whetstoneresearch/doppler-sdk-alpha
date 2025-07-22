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
    inputs: [{ name: "amount", type: "uint256", internalType: "uint256" }],
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
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "uint256", name: "amountOut", type: "uint256" },
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