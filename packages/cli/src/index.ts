/**
 * @omnivis/cli — CLI 入口
 *
 * 使用 Commander.js 构建命令行工具。
 * 支持命令：serve, analyze, check, mcp, init
 */

import { Command } from 'commander'
import { serveCommand } from './commands/serve'
import { analyzeCommand } from './commands/analyze'
import { checkCommand } from './commands/check'
import { initCommand } from './commands/init'

// ============================================================
// CLI 程序
// ============================================================

const program = new Command()

program
  .name('omnivis')
  .description('Full-stack architecture visualizer for TypeScript projects')
  .version('0.0.1')

// 注册命令
serveCommand(program)
analyzeCommand(program)
checkCommand(program)
initCommand(program)

// 解析命令行参数
program.parse()
