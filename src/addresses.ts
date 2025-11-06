import { Address } from 'viem'
import { GENERATED_DOPPLER_DEPLOYMENTS } from './deployments.generated'

// Chain IDs
export const CHAIN_IDS = {
  MAINNET: 1,
  BASE: 8453,
  BASE_SEPOLIA: 84532,
  INK: 57073,
  UNICHAIN: 130,
  UNICHAIN_SEPOLIA: 1301,
  MONAD_TESTNET: 10143,
} as const

export type SupportedChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS]

// Human-friendly chain key type (e.g., 'BASE', 'UNICHAIN')
export type SupportedChainKey = keyof typeof CHAIN_IDS

// Contract addresses per chain
export interface ChainAddresses {
  // Core contracts
  airlock: Address
  tokenFactory: Address

  // Static auction contracts (V3)
  v3Initializer: Address
  v3Quoter: Address
  lockableV3Initializer?: Address
  
  // Dynamic auction contracts (V4)
  v4Initializer: Address
  // Multicurve initializer (V4) — optional per chain
  v4MulticurveInitializer?: Address
  v4ScheduledMulticurveInitializer?: Address
  dopplerLens: Address
  dopplerDeployer: Address
  poolManager: Address

  // Doppler404 contracts
  doppler404Factory?: Address
  
  // Migration contracts
  v2Migrator: Address
  v3Migrator: Address
  v4Migrator: Address
  v4MigratorHook?: Address
  noOpMigrator?: Address
  
  // Governance contracts
  governanceFactory: Address
  noOpGovernanceFactory?: Address
  streamableFeesLocker?: Address
  
  // Router contracts
  universalRouter: Address
  univ2Router02?: Address
  permit2: Address
  
  // Other contracts
  bundler?: Address
  
  // Uniswap contracts
  weth: Address
  uniswapV2Factory?: Address
  uniswapV3Factory?: Address
  uniswapV4Quoter: Address
}

