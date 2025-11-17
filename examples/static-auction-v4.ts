import { DopplerSDK, getAirlockOwner } from '../src';
import { parseEther, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
const rpcUrl = process.env.RPC_URL ?? "https://mainnet.base.org";
const account = privateKeyToAccount(privateKey);

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

  const airlockOwner = await getAirlockOwner(publicClient);

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
    .poolByTicks({
      startTick: 174960, // fee 3000 → tickSpacing 60, so ticks must be multiples of 60
      endTick: 225000,
      fee: 3000,
    })
    .withVesting({
      duration: BigInt(365 * 24 * 60 * 60),
      cliffDuration: 0,
      // Optional: Specify multiple vesting beneficiaries
      // recipients: [account.address, '0xTeamWallet...', '0xAdvisorWallet...'],
      // amounts: [parseEther('50000000'), parseEther('30000000'), parseEther('20000000')]
    })
    .withMigration({
      type: 'uniswapV4',
      fee: 3000,
      tickSpacing: 60,
      streamableFees: {
        lockDuration: 365 * 24 * 60 * 60, // 1 year
        beneficiaries: [
          { beneficiary: account.address, shares: parseEther('0.95') }, // 95%
          { beneficiary: airlockOwner, shares: parseEther('0.05') }, // 5%
        ],
      },
    })
    .withUserAddress(account.address)
    .withGovernance({ type: "default" })
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
