export const VERSION = '1.0.0';

// Export the main SDK class
export { DopplerSDK } from './DopplerSDK';

// Export factory and auction classes
export { DopplerFactory } from './entities/DopplerFactory';
export type { MigrationEncoder } from './entities/DopplerFactory';
export { DopplerHookMigrator } from './entities/DopplerHookMigrator';
export type { MigrationRefund } from './entities/DopplerHookMigrator';
export { StreamableFeesLockerV2 } from './entities/StreamableFeesLockerV2';
export type { StreamableFeesStream } from './entities/StreamableFeesLockerV2';
export { Bundler } from './entities/Bundler';
export type {
  BundlerClaimSimulation,
  BundlerVestingPosition,
} from './entities/Bundler';
export {
  StaticAuction,
  DynamicAuction,
  MulticurvePool,
  MulticurveFees,
  RehypeDopplerHookInitializer,
  RehypeDopplerHook,
  OpeningAuction,
  OpeningAuctionLifecycle,
  OpeningAuctionBidManager,
  OpeningAuctionPositionManager,
} from './entities/auction';
export type {
  AirlockAssetData,
  MulticurveFeesOptions,
  MulticurvePendingFees,
  MulticurvePendingFeesOptions,
  MulticurveTokenPendingFeeBreakdown,
  MulticurveTokenPendingFees,
  RehypePendingFees,
  RehypeIntegratorFees,
  RehypeIntegratorRoutingConfig,
} from './entities/auction';

// Export quoter
export { Quoter } from './entities/quoter';

// Export token entities
export {
  Derc20,
  Derc20V2,
  DopplerDN404,
  DopplerERC20V1,
  Eth,
} from './entities/token';

// Export builders and common interface
export {
  StaticAuctionBuilder,
  DynamicAuctionBuilder,
  MulticurveBuilder,
  OpeningAuctionBuilder,
} from './builders';
export type { BaseAuctionBuilder } from './builders/shared';
export type {
  BuilderDevBuyInput,
  BuilderDevBuyVestingInput,
} from './builders/shared';
export type {
  OpeningAuctionConfig,
  OpeningAuctionDopplerConfig,
  ResolvedOpeningAuctionDopplerConfig,
  CreateOpeningAuctionParams,
  OpeningAuctionModuleAddressOverrides,
} from './builders/OpeningAuctionBuilder';
export type {
  OpeningAuctionBidManagerConfig,
  OpeningAuctionBidArgs,
  OpeningAuctionWithdrawFullBidArgs,
  OpeningAuctionBidLookupArgs,
  OpeningAuctionBidSimulationResult,
  OpeningAuctionClaimIncentivesSimulationResult,
  OpeningAuctionBidPositionInfo,
  OpeningAuctionBidStatus,
  OpeningAuctionWatchBidStatusOptions,
  OpeningAuctionAuctionSettledEvent,
  OpeningAuctionWatchSettlementOptions,
  OpeningAuctionOwnerBidInfo,
  OpeningAuctionOwnerBidStatus,
  OpeningAuctionBidPlacedEvent,
  OpeningAuctionBidWithdrawnEvent,
  OpeningAuctionIncentivesClaimedEvent,
  OpeningAuctionPhaseChangedEvent,
  OpeningAuctionEstimatedClearingTickUpdatedEvent,
  OpeningAuctionWatchBidPlacedOptions,
  OpeningAuctionWatchBidWithdrawnOptions,
  OpeningAuctionWatchIncentivesClaimedOptions,
  OpeningAuctionWatchPhaseChangeOptions,
  OpeningAuctionWatchEstimatedClearingTickOptions,
  OpeningAuctionMoveBidArgs,
  OpeningAuctionMoveBidSimulationResult,
  OpeningAuctionMoveBidResult,
  OpeningAuctionBidQuote,
  OpeningAuctionClaimAllIncentivesPreview,
  OpeningAuctionClaimAllIncentivesResult,
  OpeningAuctionBidValidationResult,
  OpeningAuctionQuoteFromTokenAmountArgs,
  OpeningAuctionQuoteFromTokenAmountResult,
} from './entities/auction/OpeningAuctionBidManager';
export type {
  OpeningAuctionBidConstraints,
  OpeningAuctionPosition,
  OpeningAuctionSettlementData,
  OpeningAuctionIncentiveData,
} from './entities/auction/OpeningAuction';
export type {
  OpeningAuctionModifyLiquidityParams,
  OpeningAuctionModifyLiquiditySimulationResult,
  OpeningAuctionWithdrawFullBidSimulationResult,
  OpeningAuctionWithdrawFullBidResult,
} from './entities/auction/OpeningAuctionPositionManager';

