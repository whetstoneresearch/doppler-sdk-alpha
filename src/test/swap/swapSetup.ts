// import {
//   Address,
//   Hex,
//   createTestClient,
//   http,
//   parseEther,
//   publicActions,
//   walletActions,
// } from 'viem';
// import { foundry } from 'viem/chains';
// import { privateKeyToAccount } from 'viem/accounts';
// import {
//   DeployDopplerFactoryABI,
//   DeployDopplerFactoryDeployedBytecode,
// } from '../abis/DeployDopplerFactoryABI';
// import { randomBytes } from 'crypto';
// import { Doppler } from '../../entities/Doppler';
// import { Deployer, DopplerPreDeploymentConfig } from '../../entities/Deployer';
// import { Clients, DopplerAddresses } from '../../types';

// interface SwapTestEnvironment {
//   addresses: DopplerAddresses;
//   clients: Clients;
//   doppler: Doppler;
// }

// export async function setupTestEnvironment(): Promise<SwapTestEnvironment> {
//   const privateKey = `0x${randomBytes(32).toString('hex')}` as Hex;
//   const deploymentFactoryAddress = `0x${randomBytes(20).toString(
//     'hex'
//   )}` as Address;

//   const publicClient = createTestClient({
//     chain: foundry,
//     mode: 'anvil',
//     transport: http(),
//   }).extend(publicActions);

//   const walletClient = createTestClient({
//     account: privateKeyToAccount(privateKey),
//     chain: foundry,
//     mode: 'anvil',
//     transport: http(),
//   }).extend(walletActions);

//   const testClient = createTestClient({
//     chain: foundry,
//     mode: 'anvil',
//     transport: http(),
//   });

//   testClient.setBalance({
//     address: privateKeyToAccount(privateKey).address,
//     value: parseEther('1000000'),
//   });

//   testClient.setCode({
//     address: deploymentFactoryAddress,
//     bytecode: DeployDopplerFactoryDeployedBytecode,
//   });

//   const deployContractsHash = await walletClient.writeContract({
//     abi: DeployDopplerFactoryABI,
//     address: deploymentFactoryAddress,
//     functionName: 'run',
//     account: walletClient.account,
//   });

//   await publicClient.waitForTransactionReceipt({
//     hash: deployContractsHash,
//   });

//   const contractAddresses = await publicClient.readContract({
//     abi: DeployDopplerFactoryABI,
//     address: deploymentFactoryAddress,
//     functionName: 'getDeploymentAddresses',
//   });

//   // Deploy your contracts here and get their addresses
//   // You'll need to deploy: poolManager, airlock, tokenFactory, etc.
//   const addresses = {
//     airlock: contractAddresses[0] as Address,
//     tokenFactory: contractAddresses[1] as Address,
//     dopplerFactory: contractAddresses[2] as Address,
//     governanceFactory: contractAddresses[3] as Address,
//     migrator: contractAddresses[4] as Address,
//     poolManager: contractAddresses[5] as Address,
//     stateView: contractAddresses[6] as Address,
//     customRouter: contractAddresses[7] as Address,
//   };

//   const block = await publicClient.getBlock();

//   const configParams: DopplerPreDeploymentConfig = {
//     name: 'Swap Coin',
//     symbol: 'SWAP',
//     totalSupply: parseEther('1000'),
//     numTokensToSell: parseEther('1000'),
//     blockTimestamp: Number(block.timestamp),
//     startTimeOffset: 1,
//     duration: 3,
//     epochLength: 1600,
//     priceRange: {
//       startPrice: 0.1,
//       endPrice: 0.0001,
//     },
//     tickSpacing: 8,
//     fee: 300,
//     minProceeds: parseEther('100'),
//     maxProceeds: parseEther('600'),
//   };

//   const deployer = new Deployer({ publicClient, walletClient, addresses });
//   const config = deployer.buildConfig(configParams);
//   const doppler = await deployer.deployWithConfig(config);

//   const { timestamp } = await publicClient.getBlock();
//   const delta = Number(doppler.config.startingTime) - Number(timestamp) + 1;
//   await testClient.increaseTime({
//     seconds: delta,
//   });
//   await testClient.mine({
//     blocks: 1,
//   });

//   return {
//     addresses,
//     clients: { publicClient, walletClient, testClient },
//     doppler,
//   };
// }
