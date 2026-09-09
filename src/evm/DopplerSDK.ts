import type { Address, PublicClient, WalletClient } from 'viem';
import type {
  BeneficiaryData,
  DopplerSDKConfig,
  HookInfo,
  PoolInfo,
  SupportedPublicClient,
  V4PoolKey,
} from './types';
import { getAddresses, type SupportedChainId } from './addresses';
import { DopplerFactory } from './entities/DopplerFactory';
import {
  StaticAuction,
  DynamicAuction,
  MulticurvePool,
  RehypeDopplerHookInitializer,
  RehypeDopplerHook,
  OpeningAuction,
  OpeningAuctionLifecycle,
  OpeningAuctionBidManager,
  OpeningAuctionPositionManager,
} from './entities/auction';
import { Quoter } from './entities/quoter';
import {
  Derc20,
  Derc20V2,
  DopplerDN404,
  DopplerERC20V1,
} from './entities/token';
import { Bundler } from './entities/Bundler';
import { DopplerHookMigrator } from './entities/DopplerHookMigrator';
import { StreamableFeesLockerV2 } from './entities/StreamableFeesLockerV2';
import {
  StaticAuctionBuilder,
  DynamicAuctionBuilder,
  MulticurveBuilder,
  OpeningAuctionBuilder,
} from './builders';
import { airlockAbi } from './abis';
import { ZERO_ADDRESS } from './constants';
import {
  DEFAULT_AIRLOCK_BENEFICIARY_SHARES,
  getAirlockBeneficiary,
  getAirlockOwner as fetchAirlockOwner,
} from './utils/airlock';
import {
  normalizeAirlockAssetData,
  type AirlockAssetData,
} from './entities/auction/contractResults';

export class DopplerSDK<C extends SupportedChainId = SupportedChainId> {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  public chainId: C;
  private _factory?: DopplerFactory<C>;
  private _quoter?: Quoter;
  private _bundler?: Bundler;

  constructor(config: DopplerSDKConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.chainId = config.chainId as unknown as C;
  }

  /**
   * Get the factory instance for creating auctions
   */
  get factory(): DopplerFactory<C> {
    if (!this._factory) {
      this._factory = new DopplerFactory(
        this.publicClient,
        this.walletClient,
        this.chainId,
      );
    }
    return this._factory;
  }

  /**
   * Get the quoter instance for price queries
   */
  get quoter(): Quoter {
    if (!this._quoter) {
      this._quoter = new Quoter(this.publicClient, this.chainId);
    }
    return this._quoter;
  }

  /**
   * Gets the Bundler client configured for this chain.
   *
   * Throws when the chain has no Bundler deployment. Use `getBundler(address)`
   * for custom deployments.
   */
  get bundler(): Bundler {
    if (!this._bundler) {
      this._bundler = this.getBundler();
    }
    return this._bundler;
  }

  /**
   * Creates a Bundler client using the chain default or an explicit address.
   *
   * Read methods work without a wallet client; claims require one.
   *
   * @param bundlerAddress Optional custom Bundler deployment.
   */
  getBundler(bundlerAddress?: Address): Bundler {
    const resolvedBundler =
      bundlerAddress ?? getAddresses(this.chainId).bundler;
    if (!resolvedBundler || resolvedBundler === ZERO_ADDRESS) {
      throw new Error(
        'Bundler address is not configured on this chain. Pass bundlerAddress to getBundler().',
      );
    }
    return new Bundler(this.publicClient, this.walletClient, resolvedBundler);
  }

  /**
   * Get a StaticAuction instance for interacting with a static auction pool
   * @param poolAddress The address of the Uniswap V3 pool
   */
  async getStaticAuction(poolAddress: Address): Promise<StaticAuction> {
    return new StaticAuction(this.publicClient, poolAddress);
  }

  /**
   * Get a DynamicAuction instance for interacting with a dynamic auction hook
   * @param hookAddress The address of the Uniswap V4 hook
   */
  async getDynamicAuction(hookAddress: Address): Promise<DynamicAuction> {
    return new DynamicAuction(this.publicClient, hookAddress);
  }

  /**
   * Get a RehypeDopplerHookInitializer instance.
   * @param hookAddress The address of the RehypeDopplerHookInitializer
   */
  async getRehypeDopplerHookInitializer(
    hookAddress: Address,
  ): Promise<RehypeDopplerHookInitializer> {
    return new RehypeDopplerHookInitializer(
      this.publicClient,
      this.walletClient,
      hookAddress,
    );
  }

  /** @deprecated Use getRehypeDopplerHookInitializer instead. */
  async getRehypeDopplerHook(hookAddress: Address): Promise<RehypeDopplerHook> {
    return this.getRehypeDopplerHookInitializer(hookAddress);
  }

