import type { Address } from 'viem'
import {
  DEFAULT_AUCTION_DURATION,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_MULTICURVE_LOWER_TICKS,
  DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES,
  DEFAULT_MULTICURVE_NUM_POSITIONS,
  DEFAULT_MULTICURVE_UPPER_TICKS,
  DEFAULT_V3_END_TICK,
  DEFAULT_V3_FEE,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_START_TICK,
  DEFAULT_V3_VESTING_DURATION,
  DEFAULT_V3_YEARLY_MINT_RATE,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DAY_SECONDS,
  FEE_TIERS,
  TICK_SPACINGS,
  WAD,
  ZERO_ADDRESS,
} from './constants'
import { MAX_TICK, MIN_TICK } from './utils'
import type {
  CreateDynamicAuctionParams,
  CreateStaticAuctionParams,
  CreateMulticurveParams,
  GovernanceOption,
  MigrationConfig,
  PriceRange,
  TickRange,
  MulticurveMarketCapPreset,
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

const MARKET_CAP_PRESET_ORDER = ['low', 'medium', 'high'] as const satisfies readonly MulticurveMarketCapPreset[]

type MarketCapPresetConfig = {
  tickLower: number
  tickUpper: number
  numPositions: number
  shares: bigint
}

const MARKET_CAP_PRESETS: Record<MulticurveMarketCapPreset, MarketCapPresetConfig> = {
  low: {
    tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[0],
    tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[0],
    numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[0],
    shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[0],
  },
  medium: {
    tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[1],
    tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[1],
    numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[1],
    shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[1],
  },
  high: {
    tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[2],
    tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[2],
    numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[2],
    shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[2],
  },
}

type MarketCapPresetOverrides = Partial<
  Record<
    MulticurveMarketCapPreset,
    {
      tickLower?: number
      tickUpper?: number
      numPositions?: number
      shares?: bigint
    }
  >
>

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
  private gasLimit?: bigint
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

  withVesting(params?: { duration?: bigint; cliffDuration?: number; recipients?: Address[]; amounts?: bigint[] }): this {
    if (!params) {
      this.vesting = undefined
      return this
    }
    this.vesting = {
      duration: Number(params.duration ?? DEFAULT_V3_VESTING_DURATION),
      cliffDuration: params.cliffDuration ?? 0,
      recipients: params.recipients,
      amounts: params.amounts,
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

  withGasLimit(gas?: bigint): this {
    this.gasLimit = gas
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

  withNoOpMigrator(address: Address): this {
    return this.overrideModule('noOpMigrator', address)
  }

  build(): CreateStaticAuctionParams<C> {
    if (!this.token) throw new Error('tokenConfig is required')
    if (!this.sale) throw new Error('saleConfig is required')
    if (!this.pool) throw new Error('pool configuration is required')
    if (!this.migration) throw new Error('migration configuration is required')
    if (!this.userAddress) throw new Error('userAddress is required')
    if (!this.governance) throw new Error("governance configuration is required; call withGovernance({ type: 'default' | 'custom' | 'noOp' })")

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
      gas: this.gasLimit,
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
  private gasLimit?: bigint
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

  withVesting(params?: { duration?: bigint; cliffDuration?: number; recipients?: Address[]; amounts?: bigint[] }): this {
    if (!params) {
      this.vesting = undefined
      return this
    }
    this.vesting = {
      duration: Number(params.duration ?? 0n),
      cliffDuration: params.cliffDuration ?? 0,
      recipients: params.recipients,
      amounts: params.amounts,
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

  withGasLimit(gas?: bigint): this {
    this.gasLimit = gas
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

  withNoOpMigrator(address: Address): this {
    return this.overrideModule('noOpMigrator', address)
  }

  build(): CreateDynamicAuctionParams<C> {
    if (!this.token) throw new Error('tokenConfig is required')
    if (!this.sale) throw new Error('saleConfig is required')
    if (!this.pool) throw new Error('poolConfig is required')
    if (!this.auction) throw new Error('auction configuration is required')
    if (!this.migration) throw new Error('migration configuration is required')
    if (!this.userAddress) throw new Error('userAddress is required')
    if (!this.governance) throw new Error("governance configuration is required; call withGovernance({ type: 'default' | 'custom' | 'noOp' })")

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
      gas: this.gasLimit,
    }
  }
}

// Multicurve (V4-style initializer) Builder
export class MulticurveBuilder<C extends SupportedChainId> {
  private token?: TokenConfig
  private sale?: CreateMulticurveParams<C>['sale']
  private pool?: CreateMulticurveParams<C>['pool']
  private schedule?: CreateMulticurveParams<C>['schedule']
  private vesting?: VestingConfig
  private governance?: GovernanceOption<C>
  private migration?: MigrationConfig
  private integrator?: Address
  private userAddress?: Address
  private moduleAddresses?: ModuleAddressOverrides
  private gasLimit?: bigint
  public chainId: C

  constructor(chainId: C) {
    this.chainId = chainId
  }

  static forChain<C extends SupportedChainId>(chainId: C): MulticurveBuilder<C> {
    return new MulticurveBuilder(chainId)
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

  saleConfig(params: { initialSupply: bigint; numTokensToSell: bigint; numeraire: Address }): this {
    this.sale = { initialSupply: params.initialSupply, numTokensToSell: params.numTokensToSell, numeraire: params.numeraire }
    return this
  }

  poolConfig(params: { fee: number; tickSpacing: number; curves: { tickLower: number; tickUpper: number; numPositions: number; shares: bigint }[]; beneficiaries?: { beneficiary: Address; shares: bigint }[] }): this {
    const sortedBeneficiaries = params.beneficiaries
      ? [...params.beneficiaries].sort((a, b) => {
          const aAddr = a.beneficiary.toLowerCase()
          const bAddr = b.beneficiary.toLowerCase()
          return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0
        })
      : undefined

    this.pool = { fee: params.fee, tickSpacing: params.tickSpacing, curves: params.curves, beneficiaries: sortedBeneficiaries }
    return this
  }

  withMarketCapPresets(params?: {
    fee?: number
    tickSpacing?: number
    presets?: MulticurveMarketCapPreset[]
    overrides?: MarketCapPresetOverrides
    beneficiaries?: { beneficiary: Address; shares: bigint }[]
  }): this {
    const fee = params?.fee ?? FEE_TIERS.LOW
    const tickSpacing =
      params?.tickSpacing ??
      (TICK_SPACINGS as Record<number, number>)[fee]

    if (tickSpacing === undefined) {
      throw new Error('tickSpacing must be provided when using a custom fee tier')
    }

    const requestedPresets = params?.presets ?? [...MARKET_CAP_PRESET_ORDER]
    const uniquePresets: MulticurveMarketCapPreset[] = []
    for (const preset of requestedPresets) {
      if (!(preset in MARKET_CAP_PRESETS)) {
        throw new Error(`Unsupported market cap preset: ${preset}`)
      }
      if (!uniquePresets.includes(preset)) {
        uniquePresets.push(preset)
      }
    }

    if (uniquePresets.length === 0) {
      throw new Error('At least one market cap preset must be provided')
    }

    const presetCurves = uniquePresets.map((preset) => {
      const base = MARKET_CAP_PRESETS[preset]
      const override = params?.overrides?.[preset]
      return {
        tickLower: override?.tickLower ?? base.tickLower,
        tickUpper: override?.tickUpper ?? base.tickUpper,
        numPositions: override?.numPositions ?? base.numPositions,
        shares: override?.shares ?? base.shares,
      }
    })

    let totalShares = presetCurves.reduce((acc, curve) => {
      if (curve.shares <= 0n) {
        throw new Error('Preset shares must be greater than zero')
      }
      return acc + curve.shares
    }, 0n)

    if (totalShares > WAD) {
      throw new Error('Total preset shares cannot exceed 100% (1e18)')
    }

    const curves = [...presetCurves]

    if (totalShares < WAD) {
      const remainder = WAD - totalShares
      const lastCurve = curves[curves.length - 1]
      let fillerTickLower = lastCurve?.tickUpper ?? 0
      let fillerNumPositions = lastCurve?.numPositions ?? 1

      if (fillerNumPositions <= 0) {
        fillerNumPositions = 1
      }

      const minTickAllowed = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing
      const rawMaxTick = Math.floor(MAX_TICK / tickSpacing) * tickSpacing
      const maxTickAllowed = rawMaxTick - tickSpacing

      fillerTickLower = Math.max(fillerTickLower, minTickAllowed)
      let fillerTickUpper = fillerTickLower + fillerNumPositions * tickSpacing

      if (fillerTickUpper > maxTickAllowed) {
        fillerTickUpper = maxTickAllowed
        fillerTickLower = Math.min(fillerTickLower, maxTickAllowed - tickSpacing)
      }

      if (fillerTickUpper <= fillerTickLower) {
        fillerTickLower = Math.max(minTickAllowed, maxTickAllowed - tickSpacing)
        fillerTickUpper = fillerTickLower + tickSpacing
      }

      curves.push({
        tickLower: fillerTickLower,
        tickUpper: fillerTickUpper,
        numPositions: fillerNumPositions,
        shares: remainder,
      })

      totalShares = WAD
    }

    if (totalShares !== WAD) {
      throw new Error('Failed to normalize preset shares to 100%')
    }

    return this.poolConfig({
      fee,
      tickSpacing,
      curves,
      beneficiaries: params?.beneficiaries,
    })
  }

  // Alias for clarity: indicate use of V4 multicurve initializer
  withMulticurveAuction(params: { fee: number; tickSpacing: number; curves: { tickLower: number; tickUpper: number; numPositions: number; shares: bigint }[]; beneficiaries?: { beneficiary: Address; shares: bigint }[] }): this {
    return this.poolConfig(params)
  }

  withVesting(params?: { duration?: bigint; cliffDuration?: number; recipients?: Address[]; amounts?: bigint[] }): this {
    if (!params) { this.vesting = undefined; return this }
    this.vesting = { duration: Number(params.duration ?? 0n), cliffDuration: params.cliffDuration ?? 0, recipients: params.recipients, amounts: params.amounts }
    return this
  }

  withSchedule(params?: { startTime: number | bigint | Date }): this {
    if (!params) {
      this.schedule = undefined
      return this
    }

    let startTimeSeconds: number
    const { startTime } = params

    if (startTime instanceof Date) {
      startTimeSeconds = Math.floor(startTime.getTime() / 1000)
    } else if (typeof startTime === 'bigint') {
      startTimeSeconds = Number(startTime)
    } else {
      startTimeSeconds = Number(startTime)
    }

    if (!Number.isFinite(startTimeSeconds) || !Number.isInteger(startTimeSeconds)) {
      throw new Error('Schedule startTime must be an integer number of seconds since Unix epoch')
    }

    if (startTimeSeconds < 0) {
      throw new Error('Schedule startTime cannot be negative')
    }

    const UINT32_MAX = 0xffffffff
    if (startTimeSeconds > UINT32_MAX) {
      throw new Error('Schedule startTime must fit within uint32 (seconds since Unix epoch up to year 2106)')
    }

    this.schedule = { startTime: startTimeSeconds }
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

  withGasLimit(gas?: bigint): this {
    this.gasLimit = gas
    return this
  }

  private overrideModule<K extends keyof ModuleAddressOverrides>(key: K, address: NonNullable<ModuleAddressOverrides[K]>): this {
    this.moduleAddresses = { ...(this.moduleAddresses ?? {}), [key]: address } as ModuleAddressOverrides
    return this
  }

  withTokenFactory(address: Address): this { return this.overrideModule('tokenFactory', address) }
  withAirlock(address: Address): this { return this.overrideModule('airlock', address) }
  withV4MulticurveInitializer(address: Address): this { return this.overrideModule('v4MulticurveInitializer', address) }
  withV4ScheduledMulticurveInitializer(address: Address): this { return this.overrideModule('v4ScheduledMulticurveInitializer', address) }
  withGovernanceFactory(address: Address): this { return this.overrideModule('governanceFactory', address) }
  withV2Migrator(address: Address): this { return this.overrideModule('v2Migrator', address) }
  withV3Migrator(address: Address): this { return this.overrideModule('v3Migrator', address) }
  withV4Migrator(address: Address): this { return this.overrideModule('v4Migrator', address) }
  withNoOpMigrator(address: Address): this { return this.overrideModule('noOpMigrator', address) }

  build(): CreateMulticurveParams<C> {
    if (!this.token) throw new Error('tokenConfig is required')
    if (!this.sale) throw new Error('saleConfig is required')
    if (!this.pool) throw new Error('poolConfig is required')
    if (!this.migration) throw new Error('migration configuration is required')
    if (!this.userAddress) throw new Error('userAddress is required')
    if (!this.governance) throw new Error("governance configuration is required; call withGovernance({ type: 'default' | 'custom' | 'noOp' })")

    return {
      token: this.token,
      sale: this.sale,
      pool: this.pool,
      schedule: this.schedule,
      vesting: this.vesting,
      governance: this.governance,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
      modules: this.moduleAddresses,
      gas: this.gasLimit,
    }
  }
}
