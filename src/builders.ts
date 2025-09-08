import type { Address } from 'viem'
import {
  DEFAULT_AUCTION_DURATION,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_V3_END_TICK,
  DEFAULT_V3_FEE,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_START_TICK,
  DEFAULT_V3_VESTING_DURATION,
  DEFAULT_V3_YEARLY_MINT_RATE,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DAY_SECONDS,
  TICK_SPACINGS,
  ZERO_ADDRESS,
} from './constants'
import type {
  CreateDynamicAuctionParams,
  CreateStaticAuctionParams,
  GovernanceOption,
  MigrationConfig,
  PriceRange,
  TickRange,
  VestingConfig,
  TokenConfig,
} from './types'
import type { ModuleAddressOverrides } from './types'
import { type SupportedChainId } from './addresses'

function computeTicks(priceRange: PriceRange, tickSpacing: number): TickRange {
  const startTick =
    Math.floor(Math.log(priceRange.startPrice) / Math.log(1.0001) / tickSpacing) *
    tickSpacing
  const endTick =
    Math.ceil(Math.log(priceRange.endPrice) / Math.log(1.0001) / tickSpacing) *
    tickSpacing
  return { startTick, endTick }
}

function computeOptimalGamma(
  startTick: number,
  endTick: number,
  durationDays: number,
  epochLength: number,
  tickSpacing: number,
): number {
  const totalEpochs = (durationDays * DAY_SECONDS) / epochLength
  const tickDelta = Math.abs(endTick - startTick)
  // Base per-epoch movement in ticks
  let perEpochTicks = Math.ceil(tickDelta / totalEpochs)
  // Quantize up to the nearest multiple of tickSpacing
  const multiples = Math.ceil(perEpochTicks / tickSpacing)
  let gamma = multiples * tickSpacing
  gamma = Math.max(tickSpacing, gamma)
  if (gamma % tickSpacing !== 0) {
    throw new Error('Computed gamma must be divisible by tick spacing')
  }
  return gamma
}

// Static Auction Builder (V3-style)
export class StaticAuctionBuilder<C extends SupportedChainId> {
  private token?: TokenConfig
  private sale?: CreateStaticAuctionParams<C>['sale']
  private pool?: CreateStaticAuctionParams<C>['pool']
  private vesting?: VestingConfig
  private governance?: GovernanceOption<C>
  private migration?: MigrationConfig
  private integrator?: Address
  private userAddress?: Address
  private moduleAddresses?: ModuleAddressOverrides
  public chainId: C

  constructor(chainId: C) {
    this.chainId = chainId
  }

  static forChain<C extends SupportedChainId>(chainId: C): StaticAuctionBuilder<C> {
    return new StaticAuctionBuilder(chainId)
  }

  tokenConfig(
    params:
      | { type?: 'standard'; name: string; symbol: string; tokenURI: string; yearlyMintRate?: bigint }
      | { type: 'doppler404'; name: string; symbol: string; baseURI: string; unit?: bigint }
  ): this {
    if (params && 'type' in params && params.type === 'doppler404') {
      this.token = {
        type: 'doppler404',
        name: params.name,
        symbol: params.symbol,
        baseURI: params.baseURI,
        unit: params.unit,
      }
    } else {
      this.token = {
        type: 'standard',
        name: params.name,
        symbol: params.symbol,
        tokenURI: params.tokenURI,
        yearlyMintRate: params.yearlyMintRate ?? DEFAULT_V3_YEARLY_MINT_RATE,
      }
    }
    return this
  }

  saleConfig(params: {
    initialSupply: bigint
    numTokensToSell: bigint
    numeraire: Address
  }): this {
    this.sale = {
      initialSupply: params.initialSupply,
      numTokensToSell: params.numTokensToSell,
      numeraire: params.numeraire,
    }
    return this
  }

  // Provide pool ticks directly
  poolByTicks(params: {
    startTick?: number
    endTick?: number
    fee?: number
    numPositions?: number
    maxShareToBeSold?: bigint
  }): this {
    const fee = params.fee ?? DEFAULT_V3_FEE
    const startTick = params.startTick ?? DEFAULT_V3_START_TICK
    const endTick = params.endTick ?? DEFAULT_V3_END_TICK
    this.pool = {
      startTick,
      endTick,
      fee,
      numPositions: params.numPositions ?? DEFAULT_V3_NUM_POSITIONS,
      maxShareToBeSold: params.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
    }
    return this
  }

  // Or compute ticks from a price range (tick spacing is inferred from fee)
  poolByPriceRange(params: {
    priceRange: PriceRange
    fee?: number
    numPositions?: number
    maxShareToBeSold?: bigint
  }): this {
    const fee = params.fee ?? DEFAULT_V3_FEE
    const tickSpacing =
      fee === 100 ? TICK_SPACINGS[100] : fee === 500 ? TICK_SPACINGS[500] : fee === 3000 ? TICK_SPACINGS[3000] : TICK_SPACINGS[10000]
    const ticks = computeTicks(params.priceRange, tickSpacing)
    return this.poolByTicks({
      startTick: ticks.startTick,
      endTick: ticks.endTick,
      fee,
      numPositions: params.numPositions,
      maxShareToBeSold: params.maxShareToBeSold,
    })
  }

