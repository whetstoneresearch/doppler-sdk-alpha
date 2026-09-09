/**
 * Global test setup - runs once before all tests
 *
 * Cleans up any stale Anvil processes from previous test runs
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Known Anvil ports used by tests (from test/utils/anvil.ts)
const ANVIL_PORTS = [8545, 8546, 8547, 8548, 8549, 8550, 8551]

async function killAnvilOnPort(port: number): Promise<void> {
  try {
    // Find and kill any process on this port
    await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`)
  } catch {
    // Ignore errors - process may not exist
  }
}

export async function setup(): Promise<void> {
  // Kill any stale Anvil processes on known ports
  await Promise.all(ANVIL_PORTS.map(killAnvilOnPort))

  // Also kill any anvil processes by name
  try {
    await execAsync('pkill -9 anvil 2>/dev/null || true')
  } catch {
    // Ignore errors
  }

  // Brief pause to ensure ports are released
  await new Promise((resolve) => setTimeout(resolve, 500))
}

export default setup
