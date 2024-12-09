import { ReadContract, ReadAdapter, Drift, EventFilter } from '@delvtech/drift';
import { Address } from 'abitype';
import { dopplerAbi, stateViewAbi } from '@/abis';
import { encodePacked, Hex, keccak256 } from 'viem';
import { PoolKey } from '@/types';
import { ReadDerc20 } from '../token/derc20/ReadDerc20';
import { ReadEth } from '../token/eth/ReadEth';
import { ETH_ADDRESS } from '@/constants';

type DopplerABI = typeof dopplerAbi;
type StateViewABI = typeof stateViewAbi;

export class ReadDoppler {
  drift: Drift<ReadAdapter>;
  address: Address;
  doppler: ReadContract<DopplerABI>;
  stateView: ReadContract<StateViewABI>;
  poolId: Hex;

  constructor(
    dopplerAddress: `0x${string}`,
    stateViewAddress: `0x${string}`,
    drift: Drift<ReadAdapter> = new Drift()
  ) {
    this.address = dopplerAddress;
    this.doppler = drift.contract({
      abi: dopplerAbi,
      address: dopplerAddress,
    });
    this.stateView = drift.contract({
      abi: stateViewAbi,
      address: stateViewAddress,
    });
  }

  async getState(): Promise<{
    lastEpoch: number;
    tickAccumulator: bigint;
    totalTokensSold: bigint;
    totalProceeds: bigint;
    totalTokensSoldLastEpoch: bigint;
    feesAccrued: bigint;
  }> {
    return this.doppler.read('state');
  }

  async getPosition(
    salt: Hex
  ): Promise<{ tickLower: number; tickUpper: number }> {
    return this.doppler.read('positions', { salt });
  }

  async getSlot0(id: Hex): Promise<{
    tick: number;
    sqrtPriceX96: bigint;
    protocolFee: number;
    lpFee: number;
  }> {
    return this.stateView.read('getSlot0', { poolId: id });
  }

  async getCurrentPrice(): Promise<bigint> {
    const { sqrtPriceX96 } = await this.getSlot0(this.poolId);
    return (sqrtPriceX96 * sqrtPriceX96) / BigInt(2 ** 192);
  }

  async getPoolKey(): Promise<PoolKey> {
    return this.doppler.read('poolKey');
  }

  async getPoolId(): Promise<Hex> {
    const poolKey = await this.getPoolKey();
    const tokenA =
      poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase()
        ? poolKey.currency1
        : poolKey.currency0;
    const tokenB =
      poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase()
        ? poolKey.currency0
        : poolKey.currency1;

    const poolId = keccak256(
      encodePacked(
        ['address', 'address', 'uint24', 'uint24', 'address'],
        [tokenA, tokenB, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
      )
    );

    return poolId;
  }

  async getAssetToken(): Promise<ReadDerc20> {
    const poolKey = await this.getPoolKey();
    return new ReadDerc20(poolKey.currency1, this.drift);
  }

  async getQuoteToken(): Promise<ReadDerc20 | ReadEth> {
    const poolKey = await this.getPoolKey();
    return poolKey.currency0.toLowerCase() === ETH_ADDRESS.toLowerCase()
      ? new ReadEth(this.drift)
      : new ReadDerc20(poolKey.currency0, this.drift);
  }

  async getInsufficientProceeds(): Promise<boolean> {
    return this.doppler.read('insufficientProceeds');
  }

  async getEarlyExit(): Promise<boolean> {
    return this.doppler.read('earlyExit');
  }

  async getNumTokensToSell(): Promise<bigint> {
    return this.doppler.read('numTokensToSell');
  }

  async getMinimumProceeds(): Promise<bigint> {
    return this.doppler.read('minimumProceeds');
  }

  async getMaximumProceeds(): Promise<bigint> {
    return this.doppler.read('maximumProceeds');
  }

  async getStartingTime(): Promise<bigint> {
    return this.doppler.read('startingTime');
  }

  async getEndingTime(): Promise<bigint> {
    return this.doppler.read('endingTime');
  }

  async getStartingTick(): Promise<number> {
    return this.doppler.read('startingTick');
  }

  async getEndingTick(): Promise<number> {
    return this.doppler.read('endingTick');
  }

  async getEpochLength(): Promise<bigint> {
    return this.doppler.read('epochLength');
  }

  async getGamma(): Promise<number> {
    return this.doppler.read('gamma');
  }

  async getIsToken0(): Promise<boolean> {
    return this.doppler.read('isToken0');
  }

  async getNumPDSlugs(): Promise<bigint> {
    return this.doppler.read('numPDSlugs');
  }

  async getTotalEpochs(): Promise<bigint> {
    return this.doppler.read('totalEpochs');
  }

  async getSwapEvents(): Promise<EventFilter<DopplerABI, 'DopplerSwap'>> {
    return this.doppler.getEvents('DopplerSwap');
  }
}
