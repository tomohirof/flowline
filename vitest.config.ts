import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@resvg/resvg-wasm/index_bg.wasm': path.resolve(
        __dirname,
        'tests/helpers/mock-resvg-wasm.ts',
      ),
      '@resvg/resvg-wasm': path.resolve(__dirname, 'tests/helpers/mock-cf-resvg.ts'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
  },
})
