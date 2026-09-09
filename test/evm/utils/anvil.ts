/**
 * Anvil process manager for local fork testing
 *
 * Provides utilities to spawn and manage Anvil instances for each chain.
 * Anvil is Foundry's local Ethereum node for testing.
 *
 * Usage:
 *   const manager = new AnvilManager()
 *   await manager.start(CHAIN_IDS.BASE)
 *   const rpcUrl = manager.getRpcUrl(CHAIN_IDS.BASE)
 *   await manager.stop(CHAIN_IDS.BASE)
 */

import { type ChildProcess, spawn } from 'child_process';
import { CHAIN_IDS } from '../../../src/evm';
import { loadTestEnv } from './env';

loadTestEnv();

/** Default Anvil mnemonic - generates the same accounts every time */
export const ANVIL_MNEMONIC =
  'test test test test test test test test test test test junk';

/** Pre-funded accounts from Anvil's default mnemonic (10,000 ETH each) */
export const ANVIL_ACCOUNTS = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const,
    privateKey:
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const,
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const,
    privateKey:
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const,
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as const,
    privateKey:
      '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as const,
  },
  {
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const,
    privateKey:
      '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' as const,
  },
  {
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' as const,
    privateKey:
      '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a' as const,
  },
] as const;

/** Port allocation per chain */
const CHAIN_PORTS: Record<number, number> = {
  [CHAIN_IDS.BASE]: 8545,
  [CHAIN_IDS.BASE_SEPOLIA]: 8546,
  [CHAIN_IDS.MONAD_MAINNET]: 8547,
  [CHAIN_IDS.MAINNET]: 8548,
  [CHAIN_IDS.ARBITRUM]: 8550,
};

