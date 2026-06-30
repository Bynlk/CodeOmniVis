import { defineConfig } from 'tsup'
import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 自包含 CLI 打包配置。
 *
 * - noExternal 内联所有 workspace 包(@codeomnivis/*),消除发布时 `workspace:*` 断点;
 *   第三方依赖保持 external,由 CLI package.json 的 dependencies 在安装时解析。
 * - onSuccess 把 UI 产物与 tree-sitter Kotlin wasm 拷进 dist,使 `dist/` 自包含:
 *   - dist/ui   ← packages/ui/dist(serve 命令以 import.meta.url 定位)
 *   - dist/wasm ← analyzer Kotlin wasm(内联后的 analyzer 代码用 __dirname/wasm 读取)
 *   sql.js 的 wasm 仍随其 npm 包解析(sql.js 保持 external)。
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  noExternal: [/^@codeomnivis\//],
  onSuccess: async () => {
    const pkgDir = process.cwd()
    const copies: Array<[string, string]> = [
      [resolve(pkgDir, '../ui/dist'), resolve(pkgDir, 'dist/ui')],
      [resolve(pkgDir, '../analyzer/src/parsers/kotlin/wasm'), resolve(pkgDir, 'dist/wasm')],
    ]
    for (const [src, dest] of copies) {
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true })
        console.log(`[bundle-assets] ${src} -> ${dest}`)
      } else {
        console.warn(`[bundle-assets] missing: ${src}`)
      }
    }
  },
})
