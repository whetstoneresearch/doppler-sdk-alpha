import { describe, it, expect } from 'vitest';
import type { Address } from 'viem';
import { OpeningAuctionBuilder } from '../../../../src/evm/builders';
import { CHAIN_IDS, type SupportedChainId } from '../../../../src/evm/addresses';
import {
  DEFAULT_AUCTION_DURATION,
  DEFAULT_EPOCH_LENGTH,
  DEFAULT_PD_SLUGS,
  DOPPLER_MAX_TICK_SPACING,
  FEE_TIERS,
  ZERO_ADDRESS,
} from '../../../../src/evm/constants';

const USER: Address = '0x00000000000000000000000000000000000000AA';

const BASE_TOKEN = {
  type: 'standard' as const,
  name: 'Opening Token',
  symbol: 'OPEN',
  tokenURI: 'ipfs://opening-token',
};

const BASE_SALE = {
  initialSupply: 1_000_000n,
  numTokensToSell: 500_000n,
  numeraire: ZERO_ADDRESS,
};

const BASE_OPENING_AUCTION = {
  auctionDuration: 86_400,
  minAcceptableTickToken0: -34_020,
  minAcceptableTickToken1: -34_020,
  incentiveShareBps: 1_000,
  tickSpacing: 60,
  fee: 3_000,
  minLiquidity: 1n,
  shareToAuctionBps: 10_000,
};

const BASE_DOPPLER = {
  minProceeds: 0n,
  maxProceeds: 10n,
  startTick: -120_000,
  endTick: -90_000,
};

type MissingField =
  | 'token'
  | 'sale'
  | 'openingAuction'
  | 'doppler'
  | 'migration'
  | 'userAddress';

function builderWithMissing(field: MissingField) {
  const builder = OpeningAuctionBuilder.forChain(CHAIN_IDS.BASE);

  if (field !== 'token') {
    builder.tokenConfig(BASE_TOKEN);
  }
  if (field !== 'sale') {
    builder.saleConfig(BASE_SALE);
  }
  if (field !== 'openingAuction') {
    builder.openingAuctionConfig(BASE_OPENING_AUCTION);
  }
  if (field !== 'doppler') {
    builder.dopplerConfig(BASE_DOPPLER);
  }
  if (field !== 'migration') {
    builder.withMigration({ type: 'uniswapV2' });
  }
  if (field !== 'userAddress') {
    builder.withUserAddress(USER);
  }

  return builder;
}

function buildValidOpeningAuction(chainId: SupportedChainId = CHAIN_IDS.BASE) {
  return OpeningAuctionBuilder.forChain(chainId)
    .tokenConfig(BASE_TOKEN)
    .saleConfig(BASE_SALE)
    .openingAuctionConfig(BASE_OPENING_AUCTION)
    .dopplerConfig(BASE_DOPPLER)
    .withMigration({ type: 'uniswapV2' })
    .withUserAddress(USER);
}

describe('OpeningAuctionBuilder', () => {
  describe('required fields', () => {
    it.each<readonly [MissingField, string]>([
      ['token', 'tokenConfig is required'],
      ['sale', 'saleConfig is required'],
      ['openingAuction', 'openingAuctionConfig is required'],
      ['doppler', 'dopplerConfig is required'],
      ['migration', 'migration configuration is required'],
      ['userAddress', 'userAddress is required'],
    ])('throws when %s is missing', (missingField, expectedError) => {
      expect(() => builderWithMissing(missingField).build()).toThrow(
        expectedError,
      );
    });
  });

  describe('default resolution', () => {
    it('resolves doppler defaults when optional values are omitted', () => {
      const params = buildValidOpeningAuction().build();

      expect(params.doppler.duration).toBe(DEFAULT_AUCTION_DURATION);
      expect(params.doppler.epochLength).toBe(DEFAULT_EPOCH_LENGTH);
      expect(params.doppler.fee).toBe(FEE_TIERS.HIGH);
      expect(params.doppler.tickSpacing).toBe(DOPPLER_MAX_TICK_SPACING);
      expect(params.doppler.numPdSlugs).toBe(DEFAULT_PD_SLUGS);
      expect(params.doppler.gamma).toBe(2_160);
    });
  });

  describe('withTime', () => {
    it('throws if startTimeOffset and startingTime are both provided', () => {
      const builder = buildValidOpeningAuction();

      expect(() =>
        builder.withTime({
          startTimeOffset: 300,
          startingTime: 1_700_000_000,
        }),
      ).toThrow(
        'withTime() accepts either startTimeOffset or startingTime, not both',
      );
    });
  });

  describe('tick spacing validation', () => {
    it('throws if openingAuction.tickSpacing is not divisible by doppler.tickSpacing', () => {
      const builder = buildValidOpeningAuction()
        .openingAuctionConfig({
          ...BASE_OPENING_AUCTION,
          tickSpacing: 31,
        })
        .dopplerConfig({
          ...BASE_DOPPLER,
          tickSpacing: 30,
        });

      expect(() => builder.build()).toThrow(
        'openingAuction.tickSpacing (31) must be divisible by doppler.tickSpacing (30)',
      );
    });
  });

  describe('governance defaults by chain', () => {
    it.each([CHAIN_IDS.BASE, CHAIN_IDS.ARBITRUM, CHAIN_IDS.BSC] as const)(
      'defaults to noOp governance on no-op-enabled chain %s',
      (chainId) => {
        const params = buildValidOpeningAuction(chainId).build();

        expect(params.governance).toEqual({ type: 'noOp' });
      },
    );

    it('defaults to default governance on chains without no-op governance', () => {
      const params = buildValidOpeningAuction(CHAIN_IDS.INK).build();

      expect(params.governance).toEqual({ type: 'default' });
    });

    it.each([
      CHAIN_IDS.MAINNET,
      CHAIN_IDS.ARBITRUM,
      CHAIN_IDS.BSC,
      CHAIN_IDS.BASE,
      CHAIN_IDS.BASE_SEPOLIA,
      CHAIN_IDS.MONAD_MAINNET,
    ] as const)(
      'preserves launchpad governance on launchpad-enabled chain %s',
      (chainId) => {
        const params = buildValidOpeningAuction(chainId)
          .withGovernance({
            type: 'launchpad',
            multisig: USER,
          })
          .build();

        expect(params.governance).toEqual({
          type: 'launchpad',
          multisig: USER,
        });
      },
    );

    it('rejects launchpad governance on unsupported chains', () => {
      const builder = buildValidOpeningAuction(CHAIN_IDS.INK).withGovernance({
        type: 'launchpad',
        multisig: USER,
      });

      expect(() => builder.build()).toThrow(
        `Launchpad governance is not supported on chain ${CHAIN_IDS.INK}. Use a supported chain or a different governance type.`,
      );
    });
  });

  describe('module overrides', () => {
    it('sets opening-auction initializer and position-manager overrides in modules', () => {
      const openingAuctionInitializer =
        '0x1111111111111111111111111111111111111111' as Address;
      const openingAuctionPositionManager =
        '0x2222222222222222222222222222222222222222' as Address;

      const params = buildValidOpeningAuction()
        .withOpeningAuctionInitializer(openingAuctionInitializer)
        .withOpeningAuctionPositionManager(openingAuctionPositionManager)
        .build();

      expect(params.modules).toMatchObject({
        openingAuctionInitializer,
        openingAuctionPositionManager,
      });
    });
  });
});
