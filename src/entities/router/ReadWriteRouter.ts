import { ReadWriteContract, ReadWriteAdapter, Drift } from '@delvtech/drift';
import { customRouterAbi } from '@/abis';
import { Address, Hex } from 'viem';
import { PoolKey } from '@/types';

interface TradeParams {
  key: PoolKey;
  amount: bigint;
}

type CustomRouterABI = typeof customRouterAbi;

export class ReadWriteRouter {
  contract: ReadWriteContract<CustomRouterABI>;

  constructor(address: Address, drift: Drift<ReadWriteAdapter> = new Drift()) {
    this.contract = drift.contract({
      abi: customRouterAbi,
      address,
    });
  }

  async buyExactIn(params: TradeParams): Promise<Hex> {
    return this.contract.write('buyExactIn', params);
  }

  async buyExactOut(params: TradeParams): Promise<Hex> {
    return this.contract.write('buyExactOut', params);
  }

  async sellExactIn(params: TradeParams): Promise<Hex> {
    return this.contract.write('sellExactIn', params);
  }

  async sellExactOut(params: TradeParams): Promise<Hex> {
    return this.contract.write('sellExactOut', params);
  }
}