// Export all types
export type {
  // Core types
  TokenConfig,
  DopplerERC20V1TokenConfig,
  SaleConfig,
  StaticPoolConfig,
  DynamicAuctionConfig,
  VestingConfig,
  VestingAllocationConfig,
  VestingScheduleConfig,
  MigrationConfig,
  ProceedsSplitConfig,
  StreamableFeesConfig,
  UniswapV2MigrationConfig,
  UniswapV2SplitMigrationConfig,
  UniswapV4MigrationConfig,
  UniswapV4SplitMigrationConfig,
  DopplerHookMigratorConfig,
  DopplerHookMigrationConfig,
  BeneficiaryData,

  // Lockable initializer types
  LockablePoolState,
  LockableV3InitializerParams,
  MulticurvePoolState,
  MulticurveMarketCapPreset,

  // DopplerHook types
  RehypeDopplerHookInitializerConfig,
  RehypeDopplerHookConfig,
  RehypeFeeDistributionInfo,
  RehypeIntegratorFeeConfig,
  MulticurveInitializerConfig,
  MulticurveDecayFeeSchedule,

  // Parameter types
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  V4PoolKey,
  MulticurveDevBuyVestingConfig,
  MulticurveDevBuyConfig,
  PreparedMulticurveTransaction,
  PreparedMulticurveDevBuy,
  SimulatedMulticurveCreate,
  MulticurveDevBuyResult,
  MulticurveCreateResult,
  OpeningAuctionState,
  OpeningAuctionCreateResult,
  OpeningAuctionCompleteResult,
  PrepareCreateMulticurveOptions,
  MulticurveCreateGasEstimate,
  MulticurveCreatePrediction,
  PreparedMulticurveCreate,
  ModuleAddressOverrides,
  // Configuration types
  DopplerSDKConfig,

  // Information types
  PoolInfo,
  HookInfo,
  QuoteResult,

  // Chain/public client helper types
  SupportedPublicClient,
  SupportedChain,

  // Governance helper types
  NoOpEnabledChainId,
  LaunchpadEnabledChainId,
  GovernanceOption,
  GovernanceLaunchpad,

  // Market cap configuration types
  MarketCapRange,
  DynamicMarketCapRange,
  MarketCapConfig,
  StaticAuctionMarketCapConfig,
  DynamicAuctionMarketCapConfig,
  MulticurveMarketCapRangeCurve,
  MulticurveMarketCapCurvesConfig,
  MarketCapValidationResult,

  // Internal create() param shape (advanced)
  CreateParams,
} from './types';

// Export runtime governance helpers (not types)
export {
  NO_OP_ENABLED_CHAIN_IDS,
  isNoOpEnabledChain,
  LAUNCHPAD_ENABLED_CHAIN_IDS,
  isLaunchpadEnabledChain,
} from './types';

// Export enums
export { LockablePoolStatus } from './types';
export { RehypeFeeRoutingMode } from './types';
export { OpeningAuctionStatus, OpeningAuctionPhase } from './types';

// Export addresses and utilities
export {
  ADDRESSES,
  CHAIN_IDS,
  getAddresses,
  SUPPORTED_CHAIN_IDS,
  isSupportedChainId,
} from './addresses';
export type {
  SupportedChainId,
  ChainAddresses,
  SupportedChainKey,
} from './addresses';

// Export constants (excluding MIN_SQRT_RATIO and MAX_SQRT_RATIO to avoid conflicts)
export {
  WAD,
  DEAD_ADDRESS,
  ZERO_ADDRESS,
  FEE_TIERS,
  TICK_SPACINGS,
  SECONDS_PER_DAY,
  SECONDS_PER_YEAR,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_AUCTION_DURATION,
  DEFAULT_LOCK_DURATION,
  DEFAULT_PD_SLUGS,
  DAY_SECONDS,
  DEFAULT_V3_START_TICK,
  DEFAULT_V3_END_TICK,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_FEE,
  DEFAULT_V3_INITIAL_VOTING_DELAY,
  DEFAULT_V3_INITIAL_VOTING_PERIOD,
  DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V3_VESTING_DURATION,
  DEFAULT_V3_INITIAL_SUPPLY,
  DEFAULT_V3_NUM_TOKENS_TO_SELL,
  DEFAULT_V3_YEARLY_MINT_RATE,
  DEFAULT_V3_PRE_MINT,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DEFAULT_MULTICURVE_LOWER_TICKS,
  DEFAULT_MULTICURVE_UPPER_TICKS,
  DEFAULT_MULTICURVE_NUM_POSITIONS,
  DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES,
  BASIS_POINTS,
  FLAG_MASK,
  DOPPLER_FLAGS,
  OPENING_AUCTION_FLAGS,
  OPENING_AUCTION_PHASE_NOT_STARTED,
  OPENING_AUCTION_PHASE_ACTIVE,
  OPENING_AUCTION_PHASE_CLOSED,
  OPENING_AUCTION_PHASE_SETTLED,
  OPENING_AUCTION_STATUS_UNINITIALIZED,
  OPENING_AUCTION_STATUS_ACTIVE,
  OPENING_AUCTION_STATUS_DOPPLER_ACTIVE,
  OPENING_AUCTION_STATUS_EXITED,
  INT24_MIN,
  INT24_MAX,
  DYNAMIC_FEE_FLAG,
  FEE_AMOUNT_MASK,
  DOPPLER_MAX_TICK_SPACING,
  DEFAULT_OPENING_AUCTION_DURATION,
  DEFAULT_OPENING_AUCTION_FEE,
  DEFAULT_OPENING_AUCTION_MIN_ACCEPTABLE_TICK_TOKEN0,
  DEFAULT_OPENING_AUCTION_MIN_ACCEPTABLE_TICK_TOKEN1,
  DEFAULT_OPENING_AUCTION_MIN_LIQUIDITY,
  DEFAULT_OPENING_AUCTION_INCENTIVE_SHARE_BPS,
  DEFAULT_OPENING_AUCTION_SHARE_TO_AUCTION_BPS,
  DEFAULT_OPENING_DOPPLER_DURATION,
  DEFAULT_OPENING_DOPPLER_EPOCH_LENGTH,
  DEFAULT_OPENING_DOPPLER_NUM_PD_SLUGS,
  DEFAULT_OPENING_DOPPLER_FEE,
  DEFAULT_OPENING_DOPPLER_TICK_SPACING,
  VALID_FEE_TIERS,
  V3_FEE_TIERS,
  V4_MAX_FEE,
  DECAY_MAX_START_FEE,
  type FeeTier,
} from './constants';

// Export utility functions (includes MIN_SQRT_RATIO and MAX_SQRT_RATIO from tickMath)
export * from './utils';

// Export ABIs
export * from './abis';
