import { isAddress, isHex, type Address, type Hex } from 'viem';
import type { RehypeFeeDistributionInfo } from '../../types';

export interface DynamicHookState {
  totalTokensSold: bigint;
  totalProceeds: bigint;
}

export interface RehypeFeeSchedule {
  startingTime: number;
  startFee: number;
  endFee: number;
  lastFee: number;
  durationSeconds: number;
}

export interface RehypeHookFees {
  fees0: bigint;
  fees1: bigint;
  beneficiaryFees0: bigint;
  beneficiaryFees1: bigint;
  airlockOwnerFees0: bigint;
  airlockOwnerFees1: bigint;
  customFee: number;
}

export interface RehypePoolInfo {
  asset: Address;
  numeraire: Address;
  buybackDst: Address;
}

export interface RehypeIntegratorRoutingConfig {
  integrator: Address;
  assetFeesToNumeraireRatio: number;
  numeraireFeesToAssetRatio: number;
  automaticPayout: boolean;
}

export interface RehypeIntegratorFees {
  fees0: bigint;
  fees1: bigint;
}
export interface AirlockAssetData {
  numeraire: Address;
  timelock: Address;
  governance: Address;
  liquidityMigrator: Address;
  poolInitializer: Address;
  poolOrHook: Address;
  migrationPool: Address;
  numTokensToSell: bigint;
  totalSupply: bigint;
  integrator: Address;
}

export interface RehypePosition {
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  salt: Hex;
}

export function normalizeAirlockAssetData(
  rawAssetData: unknown,
  context = 'Airlock getAssetData',
): AirlockAssetData {
  const addressField = (name: string, index: number): Address =>
    parseAddress(
      readContractResultField(rawAssetData, [name], index, context),
      context,
      name,
    );
  return {
    numeraire: addressField('numeraire', 0),
    timelock: addressField('timelock', 1),
    governance: addressField('governance', 2),
    liquidityMigrator: addressField('liquidityMigrator', 3),
    poolInitializer: addressField('poolInitializer', 4),
    poolOrHook: parseAddress(
      readContractResultField(rawAssetData, ['poolOrHook', 'pool'], 5, context),
      context,
      'poolOrHook',
    ),
    migrationPool: addressField('migrationPool', 6),
    numTokensToSell: parseBigIntField(
      rawAssetData,
      'numTokensToSell',
      7,
      context,
    ),
    totalSupply: parseBigIntField(rawAssetData, 'totalSupply', 8, context),
    integrator: addressField('integrator', 9),
  };
}

export function parseAirlockPoolOrHook(
  rawAssetData: unknown,
  context = 'Airlock getAssetData',
): Address {
  const rawPoolOrHook = readContractResultField(
    rawAssetData,
    ['poolOrHook', 'pool'],
    5,
    context,
  );
  return parseAddress(rawPoolOrHook, context, 'poolOrHook');
}

export function parseAirlockLiquidityMigrator(
  rawAssetData: unknown,
  context = 'Airlock getAssetData',
): Address {
  const rawLiquidityMigrator = readContractResultField(
    rawAssetData,
    ['liquidityMigrator'],
    3,
    context,
  );
  return parseAddress(rawLiquidityMigrator, context, 'liquidityMigrator');
}

export function normalizeDynamicHookState(
  rawState: unknown,
  context = 'DopplerHook state',
): DynamicHookState {
  return {
    totalTokensSold: parseBigIntField(rawState, 'totalTokensSold', 2, context),
    totalProceeds: parseBigIntField(rawState, 'totalProceeds', 3, context),
  };
}

