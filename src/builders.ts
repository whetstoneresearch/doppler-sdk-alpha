import type { Address } from 'viem'
import {
  BASIS_POINTS,
  DEFAULT_AUCTION_DURATION,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_V3_END_TICK,
  DEFAULT_V3_FEE,
  DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V3_INITIAL_VOTING_DELAY,
  DEFAULT_V3_INITIAL_VOTING_PERIOD,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_START_TICK,
  DEFAULT_V3_VESTING_DURATION,
  DEFAULT_V3_YEARLY_MINT_RATE,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DAY_SECONDS,
  TICK_SPACINGS,
  ZERO_ADDRESS,
} from './constants'
import type {
  CreateDynamicAuctionParams,
  CreateStaticAuctionParams,
  GovernanceConfig,
  GovernanceOption,
  MigrationConfig,
  PriceRange,
  TickRange,
  VestingConfig,
} from './types'

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
  let gamma = Math.ceil(tickDelta / totalEpochs) * tickSpacing
  gamma = Math.max(tickSpacing, gamma)
  if (gamma % tickSpacing !== 0) {
    throw new Error('Computed gamma must be divisible by tick spacing')
  }
  return gamma
}

// Static Auction Builder (V3-style)
export class StaticAuctionBuilder {
  private token?: CreateStaticAuctionParams['token']
  private sale?: CreateStaticAuctionParams['sale']
  private pool?: CreateStaticAuctionParams['pool']
  private vesting?: VestingConfig
  private governance?: GovernanceOption
  private migration?: MigrationConfig
  private integrator?: Address
  private userAddress?: Address

  tokenConfig(
    params:
      | { type?: 'standard'; name: string; symbol: string; tokenURI: string; yearlyMintRate?: bigint }
      | { type: 'doppler404'; name: string; symbol: string; baseURI: string; unit?: bigint }
  ): this {
    if ((params as any).type === 'doppler404') {
      const p = params as { type: 'doppler404'; name: string; symbol: string; baseURI: string; unit?: bigint }
      this.token = {
        type: 'doppler404',
        name: p.name,
        symbol: p.symbol,
        baseURI: p.baseURI,
        unit: p.unit,
      } as any
    } else {
      const p = params as { type?: 'standard'; name: string; symbol: string; tokenURI: string; yearlyMintRate?: bigint }
      this.token = {
        name: p.name,
        symbol: p.symbol,
        tokenURI: p.tokenURI,
        yearlyMintRate: p.yearlyMintRate ?? DEFAULT_V3_YEARLY_MINT_RATE,
      } as any
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

  withGovernance(params?: GovernanceConfig | { useDefaults?: boolean } | { noOp: true }): this {
    if (!params) {
      // No args → apply standard governance defaults (explicit selection)
      this.governance = {
        initialVotingDelay: DEFAULT_V3_INITIAL_VOTING_DELAY,
        initialVotingPeriod: DEFAULT_V3_INITIAL_VOTING_PERIOD,
        initialProposalThreshold: DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
      }
      return this
    }
    if ('useDefaults' in params) {
      this.governance = {
        initialVotingDelay: DEFAULT_V3_INITIAL_VOTING_DELAY,
        initialVotingPeriod: DEFAULT_V3_INITIAL_VOTING_PERIOD,
        initialProposalThreshold: DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
      }
      return this
    }
    if ('noOp' in params) {
      this.governance = { noOp: true }
      return this
    }
    this.governance = params as GovernanceConfig
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

  build(): CreateStaticAuctionParams {
    if (!this.token) throw new Error('tokenConfig is required')
    if (!this.sale) throw new Error('saleConfig is required')
    if (!this.pool) throw new Error('pool configuration is required')
    if (!this.migration) throw new Error('migration configuration is required')
    if (!this.userAddress) throw new Error('userAddress is required')
    if (!this.governance) throw new Error('governance configuration is required; call withGovernance()')

    return {
      token: this.token,
      sale: this.sale,
      pool: this.pool,
      vesting: this.vesting,
      governance: this.governance,
      migration: this.migration,
      integrator: this.integrator ?? ZERO_ADDRESS,
      userAddress: this.userAddress,
    }
  }
}

// Dynamic Auction Builder (V4-style)
export class DynamicAuctionBuilder {
  private token?: CreateDynamicAuctionParams['token']
  private sale?: CreateDynamicAuctionParams['sale']
  private auction?: CreateDynamicAuctionParams['auction']
  private pool?: CreateDynamicAuctionParams['pool']
  private vesting?: VestingConfig
  private governance?: GovernanceOption
  private migration?: MigrationConfig
  private integrator?: Address
  private userAddress?: Address
  private startTimeOffset?: number
  private blockTimestamp?: number

  tokenConfig(
    params:
      | { type?: 'standard'; name: string; symbol: string; tokenURI: string; yearlyMintRate?: bigint }
      | { type: 'doppler404'; name: string; symbol: string; baseURI: string; unit?: bigint }
  ): this {
    if ((params as any).type === 'doppler404') {
      const p = params as { type: 'doppler404'; name: string; symbol: string; baseURI: string; unit?: bigint }
      this.token = {
        type: 'doppler404',
        name: p.name,
        symbol: p.symbol,
        baseURI: p.baseURI,
        unit: p.unit,
      } as any
    } else {
      const p = params as { type?: 'standard'; name: string; symbol: string; tokenURI: string; yearlyMintRate?: bigint }
      this.token = {
        name: p.name,
        symbol: p.symbol,
        tokenURI: p.tokenURI,
        yearlyMintRate: p.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE,
      } as any
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

  withGovernance(params?: GovernanceConfig | { useDefaults?: boolean } | { noOp: true }): this {
    if (!params) {
      // No args → apply standard governance defaults (explicit selection)
      this.governance = {
        initialVotingDelay: DEFAULT_V4_INITIAL_VOTING_DELAY,
        initialVotingPeriod: DEFAULT_V4_INITIAL_VOTING_PERIOD,
        initialProposalThreshold: DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
      }
      return this
    }
    if ('useDefaults' in params) {
      this.governance = {
        initialVotingDelay: DEFAULT_V4_INITIAL_VOTING_DELAY,
        initialVotingPeriod: DEFAULT_V4_INITIAL_VOTING_PERIOD,
        initialProposalThreshold: DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
      }
      return this
    }
    if ('noOp' in params) {
      this.governance = { noOp: true }
      return this
    }
    this.governance = params as GovernanceConfig
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

  build(): CreateDynamicAuctionParams {
    if (!this.token) throw new Error('tokenConfig is required')
    if (!this.sale) throw new Error('saleConfig is required')
    if (!this.pool) throw new Error('poolConfig is required')
    if (!this.auction) throw new Error('auction configuration is required')
    if (!this.migration) throw new Error('migration configuration is required')
    if (!this.userAddress) throw new Error('userAddress is required')
    if (!this.governance) throw new Error('governance configuration is required; call withGovernance()')

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
    }
  }
}
