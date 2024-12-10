import {
  DopplerPreDeploymentConfig,
  PoolConfig,
  PoolKey,
  PriceRange,
} from '@/types';
import { DAY_SECONDS, DEFAULT_PD_SLUGS, MAX_TICK_SPACING } from '@/constants';
import { DopplerAddresses } from '@/types';
import { Price, Token } from '@uniswap/sdk-core';
import { encodeSqrtRatioX96, tickToPrice, TickMath } from '@uniswap/v3-sdk';
import { Address, encodeAbiParameters, parseEther, toHex } from 'viem';
import { ETH_ADDRESS } from '@/constants';
import { CreateParams, MineParams, mine } from '@/entities/factory';
import { sortsBefore } from '@uniswap/v4-sdk';

/**
 * Validates and builds pool configuration from user-friendly parameters
 */
export function buildConfig(
  params: DopplerPreDeploymentConfig,
  addresses: DopplerAddresses
): CreateParams {
  validateBasicParams(params);

  const { startTick, endTick } = computeTicks(
    params.priceRange,
    params.tickSpacing
  );

  const gamma = computeOptimalGamma(
    startTick,
    endTick,
    params.duration,
    params.epochLength,
    params.tickSpacing
  );

  const startTime =
    params.blockTimestamp + params.startTimeOffset * DAY_SECONDS;
  const endTime = params.blockTimestamp + params.duration * DAY_SECONDS;

  const totalDuration = endTime - startTime;
  if (totalDuration % params.epochLength !== 0) {
    throw new Error('Epoch length must divide total duration evenly');
  }

  if (gamma % params.tickSpacing !== 0) {
    throw new Error('Computed gamma must be divisible by tick spacing');
  }

  const { tokenFactory, dopplerFactory, poolManager, airlock } = addresses;

  const mineParams: MineParams = {
    poolManager,
    numTokensToSell: params.numTokensToSell,
    minTick: startTick,
    maxTick: endTick,
    airlock,
    name: params.name,
    symbol: params.symbol,
    initialSupply: params.totalSupply,
    numeraire: ETH_ADDRESS,
    startingTime: BigInt(startTime),
    endingTime: BigInt(endTime),
    minimumProceeds: params.minProceeds,
    maximumProceeds: params.maxProceeds,
    epochLength: BigInt(params.epochLength),
    gamma,
    numPDSlugs: BigInt(params.numPdSlugs ?? DEFAULT_PD_SLUGS),
  };

  const [salt, dopplerAddress, tokenAddress] = mine(
    tokenFactory,
    dopplerFactory,
    mineParams
  );

  const poolConfig: PoolConfig = {
    tickSpacing: params.tickSpacing,
    fee: params.fee,
  };

  const poolKey: PoolKey = {
    currency0: ETH_ADDRESS,
    currency1: tokenAddress,
    ...poolConfig,
    hooks: dopplerAddress,
  };

  const hookData = encodeAbiParameters(
    [
      { name: 'minimumProceeds', type: 'uint256' },
      { name: 'maximumProceeds', type: 'uint256' },
      { name: 'startingTime', type: 'uint256' },
      { name: 'endingTime', type: 'uint256' },
      { name: 'startTick', type: 'int24' },
      { name: 'endTick', type: 'int24' },
      { name: 'epochLength', type: 'uint256' },
      { name: 'gamma', type: 'int24' },
      { name: 'isToken0', type: 'bool' },
      { name: 'numPDSlugs', type: 'uint256' },
      { name: 'airlock', type: 'address' },
    ],
    [
      params.minProceeds,
      params.maxProceeds,
      BigInt(startTime),
      BigInt(endTime),
      startTick,
      endTick,
      BigInt(params.epochLength),
      gamma,
      false,
      BigInt(params.numPdSlugs ?? DEFAULT_PD_SLUGS),
      airlock,
    ]
  );

  const createArgs: CreateParams = {
    name: params.name,
    symbol: params.symbol,
    initialSupply: params.totalSupply,
    numTokensToSell: params.numTokensToSell,
    poolKey,
    recipients: [] as Address[],
    amounts: [] as bigint[],
    tokenFactory,
    tokenData: toHex(''),
    governanceFactory: addresses.governanceFactory,
    governanceData: toHex(''),
    hookFactory: addresses.dopplerFactory,
    hookData,
    migrator: addresses.migrator,
    pool: poolConfig,
    salt,
  };

  return createArgs;
}

