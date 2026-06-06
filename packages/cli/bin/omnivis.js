#!/usr/bin/env node

/**
 * OmniVis CLI 入口
 *
 * 这个文件是 npm bin 的入口点。
 * 它会加载编译后的 CLI 代码。
 */

import('../dist/index.js').catch((err) => {
  console.error('Failed to load OmniVis CLI:', err)
  process.exit(1)
})
