import { randomBytes } from 'crypto';
import {
  Address,
  createPublicClient,
  createTestClient,
  createWalletClient,
  Hex,
  http,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import {
  DeployDopplerFactoryABI,
  DeployDopplerFactoryDeployedBytecode,
} from '../abis/DeployDopplerFactoryABI';
import { Clients, DopplerAddresses } from '../../types';

interface TestEnvironment {
  clients: Clients;
  addresses: DopplerAddresses;
}

export async function setupTestEnvironment(): Promise<TestEnvironment> {
  const privateKey = `0x${randomBytes(32).toString('hex')}` as Hex;
  const deploymentFactoryAddress = `0x${randomBytes(20).toString(
    'hex'
  )}` as Address;

  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: foundry,
    transport: http(),
  });

  const testClient = createTestClient({
    chain: foundry,
    mode: 'anvil',
    transport: http(),
  });

  testClient.setBalance({
    address: privateKeyToAccount(privateKey).address,
    value: parseEther('1000000'),
  });

  testClient.setCode({
    address: deploymentFactoryAddress,
    bytecode: DeployDopplerFactoryDeployedBytecode,
  });

  const deployContractsHash = await walletClient.writeContract({
    abi: DeployDopplerFactoryABI,
    address: deploymentFactoryAddress,
    functionName: 'run',
    account: walletClient.account,
  });

  await publicClient.waitForTransactionReceipt({
    hash: deployContractsHash,
  });

  const contractAddresses = await publicClient.readContract({
    abi: DeployDopplerFactoryABI,
    address: deploymentFactoryAddress,
    functionName: 'getDeploymentAddresses',
  });

  // Deploy your contracts here and get their addresses
  // You'll need to deploy: poolManager, airlock, tokenFactory, etc.
  const addresses = {
    airlock: contractAddresses[0] as Address,
    tokenFactory: contractAddresses[1] as Address,
    dopplerFactory: contractAddresses[2] as Address,
    governanceFactory: contractAddresses[3] as Address,
    migrator: contractAddresses[4] as Address,
    poolManager: contractAddresses[5] as Address,
    stateView: contractAddresses[6] as Address,
    customRouter: contractAddresses[7] as Address,
  };

  return {
    clients: { publicClient, walletClient, testClient },
    addresses,
  };
}