// Converts price range to tick range, ensuring alignment with tick spacing
function computeTicks(
  priceRange: PriceRange,
  tickSpacing: number
): { startTick: number; endTick: number } {
  const quoteToken = new Token(1, ETH_ADDRESS, 18);
  const assetToken = new Token(
    1,
    '0x0000000000000000000000000000000000000001',
    18
  );
  // Convert prices to sqrt price X96
  let startTick = priceToClosestTick(
    new Price(
      assetToken,
      quoteToken,
      parseEther('1').toString(),
      parseEther(priceRange.startPrice.toString()).toString()
    )
  );
  let endTick = priceToClosestTick(
    new Price(
      assetToken,
      quoteToken,
      parseEther('1').toString(),
      parseEther(priceRange.endPrice.toString()).toString()
    )
  );

  // Align to tick spacing
  startTick = Math.floor(startTick / tickSpacing) * tickSpacing;
  endTick = Math.floor(endTick / tickSpacing) * tickSpacing;

  // Validate tick range
  if (startTick === endTick) {
    throw new Error('Start and end prices must result in different ticks');
  }

  return { startTick, endTick };
}

// Computes optimal gamma parameter based on price range and time parameters
function computeOptimalGamma(
  startTick: number,
  endTick: number,
  durationDays: number,
  epochLength: number,
  tickSpacing: number
): number {
  // Calculate total number of epochs
  const totalEpochs = (durationDays * DAY_SECONDS) / epochLength;

  // Calculate required tick movement per epoch to cover the range
  const tickDelta = Math.abs(endTick - startTick);
  // Round up to nearest multiple of tick spacing
  let gamma = Math.ceil(tickDelta / totalEpochs) * tickSpacing;
  // Ensure gamma is at least 1 tick spacing
  gamma = Math.max(tickSpacing, gamma);

  if (gamma % tickSpacing !== 0) {
    throw new Error('Computed gamma must be divisible by tick spacing');
  }

  return gamma;
}

// Validates basic parameters
function validateBasicParams(params: DopplerPreDeploymentConfig) {
  // Validate tick spacing
  if (params.tickSpacing > MAX_TICK_SPACING) {
    throw new Error(`Tick spacing cannot exceed ${MAX_TICK_SPACING}`);
  }

  // Validate time parameters
  if (params.startTimeOffset < 0) {
    throw new Error('Start time offset must be positive');
  }
  if (params.duration <= 0) {
    throw new Error('Duration must be positive');
  }
  if (params.epochLength <= 0) {
    throw new Error('Epoch length must be positive');
  }

  // Validate proceeds
  if (params.maxProceeds < params.minProceeds) {
    throw new Error('Maximum proceeds must be greater than minimum proceeds');
  }

  // Validate price range
  if (params.priceRange.startPrice === 0 || params.priceRange.endPrice === 0) {
    throw new Error('Prices must be positive');
  }
  if (params.priceRange.startPrice === params.priceRange.endPrice) {
    throw new Error('Start and end prices must be different');
  }
}

export function priceToClosestTick(price: Price<Token, Token>): number {
  const sorted = sortsBefore(price.baseCurrency, price.quoteCurrency);

  const sqrtRatioX96 = sorted
    ? encodeSqrtRatioX96(price.numerator, price.denominator)
    : encodeSqrtRatioX96(price.denominator, price.numerator);

  let tick = TickMath.getTickAtSqrtRatio(sqrtRatioX96);
  const nextTickPrice = tickToPrice(
    price.baseCurrency,
    price.quoteCurrency,
    tick + 1
  );
  if (sorted) {
    if (!price.lessThan(nextTickPrice)) {
      tick++;
    }
  } else {
    if (!price.greaterThan(nextTickPrice)) {
      tick++;
    }
  }
  return tick;
}

// // Helper to suggest optimal epoch length based on duration
// function suggestEpochLength(durationDays: number): number {
//   if (durationDays > 30) return 2 * 60 * 60; // 2 hours
//   if (durationDays > 7) return 1 * 60 * 60; // 1 hour
//   if (durationDays > 1) return 1 * 60 * 30; // 30 minutes
//   return 1 * 60 * 20; // 20 minutes
// }
