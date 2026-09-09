import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  type Address,
  type Hex,
  type PublicClient,
  zeroAddress,
} from 'viem';
import type { ChainAddresses } from '../../../addresses';
import {
  dopplerHookInitializerAbi,
  v4MulticurveInitializerAbi,
} from '../../../abis';
import type { MulticurvePoolState, V4PoolKey } from '../../../types';

export interface InitializerDiscoveryResult {
  initializerAddress: Address;
  initializerKind: MulticurveInitializerKind;
  dopplerHookAddress: Address;
  state: MulticurvePoolState;
}

export type InitializerDiscoveryClient = Pick<PublicClient, 'readContract'>;

export type MulticurveInitializerKind = 'standard' | 'dopplerHook';

export type MulticurveInitializerCandidate = {
  address: Address;
  kind: MulticurveInitializerKind;
  probeAlternateLayout?: boolean;
};

type StructLike = Record<string, unknown> & {
  readonly [index: number]: unknown;
};

interface ParsedInitializerState {
  numeraire: Address;
  status: number;
  poolKey: V4PoolKey;
  farTick: number;
  dopplerHookAddress: Address;
}

const ABSENT_POOL_ERROR_ABI = [
  { type: 'error', name: 'PoolNotFound', inputs: [] },
  { type: 'error', name: 'PoolNotInitialized', inputs: [] },
] as const;

export async function findMulticurveInitializerForPool({
  client,
  tokenAddress,
  addresses,
  recordedInitializer,
}: {
  client: InitializerDiscoveryClient;
  tokenAddress: Address;
  addresses: ChainAddresses;
  recordedInitializer?: Address;
}): Promise<InitializerDiscoveryResult> {
  const configuredInitializers = getMulticurveInitializerCandidates(addresses);
  const initializersToTry =
    recordedInitializer === undefined
      ? configuredInitializers
      : [
          {
            address: recordedInitializer,
            kind: 'dopplerHook' as const,
            probeAlternateLayout: true,
          },
          {
            address: recordedInitializer,
            kind: 'standard' as const,
            probeAlternateLayout: true,
          },
          ...configuredInitializers.filter(
            ({ address }) =>
              address.toLowerCase() !== recordedInitializer.toLowerCase(),
          ),
        ];

  if (initializersToTry.length === 0) {
    throw new Error(
      'No V4 multicurve initializer addresses configured for this chain',
    );
  }

  const triedInitializers: Address[] = [];
  const failedInitializers: Error[] = [];

  for (const initializer of initializersToTry) {
    const { address: initializerAddress, kind } = initializer;
    triedInitializers.push(initializerAddress);

    let stateData: unknown;
    try {
      stateData = await client.readContract({
        address: initializerAddress,
        abi: getMulticurveInitializerAbi(kind),
        functionName: 'getState',
        args: [tokenAddress],
      });
    } catch (error) {
      if (
        !initializer.probeAlternateLayout &&
        !isAbsentPoolReadFailure(error)
      ) {
        throw error;
      }

      const reason = error instanceof Error ? error.message : String(error);
      failedInitializers.push(
        new Error(`${initializerAddress} ${kind} getState failed: ${reason}`),
      );
      continue;
    }

    try {
      const discoveryResult = parseMulticurveInitializerDiscoveryResult({
        tokenAddress,
        initializerAddress,
        kind,
        stateData,
      });

      if (isInitializedMulticurvePoolKey(discoveryResult.state.poolKey)) {
        return discoveryResult;
      }
    } catch (error) {
      if (!initializer.probeAlternateLayout) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      failedInitializers.push(
        new Error(`${initializerAddress} ${kind} decode failed: ${reason}`),
      );
    }
  }

  const notFoundError = new Error(
    `Pool not found for token ${tokenAddress}. ` +
      `Tried initializers: ${triedInitializers.join(', ')}` +
      (failedInitializers.length > 0
        ? `. Failed initializers: ${failedInitializers
            .map((error) => error.message)
            .join(' | ')}`
        : ''),
  );

  if (failedInitializers.length > 0) {
    (notFoundError as Error & { cause?: AggregateError }).cause =
      new AggregateError(
        failedInitializers,
        `Initializer discovery failed for token ${tokenAddress}`,
      );
  }

  throw notFoundError;
}

