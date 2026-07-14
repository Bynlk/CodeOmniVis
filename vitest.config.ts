import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      all: true,
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/dist/**',
        '**/__tests__/**',
        '**/fixtures/**',
        '**/wasm/**',
      ],
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 80,
      },
    },
  },
})
