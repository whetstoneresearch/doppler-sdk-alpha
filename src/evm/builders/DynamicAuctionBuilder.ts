import type { Address } from 'viem';
import {
  DEFAULT_AUCTION_DURATION,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DOPPLER_MAX_TICK_SPACING,
  FEE_TIERS,
  V4_MAX_FEE,
  ZERO_ADDRESS,
} from '../constants';
import {
  computeOptimalGamma,
  marketCapToTicksForDynamicAuction,
  validateMarketCapParameters,
} from '../utils';
import {
  isNoOpEnabledChain,
  isLaunchpadEnabledChain,
  type CreateDynamicAuctionParams,
  type GovernanceOption,
  type MigrationConfig,
  type PriceRange,
  type VestingConfig,
  type TokenConfig,
  type DynamicAuctionMarketCapConfig,
  type ModuleAddressOverrides,
} from '../types';
import { type SupportedChainId } from '../addresses';
import {
  computeTicks,
  normalizeBuilderTokenConfig,
  normalizeBuilderVestingSchedule,
  type BaseAuctionBuilder,
  type BuilderVestingInput,
} from './shared';

export class DynamicAuctionBuilder<
  C extends SupportedChainId,
> implements BaseAuctionBuilder<C> {
  private token?: TokenConfig;
  private sale?: CreateDynamicAuctionParams<C>['sale'];
  private auction?: CreateDynamicAuctionParams<C>['auction'];
  private pool?: CreateDynamicAuctionParams<C>['pool'];
  private vesting?: VestingConfig;
  private governance?: GovernanceOption<C>;
  private migration?: MigrationConfig;
  private integrator?: Address;
  private userAddress?: Address;
  private startTimeOffset?: number;
  private blockTimestamp?: number;
  private moduleAddresses?: ModuleAddressOverrides;
  private gasLimit?: bigint;
  // Deferred market cap config - converted to pool and auction in build()
  private marketCapConfig?: {
    marketCap: { start: number; min: number };
    numerairePrice: number;
    tokenSupply?: bigint;
    tokenDecimals?: number;
    numeraireDecimals?: number;
    fee?: number;
    tickSpacing?: number;
    minProceeds: bigint;
    maxProceeds: bigint;
    duration?: number;
    epochLength?: number;
    gamma?: number;
    numPdSlugs?: number;
  };
  public chainId: C;

  constructor(chainId: C) {
    this.chainId = chainId;
  }

  static forChain<C extends SupportedChainId>(
    chainId: C,
  ): DynamicAuctionBuilder<C> {
    return new DynamicAuctionBuilder(chainId);
  }

  tokenConfig(params: TokenConfig): this {
    this.token = normalizeBuilderTokenConfig(
      params,
      DEFAULT_V4_YEARLY_MINT_RATE,
    );
    return this;
  }

  saleConfig(params: {
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire?: Address;
  }): this {
    this.sale = {
      initialSupply: params.initialSupply,
      numTokensToSell: params.numTokensToSell,
      numeraire: params.numeraire ?? ZERO_ADDRESS,
    };
    return this;
  }

  poolConfig(params: { fee: number; tickSpacing: number }): this {
    // Mutual exclusion: cannot use poolConfig() after withMarketCapRange()
    if (this.marketCapConfig) {
      throw new Error(
        'Cannot use poolConfig() after withMarketCapRange(). ' +
          'Use withMarketCapRange() for market cap-based configuration, ' +
          'or poolConfig() + auctionByTicks() for manual tick configuration.',
      );
    }

    // Validate tick spacing against Doppler contract constraint
    if (params.tickSpacing > DOPPLER_MAX_TICK_SPACING) {
      throw new Error(
        `Dynamic auctions require tickSpacing <= ${DOPPLER_MAX_TICK_SPACING} (Doppler.sol MAX_TICK_SPACING). ` +
          `Got tickSpacing=${params.tickSpacing}. ` +
          `Use a smaller tickSpacing, or use withMarketCapRange() which handles this automatically.`,
      );
    }

    this.pool = { fee: params.fee, tickSpacing: params.tickSpacing };
    return this;
  }

  // Provide ticks directly
  auctionByTicks(params: {
    startTick: number;
    endTick: number;
    minProceeds: bigint;
    maxProceeds: bigint;
    duration?: number;
    epochLength?: number;
    gamma?: number;
    numPdSlugs?: number;
  }): this {
    const duration = params.duration ?? DEFAULT_AUCTION_DURATION;
    const epochLength = params.epochLength ?? DEFAULT_EPOCH_LENGTH;
    const gamma =
      params.gamma ??
      (this.pool
        ? computeOptimalGamma(
            params.startTick,
            params.endTick,
            duration,
            epochLength,
            this.pool.tickSpacing,
          )
        : undefined);
    this.auction = {
      duration,
      epochLength,
      startTick: params.startTick,
      endTick: params.endTick,
      gamma,
      minProceeds: params.minProceeds,
      maxProceeds: params.maxProceeds,
      numPdSlugs: params.numPdSlugs,
    };
    return this;
  }

  /**
   * @deprecated Use withMarketCapRange() instead for more intuitive market cap configuration
   */
  auctionByPriceRange(params: {
    priceRange: PriceRange;
    minProceeds: bigint;
    maxProceeds: bigint;
    duration?: number;
    epochLength?: number;
    gamma?: number;
    tickSpacing?: number; // optional; will use pool.tickSpacing if not provided
    numPdSlugs?: number;
  }): this {
    const tickSpacing = params.tickSpacing ?? this.pool?.tickSpacing;
    if (!tickSpacing) {
      throw new Error(
        'tickSpacing is required (set poolConfig first or pass tickSpacing)',
      );
    }
    const ticks = computeTicks(params.priceRange, tickSpacing);
    return this.auctionByTicks({
      startTick: ticks.startTick,
      endTick: ticks.endTick,
      minProceeds: params.minProceeds,
      maxProceeds: params.maxProceeds,
      duration: params.duration,
      epochLength: params.epochLength,
      gamma: params.gamma,
      numPdSlugs: params.numPdSlugs,
    });
  }

  /**
   * Configure auction using target market cap range.
   * Converts market cap values (in USD) to Uniswap ticks.
   *
   * V4 pools support custom fees (0-100,000). Standard fee tiers auto-derive
   * tickSpacing; custom fees require explicit tickSpacing (max: 30).
   *
   * @param params - Market cap configuration with auction parameters
   * @returns Builder instance for chaining
   *
   * @example Standard fee tier (auto tickSpacing)
   * ```ts
   * builder
   *   .saleConfig({ initialSupply, numTokensToSell, numeraire: WETH })
   *   .withMarketCapRange({
   *     marketCap: { start: 500_000, min: 50_000 },
   *     numerairePrice: 3000,
   *     minProceeds: parseEther('10'),
   *     maxProceeds: parseEther('1000'),
   *     fee: 10000, // Standard tier, tickSpacing auto = 30
   *   })
   * ```
   *
   * @example Custom fee (requires explicit tickSpacing)
   * ```ts
   * builder
   *   .saleConfig({ initialSupply, numTokensToSell, numeraire: WETH })
   *   .withMarketCapRange({
   *     marketCap: { start: 500_000, min: 50_000 },
   *     numerairePrice: 3000,
   *     minProceeds: parseEther('10'),
   *     maxProceeds: parseEther('1000'),
   *     fee: 2500,      // Custom 0.25% fee
   *     tickSpacing: 10, // Required for custom fees
   *   })
   * ```
   */
  withMarketCapRange(params: DynamicAuctionMarketCapConfig): this {
    // Mutual exclusion: cannot use withMarketCapRange() after poolConfig()
    if (this.pool) {
      throw new Error(
        'Cannot use withMarketCapRange() after poolConfig(). ' +
          'Use withMarketCapRange() for market cap-based configuration, ' +
          'or poolConfig() + auctionByTicks() for manual tick configuration.',
      );
    }

    // Basic validation that doesn't require saleConfig
    if (params.numerairePrice <= 0) {
      throw new Error('numerairePrice must be greater than 0');
    }
    if (params.marketCap.start <= 0 || params.marketCap.min <= 0) {
      throw new Error('marketCap values must be greater than 0');
    }
    if (params.marketCap.min >= params.marketCap.start) {
      throw new Error('marketCap.min must be less than marketCap.start');
    }

    // Validate fee if provided
    if (params.fee !== undefined && params.fee > V4_MAX_FEE) {
      throw new Error(
        `Fee ${params.fee} exceeds maximum allowed for V4 pools (${V4_MAX_FEE} = 10%). ` +
          `Use a fee between 0 and ${V4_MAX_FEE}.`,
      );
    }

    // Validate tickSpacing if provided
    if (
      params.tickSpacing !== undefined &&
      params.tickSpacing > DOPPLER_MAX_TICK_SPACING
    ) {
      throw new Error(
        `tickSpacing ${params.tickSpacing} exceeds maximum allowed for Doppler pools (${DOPPLER_MAX_TICK_SPACING}). ` +
          `Use tickSpacing <= ${DOPPLER_MAX_TICK_SPACING}.`,
      );
    }

    // Store config for deferred conversion in build()
    this.marketCapConfig = {
      marketCap: params.marketCap,
      numerairePrice: params.numerairePrice,
      tokenSupply: params.tokenSupply,
      tokenDecimals: params.tokenDecimals,
      numeraireDecimals: params.numeraireDecimals,
      fee: params.fee,
      tickSpacing: params.tickSpacing,
      minProceeds: params.minProceeds,
      maxProceeds: params.maxProceeds,
      duration: params.duration,
      epochLength: params.epochLength,
      gamma: params.gamma,
      numPdSlugs: params.numPdSlugs,
    };

    return this;
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

  withGovernance(params: GovernanceOption<C>): this {
    this.governance = params;
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

  withGasLimit(gas?: bigint): this {
    this.gasLimit = gas;
    return this;
  }

  withTime(params?: {
    startTimeOffset?: number;
    blockTimestamp?: number;
  }): this {
    if (!params) {
      this.startTimeOffset = undefined;
      this.blockTimestamp = undefined;
      return this;
    }
    this.startTimeOffset = params.startTimeOffset;
    this.blockTimestamp = params.blockTimestamp;
    return this;
  }

  // Address override helpers
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

  withV4Initializer(address: Address): this {
    return this.overrideModule('v4Initializer', address);
  }

  withPoolManager(address: Address): this {
    return this.overrideModule('poolManager', address);
  }

  withDopplerDeployer(address: Address): this {
    return this.overrideModule('dopplerDeployer', address);
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

  withDopplerHookMigrator(address: Address): this {
    return this.overrideModule('dopplerHookMigrator', address);
  }

  withNoOpMigrator(address: Address): this {
    return this.overrideModule('noOpMigrator', address);
  }

  build(): CreateDynamicAuctionParams<C> {
    if (!this.token) throw new Error('tokenConfig is required');
    if (!this.sale) throw new Error('saleConfig is required');
    if (!this.migration) throw new Error('migration configuration is required');
    if (!this.userAddress) throw new Error('userAddress is required');

    // Convert deferred market cap config to pool and auction if set
    if (this.marketCapConfig && !this.pool) {
      const config = this.marketCapConfig;

      // Get token supply from config or saleConfig
      const tokenSupply = config.tokenSupply ?? this.sale.initialSupply;
      if (!tokenSupply) {
        throw new Error(
          'tokenSupply must be provided (either via saleConfig() or withMarketCapRange() params)',
        );
      }

      // Derive fee and tickSpacing
      const fee = config.fee ?? FEE_TIERS.HIGH;
      const tickSpacing = config.tickSpacing ?? DOPPLER_MAX_TICK_SPACING;

      // Set pool config
      this.pool = { fee, tickSpacing };

      // Validate market cap parameters
      const startValidation = validateMarketCapParameters(
        config.marketCap.start,
        tokenSupply,
        config.tokenDecimals,
      );
      const minValidation = validateMarketCapParameters(
        config.marketCap.min,
        tokenSupply,
        config.tokenDecimals,
      );

      const allWarnings = [
        ...startValidation.warnings,
        ...minValidation.warnings,
      ];
      if (allWarnings.length > 0) {
        console.warn('Market cap validation warnings:');
        allWarnings.forEach((w) => console.warn(`  - ${w}`));
      }

      // Convert market cap range to ticks for V4 Dynamic auction
      const { startTick, endTick } = marketCapToTicksForDynamicAuction({
        marketCapRange: {
          start: config.marketCap.min,
          end: config.marketCap.start,
        },
        tokenSupply,
        numerairePriceUSD: config.numerairePrice,
        numeraire: this.sale.numeraire,
        tickSpacing,
        tokenDecimals: config.tokenDecimals ?? 18,
        numeraireDecimals: config.numeraireDecimals ?? 18,
      });

      // Set auction config
      const duration = config.duration ?? DEFAULT_AUCTION_DURATION;
      const epochLength = config.epochLength ?? DEFAULT_EPOCH_LENGTH;
      const gamma =
        config.gamma ??
        computeOptimalGamma(
          startTick,
          endTick,
          duration,
          epochLength,
          tickSpacing,
        );

      this.auction = {
        duration,
        epochLength,
        startTick,
        endTick,
        gamma,
        minProceeds: config.minProceeds,
        maxProceeds: config.maxProceeds,
        numPdSlugs: config.numPdSlugs,
      };
    }

    if (!this.pool) throw new Error('poolConfig is required');
    if (!this.auction) throw new Error('auction configuration is required');

    // Validate noOp migration is not supported for dynamic auctions
    if (this.migration.type === 'noOp') {
      throw new Error(
        'noOp migration is not supported for dynamic auctions. ' +
          'Use uniswapV2, uniswapV4, or dopplerHookMigrator migration instead.',
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

    // Ensure gamma is set and valid
    let { gamma } = this.auction;
    if (gamma === undefined) {
      gamma = computeOptimalGamma(
        this.auction.startTick,
        this.auction.endTick,
        this.auction.duration,
        this.auction.epochLength,
        this.pool.tickSpacing,
      );
    }

    const auction = { ...this.auction, gamma };

    return {
      token: this.token,
      sale: this.sale,
      auction,
      pool: this.pool,
      vesting: this.vesting,
      governance: governance as GovernanceOption<C>,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
      startTimeOffset: this.startTimeOffset,
      blockTimestamp: this.blockTimestamp,
      modules: this.moduleAddresses,
      gas: this.gasLimit,
    };
  }
}
