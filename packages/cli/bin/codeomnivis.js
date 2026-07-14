#!/usr/bin/env node

/**
 * CodeOmniVis CLI 入口
 *
 * 这个文件是 npm bin 的入口点。
 * 它会加载编译后的 CLI 代码。
 */

import('../dist/index.js')
  .then(module => {
    // Development tests may intentionally execute against an older dist build,
    // whose import side effect already starts the CLI and has no runCli export.
    if (typeof module.runCli === 'function') return module.runCli()
  })
  .catch((err) => {
    console.error('Failed to load CodeOmniVis CLI:', err)
    process.exit(1)
  })