/** Fork RPC URLs for each chain */
function getForkUrl(chainId: number): string | undefined {
  const alchemyKey = process.env.ALCHEMY_API_KEY;

  switch (chainId) {
    case CHAIN_IDS.MAINNET:
      return (
        process.env.ETH_MAINNET_RPC_URL ||
        process.env.MAINNET_RPC_URL ||
        (alchemyKey
          ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
          : undefined)
      );
    case CHAIN_IDS.ARBITRUM:
      return (
        process.env.ARBITRUM_RPC_URL ||
        (alchemyKey
          ? `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`
          : undefined)
      );
    case CHAIN_IDS.BASE:
      return (
        process.env.BASE_RPC_URL ||
        (alchemyKey
          ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`
          : undefined)
      );
    case CHAIN_IDS.BASE_SEPOLIA:
      return (
        process.env.BASE_SEPOLIA_RPC_URL ||
        (alchemyKey
          ? `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`
          : undefined)
      );
    case CHAIN_IDS.MONAD_MAINNET:
      return alchemyKey
        ? `https://monad-mainnet.g.alchemy.com/v2/${alchemyKey}`
        : undefined;
    default:
      return undefined;
  }
}

/** Options for starting an Anvil instance */
export interface AnvilOptions {
  /** Port to run on (defaults to chain-specific port) */
  port?: number;
  /** Fork block number (defaults to latest) */
  forkBlockNumber?: bigint;
  /** Number of accounts to generate */
  accounts?: number;
  /** Initial balance per account in ETH */
  balance?: number;
  /** Gas limit */
  gasLimit?: bigint;
  /** Chain ID to use */
  chainId?: number;
  /** Silent mode - suppress Anvil output */
  silent?: boolean;
}

/** State of an Anvil instance */
interface AnvilInstance {
  process: ChildProcess;
  port: number;
  chainId: number;
  rpcUrl: string;
  forkUrl: string;
}

/**
 * Manager for Anvil instances
 *
 * Handles spawning, health checking, and cleanup of Anvil processes.
 */
export class AnvilManager {
  private instances: Map<number, AnvilInstance> = new Map();
  private healthCheckTimeout = 30_000; // 30 seconds
  private healthCheckInterval = 500; // 500ms between checks

  /**
   * Start an Anvil instance for the specified chain
   */
  async start(chainId: number, options: AnvilOptions = {}): Promise<string> {
    if (this.instances.has(chainId)) {
      return this.instances.get(chainId)!.rpcUrl;
    }

    const forkUrl = getForkUrl(chainId);
    if (!forkUrl) {
      throw new Error(
        `No fork URL available for chain ${chainId}. Set ALCHEMY_API_KEY or chain-specific RPC URL.`,
      );
    }

    const port = options.port ?? CHAIN_PORTS[chainId] ?? 8545 + chainId;
    const rpcUrl = `http://127.0.0.1:${port}`;

    const args = [
      '--fork-url',
      forkUrl,
      '--port',
      String(port),
      '--accounts',
      String(options.accounts ?? 10),
      '--balance',
      String(options.balance ?? 10000),
      '--mnemonic',
      ANVIL_MNEMONIC,
    ];

    if (options.forkBlockNumber) {
      args.push('--fork-block-number', String(options.forkBlockNumber));
    }

    if (options.gasLimit) {
      args.push('--gas-limit', String(options.gasLimit));
    }

    if (options.chainId) {
      args.push('--chain-id', String(options.chainId));
    }

    const silent = options.silent ?? !process.env.ANVIL_DEBUG;

    const anvilProcess = spawn('anvil', args, {
      stdio: silent ? 'pipe' : 'inherit',
      detached: false,
    });

    // Capture stderr for error reporting
    let stderrOutput = '';
    if (silent && anvilProcess.stderr) {
      anvilProcess.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });
    }

    // Handle process errors
    anvilProcess.on('error', (err) => {
      console.error(`Anvil process error for chain ${chainId}:`, err);
      this.instances.delete(chainId);
    });

    anvilProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(
          `Anvil process exited with code ${code} for chain ${chainId}`,
        );
        if (stderrOutput) {
          console.error('Stderr:', stderrOutput);
        }
      }
      this.instances.delete(chainId);
    });

    const instance: AnvilInstance = {
      process: anvilProcess,
      port,
      chainId,
      rpcUrl,
      forkUrl,
    };

    this.instances.set(chainId, instance);

    // Wait for Anvil to be ready
    await this.waitForReady(rpcUrl, chainId);

    return rpcUrl;
  }

  /**
   * Wait for Anvil to be ready to accept connections
   */
  private async waitForReady(rpcUrl: string, chainId: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.healthCheckTimeout) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_chainId',
            params: [],
            id: 1,
          }),
        });

        if (response.ok) {
          const json = await response.json();
          if (json.result) {
            return; // Anvil is ready
          }
        }
      } catch {
        // Anvil not ready yet, continue waiting
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.healthCheckInterval),
      );
    }

    // Cleanup on timeout
    await this.stop(chainId);
    throw new Error(
      `Anvil failed to start for chain ${chainId} within ${this.healthCheckTimeout}ms`,
    );
  }

  /**
   * Stop an Anvil instance
   */
  async stop(chainId: number): Promise<void> {
    const instance = this.instances.get(chainId);
    if (!instance) return;

    return new Promise((resolve) => {
      instance.process.on('exit', () => {
        this.instances.delete(chainId);
        resolve();
      });

      instance.process.kill('SIGTERM');

      // Force kill after 5 seconds if graceful shutdown fails
      setTimeout(() => {
        if (this.instances.has(chainId)) {
          instance.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Stop all running Anvil instances
   */
  async stopAll(): Promise<void> {
    const chainIds = Array.from(this.instances.keys());
    await Promise.all(chainIds.map((chainId) => this.stop(chainId)));
  }

  /**
   * Get the RPC URL for a running Anvil instance
   */
  getRpcUrl(chainId: number): string | undefined {
    return this.instances.get(chainId)?.rpcUrl;
  }

  /**
   * Check if an Anvil instance is running for a chain
   */
  isRunning(chainId: number): boolean {
    return this.instances.has(chainId);
  }

  /**
   * Get all running chain IDs
   */
  getRunningChains(): number[] {
    return Array.from(this.instances.keys());
  }
}

/** Singleton instance for global access */
let globalAnvilManager: AnvilManager | undefined;

/**
 * Get the global Anvil manager instance
 */
export function getAnvilManager(): AnvilManager {
  if (!globalAnvilManager) {
    globalAnvilManager = new AnvilManager();
  }
  return globalAnvilManager;
}

/**
 * Check if Anvil fork mode is enabled
 */
export function isAnvilForkEnabled(): boolean {
  return process.env.ANVIL_FORK_ENABLED === 'true';
}

/**
 * Get port for a chain
 */
export function getAnvilPort(chainId: number): number {
  return CHAIN_PORTS[chainId] ?? 8545 + chainId;
}
