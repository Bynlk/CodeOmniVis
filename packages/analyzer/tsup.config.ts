import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  external: ['ts-morph', 'typescript', '@prisma/internals'],
  onSuccess: async () => {
    const source = resolve(process.cwd(), 'src/parsers/kotlin/wasm')
    const destination = resolve(process.cwd(), 'dist/wasm')
    if (!existsSync(source)) throw new Error(`Kotlin parser assets not found: ${source}`)
    cpSync(source, destination, { recursive: true })
    console.log(`[bundle-assets] ${source} -> ${destination}`)
  },
})