  withVesting(params?: { duration?: bigint; cliffDuration?: number }): this {
    if (!params) {
      this.vesting = undefined
      return this
    }
    this.vesting = {
      duration: Number(params.duration ?? DEFAULT_V3_VESTING_DURATION),
      cliffDuration: params.cliffDuration ?? 0,
    }
    return this
  }

  withGovernance(params: GovernanceOption<C>): this {
    this.governance = params
    return this
  }

  withMigration(migration: MigrationConfig): this {
    this.migration = migration
    return this
  }

  withUserAddress(address: Address): this {
    this.userAddress = address
    return this
  }

  withIntegrator(address?: Address): this {
    this.integrator = address ?? ZERO_ADDRESS
    return this
  }

  // Address override helpers
  private overrideModule<K extends keyof ModuleAddressOverrides>(key: K, address: NonNullable<ModuleAddressOverrides[K]>): this {
    this.moduleAddresses = {
      ...(this.moduleAddresses ?? {}),
      [key]: address,
    } as ModuleAddressOverrides
    return this
  }

  withTokenFactory(address: Address): this {
    return this.overrideModule('tokenFactory', address)
  }

  withAirlock(address: Address): this {
    return this.overrideModule('airlock', address)
  }

  withV3Initializer(address: Address): this {
    return this.overrideModule('v3Initializer', address)
  }

  withGovernanceFactory(address: Address): this {
    return this.overrideModule('governanceFactory', address)
  }

  withV2Migrator(address: Address): this {
    return this.overrideModule('v2Migrator', address)
  }

  withV3Migrator(address: Address): this {
    return this.overrideModule('v3Migrator', address)
  }

  withV4Migrator(address: Address): this {
    return this.overrideModule('v4Migrator', address)
  }

  build(): CreateStaticAuctionParams<C> {
    if (!this.token) throw new Error('tokenConfig is required')
    if (!this.sale) throw new Error('saleConfig is required')
    if (!this.pool) throw new Error('pool configuration is required')
    if (!this.migration) throw new Error('migration configuration is required')
    if (!this.userAddress) throw new Error('userAddress is required')
    // Default governance to standard if not provided
    if (!this.governance) {
      this.governance = { type: 'default' } as any
    }

    return {
      token: this.token,
      sale: this.sale,
      pool: this.pool,
      vesting: this.vesting,
      governance: this.governance,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
      modules: this.moduleAddresses,
    }
  }
}

// Dynamic Auction Builder (V4-style)
export class DynamicAuctionBuilder<C extends SupportedChainId> {
  private token?: TokenConfig
  private sale?: CreateDynamicAuctionParams<C>['sale']
  private auction?: CreateDynamicAuctionParams<C>['auction']
  private pool?: CreateDynamicAuctionParams<C>['pool']
  private vesting?: VestingConfig
  private governance?: GovernanceOption<C>
  private migration?: MigrationConfig
  private integrator?: Address
  private userAddress?: Address
  private startTimeOffset?: number
  private blockTimestamp?: number
  private moduleAddresses?: ModuleAddressOverrides
  public chainId: C

  constructor(chainId: C) {
    this.chainId = chainId
  }

  static forChain<C extends SupportedChainId>(chainId: C): DynamicAuctionBuilder<C> {
    return new DynamicAuctionBuilder(chainId)
  }

  tokenConfig(
    params:
      | { type?: 'standard'; name: string; symbol: string; tokenURI: string; yearlyMintRate?: bigint }
      | { type: 'doppler404'; name: string; symbol: string; baseURI: string; unit?: bigint }
  ): this {
    if (params && 'type' in params && params.type === 'doppler404') {
      this.token = {
        type: 'doppler404',
        name: params.name,
        symbol: params.symbol,
        baseURI: params.baseURI,
        unit: params.unit,
      }
    } else {
      this.token = {
        type: 'standard',
        name: params.name,
        symbol: params.symbol,
        tokenURI: params.tokenURI,
        yearlyMintRate: params.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE,
      }
    }
    return this
  }

  saleConfig(params: {
    initialSupply: bigint
    numTokensToSell: bigint
    numeraire?: Address
  }): this {
    this.sale = {
      initialSupply: params.initialSupply,
      numTokensToSell: params.numTokensToSell,
      numeraire: params.numeraire ?? ZERO_ADDRESS,
    }
    return this
  }

  poolConfig(params: { fee: number; tickSpacing: number }): this {
    this.pool = { fee: params.fee, tickSpacing: params.tickSpacing }
    return this
  }

