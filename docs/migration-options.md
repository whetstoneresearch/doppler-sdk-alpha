# Migration Options Guide

The SDK encodes post‑auction liquidity migration via a discriminated union `MigrationConfig`:

```ts
export type MigrationConfig =
  | { type: 'uniswapV2' }
  | {
      type: 'uniswapV2Split';
      proceedsSplit?: { recipient: Address; share: bigint };
    }
  | {
      type: 'uniswapV4';
      fee: number;
      tickSpacing: number;
      streamableFees?: {
        lockDuration: number; // seconds
        beneficiaries: { beneficiary: Address; shares: bigint }[]; // shares in WAD
      };
    }
  | {
      type: 'uniswapV4Split';
      fee: number;
      tickSpacing: number;
      streamableFees: {
        lockDuration: number; // seconds
        beneficiaries: { beneficiary: Address; shares: bigint }[]; // shares in WAD
      };
      proceedsSplit?: { recipient: Address; share: bigint };
    }
  | { type: 'noOp' };
```

Internally, the factory resolves the on‑chain migrator address for your chain and ABI‑encodes the specific data shape required by that migrator.

## When to choose which

- Uniswap V2
  - Simple constant‑product pool; broad ecosystem tooling
  - No price range configuration; least complexity
  - Good default if you do not require V3/V4‑specific features

- Uniswap V4
  - Pools with hooks; optionally supports fee streaming via `StreamableFeesLocker`
  - Choose when you want programmable fee distribution to beneficiaries, and V4 infra is available on your chain

- Uniswap V2 Split
  - Uses `UniswapV2MigratorSplit`
  - Adds an optional proceeds split during migration
  - Good when a recipient should receive part of migration proceeds

- Uniswap V4 Split
  - Uses `UniswapV4MigratorSplit`
  - Adds V4 locker beneficiaries plus an optional proceeds split
  - Requires `streamableFees` because the split migrator always configures locker beneficiaries

## V2 Migration

```ts
.withMigration({ type: 'uniswapV2' })
```

- Encoded data: empty (`0x`)
- Migrator address resolved per chain (see `src/addresses.ts`)

## V2 Split Migration

```ts
.withMigration({
  type: 'uniswapV2Split',
  proceedsSplit: {
    recipient: '0xRecipient...',
    share: parseEther('0.1'),
  },
})
```

- Encoded data: `(recipient:address, share:uint256)`
- `share` is in WAD and capped onchain at `0.5e18` (50%)
- If `proceedsSplit` is omitted, the SDK still selects the split migrator but encodes a zero recipient / zero share
- The split recipient receives only its configured proceeds share

## V4 Migration (streamable fees)

```ts
.withMigration({
  type: 'uniswapV4',
  fee: 3000,
  tickSpacing: 60,
  streamableFees: {
    lockDuration: 365 * 24 * 60 * 60, // 1 year
    beneficiaries: [
      { beneficiary: '0x...', shares: parseEther('0.95') },
      { beneficiary: '0xAirlockOwner...', shares: parseEther('0.05') },
    ],
  },
})
```

- Encoded data:
  - `(fee:uint24, tickSpacing:int24, lockDuration:uint32, beneficiaries: (address, shares[WAD])[])`
  - The SDK sorts beneficiaries by address (ascending) as required by the contract
- Validation:
  - If `streamableFees` is provided: at least one beneficiary, all shares must be positive, total shares must sum to `1e18`
  - Contract enforces: airlock owner must receive at least 5% of streamed fees (add as a beneficiary if applicable)
- Chain support:
- Ensure `streamableFeesLocker` and `v4Migrator` are deployed on your target chain (see `src/addresses.ts`)

## V4 Split Migration

```ts
.withMigration({
  type: 'uniswapV4Split',
  fee: 3000,
  tickSpacing: 8,
  streamableFees: {
    lockDuration: 30 * 24 * 60 * 60,
    beneficiaries: [
      { beneficiary: '0xAirlockOwner...', shares: parseEther('0.05') },
      { beneficiary: '0xTeam...', shares: parseEther('0.95') },
    ],
  },
  proceedsSplit: {
    recipient: '0xRecipient...',
    share: parseEther('0.1'),
  },
})
```

- Encoded data:
  - `(fee:uint24, tickSpacing:int24, lockDuration:uint32, beneficiaries:(address,shares[WAD])[], proceedsRecipient:address, proceedsShare:uint256)`
