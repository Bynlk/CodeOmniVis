/**
 * @codeomnivis/cli — CLI 入口
 *
 * 使用 Commander.js 构建命令行工具。
 * 支持命令：serve, analyze, check, mcp, init
 */

import { createCliProgram } from './program'

void createCliProgram().parseAsync().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
