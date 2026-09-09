import type { Address, Hex } from 'viem';
import {
  DEFAULT_V3_YEARLY_MINT_RATE,
  DECAY_MAX_START_FEE,
  FEE_TIERS,
  TICK_SPACINGS,
  V4_MAX_FEE,
  WAD,
  ZERO_ADDRESS,
} from '../constants';

import {
  marketCapToTicksForMulticurve,
  marketCapToTickForMulticurve,
  validateMarketCapParameters,
  getMaxLiquiditySafeMulticurveTickUpper,
  normalizeRehypeDopplerHookInitializerConfig,
} from '../utils';
import {
  isNoOpEnabledChain,
  isLaunchpadEnabledChain,
  type CreateMulticurveParams,
  type GovernanceOption,
  type MigrationConfig,
  type VestingConfig,
  type TokenConfig,
  type MulticurveMarketCapCurvesConfig,
  type MulticurveMarketCapPreset,
  type ModuleAddressOverrides,
  type RehypeDopplerHookConfig,
  type RehypeDopplerHookInitializerConfig,
  type MulticurveInitializerConfig,
  type MulticurveDevBuyConfig,
} from '../types';
import { type SupportedChainId } from '../addresses';
import {
  type BaseAuctionBuilder,
  type BuilderVestingInput,
  type BuilderDevBuyInput,
  type MarketCapPresetOverrides,
  buildCurvesFromPresets,
  normalizeBuilderTokenConfig,
  normalizeBuilderVestingSchedule,
  normalizeBuilderDevBuy,
} from './shared';

export class MulticurveBuilder<
  C extends SupportedChainId,
