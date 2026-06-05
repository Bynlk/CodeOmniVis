/**
 * serve 命令
 *
 * 启动 Web 服务并自动检测项目。
 * npx omnivis serve → 启动服务器 → 打开浏览器
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import { autoDetectProject } from '../utils/autoDetect'
import { createOmniServer } from '@omnivis/server'

export function serveCommand(program: Command): void {
  program
    .command('serve')
    .description('Start OmniVis server and visualize your project')
    .option('-p, --port <port>', 'Server port', '4321')
    .option('-h, --host <host>', 'Server host', 'localhost')
    .option('--no-open', 'Do not open browser automatically')
    .action(async (options) => {
      const spinner = ora('Starting OmniVis server...').start()

      try {
        // 自动检测项目
        spinner.text = 'Detecting project structure...'
        const projectMeta = await autoDetectProject(process.cwd())

        spinner.text = 'Starting server...'

        // 创建服务器
        const server = createOmniServer({
          port: parseInt(options.port, 10),
          host: options.host,
        })

        // 启动服务器
        await server.start()

        spinner.succeed(chalk.green(`Server running at http://${options.host}:${options.port}`))

        // 显示项目信息
        console.log('')
        console.log(chalk.blue('Project detected:'))
        console.log(`  Frontend: ${projectMeta.frontendFramework}`)
        console.log(`  Backend:  ${projectMeta.backendFramework}`)
        console.log(`  Database: ${projectMeta.databaseType}`)

        // 打开浏览器
        if (options.open) {
          const open = (await import('open')).default
          await open(`http://${options.host}:${options.port}`)
          console.log(chalk.gray('\nBrowser opened automatically'))
        }

        console.log(chalk.gray('\nPress Ctrl+C to stop the server'))

        // 保持进程运行
        process.on('SIGINT', async () => {
          console.log(chalk.gray('\nShutting down...'))
          await server.stop()
          process.exit(0)
        })

        // 阻塞主线程
        await new Promise(() => {})
      } catch (err) {
        spinner.fail(chalk.red('Failed to start server'))
        console.error(err)
        process.exit(1)
      }
    })
}
