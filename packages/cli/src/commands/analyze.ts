/**
 * analyze 命令
 *
 * 分析项目并输出 JSON 结果。
 * npx codeomnivis analyze → 分析项目 → 输出 JSON
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'
import { autoDetectProject } from '../utils/autoDetect'
import { getDbPath, loadConfig } from '@codeomnivis/shared/node'
import { OmniDatabase, NPlusOneDetector, AuthDetector, RSCBoundaryDetector, analyzeProject } from '@codeomnivis/analyzer'

interface AnalyzeOptions {
  project?: string
  output: string
  json?: boolean
}

/**
 * LEAK-05 · F13:依赖注入点。openDatabase 默认创建真实 OmniDatabase,
 * 测试可注入以观察异常路径下数据库句柄是否被释放。onProgress 用于驱动 spinner 文案。
 */
export interface AnalyzeDeps {
  openDatabase: (dbPath: string) => OmniDatabase
  onProgress?: (message: string) => void
}

const defaultAnalyzeDeps: AnalyzeDeps = {
  openDatabase: (dbPath: string): OmniDatabase => new OmniDatabase(dbPath),
}

/**
 * 执行分析的核心逻辑。
 *
 * LEAK-05 · F13:数据库句柄在 try 之外打开,无论解析 / 连线 / 检测过程是否抛错,
 * 都在 finally 中 close(),避免异常路径泄漏 sql.js 句柄与未持久化数据。
 */
export async function runAnalyze(options: AnalyzeOptions, deps: AnalyzeDeps = defaultAnalyzeDeps): Promise<void> {
  const report = deps.onProgress ?? ((): void => {})

  // 加载配置 + 自动检测项目
  const projectRoot = path.resolve(options.project ?? '.')
  report('Detecting project structure...')
  const config = loadConfig(projectRoot)
  const projectMeta = await autoDetectProject(projectRoot, config)

  // 初始化数据库(在 try 之外,确保 finally 始终能访问并关闭)
  const dbPath = getDbPath(projectRoot)
  const db = deps.openDatabase(dbPath)

  try {
    await db.ready()
    const result = await analyzeProject({
      projectRoot,
      dbPath,
      projectMeta,
      db,
      onProgress: event => {
        if (event.filesScanned !== undefined) report(`Parsing ${event.filesScanned} files...`)
      },
    })
    const graph = result.snapshot.graph

    if (options.json) {
      process.stdout.write(`${JSON.stringify({
        data: result.snapshot,
        meta: {
          snapshotId: result.snapshot.snapshotId,
          snapshotDigest: result.snapshot.snapshotDigest,
        },
      })}\n`)
      return
    }

    // 6. 深度分析检测器
    const nPlusOneDetector = new NPlusOneDetector()
    const authDetector = new AuthDetector()
    const rscBoundaryDetector = new RSCBoundaryDetector()

    const allIssues = [
      ...nPlusOneDetector.detect(graph, projectRoot),
      ...authDetector.detect(graph, projectRoot),
      ...rscBoundaryDetector.detect(graph, projectRoot),
    ]

    // 输出统计信息
    console.log('')
    console.log(chalk.blue('Statistics:'))
    console.log(`  Nodes: ${graph.nodes.length}`)
    console.log(`  Edges: ${graph.edges.length}`)
    console.log(`  Errors: ${result.snapshot.parseErrors.length}`)

    // 跨层连线统计
    const crossLayerTypes = new Set(['calls_api', 'handles', 'calls_service', 'queries_db'])
    if (graph.edges.some(edge => crossLayerTypes.has(edge.type))) {
      const countEdge = (type: string): number => graph.edges.filter(edge => edge.type === type).length
      console.log('')
      console.log(chalk.blue('Cross-layer links:'))
      console.log(`  calls_api:      ${countEdge('calls_api')}`)
      console.log(`  handles:        ${countEdge('handles')}`)
      console.log(`  calls_service:  ${countEdge('calls_service')}`)
      console.log(`  queries_db:     ${countEdge('queries_db')}`)
    }

    // 输出 Issues
    if (allIssues.length > 0) {
      console.log('')
      console.log(chalk.red(`Issues Found: ${allIssues.length}`))
      const byType: Record<string, number> = {}
      for (const issue of allIssues) {
        byType[issue.type] = (byType[issue.type] || 0) + 1
      }
      for (const [type, count] of Object.entries(byType)) {
        const severity = allIssues.find(i => i.type === type)?.severity || 'info'
        const color = severity === 'critical' ? chalk.red : severity === 'warning' ? chalk.yellow : chalk.gray
        console.log(color(`  ${type}: ${count}`))
      }
      // 显示 critical issues 详情
      const criticals = allIssues.filter(i => i.severity === 'critical')
      if (criticals.length > 0) {
        console.log('')
        console.log(chalk.red('Critical issues:'))
        for (const issue of criticals.slice(0, 10)) {
          console.log(chalk.red(`  ⚠ ${issue.description}`))
          if (issue.locations[0]) {
            console.log(chalk.gray(`    at ${issue.locations[0].file}:${issue.locations[0].line}`))
          }
        }
        if (criticals.length > 10) {
          console.log(chalk.gray(`  ... and ${criticals.length - 10} more`))
        }
      }
    }

    // 输出 JSON（使用包含跨层结果的 graph）
    const json = JSON.stringify(graph, null, 2)

    if (options.output === '-') {
      console.log(json)
    } else {
      fs.writeFileSync(options.output, json, 'utf-8')
      console.log(chalk.gray(`\nGraph saved to ${options.output}`))
    }
  } finally {
    // LEAK-05 · F13:无论成功或异常,确保数据库句柄释放并持久化。
    db.close()
  }
}

export function analyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze project and output graph as JSON')
    .option('-p, --project <path>', 'Project root', '.')
    .option('-o, --output <file>', 'Output file path', 'codeomnivis-graph.json')
    .option('--json', 'Write the versioned snapshot envelope to stdout')
    .action(async (options: AnalyzeOptions) => {
      const spinner = ora('Analyzing project...').start()

      try {
        await runAnalyze(options, {
          openDatabase: (dbPath: string): OmniDatabase => new OmniDatabase(dbPath),
          onProgress: (message: string): void => {
            spinner.text = message
          },
        })
        spinner.succeed(chalk.green('Analysis complete!'))
      } catch (err) {
        spinner.fail(chalk.red('Analysis failed'))
        console.error(err)
        process.exit(1)
      }
    })
}
