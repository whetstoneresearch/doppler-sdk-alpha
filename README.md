# Doppler SDK

Unified TypeScript SDK for interacting with Doppler Protocol V3 and V4.

## Installation

```bash
npm install @doppler/sdk
# or
yarn add @doppler/sdk
# or
pnpm add @doppler/sdk
```

## Usage

```typescript
import { DopplerSDK } from '@doppler/sdk'

// Initialize for V3
const v3Client = new DopplerSDK({ version: 'v3' })

// Initialize for V4
const v4Client = new DopplerSDK({ version: 'v4' })
```

## Development

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm build

# Run tests
pnpm test

# Development mode with watch
pnpm dev
```