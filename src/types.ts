import { Address, Hash, PublicClient, TestClient, WalletClient } from 'viem';

export interface Clients {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  testClient?: TestClient;
}

export interface DopplerAddresses {
  airlock: Address;
  tokenFactory: Address;
  dopplerFactory: Address;
  governanceFactory: Address;
  migrator: Address;
  poolManager: Address;
  stateView: Address;
  customRouter: Address;
}

export interface TokenConfig {
  name: string;
  symbol: string;
  totalSupply: bigint;
}

export interface DeploymentConfigParams {
  assetToken: Address;
  quoteToken: Address;
  startTime: number; // in seconds
  endTime: number; // in seconds
  epochLength: number; // in seconds
  startTick: number;
  endTick: number;
  gamma: number;
  minProceeds: bigint;
  maxProceeds: bigint;
  numTokensToSell: bigint;
  numPdSlugs: number;
}

export type ViewOverrides = {
  blockNumber?: bigint;
  blockTag?: 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized';
};

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

// this maps onto the tick range, startingTick -> endingTick
export interface PriceRange {
  startPrice: number;
  endPrice: number;
}

export interface DopplerPreDeploymentConfig {
  // Token details
  name: string;
  symbol: string;
  totalSupply: bigint;
  numTokensToSell: bigint;

  // Time parameters
  blockTimestamp: number;
  startTimeOffset: number; // in days from now
  duration: number; // in days
  epochLength: number; // in seconds

  // Price parameters
  priceRange: PriceRange;
  tickSpacing: number;
  fee: number; // In bips

  // Sale parameters
  minProceeds: bigint;
  maxProceeds: bigint;
  numPdSlugs?: number; // uses a default if not set
}

export interface PoolConfig {
  tickSpacing: number;
  fee: number; // In bips (e.g., 3000 for 0.3%)
}

export interface DopplerDeploymentConfig {
  salt: Hash;
  dopplerAddress: Address;
  poolKey: PoolKey;
  token: TokenConfig;
  hook: DeploymentConfigParams;
  pool: PoolConfig;
}

export interface DeployerParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  addresses?: DopplerAddresses;
}