  getDopplerHookMigrator(address?: Address): DopplerHookMigrator {
    const resolvedAddress =
      address ?? getAddresses(this.chainId).dopplerHookMigrator;
    if (!resolvedAddress || resolvedAddress === ZERO_ADDRESS) {
      throw new Error(
        'DopplerHookMigrator address is not configured on this chain. Pass an address to getDopplerHookMigrator().',
      );
    }
    return new DopplerHookMigrator(
      this.publicClient,
      this.walletClient,
      resolvedAddress,
    );
  }

  async getDopplerHookMigratorForAsset(
    asset: Address,
  ): Promise<DopplerHookMigrator> {
    const assetData = await this.getAirlockAssetData(asset);
    if (assetData.liquidityMigrator === ZERO_ADDRESS) {
      throw new Error(`Asset ${asset} has no configured liquidity migrator`);
    }
    return this.getDopplerHookMigrator(assetData.liquidityMigrator);
  }

  getStreamableFeesLockerV2(address: Address): StreamableFeesLockerV2 {
    if (address === ZERO_ADDRESS) {
      throw new Error('StreamableFeesLockerV2 address must not be zero');
    }
    return new StreamableFeesLockerV2(
      this.publicClient,
      this.walletClient,
      address,
    );
  }

  async getStreamableFeesLockerForAsset(
    asset: Address,
  ): Promise<StreamableFeesLockerV2> {
    const migrator = await this.getDopplerHookMigratorForAsset(asset);
    return this.getStreamableFeesLockerV2(await migrator.getLockerAddress());
  }

  /**
   * Get an OpeningAuction instance for interacting with an opening auction hook.
   * @param hookAddress The address of the opening auction hook
   */
  async getOpeningAuction(hookAddress: Address): Promise<OpeningAuction> {
    return new OpeningAuction(
      this.publicClient,
      this.walletClient,
      hookAddress,
    );
  }

  /**
   * Get an OpeningAuctionLifecycle instance for interacting with opening-auction completion flows.
   * @param initializerAddress Optional OpeningAuctionInitializer override address
   */
  async getOpeningAuctionLifecycle(
    initializerAddress?: Address,
  ): Promise<OpeningAuctionLifecycle> {
    const chainAddresses = getAddresses(this.chainId);
    const resolvedInitializer =
      initializerAddress ??
      chainAddresses.openingAuctionInitializer ??
      ZERO_ADDRESS;

    if (resolvedInitializer === ZERO_ADDRESS) {
      throw new Error(
        'OpeningAuctionInitializer address is not configured on this chain. ' +
          'Pass initializerAddress to getOpeningAuctionLifecycle(), or override it via builder.withOpeningAuctionInitializer().',
      );
    }

    return new OpeningAuctionLifecycle(
      this.publicClient,
      this.walletClient,
      resolvedInitializer,
    );
  }

  /**
   * Get an OpeningAuctionPositionManager instance for placing/withdrawing opening-auction bids.
   * @param positionManagerAddress Optional OpeningAuctionPositionManager override address
   */
  async getOpeningAuctionPositionManager(
    positionManagerAddress?: Address,
  ): Promise<OpeningAuctionPositionManager> {
    const chainAddresses = getAddresses(this.chainId);
    const resolvedPositionManager =
      positionManagerAddress ??
      chainAddresses.openingAuctionPositionManager ??
      ZERO_ADDRESS;

    if (resolvedPositionManager === ZERO_ADDRESS) {
      throw new Error(
        'OpeningAuctionPositionManager address is not configured on this chain. ' +
          'Pass positionManagerAddress to getOpeningAuctionPositionManager(), or resolve it from the initializer via OpeningAuctionLifecycle.getPositionManager().',
      );
    }

    return new OpeningAuctionPositionManager(
      this.publicClient,
      this.walletClient,
      resolvedPositionManager,
    );
  }

  /**
   * Get a context-bound OpeningAuctionBidManager for placing/withdrawing bids, status reads, and incentive claims.
   * @param args.openingAuctionHookAddress Opening auction hook address
   * @param args.openingAuctionPoolKey Opening auction pool key from OpeningAuctionLifecycle.getState(asset)
   * @param args.positionManagerAddress Optional OpeningAuctionPositionManager override
   */
  async getOpeningAuctionBidManager(args: {
    openingAuctionHookAddress: Address;
    openingAuctionPoolKey: V4PoolKey;
    positionManagerAddress?: Address;
  }): Promise<OpeningAuctionBidManager> {
    const positionManager = await this.getOpeningAuctionPositionManager(
      args.positionManagerAddress,
    );

    return new OpeningAuctionBidManager(this.publicClient, this.walletClient, {
      openingAuctionHookAddress: args.openingAuctionHookAddress,
      openingAuctionPoolKey: args.openingAuctionPoolKey,
      positionManagerAddress: positionManager.getAddress(),
    });
  }

