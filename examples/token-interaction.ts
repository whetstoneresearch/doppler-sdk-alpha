/**
 * Example: Token Interaction
 *
 * This example demonstrates:
 * - Interacting with DERC20 tokens launched via Doppler
 * - Checking balances and vesting data
 * - Approving spending and releasing vested tokens
 */

import { Derc20, Eth } from '@whetstone-research/doppler-sdk';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type Address,
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org' as string;
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as `0x${string}`;

if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is not set');
if (!TOKEN_ADDRESS) throw new Error('TOKEN_ADDRESS is not set');

async function main() {
  // 1. Set up clients
  const account = privateKeyToAccount(PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    chain: base,
    transport: http(RPC_URL),
    account,
  });

  console.log('💰 Token Interaction Example');
  console.log('===========================');
  console.log('Account:', account.address);
  console.log('Token:', TOKEN_ADDRESS);

  // 2. Create token instance
  const token = new Derc20(publicClient, walletClient, TOKEN_ADDRESS);

  try {
    // 3. Get token information
    console.log('\n📋 Token Information:');
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      token.getName(),
      token.getSymbol(),
      token.getDecimals(),
      token.getTotalSupply(),
    ]);

    console.log('- Name:', name);
    console.log('- Symbol:', symbol);
    console.log('- Decimals:', decimals);
    console.log('- Total Supply:', formatEther(totalSupply), symbol);

    // 4. Check balances
    console.log('\n💸 Balances:');
    const balance = await token.getBalanceOf(account.address);
    console.log('- Your balance:', formatEther(balance), symbol);

    // Also check ETH balance
    const eth = new Eth(publicClient);
    const ethBalance = await eth.getBalanceOf(account.address);
    console.log('- ETH balance:', formatEther(ethBalance), 'ETH');

    // 5. Check vesting information
    console.log('\n⏰ Vesting Information:');
    const [vestingDuration, vestingStart, vestedTotal] = await Promise.all([
      token.getVestingDuration(),
      token.getVestingStart(),
      token.getVestedTotalAmount(),
    ]);

    if (vestingDuration > 0n) {
      const vestingEndTime = vestingStart + vestingDuration;
      const now = BigInt(Math.floor(Date.now() / 1000));
      const isVestingActive = now < vestingEndTime;

      console.log(
        '- Vesting duration:',
        Number(vestingDuration) / 86400,
        'days'
      );
      console.log(
        '- Vesting start:',
        new Date(Number(vestingStart) * 1000).toLocaleString()
      );
      console.log('- Total vested amount:', formatEther(vestedTotal), symbol);
      console.log('- Vesting active:', isVestingActive);

      // Check user's vesting data
      const vestingData = await token.getVestingData(account.address);
      console.log('\n📊 Your Vesting Data:');
      console.log(
        '- Total vested:',
        formatEther(vestingData.totalAmount),
        symbol
      );
      console.log(
        '- Already released:',
        formatEther(vestingData.releasedAmount),
        symbol
      );

      // Calculate available to release
      const available = await token.getAvailableVestedAmount(account.address);
      console.log('- Available to release:', formatEther(available), symbol);

      // Release vested tokens if available
      if (available > 0n) {
        console.log('\n🎯 Releasing vested tokens...');
        try {
          const txHash = await token.release(available);
          console.log('✅ Tokens released! Transaction:', txHash);
        } catch (error) {
          console.error('❌ Failed to release tokens:', error);
        }
      }
    } else {
      console.log('- No vesting configured for this token');
    }

    // 6. Token approvals
    console.log('\n🔓 Token Approvals:');
    const spender = '0x0987654321098765432109876543210987654321' as Address; // Example spender
    const currentAllowance = await token.getAllowance(account.address, spender);
    console.log('- Current allowance:', formatEther(currentAllowance), symbol);

    // Approve spending if needed
    const approvalAmount = parseEther('100');
    if (currentAllowance < approvalAmount) {
      console.log(
        `\n📝 Approving ${formatEther(approvalAmount)} ${symbol} for spender...`
      );
      try {
        const txHash = await token.approve(spender, approvalAmount);
        console.log('✅ Approval successful! Transaction:', txHash);
      } catch (error) {
        console.error('❌ Approval failed:', error);
      }
    }

    // 7. Additional token info
    console.log('\n🔍 Additional Information:');
    const [tokenURI, pool, isPoolUnlocked, yearlyMintRate] = await Promise.all([
      token.getTokenURI(),
      token.getPool(),
      token.getIsPoolUnlocked(),
      token.getYearlyMintRate(),
    ]);

    console.log('- Token URI:', tokenURI);
    console.log('- Pool address:', pool);
    console.log('- Pool unlocked:', isPoolUnlocked);
    console.log(
      '- Yearly mint rate:',
      formatEther(yearlyMintRate),
      symbol,
      'per year'
    );
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }

  console.log('\n✨ Example completed!');
}

// Run the example
main().catch(console.error);
