import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAIN_IDS, DopplerSDK } from '../../../../src/evm';
import {
  createMockPublicClient,
  createMockWalletClient,
} from '../../setup/fixtures/clients';

const asset = '0x0000000000000000000000000000000000000031';
const numeraire = '0x0000000000000000000000000000000000000032';
const timelock = '0x0000000000000000000000000000000000000033';
const governance = '0x0000000000000000000000000000000000000034';
const migratorAddress = '0x0000000000000000000000000000000000000035';
const initializer = '0x0000000000000000000000000000000000000036';
const hook = '0x0000000000000000000000000000000000000037';
const migrationPool = '0x0000000000000000000000000000000000000038';
const integrator = '0x0000000000000000000000000000000000000039';
const lockerAddress = '0x0000000000000000000000000000000000000040';
const assetData = [
  numeraire,
  timelock,
  governance,
  migratorAddress,
  initializer,
  hook,
  migrationPool,
  900n,
  1_000n,
  integrator,
] as const;

describe('DopplerSDK asset module resolution', () => {
  const publicClient = createMockPublicClient();
  const walletClient = createMockWalletClient();
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: CHAIN_IDS.BASE_SEPOLIA,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes the complete Airlock asset record', async () => {
    publicClient.readContract.mockResolvedValueOnce(assetData);

    await expect(sdk.getAirlockAssetData(asset)).resolves.toEqual({
      numeraire,
      timelock,
      governance,
      liquidityMigrator: migratorAddress,
      poolInitializer: initializer,
      poolOrHook: hook,
      migrationPool,
      numTokensToSell: 900n,
      totalSupply: 1_000n,
      integrator,
    });
  });

  it('uses the launch-recorded migrator and its locker', async () => {
    publicClient.readContract.mockResolvedValueOnce(assetData);
    const migrator = await sdk.getDopplerHookMigratorForAsset(asset);
    expect(migrator.getAddress()).toBe(migratorAddress);

    publicClient.readContract
      .mockResolvedValueOnce(assetData)
      .mockResolvedValueOnce(lockerAddress);
    const locker = await sdk.getStreamableFeesLockerForAsset(asset);
    expect(locker.getAddress()).toBe(lockerAddress);
  });

  it('passes the launch-recorded initializer to multicurve discovery', async () => {
    publicClient.readContract
      .mockResolvedValueOnce(assetData)
      .mockResolvedValueOnce([
        numeraire,
        1,
        {
          currency0: asset,
          currency1: numeraire,
          fee: 3000,
          tickSpacing: 60,
          hooks: hook,
        },
        120,
      ])
      .mockResolvedValueOnce([
        numeraire,
        1,
        {
          currency0: asset,
          currency1: numeraire,
          fee: 3000,
          tickSpacing: 60,
          hooks: hook,
        },
        120,
      ]);

    const pool = await sdk.getMulticurvePool(asset);
    await pool.getState();
    expect(publicClient.readContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: initializer,
        functionName: 'getState',
      }),
    );
  });
});
