# Migration Options Guide

The SDK encodes post‑auction liquidity migration via a discriminated union `MigrationConfig`:

```ts
export type MigrationConfig =
  | { type: 'uniswapV2' }
  | { type: 'uniswapV3'; fee: number; tickSpacing: number }
  | {
      type: 'uniswapV4'
      fee: number
      tickSpacing: number
      streamableFees: {
        lockDuration: number // seconds
        beneficiaries: { address: Address; percentage: number }[] // in basis points
      }
    }
```

Internally, the factory resolves the on‑chain migrator address for your chain and ABI‑encodes the specific data shape required by that migrator.

## When to choose which

- Uniswap V2
  - Simple constant‑product pool; broad ecosystem tooling
  - No price range configuration; least complexity
  - Good default if you do not require V3/V4‑specific features

- Uniswap V3
  - Concentrated liquidity with a fixed range
  - Requires `fee` tier and matching `tickSpacing`
  - Choose when you want to seed a V3 pool with explicit range after the sale

- Uniswap V4
  - Pools with hooks; supports fee streaming via `StreamableFeesLocker`
  - Requires `fee`, `tickSpacing`, and `streamableFees`
  - Choose when you want programmable fee distribution to beneficiaries, and V4 infra is available on your chain

## V2 Migration

```ts
.withMigration({ type: 'uniswapV2' })
```

- Encoded data: empty (`0x`)
- Migrator address resolved per chain (see `src/addresses.ts`)

## V3 Migration

```ts
.withMigration({ type: 'uniswapV3', fee: 3000, tickSpacing: 60 })
```

- Encoded data: `(fee:uint24, tickSpacing:int24)`
- Ensure `tickSpacing` matches the selected `fee` tier on your chain

## V4 Migration (streamable fees)

```ts
.withMigration({
  type: 'uniswapV4',
  fee: 3000,
  tickSpacing: 60,
  streamableFees: {
    lockDuration: 365 * 24 * 60 * 60, // 1 year
    beneficiaries: [
      { address: '0x...', percentage: 6000 },
      { address: '0x...', percentage: 4000 },
    ],
  },
})
```

- Encoded data:
  - `(fee:uint24, tickSpacing:int24, lockDuration:uint32, beneficiaries: (address, shares[WAD])[])`
  - The SDK converts `percentage` (basis points) to `shares` in WAD (1e18), and sorts beneficiaries by address (ascending) as required by the contract
- Validation:
  - At least one beneficiary
  - Percentages must sum to exactly 10000
  - Contract enforces: airlock owner must receive at least 5% of streamed fees (add as a beneficiary if applicable)
- Chain support:
- Ensure `streamableFeesLocker` and `v4Migrator` are deployed on your target chain (see `src/addresses.ts`)

 

## Governance Selection

- Required: You must call `withGovernance(...)` in the builders.
- Standard governance: Call `withGovernance()` with no arguments to use standard defaults, or pass `{ initialVotingDelay?, initialVotingPeriod?, initialProposalThreshold? }` or `{ useDefaults: true }`.
- No‑op governance: Call `withGovernance({ noOp: true })`. The SDK throws if the chain’s `noOpGovernanceFactory` is not deployed and you didn’t override the governance factory address.

## Address Resolution

Migrator contracts are selected per chain via `getAddresses(chainId)` (see `src/addresses.ts`).

- `v2Migrator`, `v3Migrator`, `v4Migrator` must be present for the chosen type
- Some optional contracts (`streamableFeesLocker`) may be `0x0` on certain chains — avoid V4 migration with fee streaming where not supported. Using no‑op governance requires the chain’s `noOpGovernanceFactory` or providing a governance factory override.

## Quick Decision Guide

- Want simplest path and immediate trading? Use V2
- Want a concentrated liquidity range in the resulting pool? Use V3
- Want programmable fee streaming to beneficiaries and are on a V4‑ready chain? Use V4