  /**
   * Get a MulticurvePool instance for interacting with a V4 multicurve pool
   * @param tokenAddress The address of the token created by the auction (called "asset" in contracts; V4 pools don't have addresses, so the token is used as the lookup key)
   */
  async getMulticurvePool(tokenAddress: Address): Promise<MulticurvePool> {
    const { poolInitializer } = await this.getAirlockAssetData(tokenAddress);
    return new MulticurvePool(
      this.publicClient,
      this.walletClient,
      tokenAddress,
      poolInitializer,
    );
  }

  /**
   * Get a DERC20 token instance for interacting with a token
   * @param tokenAddress The address of the DERC20 token
   */
  getDerc20(tokenAddress: Address): Derc20 {
    return new Derc20(this.publicClient, this.walletClient, tokenAddress);
  }

  /**
   * Get a DERC20 V2 token instance for interacting with cliffed / multi-schedule vesting tokens
   * @param tokenAddress The address of the DERC20 V2 token
   */
  getDerc20V2(tokenAddress: Address): Derc20V2 {
    return new Derc20V2(this.publicClient, this.walletClient, tokenAddress);
  }

  /**
   * Get a DopplerERC20V1 token instance for schedule vesting and balance-limit controls.
   * @param tokenAddress The address of the DopplerERC20V1 token
   */
  getDopplerERC20V1(tokenAddress: Address): DopplerERC20V1 {
    return new DopplerERC20V1(
      this.publicClient,
      this.walletClient,
      tokenAddress,
    );
  }

  /**
   * Get a Doppler DN404 token instance for hybrid ERC-20/ERC-721 interaction.
   * @param tokenAddress The address of the Doppler DN404 token
   */
  getDopplerDN404(tokenAddress: Address): DopplerDN404 {
    return new DopplerDN404(this.publicClient, this.walletClient, tokenAddress);
  }

  /**
   * Get information about a static auction pool
   * @param poolAddress The address of the pool
   */
  async getPoolInfo(poolAddress: Address): Promise<PoolInfo> {
    const auction = new StaticAuction(this.publicClient, poolAddress);
    return auction.getPoolInfo();
  }

  /**
   * Get information about a dynamic auction hook
   * @param hookAddress The address of the hook
   */
  async getHookInfo(hookAddress: Address): Promise<HookInfo> {
    const auction = new DynamicAuction(this.publicClient, hookAddress);
    return auction.getHookInfo();
  }

  /**
   * Create a new static auction builder
   */
  buildStaticAuction(): StaticAuctionBuilder<C> {
    return new StaticAuctionBuilder(this.chainId);
  }

  /**
   * Create a new dynamic auction builder
   */
  buildDynamicAuction(): DynamicAuctionBuilder<C> {
    return new DynamicAuctionBuilder(this.chainId);
  }

  /**
   * Create a new multicurve (V4 initializer) auction builder
   */
  buildMulticurveAuction(): MulticurveBuilder<C> {
    return new MulticurveBuilder(this.chainId);
  }

  /**
   * Create a new opening auction builder
   */
  buildOpeningAuction(): OpeningAuctionBuilder<C> {
    return new OpeningAuctionBuilder(this.chainId);
  }

  /**
   * Get the current chain ID
   */
  getChainId(): C {
    return this.chainId;
  }

  /**
   * Get the underlying clients
   */
  getClients(): {
    publicClient: SupportedPublicClient;
    walletClient?: WalletClient;
  } {
    return {
      publicClient: this.publicClient,
      walletClient: this.walletClient,
    };
  }

  /**
   * Get the airlock owner address for the configured chain
   */
  async getAirlockOwner(): Promise<Address> {
    return fetchAirlockOwner(this.publicClient);
  }
  async getAirlockAssetData(asset: Address): Promise<AirlockAssetData> {
    const result = await (this.publicClient as PublicClient).readContract({
      address: getAddresses(this.chainId).airlock,
      abi: airlockAbi,
      functionName: 'getAssetData',
      args: [asset],
    });
    return normalizeAirlockAssetData(result);
  }

  /**
   * Convenience helper for building the airlock beneficiary entry with the default 5% (0.05e18 WAD shares)
   */
  async getAirlockBeneficiary(
    shares: bigint = DEFAULT_AIRLOCK_BENEFICIARY_SHARES,
  ): Promise<BeneficiaryData> {
    return getAirlockBeneficiary(this.publicClient, shares);
  }
}
