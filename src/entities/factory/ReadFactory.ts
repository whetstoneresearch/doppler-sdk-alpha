import { ReadContract, ReadAdapter, Drift, EventFilter } from '@delvtech/drift';
import { Address } from 'viem';
import { airlockAbi } from '@/abis';
import { PoolKey } from '@uniswap/v4-sdk';

export type AirlockABI = typeof airlockAbi;

export enum ModuleState {
  NotWhitelisted = 0,
  TokenFactory = 1,
  GovernanceFactory = 2,
  HookFactory = 3,
  Migrator = 4,
}

export class ReadFactory {
  airlock: ReadContract<AirlockABI>;

  constructor(address: Address, drift: Drift<ReadAdapter> = new Drift()) {
    this.airlock = drift.contract({
      abi: airlockAbi,
      address,
    });
  }

  async getModuleState(address: Address): Promise<ModuleState> {
    return this.airlock.read('getModuleState', {
      0: address,
    });
  }

  async getTokenData(token: Address): Promise<{
    poolKey: PoolKey;
    timelock: Address;
    governance: Address;
    migrator: Address;
  }> {
    return this.airlock.read('getTokenData', {
      token,
    });
  }

  async getCreateEvents(): Promise<EventFilter<AirlockABI, 'Create'>> {
    return this.airlock.getEvents('Create');
  }

  async getMigrateEvents(): Promise<EventFilter<AirlockABI, 'Migrate'>> {
    return this.airlock.getEvents('Migrate');
  }

  async getSetModuleStateEvents(): Promise<
    EventFilter<AirlockABI, 'SetModuleState'>
  > {
    return this.airlock.getEvents('SetModuleState');
  }
}
