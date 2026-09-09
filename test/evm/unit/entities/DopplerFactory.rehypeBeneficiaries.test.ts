import { beforeEach, describe, expect, it } from 'vitest';
import { decodeAbiParameters, getAddress, parseEther } from 'viem';
import { DopplerFactory } from '../../../../src/evm/entities/DopplerFactory';
import {
  RehypeFeeRoutingMode,
  type CreateMulticurveParams,
  type RehypeDopplerHookInitializerConfig,
} from '../../../../src/evm/types';
import { WAD } from '../../../../src/evm/constants';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';

const hookAddress = getAddress('0x9999999999999999999999999999999999999999');
const buybackDestination = getAddress(
  '0x8888888888888888888888888888888888888888',
);
const firstBeneficiary = getAddress(
  '0x1111111111111111111111111111111111111111',
);
const secondBeneficiary = getAddress(
  '0x2222222222222222222222222222222222222222',
);
const integrator = getAddress('0x7777777777777777777777777777777777777777');
const explicitIntegrator = getAddress(
  '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
);

describe('DopplerFactory RehypeDopplerHookInitializer beneficiary encoding', () => {
  let factory: DopplerFactory;

  beforeEach(() => {
    factory = new DopplerFactory(
      createMockPublicClient(),
      createMockWalletClient(),
      1,
    );
  });

  it('encodes an empty beneficiary array when buybackDst is configured', () => {
    // Given
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    // When
    const decoded = encodeAndDecode(factory, params);

    // Then
    expect(decoded.buybackDst).toBe(buybackDestination);
    expect(decoded.feeBeneficiaries).toEqual([]);
  });

  it('preserves buybackDst with beneficiary routing and no beneficiaries', () => {
    // Given
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      feeRoutingMode: RehypeFeeRoutingMode.RouteToBeneficiaryFees,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    // When
    const decoded = encodeAndDecode(factory, params);

    // Then
    expect(decoded.buybackDst).toBe(buybackDestination);
    expect(Number(decoded.feeRoutingMode)).toBe(
      RehypeFeeRoutingMode.RouteToBeneficiaryFees,
    );
    expect(decoded.feeBeneficiaries).toEqual([]);
  });

  it('encodes sorted beneficiaries with an explicit controller', () => {
    // Given
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      feeBeneficiaries: [
        { beneficiary: secondBeneficiary, shares: WAD / 4n },
        { beneficiary: firstBeneficiary, shares: (WAD * 3n) / 4n },
      ],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    // When
    const decoded = encodeAndDecode(factory, params);

    // Then
    expect(decoded.buybackDst).toBe(buybackDestination);
    expect(Number(decoded.feeRoutingMode)).toBe(
      RehypeFeeRoutingMode.RouteToBeneficiaryFees,
    );
    expect(decoded.feeBeneficiaries).toEqual([
      { beneficiary: firstBeneficiary, shares: (WAD * 3n) / 4n },
      { beneficiary: secondBeneficiary, shares: WAD / 4n },
    ]);
  });

  it('requires a controller for complete LP reinvestment', () => {
    const params = multicurveParams({
      hookAddress,
      startFee: 3_000,
      feeDistributionInfo: fullLpReinvestment(),
    });
    params.modules = {
      ...params.modules,
      governanceFactory: secondBeneficiary,
    };

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Rehype requires buybackDestination or withFeeDistributionController',
    );
  });

  it('requires a controller when no fee beneficiaries are configured', () => {
    const params = multicurveParams({
      hookAddress,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Rehype requires buybackDestination or withFeeDistributionController',
    );
  });

  it('does not infer a controller from governance', () => {
    const params = multicurveParams({
      hookAddress,
      feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });
    params.modules = {
      ...params.modules,
      governanceFactory: secondBeneficiary,
    };

    expect(() => factory.encodeCreateMulticurveParams(params)).toThrow(
      'Rehype requires buybackDestination or withFeeDistributionController',
    );
  });

  it('preserves an explicit controller that is not a beneficiary', () => {
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });

    const decoded = encodeAndDecode(factory, params);

    expect(decoded.buybackDst).toBe(buybackDestination);
    expect(decoded.feeBeneficiaries).toEqual([
      { beneficiary: firstBeneficiary, shares: WAD },
    ]);
  });

  it('allows a governance factory override with an explicit destination', () => {
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });
    params.modules = {
      ...params.modules,
      governanceFactory: secondBeneficiary,
    };

    const decoded = encodeAndDecode(factory, params);

    expect(decoded.buybackDst).toBe(buybackDestination);
  });

  it('encodes a disabled integrator config for old configurations', () => {
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });
    params.integrator = integrator;

    const decoded = encodeAndDecode(factory, params);

    expect(decoded.integratorConfig).toEqual({
      integrator: '0x0000000000000000000000000000000000000000',
      feeShare: 0,
      assetFeesToNumeraireRatio: 0,
      numeraireFeesToAssetRatio: 0,
      automaticPayout: false,
    });
  });

  it('inherits the direct factory integrator and supports an explicit override', () => {
    const inheritedParams = multicurveParams({
      hookAddress,
      buybackDestination,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
      integratorFeeConfig: {
        feeShare: 200_000,
        assetFeesToNumeraireRatio: 125_000_000,
        numeraireFeesToAssetRatio: 375_000_000,
      },
    });
    inheritedParams.integrator = integrator;
    const overriddenParams = multicurveParams({
      hookAddress,
      buybackDestination,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
      integratorFeeConfig: {
        integrator: explicitIntegrator,
        feeShare: 300_000,
        assetFeesToNumeraireRatio: 625_000_000,
        numeraireFeesToAssetRatio: 875_000_000,
        automaticPayout: true,
      },
    });
    overriddenParams.integrator = integrator;

    expect(encodeAndDecode(factory, inheritedParams).integratorConfig).toEqual({
      integrator,
      feeShare: 200_000,
      assetFeesToNumeraireRatio: 125_000_000,
      numeraireFeesToAssetRatio: 375_000_000,
      automaticPayout: false,
    });
    expect(encodeAndDecode(factory, overriddenParams).integratorConfig).toEqual(
      {
        integrator: explicitIntegrator,
        feeShare: 300_000,
        assetFeesToNumeraireRatio: 625_000_000,
        numeraireFeesToAssetRatio: 875_000_000,
        automaticPayout: true,
      },
    );
  });

  it('keeps the version five encoding readable by the legacy tuple', () => {
    const params = multicurveParams({
      hookAddress,
      buybackDestination,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    });
    const rehypeData = encodeRehypeData(factory, params);

    const [legacyDecoded] = decodeAbiParameters(
      legacyRehypeDopplerHookInitializerDataAbi,
      rehypeData,
    );
    expect(legacyDecoded.buybackDst).toBe(buybackDestination);
    expect(legacyDecoded.feeBeneficiaries).toEqual([]);
  });
});

