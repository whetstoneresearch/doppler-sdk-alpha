import { describe, it, expect } from 'vitest'
import { MulticurveBuilder } from '../../builders'
import { CHAIN_IDS } from '../../addresses'
import { WAD, ZERO_ADDRESS } from '../../constants'
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
})
