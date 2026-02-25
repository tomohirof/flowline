import { defineConfig, type Plugin } from 'vitest/config'
import path from 'path'

/** Redirect all .wasm imports to a mock module in tests */
function wasmMockPlugin(): Plugin {
  const mockPath = path.resolve(__dirname, 'tests/helpers/mock-resvg-wasm.ts')
  return {
    name: 'wasm-mock',
    enforce: 'pre',
    resolveId(source) {
      if (source.endsWith('.wasm')) {
        return mockPath
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [wasmMockPlugin()],
  define: {
    __GIT_HASH__: JSON.stringify('test-hash'),
    __APP_VERSION__: JSON.stringify('0.0.0'),
  },
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
