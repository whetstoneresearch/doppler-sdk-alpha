import { describe, it, expect } from 'vitest'
import { parseEther } from 'viem'
import { MulticurveBuilder } from '../../builders'
import { CHAIN_IDS } from '../../addresses'

describe('MulticurveBuilder - Vesting with multiple beneficiaries', () => {
  const chainId = CHAIN_IDS.BASE_SEPOLIA

  it('builds params with single vesting beneficiary (default behavior)', () => {
    const builder = new MulticurveBuilder(chainId)
    const params = builder
      .tokenConfig({
        type: 'standard',
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'ipfs://test'
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('800000'),
        numeraire: '0x4200000000000000000000000000000000000006' as `0x${string}`
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: [
          {
            tickLower: 0,
            tickUpper: 240_000,
            numPositions: 10,
            shares: parseEther('0.5')
          },
          {
            tickLower: 16_000,
            tickUpper: 240_000,
            numPositions: 10,
            shares: parseEther('0.5')
          }
        ]
      })
      .withVesting({
        duration: BigInt(365 * 24 * 60 * 60),
        cliffDuration: 0
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress('0x1234567890123456789012345678901234567890' as `0x${string}`)
      .build()

    expect(params.vesting).toBeDefined()
    expect(params.vesting?.duration).toBe(365 * 24 * 60 * 60)
    expect(params.vesting?.cliffDuration).toBe(0)
    // Recipients and amounts should be undefined (will default in factory)
    expect(params.vesting?.recipients).toBeUndefined()
    expect(params.vesting?.amounts).toBeUndefined()
  })

  it('builds params with multiple vesting beneficiaries', () => {
    const recipient1 = '0x1111111111111111111111111111111111111111' as `0x${string}`
    const recipient2 = '0x2222222222222222222222222222222222222222' as `0x${string}`
    const recipient3 = '0x3333333333333333333333333333333333333333' as `0x${string}`

    const amount1 = parseEther('100000')
    const amount2 = parseEther('100000')
    const amount3 = parseEther('100000')

    const builder = new MulticurveBuilder(chainId)
    const params = builder
      .tokenConfig({
        type: 'standard',
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'ipfs://test'
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('700000'),
        numeraire: '0x4200000000000000000000000000000000000006' as `0x${string}`
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: [
          {
            tickLower: 0,
            tickUpper: 240_000,
            numPositions: 10,
            shares: parseEther('1')
          }
        ]
      })
      .withVesting({
        duration: BigInt(4 * 365 * 24 * 60 * 60),
        cliffDuration: 0,
        recipients: [recipient1, recipient2, recipient3],
        amounts: [amount1, amount2, amount3]
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress('0x1234567890123456789012345678901234567890' as `0x${string}`)
      .build()

    expect(params.vesting).toBeDefined()
    expect(params.vesting?.duration).toBe(4 * 365 * 24 * 60 * 60)
    expect(params.vesting?.recipients).toHaveLength(3)
    expect(params.vesting?.amounts).toHaveLength(3)
    expect(params.vesting?.recipients).toEqual([recipient1, recipient2, recipient3])
    expect(params.vesting?.amounts).toEqual([amount1, amount2, amount3])
  })

  it('allows clearing vesting by passing undefined', () => {
    const builder = new MulticurveBuilder(chainId)

    // First set vesting
    builder
      .tokenConfig({
        type: 'standard',
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'ipfs://test'
      })
      .withVesting({
        duration: BigInt(365 * 24 * 60 * 60),
        cliffDuration: 0
      })

    // Then clear it
    builder.withVesting(undefined)

    builder
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('800000'),
        numeraire: '0x4200000000000000000000000000000000000006' as `0x${string}`
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: [
          {
            tickLower: 0,
            tickUpper: 240_000,
            numPositions: 10,
            shares: parseEther('1')
          }
        ]
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress('0x1234567890123456789012345678901234567890' as `0x${string}`)

    const params = builder.build()
    expect(params.vesting).toBeUndefined()
  })

  it('preserves all vesting properties including recipients and amounts', () => {
    const recipients = [
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`
    ]
    const amounts = [parseEther('150000'), parseEther('150000')]

    const builder = new MulticurveBuilder(chainId)
    const params = builder
      .tokenConfig({
        type: 'standard',
        name: 'Test Token',
        symbol: 'TEST',
        tokenURI: 'ipfs://test'
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('700000'),
        numeraire: '0x4200000000000000000000000000000000000006' as `0x${string}`
      })
      .withMulticurveAuction({
        fee: 0,
        tickSpacing: 8,
        curves: [
          {
            tickLower: 0,
            tickUpper: 240_000,
            numPositions: 10,
            shares: parseEther('1')
          }
        ]
      })
      .withVesting({
        duration: BigInt(2 * 365 * 24 * 60 * 60),
        cliffDuration: 180 * 24 * 60 * 60, // 180 days cliff
        recipients,
        amounts
      })
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })
      .withUserAddress('0x1234567890123456789012345678901234567890' as `0x${string}`)
      .build()

    expect(params.vesting).toBeDefined()
    expect(params.vesting?.duration).toBe(2 * 365 * 24 * 60 * 60)
    expect(params.vesting?.cliffDuration).toBe(180 * 24 * 60 * 60)
    expect(params.vesting?.recipients).toEqual(recipients)
    expect(params.vesting?.amounts).toEqual(amounts)
  })
})