function multicurveParams(
  config: RehypeDopplerHookInitializerConfig,
): CreateMulticurveParams {
  return {
    token: {
      name: 'Rehype Beneficiaries',
      symbol: 'RHB',
      tokenURI: 'ipfs://rehype-beneficiaries',
    },
    sale: {
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: getAddress('0x4200000000000000000000000000000000000006'),
    },
    pool: {
      fee: 500,
      tickSpacing: 10,
      curves: [
        {
          tickLower: 0,
          tickUpper: 220_000,
          numPositions: 12,
          shares: WAD,
        },
      ],
    },
    initializer: { type: 'rehype', config },
    governance: { type: 'noOp' },
    migration: { type: 'uniswapV2' },
    userAddress: getAddress('0x1234567890123456789012345678901234567890'),
    modules: {
      dopplerHookInitializer: getAddress(
        '0x7777777777777777777777777777777777777777',
      ),
    },
  };
}

function encodeRehypeData(
  factory: DopplerFactory,
  params: CreateMulticurveParams,
) {
  const createParams = factory.encodeCreateMulticurveParams(params);
  const [poolInitData] = decodeAbiParameters(
    dopplerHookInitializerDataAbi,
    createParams.poolInitializerData,
  );
  return poolInitData.onInitializationDopplerHookCalldata;
}

function encodeAndDecode(
  factory: DopplerFactory,
  params: CreateMulticurveParams,
) {
  const [rehypeInitData] = decodeAbiParameters(
    rehypeDopplerHookInitializerDataAbi,
    encodeRehypeData(factory, params),
  );
  return rehypeInitData;
}

