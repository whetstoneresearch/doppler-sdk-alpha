#!/usr/bin/env tsx
/**
 * Post-processes vitest JSON output to generate:
 * 1. GitHub Step Summary with markdown tables
 * 2. Console-friendly grouped output
 */

import * as fs from 'fs';

// Chain ID to human-readable name mapping
const CHAIN_NAMES: Record<number, string> = {
  1: 'Mainnet',
  42161: 'Arbitrum',
  8453: 'Base',
  84532: 'Base Sepolia',
  57073: 'Ink',
  130: 'Unichain',
  1301: 'Unichain Sepolia',
  10143: 'Monad Testnet',
  143: 'Monad Mainnet',
  4663: 'Robinhood',
};

// Module name extraction from test titles
// Order matters: more specific patterns must come before less specific ones
const MODULE_PATTERNS: [RegExp, string][] = [
  [
    /RehypeDopplerHookInitializer.*not whitelisted on Airlock/,
    'RehypeDopplerHookInitializer on Airlock',
  ],
  [
    /RehypeDopplerHookInitializer.*enabled on DopplerHookInitializer/,
    'RehypeDopplerHookInitializer on DopplerHookInitializer',
  ],
  [/DopplerERC20V1Factory/, 'DopplerERC20V1Factory'],
  [/TokenFactory/, 'TokenFactory'],
  [/NoOpGovernanceFactory/, 'NoOpGovernanceFactory'],
  [/LaunchpadGovernanceFactory/, 'LaunchpadGovernanceFactory'],
  [/GovernanceFactory/, 'GovernanceFactory'],
  [/DopplerHookInitializer/, 'DopplerHookInitializer'],
  [/Lockable(?:Uniswap)?V3Initializer/, 'LockableUniswapV3Initializer'],
  [/V4ScheduledMulticurveInitializer/, 'V4ScheduledMulticurveInitializer'],
  [/V4MulticurveInitializer/, 'V4MulticurveInitializer'],
  [/V4DecayMulticurveInitializer/, 'V4DecayMulticurveInitializer'],
  [/(?:Uniswap)?V3Initializer/, 'UniswapV3Initializer'],
  [/(?:Uniswap)?V4Initializer/, 'UniswapV4Initializer'],
  [/NoOpMigrator/, 'NoOpMigrator'],
  [/(?:Uniswap)?V2MigratorSplit/, 'UniswapV2MigratorSplit'],
  [/(?:Uniswap)?V2Migrator/, 'UniswapV2Migrator'],
  [/DopplerHookMigrator/, 'DopplerHookMigrator'],
  [/(?:Uniswap)?V4MigratorSplit/, 'UniswapV4MigratorSplit'],
  [/(?:Uniswap)?V4Migrator/, 'UniswapV4Migrator'],
];

interface VitestJsonResult {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: TestFileResult[];
}

interface TestFileResult {
  name: string;
  assertionResults: AssertionResult[];
}

interface AssertionResult {
  ancestorTitles: string[];
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  failureMessages?: string[];
}

interface ChainResult {
  chainId: number;
  chainName: string;
  modules: ModuleResult[];
  passed: number;
  failed: number;
  skipped: number;
  skipReason?: string;
}

interface ModuleResult {
  name: string;
  address: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
}

