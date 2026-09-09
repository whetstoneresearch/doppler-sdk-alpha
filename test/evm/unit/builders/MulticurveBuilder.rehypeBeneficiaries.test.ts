import { describe, expect, expectTypeOf, it } from 'vitest';
import { getAddress, parseEther, type Address, zeroAddress } from 'viem';
import { CHAIN_IDS } from '../../../../src/evm/addresses';
import { MulticurveBuilder } from '../../../../src/evm/builders';
import { DECAY_MAX_START_FEE, WAD } from '../../../../src/evm/constants';
import {
  RehypeFeeRoutingMode,
  type BeneficiaryData,
  type RehypeDopplerHookInitializerConfig,
} from '../../../../src/evm/types';
import { normalizeRehypeDopplerHookInitializerConfig } from '../../../../src/evm/utils';

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
const rehypeIntegrator = getAddress(
  '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
);
type CommonConfig = {
  hookAddress: Address;
  startFee: number;
  feeDistributionInfo: ReturnType<typeof feeDistributionInfo>;
};

describe('MulticurveBuilder RehypeDopplerHookInitializer beneficiaries', () => {
  it('allows buyback destination with fee beneficiaries', () => {
    type CombinedConfig = CommonConfig & {
      buybackDestination: Address;
      feeBeneficiaries: [BeneficiaryData];
    };

    expectTypeOf<CombinedConfig>().toMatchTypeOf<RehypeDopplerHookInitializerConfig>();
  });

  it('makes DirectBuyback routing incompatible with fee beneficiaries', () => {
    type DirectBuybackBeneficiariesConfig = CommonConfig & {
      feeBeneficiaries: [BeneficiaryData];
      feeRoutingMode: RehypeFeeRoutingMode.DirectBuyback;
    };

    expectTypeOf<DirectBuybackBeneficiariesConfig>().not.toMatchTypeOf<RehypeDopplerHookInitializerConfig>();
  });

  it('requires the fee beneficiary array to be nonempty in the public type', () => {
    type EmptyBeneficiariesConfig = CommonConfig & {
      feeBeneficiaries: [];
    };

    // Given / When / Then
    expectTypeOf<EmptyBeneficiariesConfig>().not.toMatchTypeOf<RehypeDopplerHookInitializerConfig>();
  });

  it('rejects an explicitly empty fee beneficiary array at runtime', () => {
    // Given
    const config = {
      hookAddress,
      feeBeneficiaries: [],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    };

    // When / Then
    expect(() =>
      Reflect.apply(normalizeRehypeDopplerHookInitializerConfig, undefined, [
        config,
        buybackDestination,
      ]),
    ).toThrow('Rehype fee beneficiary list must not be empty');
  });

  it('validates beneficiaries when buyback destination is also configured', () => {
    const config = {
      hookAddress,
      buybackDestination,
      feeBeneficiaries: [],
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
    };

    expect(() =>
      Reflect.apply(normalizeRehypeDopplerHookInitializerConfig, undefined, [
        config,
      ]),
    ).toThrow('Rehype fee beneficiary list must not be empty');
  });

  it('sorts beneficiaries and infers beneficiary fee routing', () => {
    // Given
    const builder = buildBaseBuilder();

    // When
    const params = builder
      .withRehypeDopplerHookInitializer({
        hookAddress,
        feeBeneficiaries: [
          { beneficiary: secondBeneficiary, shares: WAD / 4n },
          { beneficiary: firstBeneficiary, shares: (WAD * 3n) / 4n },
        ],
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      })
      .withFeeDistributionController(buybackDestination)
      .build();

    // Then
    expect(params.initializer?.type).toBe('rehype');
    if (params.initializer?.type !== 'rehype') {
      throw new Error('Expected RehypeDopplerHookInitializer config');
    }
    expect(params.initializer.config.feeRoutingMode).toBe(
      RehypeFeeRoutingMode.RouteToBeneficiaryFees,
    );
    expect(
      params.initializer.config.feeBeneficiaries?.map(
        ({ beneficiary }) => beneficiary,
      ),
    ).toEqual([firstBeneficiary, secondBeneficiary]);
    expect(params.initializer.config.buybackDestination).toBe(
      buybackDestination,
    );
  });

  it('rejects beneficiary shares that do not sum to WAD', () => {
    // Given
    const builder = buildBaseBuilder();

    // When / Then
    expect(() =>
      builder.withRehypeDopplerHookInitializer({
        hookAddress,
        buybackDestination,
        feeBeneficiaries: [
          { beneficiary: firstBeneficiary, shares: WAD / 4n },
          { beneficiary: secondBeneficiary, shares: WAD / 4n },
        ],
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      }),
    ).toThrow('Rehype fee beneficiary shares must sum');
  });

  it('rejects fees above the Rehype contract maximum', () => {
    // Given
    const builder = buildBaseBuilder();

    // When / Then
    expect(() =>
      builder.withRehypeDopplerHookInitializer({
        hookAddress,
        buybackDestination,
        startFee: DECAY_MAX_START_FEE + 1,
        feeDistributionInfo: feeDistributionInfo(),
      }),
    ).toThrow(
      `Rehype startFee must be an integer between 0 and ${DECAY_MAX_START_FEE}`,
    );
  });

  it('rejects the zero Rehype initializer address', () => {
    // Given
    const builder = buildBaseBuilder();

    // When / Then
    expect(() =>
      builder.withRehypeDopplerHookInitializer({
        hookAddress: zeroAddress,
        buybackDestination,
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      }),
    ).toThrow('Rehype hookAddress must be a non-zero address');
  });

  it('rejects the zero buyback destination', () => {
    // Given
    const builder = buildBaseBuilder();

    // When / Then
    expect(() =>
      builder.withRehypeDopplerHookInitializer({
        hookAddress,
        buybackDestination: zeroAddress,
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      }),
    ).toThrow('Rehype buybackDestination must be a non-zero address');
  });

  it('keeps buyback routing without adding fee beneficiaries', () => {
    // Given / When
    const params = buildBaseBuilder()
      .withRehypeDopplerHookInitializer({
        hookAddress,
        buybackDestination,
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      })
      .build();

    // Then
    expect(params.initializer?.type).toBe('rehype');
    if (params.initializer?.type !== 'rehype') {
      throw new Error('Expected RehypeDopplerHookInitializer config');
    }
    expect(params.initializer.config.feeBeneficiaries).toBeUndefined();
    expect(params.initializer.config.buybackDestination).toBe(
      buybackDestination,
    );
  });

  it('requires an explicit controller for standard governance', () => {
    expect(() =>
      buildBaseBuilder()
        .withRehypeDopplerHookInitializer({
          hookAddress,
          feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
          startFee: 3_000,
          feeDistributionInfo: feeDistributionInfo(),
        })
        .build(),
    ).toThrow(
      'Rehype requires buybackDestination or withFeeDistributionController',
    );
  });

  it('does not infer the controller from launchpad governance', () => {
    expect(() =>
      buildBaseBuilder()
        .withGovernance({ type: 'launchpad', multisig: buybackDestination })
        .withRehypeDopplerHookInitializer({
          hookAddress,
          feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
          startFee: 3_000,
          feeDistributionInfo: feeDistributionInfo(),
        })
        .build(),
    ).toThrow(
      'Rehype requires buybackDestination or withFeeDistributionController',
    );
  });

  it('requires an explicit controller with a governance factory override', () => {
    expect(() =>
      buildBaseBuilder()
        .withGovernance({ type: 'noOp' })
        .withGovernanceFactory(firstBeneficiary)
        .withRehypeDopplerHookInitializer({
          hookAddress,
          feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
          startFee: 3_000,
          feeDistributionInfo: feeDistributionInfo(),
        })
        .build(),
    ).toThrow(
      'Rehype requires buybackDestination or withFeeDistributionController',
    );
  });

  it('allows a governance factory override with an explicit controller', () => {
    const params = buildBaseBuilder()
      .withGovernance({ type: 'noOp' })
      .withGovernanceFactory(firstBeneficiary)
      .withRehypeDopplerHookInitializer({
        hookAddress,
        feeBeneficiaries: [{ beneficiary: firstBeneficiary, shares: WAD }],
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      })
      .withFeeDistributionController(buybackDestination)
      .build();

    expect(params.initializer?.type).toBe('rehype');
    if (params.initializer?.type !== 'rehype') {
      throw new Error('Expected RehypeDopplerHookInitializer config');
    }
    expect(params.initializer.config.buybackDestination).toBe(
      buybackDestination,
    );
  });

  it('requires an explicit controller for complete LP reinvestment', () => {
    expect(() =>
      buildBaseBuilder()
        .withRehypeDopplerHookInitializer({
          hookAddress,
          startFee: 3_000,
          feeDistributionInfo: fullLpReinvestment(),
        })
        .build(),
    ).toThrow(
      'Rehype requires buybackDestination or withFeeDistributionController',
    );
  });

  it('uses an explicit controller for complete LP reinvestment', () => {
    const params = buildBaseBuilder()
      .withRehypeDopplerHookInitializer({
        hookAddress,
        startFee: 3_000,
        feeDistributionInfo: fullLpReinvestment(),
      })
      .withFeeDistributionController(buybackDestination)
      .build();

    expect(params.initializer?.type).toBe('rehype');
    if (params.initializer?.type !== 'rehype') {
      throw new Error('Expected RehypeDopplerHookInitializer config');
    }
    expect(params.initializer.config.buybackDestination).toBe(
      buybackDestination,
    );
  });

  it('rejects a fee distribution controller without a Rehype initializer', () => {
    expect(() =>
      buildBaseBuilder()
        .withFeeDistributionController(buybackDestination)
        .build(),
    ).toThrow(
      'withFeeDistributionController requires a Rehype initializer configuration',
    );
  });

  it('rejects both explicit controller inputs in either call order', () => {
    expect(() =>
      buildBaseBuilder()
        .withFeeDistributionController(buybackDestination)
        .withRehypeDopplerHookInitializer({
          hookAddress,
          buybackDestination: firstBeneficiary,
          startFee: 3_000,
          feeDistributionInfo: feeDistributionInfo(),
        }),
    ).toThrow(
      'Rehype buybackDestination and withFeeDistributionController are mutually exclusive',
    );

    expect(() =>
      buildBaseBuilder()
        .withRehypeDopplerHookInitializer({
          hookAddress,
          buybackDestination,
          startFee: 3_000,
          feeDistributionInfo: feeDistributionInfo(),
        })
        .withFeeDistributionController(firstBeneficiary),
    ).toThrow(
      'Rehype buybackDestination and withFeeDistributionController are mutually exclusive',
    );
  });

  it('does not enable Rehype integrator fees for old configurations', () => {
    const params = buildBaseBuilder()
      .withIntegrator(integrator)
      .withRehypeDopplerHookInitializer({
        hookAddress,
        buybackDestination,
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
      })
      .build();

    if (params.initializer?.type !== 'rehype') {
      throw new Error('Expected RehypeDopplerHookInitializer config');
    }
    expect(params.integrator).toBe(integrator);
    expect(params.initializer.config.integratorFeeConfig).toBeUndefined();
  });

  it('inherits the Rehype integrator in either builder call order', () => {
    const config: RehypeDopplerHookInitializerConfig = {
      hookAddress,
      buybackDestination,
      startFee: 3_000,
      feeDistributionInfo: feeDistributionInfo(),
      integratorFeeConfig: { feeShare: 200_000 },
    };

    const integratorFirst = buildBaseBuilder()
      .withIntegrator(integrator)
      .withRehypeDopplerHookInitializer(config)
      .build();
    const rehypeFirst = buildBaseBuilder()
      .withRehypeDopplerHookInitializer(config)
      .withIntegrator(integrator)
      .build();

    if (
      integratorFirst.initializer?.type !== 'rehype' ||
      rehypeFirst.initializer?.type !== 'rehype'
    ) {
      throw new Error('Expected RehypeDopplerHookInitializer config');
    }
    expect(integratorFirst.initializer.config.integratorFeeConfig).toEqual({
      integrator,
      feeShare: 200_000,
      assetFeesToNumeraireRatio: 0,
      numeraireFeesToAssetRatio: 0,
      automaticPayout: false,
    });
    expect(rehypeFirst.initializer.config.integratorFeeConfig).toEqual(
      integratorFirst.initializer.config.integratorFeeConfig,
    );
  });

  it('prefers an explicit Rehype integrator over withIntegrator', () => {
    const params = buildBaseBuilder()
      .withIntegrator(integrator)
      .withRehypeDopplerHookInitializer({
        hookAddress,
        buybackDestination,
        startFee: 3_000,
        feeDistributionInfo: feeDistributionInfo(),
        integratorFeeConfig: {
          integrator: rehypeIntegrator,
          feeShare: 750_000,
          assetFeesToNumeraireRatio: 1_000_000_000,
          numeraireFeesToAssetRatio: 1_000_000_000,
          automaticPayout: true,
        },
      })
      .build();

    if (params.initializer?.type !== 'rehype') {
      throw new Error('Expected RehypeDopplerHookInitializer config');
    }
    expect(params.integrator).toBe(integrator);
    expect(params.initializer.config.integratorFeeConfig?.integrator).toBe(
      rehypeIntegrator,
    );
  });

  it.each([
    [{ feeShare: 0 }, 'feeShare'],
    [{ feeShare: 750_001 }, 'feeShare'],
    [
      { feeShare: 1, assetFeesToNumeraireRatio: 1_000_000_001 },
      'assetFeesToNumeraireRatio',
    ],
    [
      { feeShare: 1, numeraireFeesToAssetRatio: -1 },
      'numeraireFeesToAssetRatio',
    ],
  ])(
    'rejects invalid Rehype integrator config %#',
    (integratorFeeConfig, error) => {
      expect(() =>
        buildBaseBuilder()
          .withIntegrator(integrator)
          .withRehypeDopplerHookInitializer({
            hookAddress,
            buybackDestination,
            startFee: 3_000,
            feeDistributionInfo: feeDistributionInfo(),
            integratorFeeConfig,
          })
          .build(),
      ).toThrow(error);
    },
  );

  it('requires an address source for enabled Rehype integrator fees', () => {
    expect(() =>
      buildBaseBuilder()
        .withRehypeDopplerHookInitializer({
          hookAddress,
          buybackDestination,
          startFee: 3_000,
          feeDistributionInfo: feeDistributionInfo(),
          integratorFeeConfig: { feeShare: 1 },
        })
        .build(),
    ).toThrow(
      'Rehype integratorFeeConfig requires integrator or withIntegrator',
    );
  });
});

function buildBaseBuilder() {
  return MulticurveBuilder.forChain(CHAIN_IDS.BASE_SEPOLIA)
    .tokenConfig({
      type: 'standard',
      name: 'Rehype Beneficiaries',
      symbol: 'RHB',
      tokenURI: 'ipfs://rehype-beneficiaries',
    })
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('900000'),
      numeraire: getAddress('0x4200000000000000000000000000000000000006'),
    })
    .poolConfig({
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
    })
    .withGovernance({ type: 'default' })
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
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