export function normalizeRehypeFeeDistributionInfo(
  rawInfo: unknown,
  context = 'Rehype getFeeDistributionInfo',
): RehypeFeeDistributionInfo {
  return {
    assetFeesToAssetBuybackWad: parseBigIntField(
      rawInfo,
      'assetFeesToAssetBuybackWad',
      0,
      context,
    ),
    assetFeesToNumeraireBuybackWad: parseBigIntField(
      rawInfo,
      'assetFeesToNumeraireBuybackWad',
      1,
      context,
    ),
    assetFeesToBeneficiaryWad: parseBigIntField(
      rawInfo,
      'assetFeesToBeneficiaryWad',
      2,
      context,
    ),
    assetFeesToLpWad: parseBigIntField(rawInfo, 'assetFeesToLpWad', 3, context),
    numeraireFeesToAssetBuybackWad: parseBigIntField(
      rawInfo,
      'numeraireFeesToAssetBuybackWad',
      4,
      context,
    ),
    numeraireFeesToNumeraireBuybackWad: parseBigIntField(
      rawInfo,
      'numeraireFeesToNumeraireBuybackWad',
      5,
      context,
    ),
    numeraireFeesToBeneficiaryWad: parseBigIntField(
      rawInfo,
      'numeraireFeesToBeneficiaryWad',
      6,
      context,
    ),
    numeraireFeesToLpWad: parseBigIntField(
      rawInfo,
      'numeraireFeesToLpWad',
      7,
      context,
    ),
  };
}

export function normalizeRehypeFeeSchedule(
  rawSchedule: unknown,
  context = 'Rehype getFeeSchedule',
): RehypeFeeSchedule {
  return {
    startingTime: parseNumberField(rawSchedule, 'startingTime', 0, context),
    startFee: parseNumberField(rawSchedule, 'startFee', 1, context),
    endFee: parseNumberField(rawSchedule, 'endFee', 2, context),
    lastFee: parseNumberField(rawSchedule, 'lastFee', 3, context),
    durationSeconds: parseNumberField(
      rawSchedule,
      'durationSeconds',
      4,
      context,
    ),
  };
}

export function normalizeRehypeIntegratorRoutingConfig(
  rawConfig: unknown,
  context = 'Rehype getIntegratorRoutingConfig',
): RehypeIntegratorRoutingConfig {
  return {
    integrator: parseAddressField(rawConfig, 'integrator', 0, context),
    assetFeesToNumeraireRatio: parseNumberField(
      rawConfig,
      'assetFeesToNumeraireRatio',
      1,
      context,
    ),
    numeraireFeesToAssetRatio: parseNumberField(
      rawConfig,
      'numeraireFeesToAssetRatio',
      2,
      context,
    ),
    automaticPayout: parseBooleanField(
      rawConfig,
      'automaticPayout',
      3,
      context,
    ),
  };
}

export function normalizeRehypeIntegratorFees(
  rawFees: unknown,
  context: string,
): RehypeIntegratorFees {
  return {
    fees0: parseBigIntField(rawFees, 'fees0', 0, context),
    fees1: parseBigIntField(rawFees, 'fees1', 1, context),
  };
}

export function normalizeRehypeHookFees(
  rawFees: unknown,
  context = 'Rehype getHookFees',
): RehypeHookFees {
  return {
    fees0: parseBigIntField(rawFees, 'fees0', 0, context),
    fees1: parseBigIntField(rawFees, 'fees1', 1, context),
    beneficiaryFees0: parseBigIntField(rawFees, 'beneficiaryFees0', 2, context),
    beneficiaryFees1: parseBigIntField(rawFees, 'beneficiaryFees1', 3, context),
    airlockOwnerFees0: parseBigIntField(
      rawFees,
      'airlockOwnerFees0',
      4,
      context,
    ),
    airlockOwnerFees1: parseBigIntField(
      rawFees,
      'airlockOwnerFees1',
      5,
      context,
    ),
    customFee: parseNumberField(rawFees, 'customFee', 6, context),
  };
}

export function normalizeRehypePoolInfo(
  rawInfo: unknown,
  context = 'Rehype getPoolInfo',
): RehypePoolInfo {
  return {
    asset: parseAddressField(rawInfo, 'asset', 0, context),
    numeraire: parseAddressField(rawInfo, 'numeraire', 1, context),
    buybackDst: parseAddressField(rawInfo, 'buybackDst', 2, context),
  };
}