function parseChainId(ancestorTitle: string): number | null {
  const match = ancestorTitle.match(/Chain (\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function extractModuleName(testTitle: string): string {
  for (const [pattern, name] of MODULE_PATTERNS) {
    if (pattern.test(testTitle)) {
      return name;
    }
  }
  return testTitle;
}

function extractAddress(testTitle: string): string {
  const match = testTitle.match(/\((0x[a-fA-F0-9]+)\)/);
  return match ? match[1] : '';
}

function parseResults(jsonPath: string): ChainResult[] {
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data: VitestJsonResult = JSON.parse(raw);

  const chainMap = new Map<number, ChainResult>();

  for (const testFile of data.testResults) {
    for (const assertion of testFile.assertionResults) {
      // Find chain ID from ancestor titles (e.g., "Chain 8453")
      const chainAncestor = assertion.ancestorTitles.find((t) =>
        t.startsWith('Chain '),
      );
      if (!chainAncestor) continue;

      const chainId = parseChainId(chainAncestor);
      if (!chainId) continue;

      if (!chainMap.has(chainId)) {
        chainMap.set(chainId, {
          chainId,
          chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
          modules: [],
          passed: 0,
          failed: 0,
          skipped: 0,
        });
      }

      const chain = chainMap.get(chainId)!;

      // Check for chain-level skip reasons
      if (
        assertion.title.includes('config not defined') ||
        assertion.title.includes('not deployed')
      ) {
        chain.skipReason = assertion.title;
      }

      const moduleName = extractModuleName(assertion.title);
      const moduleAddress = extractAddress(assertion.title);
      const moduleStatus: 'pass' | 'fail' | 'skip' =
        assertion.status === 'passed'
          ? 'pass'
          : assertion.status === 'failed'
            ? 'fail'
            : 'skip';

      chain.modules.push({
        name: moduleName,
        address: moduleAddress,
        status: moduleStatus,
        error: assertion.failureMessages?.[0],
      });

      if (moduleStatus === 'pass') chain.passed++;
      else if (moduleStatus === 'fail') chain.failed++;
      else chain.skipped++;
    }
  }

  return Array.from(chainMap.values()).sort((a, b) => a.chainId - b.chainId);
}

function generateMarkdownSummary(
  chains: ChainResult[],
  testChains: string,
  rpcDelay: string,
): string {
  const lines: string[] = [];

  // Header
  lines.push('## Airlock Whitelisting Test Results');
  lines.push('');

  // Configuration info
  lines.push(`**Chains tested:** \`${testChains}\``);
  lines.push(`**RPC delay:** ${rpcDelay}ms`);
  lines.push('');

  // Overall summary
  const totalPassed = chains.reduce((sum, c) => sum + c.passed, 0);
  const totalFailed = chains.reduce((sum, c) => sum + c.failed, 0);
  const totalSkipped = chains.reduce((sum, c) => sum + c.skipped, 0);

  const statusEmoji = totalFailed > 0 ? ':x:' : ':white_check_mark:';
  lines.push(
    `### Overall: ${statusEmoji} ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`,
  );
  lines.push('');

  // Chain summary table
  lines.push('### Results by Chain');
  lines.push('');
  lines.push('| Chain | Status | Passed | Failed | Skipped | Notes |');
  lines.push('|-------|--------|--------|--------|---------|-------|');

  for (const chain of chains) {
    const status =
      chain.failed > 0
        ? ':x:'
        : chain.skipReason
          ? ':warning:'
          : ':white_check_mark:';
    const notes = chain.skipReason || '';
    lines.push(
      `| ${chain.chainName} | ${status} | ${chain.passed} | ${chain.failed} | ${chain.skipped} | ${notes} |`,
    );
  }
  lines.push('');

  // Detailed module table for chains with failures
  const failedChains = chains.filter((c) => c.failed > 0);
  if (failedChains.length > 0) {
    lines.push('### Failed Tests Details');
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Click to expand failed test details</summary>');
    lines.push('');

    for (const chain of failedChains) {
      lines.push(`#### ${chain.chainName}`);
      lines.push('');
      lines.push('| Module | Address | Status | Error |');
      lines.push('|--------|---------|--------|-------|');

      for (const module of chain.modules) {
        if (module.status === 'fail') {
          const errorMsg = module.error
            ? module.error.slice(0, 80).replace(/\n/g, ' ')
            : '';
          const addr = module.address ? `\`${module.address}\`` : '';
          lines.push(`| ${module.name} | ${addr} | :x: | ${errorMsg} |`);
        }
      }
      lines.push('');
    }

    lines.push('</details>');
    lines.push('');
  }

  // Full matrix table
  lines.push('### Full Module Matrix');
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Click to expand full results matrix</summary>');
  lines.push('');

  // Get all unique modules in a consistent order
  const moduleOrder = MODULE_PATTERNS.map(([, name]) => name);
  const allModules = moduleOrder.filter((m) =>
    chains.some((c) => c.modules.some((mod) => mod.name === m)),
  );

  // Build matrix header
  const header = ['Chain', ...allModules];
  lines.push('| ' + header.join(' | ') + ' |');
  lines.push('|' + header.map(() => '---').join('|') + '|');

  // Build matrix rows
  for (const chain of chains) {
    const row = [chain.chainName];
    for (const moduleName of allModules) {
      const module = chain.modules.find((m) => m.name === moduleName);
      if (!module) {
        row.push('-');
      } else if (module.status === 'pass') {
        row.push(':white_check_mark:');
      } else if (module.status === 'fail') {
        row.push(':x:');
      } else {
        row.push(':fast_forward:');
      }
    }
    lines.push('| ' + row.join(' | ') + ' |');
  }

  lines.push('');
  lines.push('</details>');
  lines.push('');

  return lines.join('\n');
}

function generateConsoleSummary(chains: ChainResult[]): string {
  const lines: string[] = [];
  const separator = '='.repeat(60);
  const thinSeparator = '-'.repeat(60);

  lines.push('');
  lines.push(separator);
  lines.push('  AIRLOCK WHITELISTING TEST SUMMARY');
  lines.push(separator);
  lines.push('');

  for (const chain of chains) {
    const statusIcon =
      chain.failed > 0 ? '[FAIL]' : chain.skipReason ? '[SKIP]' : '[PASS]';

    lines.push(`  ${statusIcon} ${chain.chainName} (${chain.chainId})`);
    lines.push(
      `      Passed: ${chain.passed} | Failed: ${chain.failed} | Skipped: ${chain.skipped}`,
    );

    if (chain.skipReason) {
      lines.push(`      Reason: ${chain.skipReason}`);
    }

    if (chain.failed > 0) {
      lines.push(`      Failed modules:`);
      for (const module of chain.modules) {
        if (module.status === 'fail') {
          lines.push(`        - ${module.name}`);
        }
      }
    }

    lines.push(thinSeparator);
  }

  // Totals
  const totalPassed = chains.reduce((sum, c) => sum + c.passed, 0);
  const totalFailed = chains.reduce((sum, c) => sum + c.failed, 0);
  const totalSkipped = chains.reduce((sum, c) => sum + c.skipped, 0);

  lines.push('');
  lines.push(
    `  TOTAL: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`,
  );
  lines.push(separator);
  lines.push('');

  return lines.join('\n');
}

// Main execution
const args = process.argv.slice(2);
const jsonPath = args[0] || 'test-results.json';
const testChains = process.env.TEST_CHAINS || 'all';
const rpcDelay = process.env.RPC_DELAY_MS || '1000';

if (!fs.existsSync(jsonPath)) {
  console.error(`Error: JSON file not found: ${jsonPath}`);
  process.exit(1);
}

const chains = parseResults(jsonPath);
const markdownSummary = generateMarkdownSummary(chains, testChains, rpcDelay);
const consoleSummary = generateConsoleSummary(chains);

// Print console summary
console.log(consoleSummary);

// Write markdown to GitHub Step Summary if available
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdownSummary);
  console.log('Summary appended to GitHub Step Summary');
}

// Exit with failure if any tests failed
const totalFailed = chains.reduce((sum, c) => sum + c.failed, 0);
if (totalFailed > 0) {
  process.exit(1);
}
