import { DopplerSDK } from '../src';
import { parseEther, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
// Using the builder pattern to construct params

const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
const beneficiary1 = process.env.BENEFICIARY_1 as `0x${string}`;
const beneficiary2 = process.env.BENEFICIARY_2 as `0x${string}`;
const rpcUrl = process.env.RPC_URL ?? "https://mainnet.base.org";
const account = privateKeyToAccount(privateKey);

if (!beneficiary1 || !beneficiary2)
  throw new Error('BENEFICIARY_1 and BENEFICIARY_2 must be set');
if (!privateKey) throw new Error('PRIVATE_KEY must be set');

// Example: Creating a static auction that migrates to Uniswap V4
async function createStaticAuctionExample() {
  // Create viem clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: base,
    transport: http(rpcUrl),
    account: account,
  });

  if (!publicClient || !walletClient) {
    throw new Error('Failed to create viem clients');
  }

  // Initialize the SDK
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: 8453, // Base mainnet
  });

  // Configure the static auction with the builder
  const params = sdk
    .buildStaticAuction()
    .tokenConfig({
      name: 'My Token',
      symbol: 'MTK',
      tokenURI: 'https://example.com/token-metadata.json',
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'), // 1 billion tokens
      numTokensToSell: parseEther('900000000'), // 900 million for sale
      numeraire: '0x4200000000000000000000000000000000000006', // WETH on Base
    })
    .poolByTicks({ startTick: 175000, endTick: 225000, fee: 3000 })
    .withVesting({ duration: BigInt(365 * 24 * 60 * 60), cliffDuration: 0 })
    .withMigration({
      type: 'uniswapV4',
      fee: 3000,
      tickSpacing: 60,
      streamableFees: {
        lockDuration: 365 * 24 * 60 * 60, // 1 year
        beneficiaries: [
          { address: beneficiary1, percentage: 7000 }, // 70%
          { address: beneficiary2, percentage: 3000 }, // 30%
        ],
      },
    })
    .withUserAddress(account.address)
    .build();

  // Create the static auction
  const result = await sdk.factory.createStaticAuction(params);

  console.log('Pool created:', result.poolAddress);
  console.log('Token created:', result.tokenAddress);
  console.log('Transaction:', result.transactionHash);

  // Later, interact with the auction
  const auction = await sdk.getStaticAuction(result.poolAddress);
  const hasGraduated = await auction.hasGraduated();

  if (hasGraduated) {
    console.log('Auction is ready for migration!');
  }
}

const main = async () => {
  await createStaticAuctionExample();
};

main();
