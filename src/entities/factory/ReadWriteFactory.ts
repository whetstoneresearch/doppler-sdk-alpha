import {
  ReadWriteContract,
  ReadWriteAdapter,
  Drift,
  ContractWriteOptions,
  OnMinedParam,
} from '@delvtech/drift';
import { ReadFactory, AirlockABI } from './ReadFactory';
import { Address, Hex } from 'viem';
import { PoolConfig, PoolKey } from '@/types';

export interface CreateParams {
  name: string;
  symbol: string;
  initialSupply: bigint;
  numTokensToSell: bigint;
  poolKey: PoolKey;
  recipients: Address[];
  amounts: bigint[];
  tokenFactory: Address;
  tokenData: Hex;
  governanceFactory: Address;
  governanceData: Hex;
  hookFactory: Address;
  hookData: Hex;
  migrator: Address;
  pool: PoolConfig;
  salt: Hex;
}

export class ReadWriteFactory extends ReadFactory {
  declare airlock: ReadWriteContract<AirlockABI>;

  constructor(address: Address, drift: Drift<ReadWriteAdapter>) {
    super(address, drift);
  }

  async create(
    params: CreateParams,
    options?: ContractWriteOptions & OnMinedParam
  ): Promise<Hex> {
    console.log('airlock addr', this.airlock.address);
    return this.airlock.write('create', params, options);
  }
}
