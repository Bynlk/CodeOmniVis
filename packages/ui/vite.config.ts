import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4322,
    proxy: {
      '/api': {
        target: 'http://localhost:4321',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4321',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('cytoscape')) {
            return 'vendor-cytoscape'
          }
          // 必须把 use-sync-external-store 与 react/react-dom/scheduler 归入同一块,
          // 否则其 CJS shim 顶部 `import { r as i } from "vendor-react"; var u = i;`
          // 会与 vendor-react 形成循环依赖:vendor-react 反过来又 import vendor 模块。
          // 浏览器按 modulepreload 顺序先求值 vendor,此时 vendor-react 尚未求值,
          // 其 export 绑定 `r` 拿到空 {exports:{}} 壳 -> shim 内 u.useState 抛 TypeError。
          if (
            id.includes('react-dom') ||
            id.includes('/react/') ||
            id.includes('scheduler') ||
            id.includes('use-sync-external-store')
          ) {
            return 'vendor-react'
          }
          if (id.includes('i18next')) {
            return 'vendor-i18n'
          }
          if (id.includes('@tanstack')) {
            return 'vendor-query'
          }
          return 'vendor'
        },
      },
    },
  },
})
