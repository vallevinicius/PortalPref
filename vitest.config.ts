import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
    },
  },
  test: {
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    include: ['tests/**/*.test.ts'],
  },
})
