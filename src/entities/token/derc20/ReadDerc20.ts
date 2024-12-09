import { ReadContract, ReadAdapter, Drift } from '@delvtech/drift';
import { Address } from 'abitype';
import { derc20Abi } from '@/abis';

export type Derc20ABI = typeof derc20Abi;

export class ReadDerc20 {
  contract: ReadContract<Derc20ABI>;

  constructor(address: `0x${string}`, drift: Drift<ReadAdapter> = new Drift()) {
    this.contract = drift.contract({ abi: derc20Abi, address });
  }

  async getName(): Promise<string> {
    return this.contract.read('name');
  }

  async getSymbol(): Promise<string> {
    return this.contract.read('symbol');
  }

  async getDecimals(): Promise<number> {
    return this.contract.read('decimals');
  }

  async getAllowance(owner: Address, spender: Address): Promise<bigint> {
    return this.contract.read('allowance', { owner, spender });
  }

  async getBalanceOf(account: Address): Promise<bigint> {
    return this.contract.read('balanceOf', { account });
  }
}
