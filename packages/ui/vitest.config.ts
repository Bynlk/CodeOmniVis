import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    test: {
      setupFiles: ['./__tests__/setup.ts'],
    },
  }),
)
