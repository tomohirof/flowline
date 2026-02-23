import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@cf-wasm/resvg/workerd': path.resolve(__dirname, 'tests/helpers/mock-cf-resvg.ts'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
  },
})