function feeDistributionInfo() {
  return {
    assetFeesToAssetBuybackWad: 0n,
    assetFeesToNumeraireBuybackWad: 0n,
    assetFeesToBeneficiaryWad: WAD,
    assetFeesToLpWad: 0n,
    numeraireFeesToAssetBuybackWad: 0n,
    numeraireFeesToNumeraireBuybackWad: 0n,
    numeraireFeesToBeneficiaryWad: WAD,
    numeraireFeesToLpWad: 0n,
  };
}

function fullLpReinvestment() {
  return {
    assetFeesToAssetBuybackWad: 0n,
    assetFeesToNumeraireBuybackWad: 0n,
    assetFeesToBeneficiaryWad: 0n,
    assetFeesToLpWad: WAD,
    numeraireFeesToAssetBuybackWad: 0n,
    numeraireFeesToNumeraireBuybackWad: 0n,
    numeraireFeesToBeneficiaryWad: 0n,
    numeraireFeesToLpWad: WAD,
  };
}

const beneficiaryComponents = [
  { name: 'beneficiary', type: 'address' },
  { name: 'shares', type: 'uint96' },
] as const;

const feeDistributionComponents = [
  { name: 'assetFeesToAssetBuybackWad', type: 'uint64' },
  { name: 'assetFeesToNumeraireBuybackWad', type: 'uint64' },
  { name: 'assetFeesToBeneficiaryWad', type: 'uint64' },
  { name: 'assetFeesToLpWad', type: 'uint64' },
  { name: 'numeraireFeesToAssetBuybackWad', type: 'uint64' },
  { name: 'numeraireFeesToNumeraireBuybackWad', type: 'uint64' },
  { name: 'numeraireFeesToBeneficiaryWad', type: 'uint64' },
  { name: 'numeraireFeesToLpWad', type: 'uint64' },
] as const;

const legacyFeeDistributionComponents = feeDistributionComponents.map(
  (component) => ({ ...component, type: 'uint256' as const }),
);

const integratorConfigComponents = [
  { name: 'integrator', type: 'address' },
  { name: 'feeShare', type: 'uint24' },
  { name: 'assetFeesToNumeraireRatio', type: 'uint32' },
  { name: 'numeraireFeesToAssetRatio', type: 'uint32' },
  { name: 'automaticPayout', type: 'bool' },
] as const;

const dopplerHookInitializerDataAbi = [
  {
    type: 'tuple',
    components: [
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'farTick', type: 'int24' },
      {
        name: 'curves',
        type: 'tuple[]',
        components: [
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'numPositions', type: 'uint16' },
          { name: 'shares', type: 'uint256' },
        ],
      },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        components: beneficiaryComponents,
      },
      { name: 'dopplerHook', type: 'address' },
      { name: 'onInitializationDopplerHookCalldata', type: 'bytes' },
      { name: 'graduationDopplerHookCalldata', type: 'bytes' },
    ],
  },
] as const;

const rehypeDopplerHookInitializerDataAbi = [
  {
    type: 'tuple',
    components: [
      { name: 'numeraire', type: 'address' },
      { name: 'buybackDst', type: 'address' },
      { name: 'startFee', type: 'uint24' },
      { name: 'endFee', type: 'uint24' },
      { name: 'durationSeconds', type: 'uint32' },
      { name: 'startingTime', type: 'uint32' },
      { name: 'feeRoutingMode', type: 'uint8' },
      {
        name: 'feeDistributionInfo',
        type: 'tuple',
        components: feeDistributionComponents,
      },
      {
        name: 'feeBeneficiaries',
        type: 'tuple[]',
        components: beneficiaryComponents,
      },
      {
        name: 'integratorConfig',
        type: 'tuple',
        components: integratorConfigComponents,
      },
    ],
  },
] as const;

const legacyRehypeDopplerHookInitializerDataAbi = [
  {
    type: 'tuple',
    components: [
      { name: 'numeraire', type: 'address' },
      { name: 'buybackDst', type: 'address' },
      { name: 'startFee', type: 'uint24' },
      { name: 'endFee', type: 'uint24' },
      { name: 'durationSeconds', type: 'uint32' },
      { name: 'startingTime', type: 'uint32' },
      { name: 'feeRoutingMode', type: 'uint8' },
      {
        name: 'feeDistributionInfo',
        type: 'tuple',
        components: legacyFeeDistributionComponents,
      },
      {
        name: 'feeBeneficiaries',
        type: 'tuple[]',
        components: beneficiaryComponents,
      },
    ],
  },
] as const;
