import { defineConfig } from 'tsup'
import { resolve } from 'path'
import { glob } from 'glob'

// Get all TypeScript files except tests
const entryPoints = glob.sync('src/**/!(*.test|*.spec).ts', {
  ignore: ['src/test/**', '**/test/**']
})

export default defineConfig({
  entry: entryPoints,
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  clean: true,
  outDir: 'dist',
  treeshake: true,
  sourcemap: true,
  esbuildOptions(options) {
    options.alias = {
      '@': resolve(__dirname, './src')
    }
  },
  external: [
    'viem'
  ]
})