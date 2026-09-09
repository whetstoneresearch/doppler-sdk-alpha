import { encodeAbiParameters, type Address, type Hex } from 'viem';
import { ZERO_ADDRESS } from '../constants';
import type { NormalizedRehypeDopplerHookInitializerConfig } from './rehypeDopplerHookInitializer';

const DISABLED_REHYPE_INTEGRATOR_CONFIG = {
  integrator: ZERO_ADDRESS,
  feeShare: 0,
  assetFeesToNumeraireRatio: 0,
  numeraireFeesToAssetRatio: 0,
  automaticPayout: false,
} as const;

export function encodeRehypeDopplerHookInitializerData(
  numeraire: Address,
  config: NormalizedRehypeDopplerHookInitializerConfig,
): Hex {
  return encodeAbiParameters(rehypeInitializerDataAbi, [
    {
      numeraire,
      buybackDst: config.buybackDestination ?? ZERO_ADDRESS,
      startFee: config.startFee,
      endFee: config.endFee,
      durationSeconds: config.durationSeconds,
      startingTime: config.startingTime,
      feeRoutingMode: config.feeRoutingMode,
      feeDistributionInfo: config.feeDistributionInfo,
      feeBeneficiaries: config.feeBeneficiaries ?? [],
      integratorConfig:
        config.integratorFeeConfig ?? DISABLED_REHYPE_INTEGRATOR_CONFIG,
    },
  ]);
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

const integratorConfigComponents = [
  { name: 'integrator', type: 'address' },
  { name: 'feeShare', type: 'uint24' },
  { name: 'assetFeesToNumeraireRatio', type: 'uint32' },
  { name: 'numeraireFeesToAssetRatio', type: 'uint32' },
  { name: 'automaticPayout', type: 'bool' },
] as const;

const rehypeInitializerDataAbi = [
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
