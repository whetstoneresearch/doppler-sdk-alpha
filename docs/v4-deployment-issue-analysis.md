# V4 Deployment Issue Analysis

## Problem Summary

The unified SDK is failing to deploy dynamic auctions with error `0x248d3d6a` while the V4 SDK succeeds with the same intended parameters.

## Key Differences Found

### 1. Gamma Value
- **V4 SDK**: gamma = 30 (0x1e in hex)
- **Unified SDK**: gamma = 64 (0x40 in hex)

The unified SDK's `computeOptimalGamma` method calculates gamma differently due to different default epoch length:
- V4 SDK uses: 43200 seconds (12 hours)
- Unified SDK uses: 3600 seconds (1 hour) as DEFAULT_EPOCH_LENGTH

### 2. Integrator Address
- **V4 SDK**: Uses `0x0000000000000000000000000000000000000000` (ZERO_ADDRESS)
- **Unified SDK**: Defaults to `0x000000000000000000000000000000000000dEaD` (DEAD_ADDRESS)

### 3. Salt Value
Different salt values are expected due to address mining, but this shouldn't cause failures.

## Root Cause

The error likely occurs because:
1. The gamma value of 64 may be incompatible with the smart contract's validation
2. The integrator address might need to be ZERO_ADDRESS for certain configurations

## Solution

When creating a dynamic auction that needs to match V4 SDK behavior:

1. **Explicitly set gamma**: Don't rely on automatic calculation
```typescript
auction: {
  gamma: 30, // Explicitly set the V4 SDK value
  // ... other params
}
```

2. **Use ZERO_ADDRESS for integrator** when matching V4 behavior:
```typescript
integrator: "0x0000000000000000000000000000000000000000"
```

3. **Match epoch length** to V4 SDK:
```typescript
auction: {
  epochLength: 43200, // 12 hours in seconds
  // ... other params
}
```

## Recommended Changes to Unified SDK

1. Update DEFAULT_EPOCH_LENGTH to match V4 SDK (43200 seconds)
2. Consider using ZERO_ADDRESS as default integrator instead of DEAD_ADDRESS
3. Add validation to ensure gamma is compatible with contract requirements
4. Document these defaults clearly in the API documentation