export function parseMulticurvePoolKey(rawPoolKey: unknown): V4PoolKey {
  const poolKeyStruct = rawPoolKey as StructLike;
  return {
    currency0: (poolKeyStruct.currency0 ?? poolKeyStruct[0]) as Address,
    currency1: (poolKeyStruct.currency1 ?? poolKeyStruct[1]) as Address,
    fee: Number(poolKeyStruct.fee ?? poolKeyStruct[2]),
    tickSpacing: Number(poolKeyStruct.tickSpacing ?? poolKeyStruct[3]),
    hooks: (poolKeyStruct.hooks ?? poolKeyStruct[4]) as Address,
  };
}

export function getMulticurveInitializerCandidates(
  addresses: ChainAddresses,
): readonly MulticurveInitializerCandidate[] {
  return [
    {
      address: addresses.v4MulticurveInitializer,
      kind: 'standard' as const,
    },
    {
      address: addresses.v4ScheduledMulticurveInitializer,
      kind: 'standard' as const,
    },
    {
      address: addresses.v4DecayMulticurveInitializer,
      kind: 'standard' as const,
    },
    {
      address: addresses.dopplerHookInitializer,
      kind: 'dopplerHook' as const,
    },
  ].filter((entry): entry is MulticurveInitializerCandidate =>
    Boolean(entry.address && entry.address !== zeroAddress),
  );
}

export function getMulticurveInitializerAbi(
  kind: MulticurveInitializerKind,
): typeof dopplerHookInitializerAbi | typeof v4MulticurveInitializerAbi {
  return kind === 'dopplerHook'
    ? dopplerHookInitializerAbi
    : v4MulticurveInitializerAbi;
}

export function parseMulticurveInitializerDiscoveryResult({
  tokenAddress,
  initializerAddress,
  kind,
  stateData,
}: {
  tokenAddress: Address;
  initializerAddress: Address;
  kind: MulticurveInitializerKind;
  stateData: unknown;
}): InitializerDiscoveryResult {
  const parsedState =
    kind === 'dopplerHook'
      ? parseDopplerHookInitializerState(stateData)
      : parseStandardInitializerState(stateData);

  const { numeraire, status, poolKey, farTick, dopplerHookAddress } =
    parsedState;
  return {
    initializerAddress,
    initializerKind: kind,
    dopplerHookAddress,
    state: {
      asset: tokenAddress,
      numeraire,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      status,
      poolKey,
      farTick: Number(farTick),
    },
  };
}

export function isInitializedMulticurvePoolKey(poolKey: V4PoolKey): boolean {
  return poolKey.hooks !== zeroAddress && poolKey.tickSpacing !== 0;
}

export function isAbsentPoolRevertData(data: Hex): boolean {
  if (data === '0x') {
    return false;
  }

  try {
    const decodedError = decodeErrorResult({
      abi: ABSENT_POOL_ERROR_ABI,
      data,
    });
    return (
      decodedError.errorName === 'PoolNotFound' ||
      decodedError.errorName === 'PoolNotInitialized'
    );
  } catch (error) {
    if (error instanceof Error) {
      return false;
    }
    throw error;
  }
}

function parseStandardInitializerState(
  stateData: unknown,
): ParsedInitializerState {
  const state = stateData as StructLike;
  return {
    numeraire: (state.numeraire ?? state[0]) as Address,
    status: Number(state.status ?? state[1]),
    poolKey: parseMulticurvePoolKey(state.poolKey ?? state[2]),
    farTick: Number(state.farTick ?? state[3]),
    dopplerHookAddress: zeroAddress,
  };
}

function parseDopplerHookInitializerState(
  stateData: unknown,
): ParsedInitializerState {
  const state = stateData as StructLike;
  return {
    numeraire: (state.numeraire ?? state[0]) as Address,
    status: Number(state.status ?? state[4]),
    poolKey: parseMulticurvePoolKey(state.poolKey ?? state[5]),
    farTick: Number(state.farTick ?? state[6]),
    dopplerHookAddress: (state.dopplerHook ?? state[2]) as Address,
  };
}

function isAbsentPoolReadFailure(error: unknown): boolean {
  if (!(error instanceof BaseError)) {
    return false;
  }

  const revertedError = error.walk(
    (cause) => cause instanceof ContractFunctionRevertedError,
  );
  if (!(revertedError instanceof ContractFunctionRevertedError)) {
    return false;
  }

  return (
    revertedError.data?.errorName === 'PoolNotFound' ||
    revertedError.data?.errorName === 'PoolNotInitialized'
  );
}
