// import { parseEther, PublicClient } from 'viem';
// import { beforeAll, describe, expect, it } from 'vitest';
// import { Deployer, DopplerPreDeploymentConfig } from '../../entities/Deployer';
// import { Doppler } from '../../entities/Doppler';
// import { fetchDopplerState } from '../../fetch/DopplerState';
// import { setupTestEnvironment } from '../utils/setupTestEnv';

// describe('Doppler Pool Fetchers', () => {
//   let doppler: Doppler;
//   let client: PublicClient;

//   beforeAll(async () => {
//     const {
//       clients: { publicClient, walletClient },
//       addresses,
//     } = await setupTestEnvironment();
//     if (!publicClient || !walletClient) {
//       throw new Error('Test client not found');
//     }

//     client = publicClient;

//     const { timestamp } = await publicClient.getBlock();
//     const configParams: DopplerPreDeploymentConfig = {
//       name: 'Gud Coin',
//       symbol: 'GUD',
//       totalSupply: parseEther('1000'),
//       numTokensToSell: parseEther('1000'),
//       blockTimestamp: Number(timestamp),
//       startTimeOffset: 1,
//       duration: 3,
//       epochLength: 1600,
//       priceRange: {
//         startPrice: 0.1,
//         endPrice: 0.0001,
//       },
//       tickSpacing: 8,
//       fee: 300,
//       minProceeds: parseEther('100'),
//       maxProceeds: parseEther('600'),
//     };

//     const deployer = new Deployer({ publicClient, walletClient, addresses });
//     const config = deployer.buildConfig(configParams);
//     doppler = await deployer.deployWithConfig(config);
//   });

//   describe('newly deployed Doppler pool', () => {
//     describe('fetch values from newly initialized doppler pool', () => {
//       it('maxProceeds - totalProceeds = maxProceeds', async () => {
//         const { totalProceeds } = await fetchDopplerState(
//           doppler.address,
//           client
//         );
//         const maxProceeds = doppler.getProceedsDistanceFromMaximum();
//         expect(maxProceeds - totalProceeds).toEqual(maxProceeds);
//       });

//       it('minProceeds - totalProceeds = minProceeds', async () => {
//         const { totalProceeds } = await fetchDopplerState(
//           doppler.address,
//           client
//         );
//         const minProceeds = doppler.getProceedsDistanceFromMinimum();
//         expect(minProceeds - totalProceeds).toEqual(minProceeds);
//       });

//       it('time remaining', async () => {
//         const timeRemaining = doppler.getTimeRemaining();
//         expect(timeRemaining).toBeGreaterThanOrEqual(0);
//       });

//       it('epochs remaining', async () => {
//         const epochsRemaining = doppler.getEpochsRemaining();
//         expect(epochsRemaining).toBeGreaterThanOrEqual(0);
//       });
//     });

//     describe('doppler pool with asset tokens purchased', () => {
//       it('distance from maxProceeds should be less than maxProceeds', async () => {
//         const { totalProceeds } = await fetchDopplerState(
//           doppler.address,
//           client
//         );
//         const maxProceeds = doppler.getProceedsDistanceFromMaximum();
//         expect(maxProceeds - totalProceeds).toEqual(maxProceeds);
//       });

//       it('distance from minProceeds should equal minProceeds', async () => {
//         const { totalProceeds } = await fetchDopplerState(
//           doppler.address,
//           client
//         );
//         const minProceeds = doppler.getProceedsDistanceFromMinimum();
//         expect(minProceeds - totalProceeds).toEqual(minProceeds);
//       });
//     });
//   });
// });
