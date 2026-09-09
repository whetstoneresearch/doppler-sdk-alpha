import { describe, it, expect } from 'vitest';
import type { Address } from 'viem';
import {
  StaticAuctionBuilder,
  DynamicAuctionBuilder,
  MulticurveBuilder,
  OpeningAuctionBuilder,
  type BaseAuctionBuilder,
} from '../../../../src/evm/builders';
import { CHAIN_IDS } from '../../../../src/evm/addresses';
import { WAD, ZERO_ADDRESS } from '../../../../src/evm/constants';

const USER = '0x00000000000000000000000000000000000000AA' as Address;
const TOKEN_FACTORY = '0x1111111111111111111111111111111111111111' as Address;

describe('BaseAuctionBuilder interface', () => {
  it('StaticAuctionBuilder implements BaseAuctionBuilder', () => {
    const builder: BaseAuctionBuilder<typeof CHAIN_IDS.BASE> =
      StaticAuctionBuilder.forChain(CHAIN_IDS.BASE);

    expect(builder.chainId).toBe(CHAIN_IDS.BASE);
    expect(typeof builder.tokenConfig).toBe('function');
    expect(typeof builder.saleConfig).toBe('function');
    expect(typeof builder.withVesting).toBe('function');
    expect(typeof builder.withGovernance).toBe('function');
    expect(typeof builder.withMigration).toBe('function');
    expect(typeof builder.withV2MigratorSplit).toBe('function');
    expect(typeof builder.withV4MigratorSplit).toBe('function');
    expect(typeof builder.withUserAddress).toBe('function');
    expect(typeof builder.withIntegrator).toBe('function');
    expect(typeof builder.withGasLimit).toBe('function');
    expect(typeof builder.withTokenFactory).toBe('function');
  });

  it('DynamicAuctionBuilder implements BaseAuctionBuilder', () => {
    const builder: BaseAuctionBuilder<typeof CHAIN_IDS.BASE> =
      DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE);

    expect(builder.chainId).toBe(CHAIN_IDS.BASE);
    expect(typeof builder.tokenConfig).toBe('function');
    expect(typeof builder.saleConfig).toBe('function');
    expect(typeof builder.withVesting).toBe('function');
    expect(typeof builder.withGovernance).toBe('function');
    expect(typeof builder.withMigration).toBe('function');
    expect(typeof builder.withV2MigratorSplit).toBe('function');
    expect(typeof builder.withV4MigratorSplit).toBe('function');
    expect(typeof (builder as DynamicAuctionBuilder<typeof CHAIN_IDS.BASE>).withDopplerHookMigrator).toBe('function');
    expect(typeof builder.withUserAddress).toBe('function');
    expect(typeof builder.withIntegrator).toBe('function');
    expect(typeof builder.withGasLimit).toBe('function');
    expect(typeof builder.withTokenFactory).toBe('function');
  });

  it('MulticurveBuilder implements BaseAuctionBuilder', () => {
    const builder: BaseAuctionBuilder<typeof CHAIN_IDS.BASE> =
      MulticurveBuilder.forChain(CHAIN_IDS.BASE);

    expect(builder.chainId).toBe(CHAIN_IDS.BASE);
    expect(typeof builder.tokenConfig).toBe('function');
    expect(typeof builder.saleConfig).toBe('function');
    expect(typeof builder.withVesting).toBe('function');
    expect(typeof builder.withGovernance).toBe('function');
    expect(typeof builder.withMigration).toBe('function');
    expect(typeof builder.withV2MigratorSplit).toBe('function');
    expect(typeof builder.withV4MigratorSplit).toBe('function');
    expect(typeof builder.withUserAddress).toBe('function');
    expect(typeof builder.withIntegrator).toBe('function');
    expect(typeof builder.withGasLimit).toBe('function');
    expect(typeof builder.withTokenFactory).toBe('function');
    expect(
      typeof (builder as MulticurveBuilder<typeof CHAIN_IDS.BASE>).withDevBuy,
    ).toBe('function');
    expect('withDevBuy' in StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)).toBe(
      false,
    );
    expect('withDevBuy' in DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)).toBe(
      false,
    );
    expect('withDevBuy' in OpeningAuctionBuilder.forChain(CHAIN_IDS.BASE)).toBe(
      false,
    );
  });

  describe('token factory module overrides', () => {
    it('sets token factory overrides on static builders', () => {
      const params = StaticAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Token', symbol: 'TKN', tokenURI: 'ipfs://token' })
        .saleConfig({
          initialSupply: 1_000n * WAD,
          numTokensToSell: 500n * WAD,
          numeraire: ZERO_ADDRESS,
        })
        .poolByTicks({ startTick: 174960, endTick: 225000, fee: 3000 })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withTokenFactory(TOKEN_FACTORY)
        .withUserAddress(USER)
        .build();

      expect(params.modules?.tokenFactory).toBe(TOKEN_FACTORY);
    });

    it('sets token factory overrides on dynamic builders', () => {
      const params = DynamicAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Token', symbol: 'TKN', tokenURI: 'ipfs://token' })
        .saleConfig({
          initialSupply: 1_000n * WAD,
          numTokensToSell: 500n * WAD,
          numeraire: ZERO_ADDRESS,
        })
        .poolConfig({ fee: 3000, tickSpacing: 30 })
        .auctionByTicks({
          startTick: -120000,
          endTick: -90000,
          minProceeds: 1n,
          maxProceeds: 10n,
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withTokenFactory(TOKEN_FACTORY)
        .withUserAddress(USER)
        .build();

      expect(params.modules?.tokenFactory).toBe(TOKEN_FACTORY);
    });

    it('sets token factory overrides on multicurve builders', () => {
      const params = MulticurveBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Token', symbol: 'TKN', tokenURI: 'ipfs://token' })
        .saleConfig({
          initialSupply: 1_000n * WAD,
          numTokensToSell: 500n * WAD,
          numeraire: ZERO_ADDRESS,
        })
        .poolConfig({
          fee: 3000,
          tickSpacing: 60,
          curves: [
            {
              tickLower: 1000,
              tickUpper: 2000,
              numPositions: 2,
              shares: WAD,
            },
          ],
        })
        .withGovernance({ type: 'default' })
        .withMigration({ type: 'uniswapV2' })
        .withTokenFactory(TOKEN_FACTORY)
        .withUserAddress(USER)
        .build();

      expect(params.modules?.tokenFactory).toBe(TOKEN_FACTORY);
    });

    it('sets token factory overrides on opening auction builders', () => {
      const params = OpeningAuctionBuilder.forChain(CHAIN_IDS.BASE)
        .tokenConfig({ name: 'Token', symbol: 'TKN', tokenURI: 'ipfs://token' })
        .saleConfig({
          initialSupply: 1_000n * WAD,
          numTokensToSell: 500n * WAD,
          numeraire: ZERO_ADDRESS,
        })
        .openingAuctionConfig({
          auctionDuration: 86_400,
          minAcceptableTickToken0: -34_020,
          minAcceptableTickToken1: -34_020,
          incentiveShareBps: 1_000,
          tickSpacing: 60,
          fee: 3_000,
          minLiquidity: 1n,
          shareToAuctionBps: 10_000,
        })
        .dopplerConfig({
          minProceeds: 0n,
          maxProceeds: 10n,
          startTick: -120_000,
          endTick: -90_000,
        })
        .withMigration({ type: 'uniswapV2' })
        .withTokenFactory(TOKEN_FACTORY)
        .withUserAddress(USER)
        .build();

      expect(params.modules?.tokenFactory).toBe(TOKEN_FACTORY);
    });
  });
});
