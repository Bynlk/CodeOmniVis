/**
 * check 命令
 *
 * 检测项目中的问题。
 * npx codeomnivis check → 检测问题 → 输出报告
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import * as path from 'path'
import { autoDetectProject } from '../utils/autoDetect'
import { getDbPath, loadConfig } from '@codeomnivis/shared/node'
import { OmniDatabase, ConsistencyChecker, runAnalysis } from '@codeomnivis/analyzer'

/**
 * LEAK-05 · F13:依赖注入点,测试可注入以观察异常路径下数据库句柄是否被释放。
 */
export interface CheckDeps {
  openDatabase: (dbPath: string) => OmniDatabase
  onProgress?: (message: string) => void
  /**
   * DUP-04 · F18:项目根目录注入点(默认当前工作目录)。
   * 取代此前散落的 process.cwd(),使扫描目录解析可测试且与 analyze 命令一致。
   */
  cwd?: string
}

const defaultCheckDeps: CheckDeps = {
  openDatabase: (dbPath: string): OmniDatabase => new OmniDatabase(dbPath),
}

/**
 * 执行一致性检测的核心逻辑。
 *
 * LEAK-05 · F13:数据库句柄在 try 之外打开,无论解析 / 检测过程是否抛错,
 * 都在 finally 中 close(),避免异常路径泄漏 sql.js 句柄。
 */
export async function runCheck(deps: CheckDeps = defaultCheckDeps): Promise<void> {
  const report = deps.onProgress ?? ((): void => {})

  // 加载配置 + 自动检测项目
  const projectRoot = path.resolve(deps.cwd ?? '.')
  report('Detecting project structure...')
  const config = loadConfig(projectRoot)
  const projectMeta = await autoDetectProject(projectRoot, config)

  // 初始化数据库(在 try 之外,确保 finally 始终能访问并关闭)
  const dbPath = getDbPath(projectRoot)
  const db = deps.openDatabase(dbPath)

  try {
    await db.ready()
    const result = await runAnalysis({
      projectRoot,
      dbPath,
      projectMeta,
      db,
      onFilesCollected: count => report(`Parsing ${count} files...`),
    })

    // 执行一致性检测
    report('Checking consistency...')
    const graph = db.loadGraph()
    const checker = new ConsistencyChecker()
    const consistencyReport = checker.check(graph)

    // 输出统计信息
    console.log('')
    console.log(chalk.blue('Statistics:'))
    console.log(`  Nodes: ${graph.nodes.length}`)
    console.log(`  Edges: ${graph.edges.length}`)
    console.log(`  Errors: ${result.errors}`)

    // 输出解析错误
    if (result.errors > 0) {
      console.log('')
      console.log(chalk.yellow('Parse Errors:'))
      const errors = db.getAllErrors()
      for (const error of errors) {
        const icon = error.severity === 'error' ? '❌' : '⚠️'
        console.log(`  ${icon} ${error.file}: ${error.message}`)
      }
    }

    // 输出一致性报告
    if (consistencyReport.issues.length > 0) {
      console.log('')
      console.log(chalk.blue('Consistency Issues:'))
      console.log(`  Total: ${consistencyReport.summary.total}`)
      console.log(`  Critical: ${consistencyReport.summary.critical}`)
      console.log(`  Warning: ${consistencyReport.summary.warning}`)
      console.log(`  Info: ${consistencyReport.summary.info}`)

      console.log('')
      for (const issue of consistencyReport.issues) {
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
  } finally {
    // LEAK-05 · F13:无论成功或异常,确保数据库句柄释放并持久化。
    db.close()
  }
}

export function checkCommand(program: Command): void {
  program
    .command('check')
    .description('Check project for consistency issues')
    .action(async () => {
      const spinner = ora('Checking project...').start()

      try {
        await runCheck({
          openDatabase: (dbPath: string): OmniDatabase => new OmniDatabase(dbPath),
          onProgress: (message: string): void => {
            spinner.text = message
          },
        })
        spinner.succeed(chalk.green('Check complete!'))
      } catch (err) {
        spinner.fail(chalk.red('Check failed'))
        console.error(err)
        process.exit(1)
      }
    })
}