// Not yet deployed placeholder
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export const ADDRESSES: Record<SupportedChainId, ChainAddresses> = {
  [CHAIN_IDS.MAINNET]: {
    // Mainnet addresses not yet deployed
    airlock: ZERO_ADDRESS,
    tokenFactory: ZERO_ADDRESS,
    v3Initializer: ZERO_ADDRESS,
    v3Quoter: ZERO_ADDRESS,
    v4Initializer: ZERO_ADDRESS,
    dopplerLens: ZERO_ADDRESS,
    dopplerDeployer: ZERO_ADDRESS,
    v2Migrator: ZERO_ADDRESS,
    v3Migrator: ZERO_ADDRESS,
    v4Migrator: ZERO_ADDRESS,
    poolManager: ZERO_ADDRESS,
    governanceFactory: ZERO_ADDRESS,
    universalRouter: ZERO_ADDRESS,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,
    uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as Address,
    uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984' as Address,
    uniswapV4Quoter: '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203' as Address,
  },
  [CHAIN_IDS.BASE]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].Airlock as Address,
    tokenFactory: '0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45' as Address,
    v3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].UniswapV3Initializer as Address,
    v3Quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a' as Address,
    lockableV3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].LockableUniswapV3Initializer as Address,
    v4Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].UniswapV4Initializer as Address,
    v4MulticurveInitializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].UniswapV4MulticurveInitializer as Address, // From Doppler multicurve deployments (Base mainnet)
    v4ScheduledMulticurveInitializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].UniswapV4ScheduledMulticurveInitializer as Address, // From Doppler scheduled multicurve deployments (Base mainnet)
    dopplerLens: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].DopplerLensQuoter as Address,
    dopplerDeployer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].DopplerDeployer as Address,
    poolManager: '0x498581ff718922c3f8e6a244956af099b2652b2b' as Address,
    v2Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].UniswapV2Migrator as Address,
    v3Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].UniswapV2Migrator as Address,
    v4Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].UniswapV4Migrator as Address,
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].NoOpMigrator as Address,
    governanceFactory: '0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9' as Address,
    noOpGovernanceFactory: '0xe7dfbd5b0a2c3b4464653a9becdc489229ef090e' as Address,
    streamableFeesLocker: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].StreamableFeesLocker as Address,
    universalRouter: '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address,
    univ2Router02: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE].Bundler as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV4Quoter: '0x0d5e0f971ed27fbff6c2837bf31316121532048d' as Address,
  },
  [CHAIN_IDS.BASE_SEPOLIA]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA].Airlock as Address,
    tokenFactory: '0xc69ba223c617f7d936b3cf2012aa644815dbe9ff' as Address,
    doppler404Factory: '0xdd8cea2890f1b3498436f19ec8da8fecc2cb7af7' as Address,
    v3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA].UniswapV3Initializer as Address,
    v3Quoter: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27' as Address,
    lockableV3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA].LockableUniswapV3Initializer as Address,
    v4Initializer: '0x8e891d249f1ecbffa6143c03eb1b12843aef09d3' as Address,
    v4MulticurveInitializer: '0x359b5952a254baaa0105381825daedb8986bb55c' as Address, // From doppler multicurve deployments (Base Sepolia)
    v4ScheduledMulticurveInitializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA].UniswapV4ScheduledMulticurveInitializer as Address, // From Doppler scheduled multicurve deployments (Base Sepolia)
    dopplerLens: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA].DopplerLensQuoter as Address,
    dopplerDeployer: '0x60a039e4add40ca95e0475c11e8a4182d06c9aa0' as Address,
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as Address,
    v2Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA].UniswapV2Migrator as Address,
    v3Migrator: '0xb2ec6559704467306d04322a5dc082b2af4562dd' as Address,
    v4Migrator: '0xb2ec6559704467306d04322a5dc082b2af4562dd' as Address,
    v4MigratorHook: '0x508812fcdd4972a59b66eb2cad3772279c052000' as Address,
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA].NoOpMigrator as Address,
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.BASE_SEPOLIA].GovernanceFactory as Address,
    noOpGovernanceFactory: '0x916b8987e4ad325c10d58ed8dc2036a6ff5eb228' as Address,
    streamableFeesLocker: '0x4da7d7a8034510c0ffd38a9252237ae8dba3cb61' as Address,
    universalRouter: '0x492E6456D9528771018DeB9E87ef7750EF184104' as Address,
    univ2Router02: '0x1689E7B1F10000AE47eBfE339a4f69dECd19F602' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: '0x69DB7c20cDdA49Bed2bFb21e16Fa218330C50661' as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV4Quoter: '0x4A6513c898fe1B2d0E78d3b0e0A4a151589B1cBa' as Address,
  },
  [CHAIN_IDS.INK]: {
    airlock: '0x014E1c0bd34f3B10546E554CB33B3293fECDD056' as Address,
    tokenFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.INK].TokenFactory as Address,
    v3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.INK].UniswapV3Initializer as Address,
    v3Quoter: '0x96b572D2d880cf2Fa2563651BD23ADE6f5516652' as Address,
    v4Initializer: '0xC99b485499f78995C6F1640dbB1413c57f8BA684' as Address,
    dopplerLens: '0x3972c00f7ed4885e145823eb7c655375d275a1c5' as Address,
    dopplerDeployer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.INK].DopplerDeployer as Address,
    poolManager: '0x360e68faccca8ca495c1b759fd9eee466db9fb32' as Address,
    v2Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.INK].UniswapV2Migrator as Address,
    v3Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.INK].UniswapV2Migrator as Address,
    v4Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.INK].UniswapV2Migrator as Address, // Same as v2/v3 migrator
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.INK].GovernanceFactory as Address,
    noOpGovernanceFactory: ZERO_ADDRESS, // Not yet deployed
    streamableFeesLocker: ZERO_ADDRESS, // Not yet deployed
    universalRouter: '0x112908dac86e20e7241b0927479ea3bf935d1fa0' as Address,
    univ2Router02: '0xB3FB126ACDd5AdCA2f50Ac644a7a2303745f18b4' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.INK].Bundler as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV4Quoter: '0x3972c00f7ed4885e145823eb7c655375d275a1c5' as Address,
  },
  [CHAIN_IDS.UNICHAIN]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN].Airlock as Address,
    tokenFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN].TokenFactory as Address,
    v3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN].UniswapV3Initializer as Address,
    v3Quoter: '0x385A5cf5F83e99f7BB2852b6A19C3538b9FA7658' as Address,
    v4Initializer: '0x2F2BAcd46d3F5c9EE052Ab392b73711dB89129DB' as Address,
    dopplerLens: '0x333e3c607b141b18ff6de9f258db6e77fe7491e0' as Address,
    dopplerDeployer: '0x06FEFD02F0b6d9f57F52cfacFc113665Dfa20F0f' as Address,
    poolManager: '0x1f98400000000000000000000000000000000004' as Address,
    v2Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN].UniswapV2Migrator as Address,
    v3Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN].UniswapV2Migrator as Address,
    v4Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN].UniswapV2Migrator as Address, // Same as v2/v3 migrator
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN].NoOpMigrator as Address,
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN].GovernanceFactory as Address,
    noOpGovernanceFactory: ZERO_ADDRESS, // Not yet deployed
    streamableFeesLocker: ZERO_ADDRESS, // Not yet deployed
    universalRouter: '0xef740bf23acae26f6492b10de645d6b98dc8eaf3' as Address,
    univ2Router02: '0x284f11109359a7e1306c3e447ef14d38400063ff' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN].Bundler as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV4Quoter: '0x333e3c607b141b18ff6de9f258db6e77fe7491e0' as Address,
  },
  [CHAIN_IDS.UNICHAIN_SEPOLIA]: {
    airlock: '0x651ab94B4777e2e4cdf96082d90C65bd947b73A4' as Address,
    tokenFactory: '0xC5E5a19a2ee32831Fcb8a81546979AF43936EbaA' as Address,
    v3Initializer: '0x7Fb9a622186B4660A5988C223ebb9d3690dD5007' as Address,
    v3Quoter: '0x6Dd37329A1A225a6Fca658265D460423DCafBF89' as Address,
    v4Initializer: '0x992375478626E67F4e639d3298EbCAaE51C3dF0b' as Address,
    dopplerLens: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
    dopplerDeployer: '0x2f2bacd46d3f5c9ee052ab392b73711db89129db' as Address,
    poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC' as Address,
    v2Migrator: '0x44C448E38A2C3D206c9132E7f645510dFbBC946b' as Address,
    v3Migrator: '0x44C448E38A2C3D206c9132E7f645510dFbBC946b' as Address,
    v4Migrator: '0x44C448E38A2C3D206c9132E7f645510dFbBC946b' as Address, // Same as v2/v3 migrator
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.UNICHAIN_SEPOLIA].NoOpMigrator as Address,
    governanceFactory: '0x1E4332EEfAE9e4967C2D186f7b2d439D778e81cC' as Address,
    noOpGovernanceFactory: ZERO_ADDRESS, // Not yet deployed
    streamableFeesLocker: ZERO_ADDRESS, // Not yet deployed
    universalRouter: '0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D' as Address,
    univ2Router02: '0x284f11109359a7e1306c3e447ef14d38400063ff' as Address,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: '0x63f8C8F9beFaab2FaCD7Ece0b0242f78B920Ee90' as Address,
    weth: '0x4200000000000000000000000000000000000006' as Address,
    uniswapV4Quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  },
  [CHAIN_IDS.MONAD_TESTNET]: {
    airlock: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].Airlock as Address,
    tokenFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].TokenFactory as Address,
    v3Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].UniswapV3Initializer as Address,
    v3Quoter: ZERO_ADDRESS,
    v4Initializer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].UniswapV4Initializer as Address,
    dopplerLens: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].DopplerLensQuoter as Address,
    dopplerDeployer: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].DopplerDeployer as Address,
    poolManager: '0xe93882f395B0b24180855c68Ab19B2d78573ceBc' as Address,
    v2Migrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].UniswapV2Migrator as Address,
    v3Migrator: ZERO_ADDRESS,
    v4Migrator: '0xBEd386a1Fc62B6598c9b8d2BF634471B6Fe75EB7' as Address, // Same as v2/v3 migrator
    noOpMigrator: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].NoOpMigrator as Address,
    governanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].GovernanceFactory as Address,
    noOpGovernanceFactory: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].NoOpGovernanceFactory as Address, // Not yet deployed
    streamableFeesLocker: '0x91231cDdD8d6C86Df602070a3081478e074b97b7' as Address, // Not yet deployed
    universalRouter: ZERO_ADDRESS,
    univ2Router02: ZERO_ADDRESS,
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
    bundler: GENERATED_DOPPLER_DEPLOYMENTS[CHAIN_IDS.MONAD_TESTNET].Bundler as Address,
    weth: ZERO_ADDRESS, // TODO: Get Monad Testnet weth
    uniswapV4Quoter: ZERO_ADDRESS,
  }
}

/**
 * Get addresses for a specific chain
 */
export function getAddresses(chainId: number): ChainAddresses {
  const addresses = ADDRESSES[chainId as SupportedChainId]
  if (!addresses) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return addresses
}

/**
 * List of supported chain IDs for easy iteration/validation
 */
export const SUPPORTED_CHAIN_IDS = Object.values(CHAIN_IDS) as SupportedChainId[]

/**
 * Runtime/type guard for narrowing a number to SupportedChainId
 */
export function isSupportedChainId(id: number): id is SupportedChainId {
  // Numeric object keys are coerced to strings at runtime; `in` is fine here
  return id in ADDRESSES
}
