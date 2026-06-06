/**
 * check 命令
 *
 * 检测项目中的问题。
 * npx omnivis check → 检测问题 → 输出报告
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'
import { autoDetectProject } from '../utils/autoDetect'
import { scanDirectory } from '../utils/scanDirectory'
import { getDbPath, loadConfig } from '@omnivis/shared'
import { OmniDatabase, PrismaParser, NextjsAppParser, NextjsPagesParser, TrpcParser, ExpressParser, TypeormParser, ApiCallsParser, ReactComponentParser, NestjsControllerParser, NestjsModuleParser, NestjsServiceParser, DrizzleParser, GraphBuilder, ConsistencyChecker } from '@omnivis/analyzer'

export function checkCommand(program: Command): void {
  program
    .command('check')
    .description('Check project for consistency issues')
    .action(async () => {
      const spinner = ora('Checking project...').start()

      try {
        // 加载配置 + 自动检测项目
        const projectRoot = path.resolve('.')
        spinner.text = 'Detecting project structure...'
        const config = loadConfig(projectRoot)
        const projectMeta = await autoDetectProject(projectRoot, config)

        // 初始化数据库
        const dbPath = getDbPath(projectRoot)
        const db = new OmniDatabase(dbPath)
        await db.ready()

        // 创建图构建器
        const builder = new GraphBuilder(db)
        builder.registerParsers([
          new PrismaParser(),
          new NextjsAppParser(),
          new NextjsPagesParser(),
          new TrpcParser(),
          new ExpressParser(),
          new TypeormParser(),
          new ApiCallsParser(),
          new ReactComponentParser(),
          new NestjsControllerParser(),
          new NestjsModuleParser(),
          new NestjsServiceParser(),
          new DrizzleParser(),
        ])

        // 获取要解析的文件
        const files: string[] = []

        // 添加 Prisma schema
        if (projectMeta.prismaSchemaPath) {
          files.push(projectMeta.prismaSchemaPath)
        }

        // 扫描项目中的 TypeScript/JavaScript 文件
        const scanDirs = ['app', 'src/app', 'pages', 'src/pages', 'components', 'src/components', 'server', 'src/server']
        for (const dir of scanDirs) {
          const fullPath = path.join(process.cwd(), dir)
          if (fs.existsSync(fullPath)) {
            const scanned = scanDirectory(fullPath, process.cwd())
            files.push(...scanned)
          }
        }

        // 执行解析
        spinner.text = `Parsing ${files.length} files...`
        const result = await builder.parseFiles(files, {
          projectRoot: process.cwd(),
          projectMeta,
          tsConfig: null,
          pathAliases: {},
        })

        // 执行一致性检测
        spinner.text = 'Checking consistency...'
        const graph = builder.loadGraph()
        const checker = new ConsistencyChecker()
        const report = checker.check(graph)

        spinner.succeed(chalk.green('Check complete!'))

        // 输出统计信息
        console.log('')
        console.log(chalk.blue('Statistics:'))
        console.log(`  Nodes: ${result.stats.totalNodes}`)
        console.log(`  Edges: ${result.stats.totalEdges}`)
        console.log(`  Errors: ${result.stats.totalErrors}`)

        // 输出解析错误
        if (result.stats.totalErrors > 0) {
          console.log('')
          console.log(chalk.yellow('Parse Errors:'))
          const errors = db.getAllErrors()
          for (const error of errors) {
            const icon = error.severity === 'error' ? '❌' : '⚠️'
            console.log(`  ${icon} ${error.file}: ${error.message}`)
          }
        }

        // 输出一致性报告
        if (report.issues.length > 0) {
          console.log('')
          console.log(chalk.blue('Consistency Issues:'))
          console.log(`  Total: ${report.summary.total}`)
          console.log(`  Critical: ${report.summary.critical}`)
          console.log(`  Warning: ${report.summary.warning}`)
          console.log(`  Info: ${report.summary.info}`)

          console.log('')
          for (const issue of report.issues) {
            const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : 'ℹ️'
            console.log(`  ${icon} [${issue.type}] ${issue.description}`)
            for (const loc of issue.locations) {
              console.log(`     at ${loc.file}:${loc.line}`)
            }
          }
        } else {
          console.log('')
          console.log(chalk.green('✅ No consistency issues found'))
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
