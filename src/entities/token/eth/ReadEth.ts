import { ReadAdapter, Drift } from '@delvtech/drift';
import { Address } from 'abitype';
import { ETH_ADDRESS } from '@/constants';

export class ReadEth {
  drift: Drift<ReadAdapter>;
  static address = ETH_ADDRESS;

  constructor(drift: Drift<ReadAdapter> = new Drift()) {
    this.drift = drift;
  }

  async getName(): Promise<string> {
    return 'Ether';
  }

  async getSymbol(): Promise<string> {
    return 'ETH';
  }

  async getDecimals(): Promise<number> {
    return 18;
  }

  async getAllowance(): Promise<bigint> {
    return 2n ** 256n - 1n;
  }

  async getBalanceOf(account: Address): Promise<bigint> {
    return this.drift.getBalance({ address: account });
  }
}
