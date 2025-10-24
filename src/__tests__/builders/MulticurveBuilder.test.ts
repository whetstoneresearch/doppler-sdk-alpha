import { describe, it, expect } from 'vitest'
import { MulticurveBuilder } from '../../builders'
import { CHAIN_IDS } from '../../addresses'
import {
  DEFAULT_MULTICURVE_LOWER_TICKS,
  DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES,
  DEFAULT_MULTICURVE_NUM_POSITIONS,
  DEFAULT_MULTICURVE_UPPER_TICKS,
  FEE_TIERS,
  TICK_SPACINGS,
  WAD,
  ZERO_ADDRESS,
} from '../../constants'
import type { Address } from 'viem'

describe('MulticurveBuilder', () => {
  it('sorts lockable beneficiaries by address during build', () => {
    const beneficiaries = [
      { beneficiary: '0x0000000000000000000000000000000000000002' as Address, shares: WAD / 10n },
      { beneficiary: '0x0000000000000000000000000000000000000001' as Address, shares: WAD / 20n },
      { beneficiary: '0x0000000000000000000000000000000000000003' as Address, shares: WAD / 5n },
    ]

    const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
      .tokenConfig({ type: 'standard', name: 'LockableToken', symbol: 'LOCK', tokenURI: 'ipfs://lock' })
      .saleConfig({ initialSupply: 1_000n * WAD, numTokensToSell: 500n * WAD, numeraire: ZERO_ADDRESS })
      .withMulticurveAuction({
        fee: 3000,
        tickSpacing: 60,
        curves: [
          {
            tickLower: 1000,
            tickUpper: 2000,
            numPositions: 2,
            shares: WAD / 2n,
          },
          {
            tickLower: 2000,
            tickUpper: 3000,
            numPositions: 2,
            shares: WAD / 2n,
          },
        ],
        beneficiaries,
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

    const params = builder.build()
    const builtBeneficiaries = params.pool.beneficiaries ?? []

    expect(builtBeneficiaries.map(b => b.beneficiary)).toEqual([
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000003',
    ])
  })

  it('configures curves from market cap presets using defaults', () => {
    const expectedTickSpacing = (TICK_SPACINGS as Record<number, number>)[FEE_TIERS.LOW]

    const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
      .tokenConfig({ type: 'standard', name: 'PresetToken', symbol: 'PRE', tokenURI: 'ipfs://preset' })
      .saleConfig({ initialSupply: 1_000n * WAD, numTokensToSell: 500n * WAD, numeraire: ZERO_ADDRESS })
      .withMarketCapPresets({ fee: FEE_TIERS.LOW })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress('0x00000000000000000000000000000000000000AA' as Address)

    const params = builder.build()

    expect(params.pool.fee).toBe(FEE_TIERS.LOW)
    expect(params.pool.tickSpacing).toBe(expectedTickSpacing)
    expect(params.pool.curves).toHaveLength(4)

    const [low, medium, high, filler] = params.pool.curves
    expect(low).toEqual({
      tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[0],
      tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[0],
      numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[0],
      shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[0],
    })
    expect(medium).toEqual({
      tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[1],
      tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[1],
      numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[1],
      shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[1],
    })
    expect(high).toEqual({
      tickLower: DEFAULT_MULTICURVE_LOWER_TICKS[2],
      tickUpper: DEFAULT_MULTICURVE_UPPER_TICKS[2],
      numPositions: DEFAULT_MULTICURVE_NUM_POSITIONS[2],
      shares: DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[2],
    })
    expect(filler.shares).toBe(WAD - DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[0] - DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[1] - DEFAULT_MULTICURVE_MAX_SUPPLY_SHARES[2])
    expect(filler.tickLower).toBe(DEFAULT_MULTICURVE_UPPER_TICKS[2])
    expect(filler.tickUpper).toBe(filler.tickLower + DEFAULT_MULTICURVE_NUM_POSITIONS[2] * expectedTickSpacing)
  })

  it('allows overriding preset parameters', () => {
    const overrideShares = WAD / 2n

    const builder = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
      .tokenConfig({ type: 'standard', name: 'OverrideToken', symbol: 'OVR', tokenURI: 'ipfs://override' })
      .saleConfig({ initialSupply: 1_000n * WAD, numTokensToSell: 400n * WAD, numeraire: ZERO_ADDRESS })
      .withMarketCapPresets({
        fee: 0,
        tickSpacing: 100,
        presets: ['high'],
        overrides: {
          high: {
            shares: overrideShares,
            numPositions: 22,
            tickLower: -160_000,
            tickUpper: -150_000,
          },
        },
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV3' })
      .withUserAddress('0x00000000000000000000000000000000000000AB' as Address)

    const params = builder.build()

    expect(params.pool.fee).toBe(0)
    expect(params.pool.tickSpacing).toBe(100)
    expect(params.pool.curves).toHaveLength(2)

    const [primary, filler] = params.pool.curves

    expect(primary).toEqual({
      tickLower: -160_000,
      tickUpper: -150_000,
      numPositions: 22,
      shares: overrideShares,
    })
    expect(filler.shares).toBe(WAD - overrideShares)
    expect(filler.tickLower).toBe(-150_000)
    expect(filler.tickUpper).toBe(-150_000 + 22 * 100)
    expect(filler.numPositions).toBe(22)
  })
})
