#!/usr/bin/env node

/**
 * CodeOmniVis CLI 入口
 *
 * 这个文件是 npm bin 的入口点。
 * 它会加载编译后的 CLI 代码。
 */

import('../dist/index.js').catch((err) => {
  console.error('Failed to load CodeOmniVis CLI:', err)
  process.exit(1)
})
