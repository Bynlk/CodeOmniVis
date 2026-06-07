/**
 * init 命令
 *
 * 生成 CodeOmniVis 配置文件。
 * npx codeomnivis init → 生成 .codeomnivis.json
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Generate CodeOmniVis configuration file')
    .action(async () => {
      const spinner = ora('Generating configuration...').start()

      try {
        const fs = await import('fs')
        const path = await import('path')

        const configPath = path.join(process.cwd(), '.codeomnivis.json')

        // 检查是否已存在
        if (fs.existsSync(configPath)) {
          spinner.warn(chalk.yellow('Configuration file already exists'))
          return
        }

        // 默认配置
        const config = {
          $schema: 'https://codeomnivis.dev/schema.json',
          version: '0.0.1',
          exclude: ['node_modules', 'dist', '.git', '.next'],
          parsers: {
            prisma: {
              enabled: true,
            },
            nextjs: {
              enabled: true,
            },
            trpc: {
              enabled: true,
            },
          },
          server: {
            port: 4321,
            host: 'localhost',
          },
        }

        // 写入配置文件
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

        spinner.succeed(chalk.green('Configuration file generated!'))
        console.log(chalk.gray(`\nCreated: ${configPath}`))
        console.log(chalk.gray('Edit this file to customize CodeOmniVis behavior.'))
      } catch (err) {
        spinner.fail(chalk.red('Failed to generate configuration'))
        console.error(err)
        process.exit(1)
      }
    })
}
