import { Address } from 'viem';
import { GENERATED_DOPPLER_DEPLOYMENTS } from './deployments.generated';
import { ZERO_ADDRESS } from './constants';

// Chain IDs
export const CHAIN_IDS = {
  MAINNET: 1,
  ARBITRUM: 42161,
  BASE: 8453,
  BASE_SEPOLIA: 84532,
  INK: 57073,
  ROBINHOOD: 4663,
  UNICHAIN: 130,
  UNICHAIN_SEPOLIA: 1301,
  MONAD_TESTNET: 10143,
  MONAD_MAINNET: 143,
} as const;

export type SupportedChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

// Human-friendly chain key type (e.g., 'BASE', 'UNICHAIN')
export type SupportedChainKey = keyof typeof CHAIN_IDS;

// Contract addresses per chain
export interface ChainAddresses {
  // Core contracts
  airlock: Address;
  tokenFactory: Address;
  derc20V2Factory?: Address;
  derc20V2Implementation?: Address;
  dopplerERC20V1Factory?: Address;
  dopplerERC20V1Implementation?: Address;

  // Static auction contracts (V3)
  v3Initializer: Address;
  v3Quoter: Address;
  lockableV3Initializer?: Address;

  // Dynamic auction contracts (V4)
  v4Initializer: Address;
  // Multicurve initializer (V4) — optional per chain
  v4MulticurveInitializer?: Address;
  v4ScheduledMulticurveInitializer?: Address;
  v4DecayMulticurveInitializer?: Address;
  openingAuctionInitializer?: Address;
  openingAuctionPositionManager?: Address;

  // DopplerHook system (for RehypeDopplerHook support)
  dopplerHookInitializer?: Address;
  rehypeDopplerHookInitializer?: Address;
  /**
   * @deprecated Use rehypeDopplerHookInitializer instead.
   */
  rehypeDopplerHook?: Address;
  dopplerLens: Address;
  dopplerDeployer: Address;
  poolManager: Address;

  // Doppler404 contracts
  doppler404Factory?: Address;

  // Migration contracts
  v2Migrator: Address;
  v2MigratorSplit?: Address;
  v4Migrator: Address;
  v4MigratorSplit?: Address;
  dopplerHookMigrator?: Address;
  v4MigratorHook?: Address;
  noOpMigrator?: Address;

  // Governance contracts
  governanceFactory: Address;
  noOpGovernanceFactory?: Address;
  launchpadGovernanceFactory?: Address;
  streamableFeesLocker?: Address;
  streamableFeesLockerV2?: Address;

  // Router contracts
  universalRouter: Address;
  univ2Router02?: Address;
  permit2: Address;

  // Other contracts
  bundler?: Address;

  // Uniswap contracts
  weth: Address;
  uniswapV2Factory?: Address;
  uniswapV3Factory?: Address;
  uniswapV4Quoter: Address;
}

function getGeneratedAddress(
  chainId: SupportedChainId,
  key: string,
): Address | undefined {
  const deployments = GENERATED_DOPPLER_DEPLOYMENTS[
    chainId as unknown as keyof typeof GENERATED_DOPPLER_DEPLOYMENTS
  ] as Record<string, string> | undefined;
  return deployments?.[key] as Address | undefined;
}

function getRehypeDopplerHookInitializerAddress(
  chainId: SupportedChainId,
): Address | undefined {
  return (
    getGeneratedAddress(chainId, 'RehypeDopplerHookInitializer') ??
    getGeneratedAddress(chainId, 'RehypeDopplerHook')
  );
}

