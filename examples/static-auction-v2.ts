/**
 * Example: Create a Static Auction with Uniswap V2 Migration
 *
 * This example demonstrates:
 * - Creating a token with fixed price range on Uniswap V3
 * - Migrating liquidity to Uniswap V2 after graduation
 * - Monitoring auction progress
 */

// UNCOMMENT IF RUNNING LOCALLY
// import { DopplerSDK, StaticAuctionBuilder } from '@whetstone-research/doppler-sdk';

import { DopplerSDK } from '../src';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Load environment variables
const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
const rpcUrl = process.env.RPC_URL || "https://mainnet.base.org";

async function main() {
  // 1. Set up clients
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: base,
    transport: http(rpcUrl),
    account,
  });

  // 2. Initialize SDK
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: base.id,
  });

  // 3. Define auction parameters via builder
  const params = sdk.buildStaticAuction()
    .tokenConfig({
      name: "TEST",
      symbol: "TEST",
      tokenURI: "https://example.com/token-metadata.json",
    })
    .saleConfig({
      initialSupply: parseEther("1000000"), // 1M tokens
      numTokensToSell: parseEther("500000"), // Sell 500k tokens
      numeraire: "0x4200000000000000000000000000000000000006", // WETH on Base
    })
    .poolByTicks({ startTick: 175000, endTick: 225000, fee: 10000 })
    .withMigration({ type: "uniswapV2" })
    .withUserAddress(account.address)
    .withGovernance({ type: 'default' })
    .build();

  console.log("Creating static auction...");
  console.log("Token:", params.token.name, `(${params.token.symbol})`);
  console.log("Selling:", formatEther(params.sale.numTokensToSell), "tokens");
  console.log("Price range: 0.0001 - 0.001 ETH per token");

  try {
    // 4. Create the auction
    const result = await sdk.factory.createStaticAuction(params);

    console.log("\n✅ Auction created successfully!");
    console.log("Pool address:", result.poolAddress);
    console.log("Token address:", result.tokenAddress);
    console.log("Transaction:", result.transactionHash);

    // 5. Get the auction instance
    const auction = await sdk.getStaticAuction(result.poolAddress);

    // 6. Monitor the auction
    console.log("\nMonitoring auction...");

    const poolInfo = await auction.getPoolInfo();
    console.log("Current liquidity:", formatEther(poolInfo.liquidity));
    console.log("Current sqrtPriceX96:", poolInfo.sqrtPriceX96.toString());

    // 7. Check graduation status
    const hasGraduated = await auction.hasGraduated();
    console.log("Has graduated:", hasGraduated);

    if (!hasGraduated) {
      console.log("\nAuction is still active. It will graduate after:");
      console.log("- 7 days have passed since creation");
      console.log("- Minimum proceeds are collected");
      console.log("\nLiquidity will then migrate to Uniswap V2");
    }

    // 8. Get current price
    const currentPrice = await auction.getCurrentPrice();
    console.log("\nCurrent price (in tick form):", currentPrice.toString());

    // 9. Calculate actual price from tick
    // This is simplified - in production use proper tick math
    const actualPrice = Number(currentPrice) / 1e18;
    console.log("Approximate price:", actualPrice, "ETH per token");
  } catch (error) {
    console.error("\n❌ Error creating auction:", error);
    process.exit(1);
  }

  console.log("\n✨ Example completed!");
}

// Run the example
main().catch(console.error);