> implements BaseAuctionBuilder<C> {
  private token?: TokenConfig;
  private sale?: CreateMulticurveParams<C>['sale'];
  private pool?: CreateMulticurveParams<C>['pool'];
  private initializer?: CreateMulticurveParams<C>['initializer'];
  private schedule?: CreateMulticurveParams<C>['schedule'];
  private dopplerHook?: RehypeDopplerHookInitializerConfig;
  private vesting?: VestingConfig;
  private devBuy?: MulticurveDevBuyConfig;
  private governance?: GovernanceOption<C>;
  private migration?: MigrationConfig;
  private integrator?: Address;
  private userAddress?: Address;
  private salt?: Hex;
  private moduleAddresses?: ModuleAddressOverrides;
  private gasLimit?: bigint;
  private feeDistributionControllerAddress?: Address;
  // Stored from withCurves() for graduationMarketCap conversion in build()
  private numerairePrice?: number;
  private tokenDecimals?: number;
  private numeraireDecimals?: number;
  // Deferred curves config - converted to pool in build()
  private curvesConfig?: {
    numerairePrice: number;
    curves: Array<{
      marketCap: { start: number; end: number | 'max' };
      numPositions: number;
      shares: bigint;
    }>;
    tokenSupply?: bigint;
    tokenDecimals?: number;
    numeraireDecimals?: number;
    fee?: number;
    tickSpacing?: number;
    beneficiaries?: { beneficiary: Address; shares: bigint }[];
  };
  public chainId: C;

  constructor(chainId: C) {
    this.chainId = chainId;
  }

  static forChain<C extends SupportedChainId>(
    chainId: C,
  ): MulticurveBuilder<C> {
    return new MulticurveBuilder(chainId);
  }

  tokenConfig(params: TokenConfig): this {
    this.token = normalizeBuilderTokenConfig(
      params,
      DEFAULT_V3_YEARLY_MINT_RATE,
    );
    return this;
  }

  saleConfig(params: {
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address;
  }): this {
    this.sale = {
      initialSupply: params.initialSupply,
      numTokensToSell: params.numTokensToSell,
      numeraire: params.numeraire,
    };
    return this;
  }

  poolConfig(params: {
    fee: number;
    tickSpacing: number;
    curves: {
      tickLower: number;
      tickUpper: number;
      numPositions: number;
      shares: bigint;
    }[];
    beneficiaries?: { beneficiary: Address; shares: bigint }[];
  }): this {
    // Mutual exclusion: cannot use poolConfig() after withCurves()
    if (this.curvesConfig) {
      throw new Error(
        'Cannot use poolConfig() after withCurves(). ' +
          'Use withCurves() for market cap-based configuration, ' +
          'or poolConfig() for manual tick configuration.',
      );
    }

    const sortedBeneficiaries = params.beneficiaries
      ? [...params.beneficiaries].sort((a, b) => {
          const aAddr = a.beneficiary.toLowerCase();
          const bAddr = b.beneficiary.toLowerCase();
          return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0;
        })
      : undefined;

    this.pool = {
      fee: params.fee,
      tickSpacing: params.tickSpacing,
      curves: params.curves,
      beneficiaries: sortedBeneficiaries,
    };
    return this;
  }

  withMarketCapPresets(params?: {
    fee?: number;
    tickSpacing?: number;
    presets?: MulticurveMarketCapPreset[];
    overrides?: MarketCapPresetOverrides;
    beneficiaries?: { beneficiary: Address; shares: bigint }[];
  }): this {
    // Mutual exclusion: cannot use withMarketCapPresets() after withCurves()
    if (this.curvesConfig) {
      throw new Error(
        'Cannot use withMarketCapPresets() after withCurves(). ' +
          'Use withCurves() for market cap-based configuration, ' +
          'or withMarketCapPresets() for preset-based configuration.',
      );
    }

    const { fee, tickSpacing, curves } = buildCurvesFromPresets({
      fee: params?.fee,
      tickSpacing: params?.tickSpacing,
      presets: params?.presets,
      overrides: params?.overrides,
    });

    return this.poolConfig({
      fee,
      tickSpacing,
      curves,
      beneficiaries: params?.beneficiaries,
    });
  }

  /**
   * Configure multicurve using market cap ranges (no tick math required).
   *
   * This is the recommended way to configure multicurve pools. Simply specify
   * market cap ranges in USD for each curve.
   *
   * Curves can be provided in any order - they will be automatically sorted
   * by market cap (ascending) before validation and processing. Curves must
   * be contiguous or overlapping (no gaps allowed).
   *
   * V4 pools support custom fees (0-100,000). Standard fee tiers auto-derive
   * tickSpacing; custom fees require explicit tickSpacing parameter.
   *
   * @param params - Market cap configuration with curves defined by market cap ranges
   * @returns Builder instance for chaining
   *
   * @example Standard fee tier
   * ```ts
   * builder
   *   .saleConfig({ initialSupply, numTokensToSell, numeraire: WETH })
   *   .withCurves({
   *     numerairePrice: 3000,
   *     curves: [...],
   *     fee: 500, // Standard tier, tickSpacing auto-derived
   *   })
   * ```
   *
   * @example Custom fee
   * ```ts
   * builder
   *   .saleConfig({ initialSupply, numTokensToSell, numeraire: WETH })
   *   .withCurves({
   *     numerairePrice: 3000,
   *     curves: [...],
   *     fee: 2500,      // Custom 0.25% fee
   *     tickSpacing: 10, // Required for custom fees
   *   })
   * ```
   */
  withCurves(params: MulticurveMarketCapCurvesConfig): this {
    // Mutual exclusion: cannot use withCurves() after poolConfig()/withMarketCapPresets()
    if (this.pool) {
      throw new Error(
        'Cannot use withCurves() after poolConfig()/withMarketCapPresets(). ' +
          'Use withCurves() for market cap-based configuration, ' +
          'or poolConfig() for manual tick configuration.',
      );
    }

    // Validate numerairePrice
    if (params.numerairePrice <= 0) {
      throw new Error('numerairePrice must be greater than 0');
    }

    // Validate curves array
    if (!params.curves || params.curves.length === 0) {
      throw new Error('curves array must contain at least one curve');
    }

    // Validate each curve (basic validation that doesn't require saleConfig)
    for (let i = 0; i < params.curves.length; i++) {
      const curve = params.curves[i];
      this.validateCurveRange(
        curve.marketCap.start,
        curve.marketCap.end,
        curve.numPositions,
        curve.shares,
        `curves[${i}]`,
      );
    }

    // Sort curves by market cap (start, then end) for deterministic ordering
    const sortedCurves = this.sortCurvesByMarketCap(params.curves);

    // Validate curve contiguity (no gaps allowed, overlaps OK)
    this.validateCurveContiguity(sortedCurves);

    // Validate total shares sum to exactly WAD
    const totalShares = sortedCurves.reduce((sum, c) => sum + c.shares, 0n);
    if (totalShares !== WAD) {
      throw new Error(
        `Total curve shares must equal 100% (${WAD}). Got ${totalShares} (${Number((totalShares * 10000n) / WAD) / 100}%)`,
      );
    }

    // Validate fee if provided
    if (params.fee !== undefined && params.fee < 0) {
      throw new Error(`Curve fee cannot be negative (got ${params.fee})`);
    }
    if (params.fee !== undefined && params.fee > V4_MAX_FEE) {
      throw new Error(
        `Fee ${params.fee} exceeds maximum allowed for V4 pools (${V4_MAX_FEE} = 10%). ` +
          `Use a fee between 0 and ${V4_MAX_FEE}.`,
      );
    }

    // Store for later use in build() (graduationMarketCap conversion)
    this.numerairePrice = params.numerairePrice;
    this.tokenDecimals = params.tokenDecimals;
    this.numeraireDecimals = params.numeraireDecimals;

    // Store config for deferred conversion in build()
    this.curvesConfig = {
      numerairePrice: params.numerairePrice,
      curves: sortedCurves,
      tokenSupply: params.tokenSupply,
      tokenDecimals: params.tokenDecimals,
      numeraireDecimals: params.numeraireDecimals,
      fee: params.fee,
      tickSpacing: params.tickSpacing,
      beneficiaries: params.beneficiaries,
    };

    return this;
  }

  /**
   * Sort curves by market cap (start, then end) for deterministic ordering
   */
  private sortCurvesByMarketCap<
    T extends { marketCap: { start: number; end: number | 'max' } },
  >(curves: T[]): T[] {
    return [...curves].sort((a, b) => {
      const startDiff = a.marketCap.start - b.marketCap.start;
      if (startDiff !== 0) return startDiff;
      const aEnd = a.marketCap.end === 'max' ? Infinity : a.marketCap.end;
      const bEnd = b.marketCap.end === 'max' ? Infinity : b.marketCap.end;
      return aEnd - bEnd;
    });
  }

  private validateCurveRange(
    startMarketCap: number,
    endMarketCap: number | 'max',
    numPositions: number,
    shares: bigint,
    label: string,
  ): void {
    if (startMarketCap <= 0) {
      throw new Error(`${label}: marketCap.start must be greater than 0`);
    }
    if (endMarketCap !== 'max' && endMarketCap <= 0) {
      throw new Error(`${label}: marketCap.end must be greater than 0`);
    }
    if (endMarketCap !== 'max' && startMarketCap >= endMarketCap) {
      throw new Error(
        `${label}: startMarketCap ($${startMarketCap.toLocaleString()}) must be less than endMarketCap ($${endMarketCap.toLocaleString()})`,
      );
    }
    if (numPositions <= 0) {
      throw new Error(`${label}: numPositions must be greater than 0`);
    }
    if (shares <= 0n) {
      throw new Error(`${label}: shares must be greater than 0`);
    }
  }

  private validateCurveContiguity(
    sortedCurves: { marketCap: { start: number; end: number | 'max' } }[],
  ): void {
    if (sortedCurves.length <= 1) {
      return;
    }

    for (let i = 1; i < sortedCurves.length; i++) {
      const prevCurve = sortedCurves[i - 1];
      const currCurve = sortedCurves[i];
      const prevEnd =
        prevCurve.marketCap.end === 'max' ? Infinity : prevCurve.marketCap.end;
      const prevEndLabel =
        prevCurve.marketCap.end === 'max'
          ? 'max'
          : `$${prevCurve.marketCap.end.toLocaleString()}`;
      const currEndLabel =
        currCurve.marketCap.end === 'max'
          ? 'max'
          : `$${currCurve.marketCap.end.toLocaleString()}`;

      if (currCurve.marketCap.start > prevEnd) {
        throw new Error(
          `Gap detected between market cap ranges: ` +
            `$${prevCurve.marketCap.start.toLocaleString()}-${prevEndLabel} ` +
            `and $${currCurve.marketCap.start.toLocaleString()}-${currEndLabel}. ` +
            `Curves must be contiguous or overlapping.`,
        );
      }
    }
  }

  /**
   * Configure a RehypeDopplerHookInitializer for the pool.
   *
   * When configured, the hook will be initialized with the pool and will handle:
   * - Custom swap fees
   * - Residual fee distribution to beneficiaries, LPs, and buyback destinations
   * - An optional, independently routed integrator share of gross hook fees
   * IMPORTANT:
   * - The hook address must be whitelisted in the DopplerHookInitializer
   * - Fee distribution percentages must sum to exactly WAD (1e18 = 100%)
   * - integratorFeeConfig.integrator defaults to withIntegrator(address)
   * @example
   * ```typescript
   * builder.withIntegrator('0x...').withRehypeDopplerHookInitializer({
   *   hookAddress: '0x...',
   *   buybackDestination: '0x...',
   *   startFee: 3000, // 0.3%
   *   endFee: 3000,
   *   durationSeconds: 0,
   *   feeDistributionInfo: {
   *     assetFeesToAssetBuybackWad: parseEther('0.2'),
   *     assetFeesToNumeraireBuybackWad: parseEther('0.2'),
   *     assetFeesToBeneficiaryWad: parseEther('0.3'),
   *     assetFeesToLpWad: parseEther('0.3'),
   *     numeraireFeesToAssetBuybackWad: parseEther('0.2'),
   *     numeraireFeesToNumeraireBuybackWad: parseEther('0.2'),
   *     numeraireFeesToBeneficiaryWad: parseEther('0.3'),
   *     numeraireFeesToLpWad: parseEther('0.3'),
   *   },
   *   integratorFeeConfig: {
   *     feeShare: 200_000, // 20% of the Rehype hook fee
   *     assetFeesToNumeraireRatio: 500_000_000, // Convert 50%
   *     automaticPayout: false,
   *   },
   * })
   * ```
   */
  withRehypeDopplerHookInitializer(
    params: RehypeDopplerHookInitializerConfig,
  ): this {
    this.assertCanSetInitializer('rehype');

    // Validate mutual exclusivity of graduation threshold options
    if (
      params.graduationMarketCap !== undefined &&
      params.farTick !== undefined
    ) {
      throw new Error(
        'Cannot specify both graduationMarketCap and farTick. Use one or the other.',
      );
    }

    if (
      params.buybackDestination !== undefined &&
      this.feeDistributionControllerAddress !== undefined
    ) {
      throw new Error(
        'Rehype buybackDestination and withFeeDistributionController are mutually exclusive',
      );
    }

    // Validate immediately when all inherited values are known. Otherwise,
    // build() validates after controller and integrator methods can be chained.
    const needsInheritedIntegrator =
      params.integratorFeeConfig !== undefined &&
      params.integratorFeeConfig.integrator === undefined;
    const canResolveIntegrator =
      !needsInheritedIntegrator || this.integrator !== undefined;
    if (
      (params.buybackDestination !== undefined ||
        this.feeDistributionControllerAddress !== undefined) &&
      canResolveIntegrator
    ) {
      normalizeRehypeDopplerHookInitializerConfig(
        params,
        this.feeDistributionControllerAddress,
        this.integrator,
      );
    }

    this.dopplerHook = params;
    this.initializer = { type: 'rehype', config: params };
    return this;
  }

  /** @deprecated Use withRehypeDopplerHookInitializer instead. */
  withRehypeDopplerHook(params: RehypeDopplerHookConfig): this {
    return this.withRehypeDopplerHookInitializer(params);
  }

  withVesting(params?: BuilderVestingInput): this {
    if (!params) {
      this.vesting = undefined;
      return this;
    }
    if (params.allocations) {
      this.vesting = {
        allocations: params.allocations.map((allocation, index) => ({
          recipient: allocation.recipient,
          amount: allocation.amount,
          schedule: normalizeBuilderVestingSchedule(
            allocation.schedule,
            `Vesting allocations[${index}].schedule`,
          ),
        })),
      };
      return this;
    }

    this.vesting = {
      duration: Number(params.duration ?? 0n),
      cliffDuration: params.cliffDuration ?? 0,
      recipients: params.recipients,
      amounts: params.amounts,
    };
    return this;
  }

  /**
   * Configures an exact-input purchase executed atomically with market creation.
   *
   * Omit `vesting` for direct delivery to `recipient`; when present, Bundler
   * holds the output and releases it under that schedule. This is independent
   * from `withVesting`, which configures token allocation vesting. Passing
   * `undefined` clears the dev buy.
   */
  withDevBuy(params?: BuilderDevBuyInput): this {
    this.devBuy = params ? normalizeBuilderDevBuy(params) : undefined;
    return this;
  }

  private parseStartTimeSeconds(
    value: number | bigint | Date,
    label: string,
  ): number {
    let startTimeSeconds: number;
    if (value instanceof Date) {
      startTimeSeconds = Math.floor(value.getTime() / 1000);
    } else if (typeof value === 'bigint') {
      startTimeSeconds = Number(value);
    } else {
      startTimeSeconds = Number(value);
    }

    if (
      !Number.isFinite(startTimeSeconds) ||
      !Number.isInteger(startTimeSeconds)
    ) {
      throw new Error(
        `${label} must be an integer number of seconds since Unix epoch`,
      );
    }

    if (startTimeSeconds < 0) {
      throw new Error(`${label} cannot be negative`);
    }

    const UINT32_MAX = 0xffffffff;
    if (startTimeSeconds > UINT32_MAX) {
      throw new Error(
        `${label} must fit within uint32 (seconds since Unix epoch up to year 2106)`,
      );
    }

    return startTimeSeconds;
  }

  private assertCanSetInitializer(
    nextType: MulticurveInitializerConfig['type'],
  ): void {
    const currentType = this.initializer?.type;
    if (
      currentType === undefined ||
      currentType === nextType ||
      (currentType === 'dopplerHookInitializer' && nextType === 'rehype')
    ) {
      return;
    }
    throw new Error(
      `Cannot set multicurve initializer to '${nextType}' because it is already configured as '${currentType}'`,
    );
  }

  /**
   * Configure decay multicurve initializer settings.
   *
   * The pool's terminal fee is always taken from `poolConfig().fee`.
   * `startFee` must be greater than or equal to that terminal fee.
   * `startTime` is optional and defaults to `0` when omitted.
   */
  withDecay(params?: {
    startTime?: number | bigint | Date;
    startFee: number;
    durationSeconds: number | bigint;
  }): this {
    if (!params) {
      if (this.initializer?.type === 'decay') {
        this.initializer = undefined;
      }
      return this;
    }

    this.assertCanSetInitializer('decay');

    const startTime =
      params.startTime === undefined
        ? 0
        : this.parseStartTimeSeconds(params.startTime, 'Decay startTime');
    const startFee = Number(params.startFee);
    const durationSeconds = Number(params.durationSeconds);

    if (!Number.isFinite(startFee) || !Number.isInteger(startFee)) {
      throw new Error('Decay startFee must be an integer');
    }
    if (startFee < 0 || startFee > DECAY_MAX_START_FEE) {
      throw new Error(
        `Decay startFee must be between 0 and ${DECAY_MAX_START_FEE} (80%)`,
      );
    }
    if (
      !Number.isFinite(durationSeconds) ||
      !Number.isInteger(durationSeconds)
    ) {
      throw new Error('Decay durationSeconds must be an integer');
    }
    if (durationSeconds < 0) {
      throw new Error('Decay durationSeconds cannot be negative');
    }
    const UINT32_MAX = 0xffffffff;
    if (durationSeconds > UINT32_MAX) {
      throw new Error('Decay durationSeconds must fit within uint32');
    }

    this.schedule = undefined;
    this.initializer = {
      type: 'decay',
      startTime,
      startFee,
      durationSeconds,
    };
    return this;
  }

  withSchedule(params?: { startTime: number | bigint | Date }): this {
    if (!params) {
      if (this.initializer?.type === 'scheduled') {
        this.initializer = undefined;
      }
      this.schedule = undefined;
      return this;
    }

    this.assertCanSetInitializer('scheduled');
    const startTimeSeconds = this.parseStartTimeSeconds(
      params.startTime,
      'Schedule startTime',
    );
    this.schedule = { startTime: startTimeSeconds };
    this.initializer = { type: 'scheduled', startTime: startTimeSeconds };
    return this;
  }

  withGovernance(params: GovernanceOption<C>): this {
    this.governance = params;
    return this;
  }

  /**
   * Configure the address authorized to update a Rehype pool's fee
   * distribution matrix.
   *
   * This sets the on-chain `buybackDst`, which also receives direct-buyback
   * proceeds and legacy empty-beneficiary fees. Every Rehype initializer
   * requires either this method or `buybackDestination`; they configure the
   * same field and cannot be used together.
   */
  withFeeDistributionController(address: Address): this {
    if (this.dopplerHook?.buybackDestination !== undefined) {
      throw new Error(
        'Rehype buybackDestination and withFeeDistributionController are mutually exclusive',
      );
    }
    this.feeDistributionControllerAddress = address;
    return this;
  }

  withMigration(migration: MigrationConfig): this {
    this.migration = migration;
    return this;
  }

  withUserAddress(address: Address): this {
    this.userAddress = address;
    return this;
  }

  withIntegrator(address?: Address): this {
    this.integrator = address ?? ZERO_ADDRESS;
    return this;
  }

  withSalt(salt?: Hex): this {
    this.salt = salt;
    return this;
  }

  withGasLimit(gas?: bigint): this {
    this.gasLimit = gas;
    return this;
  }

  private overrideModule<K extends keyof ModuleAddressOverrides>(
    key: K,
    address: NonNullable<ModuleAddressOverrides[K]>,
  ): this {
    this.moduleAddresses = {
      ...this.moduleAddresses,
      [key]: address,
    } as ModuleAddressOverrides;
    return this;
  }

  withTokenFactory(address: Address): this {
    return this.overrideModule('tokenFactory', address);
  }
  withAirlock(address: Address): this {
    return this.overrideModule('airlock', address);
  }
  withBundler(address: Address): this {
    return this.overrideModule('bundler', address);
  }
  withV4MulticurveInitializer(address: Address): this {
    this.assertCanSetInitializer('standard');
    this.initializer = { type: 'standard' };
    return this.overrideModule('v4MulticurveInitializer', address);
  }
  withV4ScheduledMulticurveInitializer(address: Address): this {
    return this.overrideModule('v4ScheduledMulticurveInitializer', address);
  }
  withV4DecayMulticurveInitializer(address: Address): this {
    return this.overrideModule('v4DecayMulticurveInitializer', address);
  }
  withGovernanceFactory(address: Address): this {
    return this.overrideModule('governanceFactory', address);
  }
  withV2Migrator(address: Address): this {
    return this.overrideModule('v2Migrator', address);
  }

  withV2MigratorSplit(address: Address): this {
    return this.overrideModule('v2MigratorSplit', address);
  }

  withV4Migrator(address: Address): this {
    return this.overrideModule('v4Migrator', address);
  }
  withV4MigratorSplit(address: Address): this {
    return this.overrideModule('v4MigratorSplit', address);
  }
  withNoOpMigrator(address: Address): this {
    return this.overrideModule('noOpMigrator', address);
  }
  withDopplerHookInitializer(address: Address): this {
    if (this.initializer?.type !== 'rehype') {
      this.assertCanSetInitializer('dopplerHookInitializer');
      this.initializer = { type: 'dopplerHookInitializer' };
    }
    return this.overrideModule('dopplerHookInitializer', address);
  }

  build(): CreateMulticurveParams<C> {
    if (!this.token) throw new Error('tokenConfig is required');
    if (!this.sale) throw new Error('saleConfig is required');
    if (!this.migration) throw new Error('migration configuration is required');
    if (!this.userAddress) throw new Error('userAddress is required');

    // Convert deferred curves config to pool if set
    if (this.curvesConfig && !this.pool) {
      const config = this.curvesConfig;

      // Get token supply from config or saleConfig
      const tokenSupply = config.tokenSupply ?? this.sale.initialSupply;
      if (!tokenSupply) {
        throw new Error(
          'tokenSupply must be provided (either via saleConfig() or withCurves() params)',
        );
      }

      // Get fee and tick spacing
      const fee = config.fee ?? FEE_TIERS.MEDIUM;
      const tickSpacing =
        config.tickSpacing ?? (TICK_SPACINGS as Record<number, number>)[fee];

      if (tickSpacing === undefined) {
        throw new Error(
          `Custom fee ${fee} requires explicit tickSpacing. ` +
            `Standard fees (100, 500, 3000, 10000) auto-derive tickSpacing.`,
        );
      }

      // Validate first curve market caps (the launch price)
      const firstCurve = config.curves[0];
      const startValidation = validateMarketCapParameters(
        firstCurve.marketCap.start,
        tokenSupply,
        config.tokenDecimals,
      );
      const endValidation =
        firstCurve.marketCap.end === 'max'
          ? { valid: true, warnings: [] }
          : validateMarketCapParameters(
              firstCurve.marketCap.end,
              tokenSupply,
              config.tokenDecimals,
            );
      const allWarnings = [
        ...startValidation.warnings,
        ...endValidation.warnings,
      ];
      if (allWarnings.length > 0) {
        console.warn('First curve market cap validation warnings:');
        allWarnings.forEach((w) => console.warn(`  - ${w}`));
      }

      // Convert all curves to ticks
      const curves: {
        tickLower: number;
        tickUpper: number;
        numPositions: number;
        shares: bigint;
      }[] = [];

      for (const curve of config.curves) {
        const curveTicks = marketCapToTicksForMulticurve({
          marketCapLower: curve.marketCap.start,
          marketCapUpper: curve.marketCap.end,
          tokenSupply,
          numerairePriceUSD: config.numerairePrice,
          tickSpacing,
          tokenDecimals: config.tokenDecimals ?? 18,
          numeraireDecimals: config.numeraireDecimals ?? 18,
        });
        const curveSupply = (this.sale.numTokensToSell * curve.shares) / WAD;
        const tickUpper =
          curve.marketCap.end === 'max'
            ? getMaxLiquiditySafeMulticurveTickUpper({
                ...curveTicks,
                tickSpacing,
                numPositions: curve.numPositions,
                curveSupply,
              })
            : curveTicks.tickUpper;

        curves.push({
          tickLower: curveTicks.tickLower,
          tickUpper,
          numPositions: curve.numPositions,
          shares: curve.shares,
        });
      }

      // Sort beneficiaries by address if provided
      const sortedBeneficiaries = config.beneficiaries
        ? [...config.beneficiaries].sort((a, b) => {
            const aAddr = a.beneficiary.toLowerCase();
            const bAddr = b.beneficiary.toLowerCase();
            return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0;
          })
        : undefined;

      // Set pool config
      this.pool = {
        fee,
        tickSpacing,
        curves,
        beneficiaries: sortedBeneficiaries,
      };
    }

    if (!this.pool) throw new Error('poolConfig is required');

    // Validate noOp migration requires beneficiaries
    // NoOpMigrator is designed for locked pools with beneficiaries. Without beneficiaries,
    // the pool status is "Initialized" (not "Locked"), meaning exitLiquidity() can be called.
    // But NoOpMigrator.migrate() always reverts, so the entire graduation transaction fails
    // and liquidity becomes trapped.
    if (this.migration.type === 'noOp') {
      const hasBeneficiaries =
        this.pool.beneficiaries && this.pool.beneficiaries.length > 0;
      if (!hasBeneficiaries) {
        throw new Error(
          'noOp migration requires beneficiaries. Without beneficiaries, the pool would be stuck after reaching ' +
            'graduation - exitLiquidity() succeeds but NoOpMigrator.migrate() always reverts, causing the entire ' +
            'transaction to fail. Either add beneficiaries or use a different migration type (uniswapV2, uniswapV4).',
        );
      }
    }

    if (
      this.feeDistributionControllerAddress !== undefined &&
      this.dopplerHook === undefined
    ) {
      throw new Error(
        'withFeeDistributionController requires a Rehype initializer configuration',
      );
    }

    // Default governance: noOp on supported chains, default on others (e.g., Ink)
    const governance =
      this.governance ??
      (isNoOpEnabledChain(this.chainId)
        ? { type: 'noOp' as const }
        : { type: 'default' as const });

    if (
      governance.type === 'launchpad' &&
      !isLaunchpadEnabledChain(this.chainId)
    ) {
      throw new Error(
        `Launchpad governance is not supported on chain ${this.chainId}. Use a supported chain or a different governance type.`,
      );
    }

    // Resolve the on-chain buybackDst only after governance is known.
    let dopplerHook = this.dopplerHook;
    if (dopplerHook) {
      dopplerHook = normalizeRehypeDopplerHookInitializerConfig(
        dopplerHook,
        this.feeDistributionControllerAddress,
        this.integrator,
      );
    }

    // Convert graduationMarketCap to farTick if using rehype
    if (dopplerHook?.graduationMarketCap !== undefined) {
      // Use numerairePrice from: 1) explicit in dopplerHook, 2) stored from withCurves()
      const numerairePrice = dopplerHook.numerairePrice ?? this.numerairePrice;

      if (!numerairePrice) {
        throw new Error(
          'graduationMarketCap requires numerairePrice. ' +
            'Either use withCurves() (which provides numerairePrice), ' +
            'or pass numerairePrice explicitly in withRehypeDopplerHookInitializer().',
        );
      }

      if (dopplerHook.graduationMarketCap <= 0) {
        throw new Error('graduationMarketCap must be greater than 0');
      }

      const farTick = marketCapToTickForMulticurve({
        marketCapUSD: dopplerHook.graduationMarketCap,
        tokenSupply: this.sale.initialSupply,
        numerairePriceUSD: numerairePrice,
        tickSpacing: this.pool.tickSpacing,
        tokenDecimals: this.tokenDecimals ?? 18,
        numeraireDecimals: this.numeraireDecimals ?? 18,
      });

      // Validate farTick is within curve boundaries
      const allTickUppers = this.pool.curves.map((c) => c.tickUpper);
      const allTickLowers = this.pool.curves.map((c) => c.tickLower);
      const maxTickUpper = Math.max(...allTickUppers);
      const minTickLower = Math.min(...allTickLowers);

      if (farTick < minTickLower) {
        throw new Error(
          `graduationMarketCap converts to tick ${farTick}, which is below the lowest curve tick (${minTickLower})`,
        );
      }
      if (farTick > maxTickUpper) {
        throw new Error(
          `graduationMarketCap converts to tick ${farTick}, which is above the highest curve tick (${maxTickUpper})`,
        );
      }

      // Store computed farTick on dopplerHook for encoding
      dopplerHook = { ...dopplerHook, farTick };
    }

    const initializer: MulticurveInitializerConfig =
      this.initializer?.type === 'rehype' && dopplerHook
        ? { type: 'rehype', config: dopplerHook }
        : (this.initializer ??
          (dopplerHook
            ? { type: 'rehype', config: dopplerHook }
            : this.schedule
              ? { type: 'scheduled', startTime: this.schedule.startTime }
              : { type: 'dopplerHookInitializer' }));

    if (initializer.type === 'scheduled' && dopplerHook) {
      throw new Error(
        'Cannot combine scheduled multicurve with rehype initializer. Use exactly one initializer mode.',
      );
    }
    if (initializer.type === 'decay' && dopplerHook) {
      throw new Error(
        'Cannot combine decay multicurve with rehype initializer. Use exactly one initializer mode.',
      );
    }
    if (initializer.type === 'decay') {
      const startFee = Number(initializer.startFee);
      const terminalFee = Number(this.pool.fee);

      if (startFee < terminalFee) {
        throw new Error(
          `Decay startFee (${startFee}) must be greater than or equal to terminal pool fee (${terminalFee})`,
        );
      }

      if (startFee > terminalFee && initializer.durationSeconds <= 0) {
        throw new Error(
          'Decay durationSeconds must be greater than 0 when startFee is greater than pool.fee',
        );
      }
    }

    if (
      this.devBuy &&
      initializer.type !== 'dopplerHookInitializer' &&
      initializer.type !== 'dopplerHook' &&
      initializer.type !== 'rehype'
    ) {
      throw new Error(
        `Dev buys require a DopplerHookInitializer or Rehype initializer; '${initializer.type}' is not supported`,
      );
    }

    const schedule =
      initializer.type === 'scheduled'
        ? { startTime: initializer.startTime }
        : undefined;
    dopplerHook =
      initializer.type === 'rehype' ? initializer.config : undefined;

    return {
      token: this.token,
      sale: this.sale,
      pool: this.pool,
      initializer,
      schedule,
      dopplerHook,
      vesting: this.vesting,
      devBuy: this.devBuy
        ? {
            ...this.devBuy,
            vesting: { ...this.devBuy.vesting },
          }
        : undefined,
      governance: governance as GovernanceOption<C>,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
      salt: this.salt,
      modules: this.moduleAddresses,
      gas: this.gasLimit,
    };
  }
}