export function normalizeRehypePosition(
  rawPosition: unknown,
  context = 'Rehype getPosition',
): RehypePosition {
  return {
    tickLower: parseNumberField(rawPosition, 'tickLower', 0, context),
    tickUpper: parseNumberField(rawPosition, 'tickUpper', 1, context),
    liquidity: parseBigIntField(rawPosition, 'liquidity', 2, context),
    salt: parseHexField(rawPosition, 'salt', 3, context),
  };
}

function parseAddressField(
  rawResult: unknown,
  fieldName: string,
  tupleIndex: number,
  context: string,
): Address {
  const rawField = readContractResultField(
    rawResult,
    [fieldName],
    tupleIndex,
    context,
  );
  return parseAddress(rawField, context, fieldName);
}

function parseBigIntField(
  rawResult: unknown,
  fieldName: string,
  tupleIndex: number,
  context: string,
): bigint {
  const rawField = readContractResultField(
    rawResult,
    [fieldName],
    tupleIndex,
    context,
  );

  if (typeof rawField === 'bigint') {
    return rawField;
  }

  if (typeof rawField === 'number' && Number.isSafeInteger(rawField)) {
    return BigInt(rawField);
  }

  if (typeof rawField === 'string' && rawField.trim() !== '') {
    try {
      return BigInt(rawField);
    } catch {
      throw new Error(`${context}: ${fieldName} must be bigint-compatible`);
    }
  }

  throw new Error(`${context}: ${fieldName} must be bigint-compatible`);
}

function parseNumberField(
  rawResult: unknown,
  fieldName: string,
  tupleIndex: number,
  context: string,
): number {
  const rawField = readContractResultField(
    rawResult,
    [fieldName],
    tupleIndex,
    context,
  );
  const numericField =
    typeof rawField === 'bigint' || typeof rawField === 'number'
      ? Number(rawField)
      : Number.NaN;

  if (!Number.isSafeInteger(numericField)) {
    throw new Error(`${context}: ${fieldName} must be a safe integer`);
  }

  return numericField;
}

function parseBooleanField(
  rawResult: unknown,
  fieldName: string,
  tupleIndex: number,
  context: string,
): boolean {
  const rawField = readContractResultField(
    rawResult,
    [fieldName],
    tupleIndex,
    context,
  );
  if (typeof rawField !== 'boolean') {
    throw new Error(`${context}: ${fieldName} must be a boolean`);
  }
  return rawField;
}

function parseHexField(
  rawResult: unknown,
  fieldName: string,
  tupleIndex: number,
  context: string,
): Hex {
  const rawField = readContractResultField(
    rawResult,
    [fieldName],
    tupleIndex,
    context,
  );

  if (typeof rawField === 'string' && isHex(rawField)) {
    return rawField as Hex;
  }

  throw new Error(`${context}: ${fieldName} must be hex`);
}

function parseAddress(
  rawField: unknown,
  context: string,
  fieldName: string,
): Address {
  if (typeof rawField === 'string' && isAddress(rawField, { strict: false })) {
    return rawField as Address;
  }

  throw new Error(`${context}: ${fieldName} must be an address`);
}

function readContractResultField(
  rawResult: unknown,
  fieldNames: readonly string[],
  tupleIndex: number,
  context: string,
): unknown {
  if (Array.isArray(rawResult)) {
    if (tupleIndex < rawResult.length && rawResult[tupleIndex] !== undefined) {
      return rawResult[tupleIndex];
    }
    throw new Error(
      `${context}: missing tuple field ${fieldNames.join('/')} at index ${tupleIndex}`,
    );
  }

  if (isRecord(rawResult)) {
    for (const fieldName of fieldNames) {
      const rawField = rawResult[fieldName];
      if (rawField !== undefined) {
        return rawField;
      }
    }
    throw new Error(`${context}: missing field ${fieldNames.join('/')}`);
  }

  throw new Error(`${context}: expected tuple or object result`);
}

function isRecord(rawResult: unknown): rawResult is Record<string, unknown> {
  return typeof rawResult === 'object' && rawResult !== null;
}
