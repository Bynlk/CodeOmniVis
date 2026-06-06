/**
 * mcp 命令
 *
 * 启动 MCP Server。
 * npx omnivis mcp → 启动 MCP Server
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'

export function mcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start MCP Server for AI assistant integration')
    .action(async () => {
      const spinner = ora('Starting MCP Server...').start()

      try {
        // 动态导入 MCP 包
        const mcp = await import('@omnivis/mcp')

        spinner.succeed(chalk.green('MCP Server started'))
        console.log(chalk.gray('\nListening on stdio transport'))
        console.log(chalk.gray('Press Ctrl+C to stop'))

        // MCP Server 会阻塞进程（通过 stdio transport）
      } catch (err) {
        spinner.fail(chalk.red('Failed to start MCP Server'))
        console.error(err)
        process.exit(1)
      }
    })
}