  // Provide ticks directly
  auctionByTicks(params: {
    startTick: number
    endTick: number
    minProceeds: bigint
    maxProceeds: bigint
    durationDays?: number
    epochLength?: number
    gamma?: number
    numPdSlugs?: number
  }): this {
    const duration = params.durationDays ?? DEFAULT_AUCTION_DURATION
    const epochLength = params.epochLength ?? DEFAULT_EPOCH_LENGTH
    const gamma =
      params.gamma ?? (this.pool ? computeOptimalGamma(params.startTick, params.endTick, duration, epochLength, this.pool.tickSpacing) : undefined)
    this.auction = {
      duration,
      epochLength,
      startTick: params.startTick,
      endTick: params.endTick,
      gamma,
      minProceeds: params.minProceeds,
      maxProceeds: params.maxProceeds,
      numPdSlugs: params.numPdSlugs,
    }
    return this
  }

  // Or compute ticks from price range
  auctionByPriceRange(params: {
    priceRange: PriceRange
    minProceeds: bigint
    maxProceeds: bigint
    durationDays?: number
    epochLength?: number
    gamma?: number
    tickSpacing?: number // optional; will use pool.tickSpacing if not provided
    numPdSlugs?: number
  }): this {
    const tickSpacing = params.tickSpacing ?? this.pool?.tickSpacing
    if (!tickSpacing) {
      throw new Error('tickSpacing is required (set poolConfig first or pass tickSpacing)')
    }
    const ticks = computeTicks(params.priceRange, tickSpacing)
    return this.auctionByTicks({
      startTick: ticks.startTick,
      endTick: ticks.endTick,
      minProceeds: params.minProceeds,
      maxProceeds: params.maxProceeds,
      durationDays: params.durationDays,
      epochLength: params.epochLength,
      gamma: params.gamma,
      numPdSlugs: params.numPdSlugs,
    })
  }

  withVesting(params?: { duration?: bigint; cliffDuration?: number }): this {
    if (!params) {
      this.vesting = undefined
      return this
    }
    this.vesting = {
      duration: Number(params.duration ?? 0n),
      cliffDuration: params.cliffDuration ?? 0,
    }
    return this
  }

  withGovernance(params: GovernanceOption<C>): this {
    this.governance = params
    return this
  }

  withMigration(migration: MigrationConfig): this {
    this.migration = migration
    return this
  }

  withUserAddress(address: Address): this {
    this.userAddress = address
    return this
  }

  withIntegrator(address?: Address): this {
    this.integrator = address ?? ZERO_ADDRESS
    return this
  }

  withTime(params?: { startTimeOffset?: number; blockTimestamp?: number }): this {
    if (!params) {
      this.startTimeOffset = undefined
      this.blockTimestamp = undefined
      return this
    }
    this.startTimeOffset = params.startTimeOffset
    this.blockTimestamp = params.blockTimestamp
    return this
  }

  // Address override helpers
  private overrideModule<K extends keyof ModuleAddressOverrides>(key: K, address: NonNullable<ModuleAddressOverrides[K]>): this {
    this.moduleAddresses = {
      ...(this.moduleAddresses ?? {}),
      [key]: address,
    } as ModuleAddressOverrides
    return this
  }

  withTokenFactory(address: Address): this {
    return this.overrideModule('tokenFactory', address)
  }

  withAirlock(address: Address): this {
    return this.overrideModule('airlock', address)
  }

  withV4Initializer(address: Address): this {
    return this.overrideModule('v4Initializer', address)
  }

  withPoolManager(address: Address): this {
    return this.overrideModule('poolManager', address)
  }

  withDopplerDeployer(address: Address): this {
    return this.overrideModule('dopplerDeployer', address)
  }

  withGovernanceFactory(address: Address): this {
    return this.overrideModule('governanceFactory', address)
  }

  withV2Migrator(address: Address): this {
    return this.overrideModule('v2Migrator', address)
  }

  withV3Migrator(address: Address): this {
    return this.overrideModule('v3Migrator', address)
  }

  withV4Migrator(address: Address): this {
    return this.overrideModule('v4Migrator', address)
  }

  build(): CreateDynamicAuctionParams<C> {
    if (!this.token) throw new Error('tokenConfig is required')
    if (!this.sale) throw new Error('saleConfig is required')
    if (!this.pool) throw new Error('poolConfig is required')
    if (!this.auction) throw new Error('auction configuration is required')
    if (!this.migration) throw new Error('migration configuration is required')
    if (!this.userAddress) throw new Error('userAddress is required')
    // Default governance to standard if not provided
    if (!this.governance) {
      this.governance = { type: 'default' } as any
    }

    // Ensure gamma is set and valid
    let { gamma } = this.auction
    if (gamma === undefined) {
      gamma = computeOptimalGamma(
        this.auction.startTick,
        this.auction.endTick,
        this.auction.duration,
        this.auction.epochLength,
        this.pool.tickSpacing,
      )
    }

    const auction = { ...this.auction, gamma }

    return {
      token: this.token,
      sale: this.sale,
      auction,
      pool: this.pool,
      vesting: this.vesting,
      governance: this.governance,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
      startTimeOffset: this.startTimeOffset,
      blockTimestamp: this.blockTimestamp,
      modules: this.moduleAddresses,
    }
  }
}