- Validation:
  - `streamableFees` is required
  - At least one beneficiary, all shares positive, total shares equal `1e18`
  - `proceedsSplit.share` is capped at `0.5e18` when provided
- Runtime behavior:
  - The split recipient receives the configured share of numeraire proceeds during migration
  - Locker positions remain managed by the split migrator

## DopplerHook migration refunds

Boundary-price migrations can leave one currency outside the valid locker positions. Read and claim that balance through the migrator used by the launch:

```ts
const migrator = await sdk.getDopplerHookMigratorForAsset(asset);
const poolId = await migrator.getMigrationPoolId(asset);
const refund = await migrator.getMigrationRefund(poolId);

if (refund.exists) {
  await migrator.claimMigrationRefund(poolId, destination);
}
```

Only `refund.recipient` can submit the claim. `destination` can be any nonzero address.

`claimMigrationRefund` rejects reverted transactions and returns the amounts from the confirmed `MigrationRefundClaimed` event, not a pre-transaction balance snapshot.

## StreamableFeesLockerV2 lifecycle

Fee collection and principal unlocking are independent:

```ts
const locker = await sdk.getStreamableFeesLockerForAsset(asset);
const stream = await locker.getStream(poolId);

await locker.collectFees(poolId); // permissionless; does not unlock principal
const { timestamp } = await publicClient.getBlock();
// A zero unlockDate denotes permanently locked principal.
if (
  stream.unlockDate !== 0 &&
  !stream.isUnlocked &&
  timestamp >= BigInt(stream.unlockDate)
) {
  await locker.unlock(poolId); // stream recipient only
}
```

Always read `stream.isUnlocked` or observe the `Unlock` event. A successful `collectFees` call does not imply that the stream is unlocked.

Streams whose recipient is the no-op governance dead address have `unlockDate = 0`; their principal stays locked while beneficiaries can collect fees. Both write methods reject reverted receipts. `collectFees` returns the confirmed `Collect` event amounts, not the simulation estimate or the caller's beneficiary payout.

The public `streams(poolId)` getter returns only static stream fields. Solidity omits the dynamic beneficiary and position arrays from this mapping getter; use `getBeneficiaryShares(poolId, beneficiary)` for a known beneficiary. The SDK does not infer a one-position or two-position layout.

## Governance Selection

- Required: You must call `withGovernance(...)` in the builders.
- Standard governance defaults to a 1-day voting delay and 7-day voting period. Current DopplerERC20V1 tokens encode these durations in seconds.
- Legacy `type: 'standard'` tokens, including DERC20 V2 vesting, encode approximate block counts using the nominal Solidity `block.number` cadence: 12 seconds on Ethereum and Arbitrum, 2 seconds on Base and Base Sepolia, 1 second on Ink and Unichain (including Unichain Sepolia), and 400 milliseconds on Monad mainnet and testnet. For example, Ethereum uses 7,200 / 50,400 blocks; Base uses 43,200 / 302,400 blocks.
- Custom voting delays and periods are durations in the token clock's units and are passed through unchanged. Check `CLOCK_MODE()` for historical or custom tokens. Unknown legacy clock cadences, including custom legacy deployments on Robinhood, require explicit custom governance values. Changed chain cadence or custom token clocks also require explicit values.
- The SDK does not add a simulated standard-governance timelock to `excludedFromBalanceLimit`. GovernanceFactory deploys timelocks by nonce, so a simulated address can become stale before execution. This is an accepted limitation for capped launches.
- No-op governance: Call `withGovernance({ type: 'noOp' })`. The SDK throws if the chain’s `noOpGovernanceFactory` is not deployed and you did not override the governance factory address.
- Launchpad governance: Call `withGovernance({ type: 'launchpad', multisig })` in the builders.

## Address Resolution

`getAddresses(chainId)` selects current modules for new launches. Existing launches remain associated with the initializer, migrator, hook, and locker stored by Airlock and the launch contracts. Asset-based SDK helpers resolve those recorded addresses rather than substituting the latest deployment.

- `v2Migrator`, `v2MigratorSplit`, `v4Migrator`, and `v4MigratorSplit` must be present for the chosen creation type.
- Fee streaming requires the applicable locker deployment. No-op governance requires `noOpGovernanceFactory` or a governance factory override.

## Quick Decision Guide

- Want the simplest path and immediate trading? Use V2.
- Want a proceeds split on a V2 pool? Use V2 Split.
- Want programmable fee streaming to beneficiaries and are on a V4-ready chain? Use V4.
- Want V4 fee streaming plus a proceeds split? Use V4 Split.