export const ADDRESSES: Record<SupportedChainId, ChainAddresses> = {
  [CHAIN_IDS.MAINNET]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .Airlock as Address,
    tokenFactory: '0xe7Df2A4520C26a2D4Dedb3a7585BFBcd30eABA6e' as Address,
    derc20V2Factory: '0x16F5ACB64F4FA17296E942C51d3395aDC318f9e1',
    derc20V2Implementation: '0x4BBfed1c27CDE12eF6638251D81ab4e3be7556b7',
    dopplerERC20V1Factory: getGeneratedAddress(
      CHAIN_IDS.MAINNET,
      'DopplerERC20V1Factory',
    ),
    dopplerERC20V1Implementation: getGeneratedAddress(
      CHAIN_IDS.MAINNET,
      'DopplerERC20V1',
    ),
    v3Initializer: ZERO_ADDRESS,
    v3Quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e' as Address,
    lockableV3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .LockableUniswapV3Initializer as Address,
    v4Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .UniswapV4Initializer as Address,
    v4ScheduledMulticurveInitializer:
      '0xF84378C9F39e0FF267f3101c88773359c5393876' as Address,
    dopplerHookInitializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .DopplerHookInitializer as Address,
    rehypeDopplerHookInitializer: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.MAINNET,
    ),
    rehypeDopplerHook: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.MAINNET,
    ),
    dopplerLens: ZERO_ADDRESS,
    dopplerDeployer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .DopplerDeployer as Address,
    poolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90' as Address,
    v2Migrator: '0x765875bff87614cE0581ee73B9fa663B71F3DfF2' as Address,
    v2MigratorSplit: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .UniswapV2MigratorSplit as Address,
    v4Migrator: '0x0820A4D0173C17Ece283f7bDaAF0f8876eB205f5' as Address,
    v4MigratorSplit: '0xa1b06BE4f2fC347d194240D79EDa9F40CCAd9732' as Address,
    v4MigratorHook: '0x4053D4fa966cbdCC20Ec62070aC8814De8bEE500' as Address,
    dopplerHookMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .DopplerHookMigrator as Address,
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .NoOpMigrator as Address,
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .GovernanceFactory as Address,
    noOpGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .NoOpGovernanceFactory as Address,
    launchpadGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .LaunchpadGovernanceFactory as Address,
    streamableFeesLocker:
      '0xe24FC2F7191e850e2D4514aBb4d39305b1871eC6' as Address,
    streamableFeesLockerV2: getGeneratedAddress(
      CHAIN_IDS.MAINNET,
      'StreamableFeesLockerV2',
    ),
    universalRouter: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MAINNET]
      .Bundler as Address,
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,
    univ2Router02: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as Address,
    uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as Address,
    uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984' as Address,
    uniswapV4Quoter: '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203' as Address,
  },
  [CHAIN_IDS.ARBITRUM]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .Airlock as Address,
    tokenFactory: ZERO_ADDRESS,
    dopplerERC20V1Factory: getGeneratedAddress(
      CHAIN_IDS.ARBITRUM,
      'DopplerERC20V1Factory',
    ),
    dopplerERC20V1Implementation: getGeneratedAddress(
      CHAIN_IDS.ARBITRUM,
      'DopplerERC20V1',
    ),
    doppler404Factory: getGeneratedAddress(CHAIN_IDS.ARBITRUM, 'DN404Factory'),
    v3Initializer: ZERO_ADDRESS,
    v3Quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e' as Address,
    lockableV3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .LockableUniswapV3Initializer as Address,
    v4Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .UniswapV4Initializer as Address,
    dopplerHookInitializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .DopplerHookInitializer as Address,
    rehypeDopplerHookInitializer: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.ARBITRUM,
    ),
    rehypeDopplerHook: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.ARBITRUM,
    ),
    dopplerLens: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .DopplerLensQuoter as Address,
    dopplerDeployer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .DopplerDeployer as Address,
    poolManager: '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32' as Address,
    v2Migrator: ZERO_ADDRESS,
    v2MigratorSplit: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .UniswapV2MigratorSplit as Address,
    v4Migrator: ZERO_ADDRESS,
    dopplerHookMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .DopplerHookMigrator as Address,
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .NoOpMigrator as Address,
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .GovernanceFactory as Address,
    noOpGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .NoOpGovernanceFactory as Address,
    launchpadGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[
      CHAIN_IDS.ARBITRUM
    ].LaunchpadGovernanceFactory as Address,
    streamableFeesLocker: ZERO_ADDRESS,
    streamableFeesLockerV2: getGeneratedAddress(
      CHAIN_IDS.ARBITRUM,
      'StreamableFeesLockerV2',
    ),
    universalRouter: '0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ARBITRUM]
      .Bundler as Address,
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
    uniswapV2Factory: '0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9' as Address,
    uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984' as Address,
    uniswapV4Quoter: '0x3972C00f7ed4885e145823eb7C655375d275A1C5' as Address,
  },
  [CHAIN_IDS.BASE]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].Airlock as Address,
    tokenFactory: '0xf0B5141dD9096254B2ca624dff26024f46087229' as Address,
    derc20V2Factory: '0x16F5ACB64F4FA17296E942C51d3395aDC318f9e1',
    derc20V2Implementation: '0x4BBfed1c27CDE12eF6638251D81ab4e3be7556b7',
    dopplerERC20V1Factory: getGeneratedAddress(
      CHAIN_IDS.BASE,
      'DopplerERC20V1Factory',
    ),
    dopplerERC20V1Implementation: getGeneratedAddress(
      CHAIN_IDS.BASE,
      'DopplerERC20V1',
    ),
    doppler404Factory: getGeneratedAddress(CHAIN_IDS.BASE, 'DN404Factory'),
    v3Initializer: '0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5' as Address,
    v3Quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as Address,
    lockableV3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .LockableUniswapV3Initializer as Address,
    v4Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .UniswapV4Initializer as Address,
    v4MulticurveInitializer:
      '0x65dE470Da664A5be139A5D812bE5FDa0d76CC951' as Address, // From Doppler multicurve deployments (Base mainnet)
    v4ScheduledMulticurveInitializer:
      '0xA36715dA46Ddf4A769f3290f49AF58bF8132ED8E' as Address, // From Doppler scheduled multicurve deployments (Base mainnet)
    v4DecayMulticurveInitializer:
      '0xD59cE43E53D69F190E15d9822Fb4540dCcc91178' as Address, // From Doppler decay multicurve deployments (Base mainnet)
    // Opening auction slots reserved for phase-1 lifecycle support (not deployed on Base yet)
    openingAuctionInitializer: ZERO_ADDRESS,
    openingAuctionPositionManager: ZERO_ADDRESS,
    dopplerLens: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .DopplerLensQuoter as Address,
    dopplerDeployer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .DopplerDeployer as Address,
    poolManager: '0x498581ff718922c3f8e6a244956af099b2652b2b' as Address,
    rehypeDopplerHookInitializer: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.BASE,
    ),
    rehypeDopplerHook: getRehypeDopplerHookInitializerAddress(CHAIN_IDS.BASE),
    dopplerHookInitializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .DopplerHookInitializer as Address,
    v2Migrator: '0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731' as Address,
    v2MigratorSplit: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .UniswapV2MigratorSplit as Address,
    v4Migrator: '0xd3B4cF7FD24381e90A4F012fC6c5976b87B9B3cE' as Address,
    v4MigratorSplit: '0xa1b06BE4f2fC347d194240D79EDa9F40CCAd9732' as Address,
    v4MigratorHook: '0xD6FECFF347c6203A41874e8D77dE669B54e7A500' as Address,
    dopplerHookMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .DopplerHookMigrator as Address,
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .NoOpMigrator as Address,
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .GovernanceFactory as Address,
    noOpGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .NoOpGovernanceFactory as Address,
    launchpadGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE]
      .LaunchpadGovernanceFactory as Address,
    streamableFeesLocker:
      '0x0A00775D71a42cd33D62780003035e7F5b47bD3A' as Address,
    streamableFeesLockerV2: getGeneratedAddress(
      CHAIN_IDS.BASE,
      'StreamableFeesLockerV2',
    ),
    universalRouter: '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address,
    univ2Router02: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24' as Address,
    uniswapV2Factory: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].Bundler as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV3Factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD' as Address,
    uniswapV4Quoter: '0x0d5e0f971ed27fbff6c2837bf31316121532048d' as Address,
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .Airlock as Address,
    tokenFactory: '0xf0B5141dD9096254B2ca624dff26024f46087229' as Address,
    derc20V2Factory: '0x16F5ACB64F4FA17296E942C51d3395aDC318f9e1',
    derc20V2Implementation: '0x4BBfed1c27CDE12eF6638251D81ab4e3be7556b7',
    dopplerERC20V1Factory: getGeneratedAddress(
      CHAIN_IDS.BASE_SEPOLIA,
      'DopplerERC20V1Factory',
    ),
    dopplerERC20V1Implementation: getGeneratedAddress(
      CHAIN_IDS.BASE_SEPOLIA,
      'DopplerERC20V1',
    ),
    doppler404Factory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .DN404Factory as Address,
    v3Initializer: '0x4C3062B9ccFdbCB10353F57C1B59a29d4c5CFa47' as Address,
    v3Quoter: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27' as Address,
    lockableV3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .LockableUniswapV3Initializer as Address,
    v4Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .UniswapV4Initializer as Address,
    v4MulticurveInitializer:
      '0x1718405E58c61425cDc0083262bC9f72198F5232' as Address,
    v4ScheduledMulticurveInitializer:
      '0xF84378C9F39e0FF267f3101c88773359c5393876' as Address, // From Doppler scheduled multicurve deployments (Base Sepolia)
    v4DecayMulticurveInitializer:
      '0xD59cE43E53D69F190E15d9822Fb4540dCcc91178' as Address, // From Doppler decay multicurve deployments (Base Sepolia)
    // Opening Auction contracts (deployed Feb 2025)
    openingAuctionInitializer:
      '0x3dCd35945Dc86a9FaA80846B06CB4676961d0AEa' as Address,
    openingAuctionPositionManager:
      '0x957CA7472ced1C1B3608152F83E0E69F975a37a9' as Address,
    dopplerHookInitializer: GENERATED_DOPPLER_DEPLOYMENTS[
      CHAIN_IDS.BASE_SEPOLIA
    ].DopplerHookInitializer as Address,
    rehypeDopplerHookInitializer: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.BASE_SEPOLIA,
    ),
    rehypeDopplerHook: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.BASE_SEPOLIA,
    ),
    dopplerLens: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .DopplerLensQuoter as Address,
    dopplerDeployer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .DopplerDeployer as Address,
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as Address,
    v2Migrator: '0x04a898f3722c38F9Def707bD17DC78920EFA977C' as Address,
    v2MigratorSplit: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .UniswapV2MigratorSplit as Address,
    v4Migrator: '0xEEe0eCCb54398ce371CAACBCEf076d3Ed597DDb3' as Address,
    v4MigratorSplit: '0xa1b06BE4f2fC347d194240D79EDa9F40CCAd9732' as Address,
    dopplerHookMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .DopplerHookMigrator as Address,
    v4MigratorHook: '0x127cAAAd598Ffa97577940b0a5c3b6150019E500' as Address,
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .NoOpMigrator as Address,
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .GovernanceFactory as Address,
    noOpGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .NoOpGovernanceFactory as Address,
    launchpadGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[
      CHAIN_IDS.BASE_SEPOLIA
    ].LaunchpadGovernanceFactory as Address,
    streamableFeesLocker:
      '0x3345E557c5C0b474bE1eb4693264008B8562Aa9c' as Address,
    streamableFeesLockerV2: getGeneratedAddress(
      CHAIN_IDS.BASE_SEPOLIA,
      'StreamableFeesLockerV2',
    ),
    universalRouter: '0x492E6456D9528771018DeB9E87ef7750EF184104' as Address,
    univ2Router02: '0x1689E7B1F10000AE47eBfE339a4f69dECd19F602' as Address,
    uniswapV2Factory: '0x7Ae58f10f7849cA6F5fB71b7f45CB416c9204b1e' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA]
      .Bundler as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV3Factory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' as Address,
    uniswapV4Quoter: '0x4A6513c898fe1B2d0E78d3b0e0A4a151589B1cBa' as Address,
  },
  [CHAIN_IDS.INK]: {
    airlock: '0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12' as Address,
    tokenFactory: '0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45' as Address,
    derc20V2Factory: getGeneratedAddress(
      CHAIN_IDS.INK,
      'CloneDERC20VotesV2Factory',
    ),
    derc20V2Implementation: getGeneratedAddress(
      CHAIN_IDS.INK,
      'CloneDERC20VotesV2',
    ),
    v3Initializer: '0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5' as Address,
    v3Quoter: '0x96b572D2d880cf2Fa2563651BD23ADE6f5516652' as Address,
    v4Initializer: '0xC99b485499f78995C6F1640dbB1413c57f8BA684' as Address,
    dopplerLens: '0x3972c00f7ed4885e145823eb7c655375d275a1c5' as Address,
    dopplerDeployer: '0xa82c66b6ddEb92089015C3565E05B5c9750b2d4B' as Address,
    poolManager: '0x360e68faccca8ca495c1b759fd9eee466db9fb32' as Address,
    v2Migrator: '0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731' as Address,
    v4Migrator: ZERO_ADDRESS,
    governanceFactory: '0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9' as Address,
    noOpGovernanceFactory: ZERO_ADDRESS, // Not yet deployed
    streamableFeesLocker: ZERO_ADDRESS, // Not yet deployed
    universalRouter: '0x112908dac86e20e7241b0927479ea3bf935d1fa0' as Address,
    univ2Router02: '0xB3FB126ACDd5AdCA2f50Ac644a7a2303745f18b4' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV4Quoter: '0x3972c00f7ed4885e145823eb7c655375d275a1c5' as Address,
  },
  [CHAIN_IDS.ROBINHOOD]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .Airlock as Address,
    tokenFactory: ZERO_ADDRESS,
    dopplerERC20V1Factory: getGeneratedAddress(
      CHAIN_IDS.ROBINHOOD,
      'DopplerERC20V1Factory',
    ),
    dopplerERC20V1Implementation: getGeneratedAddress(
      CHAIN_IDS.ROBINHOOD,
      'DopplerERC20V1',
    ),
    doppler404Factory: getGeneratedAddress(CHAIN_IDS.ROBINHOOD, 'DN404Factory'),
    v3Initializer: ZERO_ADDRESS,
    v3Quoter: '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7' as Address,
    lockableV3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .LockableUniswapV3Initializer as Address,
    v4Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .UniswapV4Initializer as Address,
    dopplerHookInitializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .DopplerHookInitializer as Address,
    rehypeDopplerHookInitializer: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.ROBINHOOD,
    ),
    rehypeDopplerHook: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.ROBINHOOD,
    ),
    dopplerLens: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .DopplerLensQuoter as Address,
    dopplerDeployer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .DopplerDeployer as Address,
    poolManager: '0x8366a39cc670b4001a1121b8f6a443a643e40951' as Address,
    v2Migrator: ZERO_ADDRESS,
    v2MigratorSplit: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .UniswapV2MigratorSplit as Address,
    v4Migrator: ZERO_ADDRESS,
    dopplerHookMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .DopplerHookMigrator as Address,
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .NoOpMigrator as Address,
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .GovernanceFactory as Address,
    noOpGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .NoOpGovernanceFactory as Address,
    launchpadGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[
      CHAIN_IDS.ROBINHOOD
    ].LaunchpadGovernanceFactory as Address,
    streamableFeesLocker: ZERO_ADDRESS,
    streamableFeesLockerV2: getGeneratedAddress(
      CHAIN_IDS.ROBINHOOD,
      'StreamableFeesLockerV2',
    ),
    universalRouter: '0x8876789976decbfcbbbe364623c63652db8c0904' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.ROBINHOOD]
      .Bundler as Address,
    weth: '0x0bd7d308f8e1639fab988df18a8011f41eacad73' as Address,
    uniswapV2Factory: '0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f' as Address,
    uniswapV3Factory: '0x1f7d7550b1b028f7571e69a784071f0205fd2efa' as Address,
    uniswapV4Quoter: '0x8dc178efb8111bb0973dd9d722ebeff267c98f94' as Address,
  },
  [CHAIN_IDS.UNICHAIN]: {
    airlock: '0x77EbfBAE15AD200758E9E2E61597c0B07d731254' as Address,
    tokenFactory: '0x43d0D97EC9241A8F05A264f94B82A1d2E600f2B3' as Address,
    derc20V2Factory: getGeneratedAddress(
      CHAIN_IDS.UNICHAIN,
      'CloneDERC20VotesV2Factory',
    ),
    derc20V2Implementation: getGeneratedAddress(
      CHAIN_IDS.UNICHAIN,
      'CloneDERC20VotesV2',
    ),
    v3Initializer: '0x9F4e56be80f08ba1A2445645EFa6d231E27b43ec' as Address,
    v3Quoter: '0x385A5cf5F83e99f7BB2852b6A19C3538b9FA7658' as Address,
    v4Initializer: '0x2F2BAcd46d3F5c9EE052Ab392b73711dB89129DB' as Address,
    dopplerLens: '0x333e3c607b141b18ff6de9f258db6e77fe7491e0' as Address,
    dopplerDeployer: '0x06FEFD02F0b6d9f57F52cfacFc113665Dfa20F0f' as Address,
    poolManager: '0x1f98400000000000000000000000000000000004' as Address,
    v2Migrator: '0xf6023127f6E937091D5B605680056A6D27524bad' as Address,
    v4Migrator: '0x49F3fBB2dFF7f3d03B622e3b2a6d3F2E6fdB2a5A' as Address,
    noOpMigrator: '0x917da361072ce968acD810BbfC9B64079426ebf0' as Address,
    governanceFactory: '0x99C94B9Df930E1E21a4E4a2c105dBff21bF5c5aE' as Address,
    noOpGovernanceFactory:
      '0x3AD727ee0FBBb8Ee0920933FdB96F23fD56f1299' as Address,
    streamableFeesLocker: ZERO_ADDRESS, // Not yet deployed
    universalRouter: '0xef740bf23acae26f6492b10de645d6b98dc8eaf3' as Address,
    univ2Router02: '0x284f11109359a7e1306c3e447ef14d38400063ff' as Address,
    uniswapV2Factory: '0x1f98400000000000000000000000000000000002' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV4Quoter: '0x333e3c607b141b18ff6de9f258db6e77fe7491e0' as Address,
  },
  [CHAIN_IDS.UNICHAIN_SEPOLIA]: {
    airlock: '0x651ab94B4777e2e4cdf96082d90C65bd947b73A4' as Address,
    tokenFactory: '0x82Ac010C67f70BACf7655cd8948a4AD92A173CAC' as Address,
    derc20V2Factory: getGeneratedAddress(
      CHAIN_IDS.UNICHAIN_SEPOLIA,
      'CloneDERC20VotesV2Factory',
    ),
    derc20V2Implementation: getGeneratedAddress(
      CHAIN_IDS.UNICHAIN_SEPOLIA,
      'CloneDERC20VotesV2',
    ),
    v3Initializer: '0x7Fb9a622186B4660A5988C223ebb9d3690dD5007' as Address,
    v3Quoter: '0x6Dd37329A1A225a6Fca658265D460423DCafBF89' as Address,
    v4Initializer: '0x992375478626E67F4e639d3298EbCAaE51C3dF0b' as Address,
    dopplerLens: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
    dopplerDeployer: '0x2f2bacd46d3f5c9ee052ab392b73711db89129db' as Address,
    poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC' as Address,
    v2Migrator: '0x620e3fec244e913d73f2163623b62d02DB69638B' as Address,
    v4Migrator: '0xb6D69eAA98E657bEEFF7ca4452768e6f707aa6b1' as Address,
    noOpMigrator: '0x193F48A45B6025dDeD10bc4BaeEF65c833696387' as Address,
    governanceFactory: '0x1E4332EEfAE9e4967C2D186f7b2d439D778e81cC' as Address,
    noOpGovernanceFactory:
      '0x7E5D336A6E9e453c9f02E5102CC039E015Fd8fb8' as Address,
    streamableFeesLocker: ZERO_ADDRESS, // Not yet deployed
    universalRouter: '0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D' as Address,
    univ2Router02: '0x284f11109359a7e1306c3e447ef14d38400063ff' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV4Quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  },
  [CHAIN_IDS.MONAD_TESTNET]: {
    airlock: '0xDe3599a2eC440B296373a983C85C365DA55d9dFA' as Address,
    tokenFactory: '0xf0B5141dD9096254B2ca624dff26024f46087229' as Address,
    derc20V2Factory: getGeneratedAddress(
      CHAIN_IDS.MONAD_TESTNET,
      'CloneDERC20VotesV2Factory',
    ),
    derc20V2Implementation: getGeneratedAddress(
      CHAIN_IDS.MONAD_TESTNET,
      'CloneDERC20VotesV2',
    ),
    v3Initializer: '0x9F4e56be80f08ba1A2445645EFa6d231E27b43ec' as Address,
    v3Quoter: ZERO_ADDRESS,
    v4Initializer: '0x53b4c21a6Cb61D64F636ABBfa6E8E90E6558e8ad' as Address,
    dopplerLens: '0x2F2BAcd46d3F5c9EE052Ab392b73711dB89129DB' as Address,
    dopplerDeployer: '0xb35469ee64A87Afd19B31615094fE3962d73e421' as Address,
    poolManager: '0xe93882f395B0b24180855c68Ab19B2d78573ceBc' as Address,
    v2Migrator: '0x43d0D97EC9241A8F05A264f94B82A1d2E600f2B3' as Address,
    v4Migrator: '0xBEd386a1Fc62B6598c9b8d2BF634471B6Fe75EB7' as Address,
    noOpMigrator: '0x5CadB034267751a364dDD4d321C99E07A307f915' as Address,
    governanceFactory: '0x014E1c0bd34f3B10546E554CB33B3293fECDD056' as Address,
    noOpGovernanceFactory:
      '0x094D926A969B3024ca46D2186BF13FD5CDBA9CE2' as Address,
    streamableFeesLocker:
      '0x91231cDdD8d6C86Df602070a3081478e074b97b7' as Address, // Not yet deployed
    universalRouter: ZERO_ADDRESS,
    univ2Router02: ZERO_ADDRESS,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    weth: ZERO_ADDRESS, // TODO: Get Monad Testnet weth
    uniswapV4Quoter: ZERO_ADDRESS,
  },
  [CHAIN_IDS.MONAD_MAINNET]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_MAINNET]
      .Airlock as Address,
    tokenFactory: '0xf0B5141dD9096254B2ca624dff26024f46087229' as Address,
    derc20V2Factory: '0x16F5ACB64F4FA17296E942C51d3395aDC318f9e1',
    derc20V2Implementation: '0x4BBfed1c27CDE12eF6638251D81ab4e3be7556b7',
    dopplerERC20V1Factory: getGeneratedAddress(
      CHAIN_IDS.MONAD_MAINNET,
      'DopplerERC20V1Factory',
    ),
    dopplerERC20V1Implementation: getGeneratedAddress(
      CHAIN_IDS.MONAD_MAINNET,
      'DopplerERC20V1',
    ),
    v3Initializer: ZERO_ADDRESS,
    v3Quoter: '0x661E93cca42AfacB172121EF892830cA3b70F08d' as Address,
    lockableV3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[
      CHAIN_IDS.MONAD_MAINNET
    ].LockableUniswapV3Initializer as Address,
    v4Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_MAINNET]
      .UniswapV4Initializer as Address,
    dopplerLens: ZERO_ADDRESS,
    dopplerDeployer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_MAINNET]
      .DopplerDeployer as Address,
    poolManager: '0x188d586ddcf52439676ca21a244753fa19f9ea8e' as Address,
    v2Migrator: '0x136191B46478cAB023cbC01a36160C4Aad81677a' as Address,
    v2MigratorSplit: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_MAINNET]
      .UniswapV2MigratorSplit as Address,
    v4Migrator: '0x44bf742e57cd8cF23ABbc8dab2c44e2a3228356E' as Address,
    v4MigratorSplit: '0xa1b06BE4f2fC347d194240D79EDa9F40CCAd9732' as Address,
    v4MigratorHook: '0x3E4c689BBf33b37106eBC13Db8aa5BF13a25e500' as Address,
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_MAINNET]
      .NoOpMigrator as Address,
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_MAINNET]
      .GovernanceFactory as Address,
    noOpGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[
      CHAIN_IDS.MONAD_MAINNET
    ].NoOpGovernanceFactory as Address,
    launchpadGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[
      CHAIN_IDS.MONAD_MAINNET
    ].LaunchpadGovernanceFactory as Address,
    v4ScheduledMulticurveInitializer:
      '0xCe3099B2F07029b086E5e92a1573C5f5A3071783' as Address,
    dopplerHookInitializer: GENERATED_DOPPLER_DEPLOYMENTS[
      CHAIN_IDS.MONAD_MAINNET
    ].DopplerHookInitializer as Address,
    rehypeDopplerHookInitializer: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.MONAD_MAINNET,
    ),
    rehypeDopplerHook: getRehypeDopplerHookInitializerAddress(
      CHAIN_IDS.MONAD_MAINNET,
    ),
    streamableFeesLocker:
      '0x63f8C8F9beFaab2FaCD7Ece0b0242f78B920Ee90' as Address,
    streamableFeesLockerV2: getGeneratedAddress(
      CHAIN_IDS.MONAD_MAINNET,
      'StreamableFeesLockerV2',
    ),
    universalRouter: '0x0d97dc33264bfc1c226207428a79b26757fb9dc3' as Address,
    univ2Router02: '0x4B2ab38DBF28D31D467aA8993f6c2585981D6804' as Address,
    uniswapV2Factory: '0x182a927119d56008d921126764bf884221b10f59' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_MAINNET]
      .Bundler as Address,
    dopplerHookMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_MAINNET]
      .DopplerHookMigrator as Address,
    weth: '0x3bd359c1119da7da1d913d1c4d2b7c461115433a' as Address, // INFO: this is wmon, but we treat it as weth because mon is native
    uniswapV4Quoter: '0xa222dd357a9076d1091ed6aa2e16c9742dd26891' as Address,
  },
};
/**
 * Get addresses for a specific chain
 */
export function getAddresses(chainId: number): ChainAddresses {
  const addresses = ADDRESSES[chainId as SupportedChainId];
  if (!addresses) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return addresses;
}

/**
 * List of supported chain IDs for easy iteration/validation
 */
export const SUPPORTED_CHAIN_IDS = Object.values(
  CHAIN_IDS,
) as SupportedChainId[];

/**
 * Runtime/type guard for narrowing a number to SupportedChainId
 */
export function isSupportedChainId(id: number): id is SupportedChainId {
  // Numeric object keys are coerced to strings at runtime; `in` is fine here
  return id in ADDRESSES;
}
