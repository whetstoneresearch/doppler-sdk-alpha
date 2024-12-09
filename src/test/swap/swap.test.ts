// import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
// import { setupTestEnvironment } from './swapSetup';
// import { Address, parseEther } from 'viem';
// import {
//   buyAssetExactIn,
//   buyAssetExactOut,
// } from '../../actions/trade/buy/buyAsset';
// import {
//   sellAssetExactIn,
//   sellAssetExactOut,
// } from '../../actions/trade/sell/sellAsset';
// import { writeContract } from 'viem/actions';
// import { DERC20ABI } from '../../abis';
// import { readContract } from 'viem/actions';
// import { fetchDopplerState } from '../../fetch/DopplerState';
// describe('Doppler Swap tests', () => {
//   let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;

//   beforeAll(async () => {
//     testEnv = await setupTestEnvironment();
//     const { clients, addresses, doppler } = testEnv;
//     if (!clients.walletClient || !clients.walletClient.account) {
//       throw new Error('Required clients not found');
//     }
//     // max approve
//     await writeContract(clients.walletClient, {
//       chain: clients.walletClient.chain,
//       account: clients.walletClient.account,
//       address: doppler.assetToken.address as Address,
//       abi: DERC20ABI,
//       functionName: 'approve',
//       args: [addresses.customRouter, BigInt(1) << (BigInt(256) - BigInt(1))],
//     });
//   });

//   beforeEach(async () => {
//     await testEnv.clients.testClient?.mine({
//       blocks: 1,
//     });
//   });

//   it('should buy asset with exact out', async () => {
//     const { clients, doppler, addresses } = testEnv;
//     if (!clients.testClient || !clients.walletClient) {
//       throw new Error('Test client not found');
//     }

//     const buyExactOutTxHash = await buyAssetExactOut(
//       doppler,
//       addresses,
//       parseEther('0.05'),
//       clients.walletClient
//     );
//     await clients.publicClient.waitForTransactionReceipt({
//       hash: buyExactOutTxHash,
//     });

//     const receipt = await clients.publicClient.getTransactionReceipt({
//       hash: buyExactOutTxHash,
//     });
//     expect(receipt.status).toBe('success');
//   });

//   it('should buy asset with exact in', async () => {
//     const { clients, doppler, addresses } = testEnv;
//     if (!clients.testClient || !clients.walletClient) {
//       throw new Error('Test client not found');
//     }

//     const buyExactInTxHash = await buyAssetExactIn(
//       doppler,
//       addresses,
//       parseEther('0.05'),
//       clients.walletClient
//     );
//     await clients.publicClient.waitForTransactionReceipt({
//       hash: buyExactInTxHash,
//     });

//     const receipt = await clients.publicClient.getTransactionReceipt({
//       hash: buyExactInTxHash,
//     });
//     expect(receipt.status).toBe('success');
//   });

//   it('should sell asset with exact in', async () => {
//     const { clients, doppler, addresses } = testEnv;
//     if (
//       !clients.testClient ||
//       !clients.walletClient ||
//       !clients.walletClient.account?.address
//     ) {
//       throw new Error('Test client not found');
//     }
//     const tokenAddress = doppler.assetToken.address;

//     const balance = await readContract(clients.testClient, {
//       address: tokenAddress as Address,
//       abi: DERC20ABI,
//       functionName: 'balanceOf',
//       args: [clients.walletClient.account?.address],
//     });

//     // sell 10% of the balance
//     const amountToSell = balance / BigInt(10);

//     const sellExactInTxHash = await sellAssetExactIn(
//       doppler,
//       addresses,
//       amountToSell,
//       clients.walletClient
//     );
//     await clients.publicClient.waitForTransactionReceipt({
//       hash: sellExactInTxHash,
//     });

//     const receipt = await clients.publicClient.getTransactionReceipt({
//       hash: sellExactInTxHash,
//     });
//     expect(receipt.status).toBe('success');
//   });

//   it('Should sell asset with exact out', async () => {
//     const { clients, doppler, addresses } = testEnv;
//     if (
//       !clients.testClient ||
//       !clients.walletClient ||
//       !clients.walletClient.account?.address
//     ) {
//       throw new Error('Test client not found');
//     }

//     const manager = addresses.poolManager;
//     const managerBalance = await clients.publicClient.getBalance({
//       address: manager,
//     });

//     const poolState = await fetchDopplerState(
//       doppler.address,
//       clients.publicClient
//     );

//     // swap for 10% of the manager balance
//     const amountOut = managerBalance / BigInt(10);

//     expect(amountOut).toBeLessThan(poolState.totalProceeds);
//     const sellExactOutTxHash = await sellAssetExactOut(
//       doppler,
//       addresses,
//       amountOut,
//       clients.walletClient
//     );
//     await clients.publicClient.waitForTransactionReceipt({
//       hash: sellExactOutTxHash,
//     });

//     const receipt = await clients.publicClient.getTransactionReceipt({
//       hash: sellExactOutTxHash,
//     });
//     expect(receipt.status).toBe('success');
//   });
// });
