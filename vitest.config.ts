import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()], // Add the plugin to handle paths
  test: {
    sequence: {
      shuffle: false,
    },
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    retry: 0,
    testTimeout: 100000,
  },
});
