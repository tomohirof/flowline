import { defineConfig, type Plugin } from 'vitest/config'
import path from 'path'

/** Redirect all .wasm imports to a mock module in tests */
function wasmMockPlugin(): Plugin {
  const mockPath = path.resolve(__dirname, 'tests/helpers/mock-resvg-wasm.ts')
  return {
    name: 'wasm-mock',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.endsWith('.wasm')) {
        return mockPath
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [wasmMockPlugin()],
  resolve: {
    alias: {
      '@resvg/resvg-wasm': path.resolve(__dirname, 'tests/helpers/mock-cf-resvg.ts'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
  },
})
