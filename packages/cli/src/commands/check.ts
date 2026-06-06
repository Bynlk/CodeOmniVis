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
import { OmniDatabase, PrismaParser, NextjsAppParser, NextjsPagesParser, TrpcParser, ExpressParser, TypeormParser, ApiCallsParser, ReactComponentParser, GraphBuilder, ConsistencyChecker } from '@omnivis/analyzer'

/**
 * 递归扫描目录，返回所有 TypeScript/JavaScript 文件
 */
function scanDirectory(dir: string, rootDir: string): string[] {
  const files: string[] = []
  const extensions = ['.ts', '.tsx', '.js', '.jsx']
  const ignoreDirs = ['node_modules', '.next', 'dist', 'build', '.git']

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) {
          files.push(...scanDirectory(fullPath, rootDir))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (extensions.includes(ext)) {
          files.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'))
        }
      }
    }
  } catch (err) {
    // 忽略无法读取的目录
  }

  return files
}

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
        builder.registerParsers([
          new PrismaParser(),
          new NextjsAppParser(),
          new NextjsPagesParser(),
          new TrpcParser(),
          new ExpressParser(),
          new TypeormParser(),
          new ApiCallsParser(),
          new ReactComponentParser(),
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
          console.log(`  Total: ${report.stats.totalIssues}`)
          console.log(`  Critical: ${report.stats.criticalCount}`)
          console.log(`  Warning: ${report.stats.warningCount}`)
          console.log(`  Info: ${report.stats.infoCount}`)

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
