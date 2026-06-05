/**
 * check 命令
 *
 * 检测项目中的问题。
 * npx omnivis check → 检测问题 → 输出报告
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import { autoDetectProject } from '../utils/autoDetect'
import { OmniDatabase, PrismaParser, GraphBuilder } from '@omnivis/analyzer'

export function checkCommand(program: Command): void {
  program
    .command('check')
    .description('Check project for consistency issues')
    .action(async () => {
      const spinner = ora('Checking project...').start()

      try {
        // 自动检测项目
        spinner.text = 'Detecting project structure...'
        const projectMeta = await autoDetectProject(process.cwd())

        // 初始化数据库
        const db = new OmniDatabase()
        await db.ready()

        // 创建图构建器
        const builder = new GraphBuilder(db)
        builder.registerParser(new PrismaParser())

        // 获取要解析的文件
        const files: string[] = []
        if (projectMeta.prismaSchemaPath) {
          files.push(projectMeta.prismaSchemaPath)
        }

        // 执行解析
        spinner.text = `Parsing ${files.length} files...`
        const result = await builder.parseFiles(files, {
          projectRoot: process.cwd(),
          projectMeta,
          tsConfig: null,
          pathAliases: {},
        })

        spinner.succeed(chalk.green('Check complete!'))

        // 输出统计信息
        console.log('')
        console.log(chalk.blue('Statistics:'))
        console.log(`  Nodes: ${result.stats.totalNodes}`)
        console.log(`  Edges: ${result.stats.totalEdges}`)
        console.log(`  Errors: ${result.stats.totalErrors}`)

        // 输出错误信息
        if (result.stats.totalErrors > 0) {
          console.log('')
          console.log(chalk.yellow('Warnings:'))
          const errors = db.getAllErrors()
          for (const error of errors) {
            const icon = error.severity === 'error' ? '❌' : '⚠️'
            console.log(`  ${icon} ${error.file}: ${error.message}`)
          }
        }

        // 关闭数据库
        db.close()
      } catch (err) {
        spinner.fail(chalk.red('Check failed'))
        console.error(err)
        process.exit(1)
      }
    })
}
