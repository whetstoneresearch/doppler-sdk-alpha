# Dynamic Hook Live Read Compatibility (Issue #6)

This note documents live‑chain behavior observed when calling view functions on two sample “hook” addresses from GitHub issue #6, our working theory for why these addresses revert, and options to fix or work around it. It also summarizes the SDK change we shipped to permanently resolve the original decode error reported in #6.

## Summary

- Original error in #6: calling `state()` on some deployed dynamic hooks failed to decode with:
  - `ContractFunctionExecutionError: Position 223 is out of bounds (0 < position < 192)`
- Root cause: our SDK had the wrong ABI shape for the live Doppler Hook `state()` — most importantly, `feesAccrued` was modeled as a tuple of two `int128` rather than the correct `int256` and output shapes didn’t match the compiled artifact.
- SDK fix: aligned the SDK’s Doppler Hook ABI to the compiled contracts in `doppler/out` (no “legacy” ABI). This removes the decode-length mismatch.
- Additional finding: the two sample hook addresses from the issue revert on several view calls (`state()`, `insufficientProceeds()`, `startingTime()`, `epochLength()`). This is a different class of failure (a revert), not an ABI decode length mismatch. See details below.

## Sample Hook Addresses That Revert

Network: Base mainnet (`https://mainnet.base.org`)

- “Recent”: `0x87b2050fae7306d4144031c417e11e937bbaf48e`
  - `insufficientProceeds()` reverted (when fetching `getHookInfo()`).
  - `earlyExit()` reverted.
  - Direct `state()` call also reverted when isolated.

- “Old”: `0x5cdeb399d27a2bfa31df1348fb2c11d4b54eda3d`
  - `startingTime()` reverted (when fetching `getHookInfo()`).
  - `epochLength()` reverted (when fetching `getCurrentEpoch()`).
  - Direct `state()` call also reverted when isolated.

Both addresses return non‑empty bytecode via `eth_getCode`, so they are contracts (not EOAs), but the expected Doppler hook view functions revert on direct calls.

## What We Fixed In The SDK

- Corrected `dopplerHookAbi` to match `doppler/out/Doppler.sol/Doppler.json` exactly:
  - `state()` returns top‑level fields and `feesAccrued` as `int256`.
  - `poolKey()` returns top‑level fields (`currency0`, `currency1`, `fee`, `tickSpacing`, `hooks`).
- Removed the legacy/fallback path. The correct ABI decodes cleanly.

Result: The decode error from #6 is resolved by using the correct ABI.

## Why These Two Addresses Revert (Theory)

One or more of the following likely apply:

1) Not Doppler hook contracts or incompatible variants
   - If the contract at the given address does not implement functions like `state()`, `startingTime()`, etc., direct calls will hit a fallback and can revert. The function selectors would not match the Doppler hook interface the SDK uses.

2) Very early/legacy deployments without public getters
   - Some early dynamic auction deployments may have exposed state via a separate “Lens/StateView” contract rather than public getters on the hook. Direct calls to those getters would revert.

3) Access checks in view functions (less likely)
   - If a hook implemented checks like “only pool” even on `view` methods, a direct read could revert when not called by the pool. This pattern is uncommon for pure reads but would produce the behavior we observed.

Given the consistent reverts on multiple distinct getters, the most probable explanation is (1)/(2): these addresses are either not Doppler hooks of the current/known legacy interface, or they are very early variants that do not expose these getters.

## How To Fix Or Work Around

Options depend on whether you control the deployments and what you need to support:

- If you can re‑deploy or upgrade:
  - Use the current Doppler dynamic hook implementation that exposes the standard view functions (`state`, `startingTime`, `endingTime`, `epochLength`, etc.). The SDK now uses the compiled ABI from `doppler/out`.

- If you must support these exact historical addresses:
  - Add a secondary read path that does not rely on direct hook getters. Two potential approaches:
    - Lens/StateView fallback: read state via a chain’s Doppler “lens”/“stateView” contract, if available for that deployment era. The SDK already contains addresses for `dopplerLens`/`stateView`, but the ABI for a state view is not yet included or integrated for this purpose.
    - Indexer: fetch hook state from an indexer/graph that knows the historical storage layout. This is the most robust for multiple legacy variants.
  - SDK enhancement sketch: extend `DynamicAuction.getHookInfo()` to catch reverts on direct hook reads and fallback to a lens/stateView provider (if configured for the chain). This would preserve a single high‑level API for both modern and legacy deployments.

- If the addresses are mis‑identified:
  - Verify that the address is indeed the Doppler hook (not the pool or initializer). The SDK’s direct reads assume a Doppler hook interface is present at the address provided.

## Repro / Verification Notes

- Unit and integration tests in `doppler-sdk-alpha` pass with the corrected ABIs.
- Optional live/fork‑style tests (skipped by default) can be configured to probe specific addresses; note that the two sample addresses still revert on direct reads as documented.

## Bottom Line

- The decode‑mismatch bug from issue #6 is fixed by aligning the SDK ABI with the compiled contracts; no legacy ABI is involved.
- The two sample addresses from the issue currently revert on direct reads. This appears to be an address/compatibility problem separate from the decode bug. If legacy deployments must be supported, we can implement a lens/state view fallback in the SDK or integrate an indexer.
