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
import { autoDetectProject, findTsConfig, collectScanDirs } from '../utils/autoDetect'
import { scanDirectory } from '../utils/scanDirectory'
import { getDbPath, loadConfig } from '@codeomnivis/shared/node'
import { OmniDatabase, PrismaParser, NextjsAppParser, NextjsPagesParser, TrpcParser, ExpressParser, TypeormParser, ApiCallsParser, ReactComponentParser, NestjsControllerParser, NestjsModuleParser, NestjsServiceParser, DrizzleParser, GraphBuilder, CrossLayerLinker, NPlusOneDetector, AuthDetector, RSCBoundaryDetector } from '@codeomnivis/analyzer'

export function analyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze project and output graph as JSON')
    .option('-o, --output <file>', 'Output file path', 'codeomnivis-graph.json')
    .action(async (options) => {
      const spinner = ora('Analyzing project...').start()

      try {
        // 加载配置 + 自动检测项目
        const projectRoot = path.resolve(options.project ?? '.')
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

        // 添加 tRPC router 文件
        if (projectMeta.trpcRouterPaths && projectMeta.trpcRouterPaths.length > 0) {
          files.push(...projectMeta.trpcRouterPaths)
        }

        // 扫描项目中的 TypeScript/JavaScript 文件
        const scanDirs = collectScanDirs(projectRoot, config)
        for (const dir of scanDirs) {
          if (fs.existsSync(dir)) {
            const scanned = scanDirectory(dir, projectRoot)
            files.push(...scanned)
          }
        }

        // 执行解析
        spinner.text = `Parsing ${files.length} files...`
        const result = await builder.parseFiles(files, {
          projectRoot,
          projectMeta,
          tsConfig: null,
          pathAliases: {},
        })

        // 跨层连线
        const tsConfigPath = findTsConfig(projectRoot)
        const linker = new CrossLayerLinker(tsConfigPath)
        const graph = builder.loadGraph()
        const crossLayerResult = await linker.link(graph)

        // 将跨层边加入 graph 并保存到数据库
        graph.edges.push(...crossLayerResult.edges)
        if (crossLayerResult.edges.length > 0) {
          db.upsertEdges(crossLayerResult.edges)
        }
        // linker.link 可能向 graph.nodes 中添加了 synthetic 节点
        const syntheticNodes = graph.nodes.filter(n => 'isSynthetic' in n.metadata && (n.metadata as { isSynthetic?: boolean }).isSynthetic)
        if (syntheticNodes.length > 0) {
          db.upsertNodes(syntheticNodes)
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

        spinner.succeed(chalk.green('Analysis complete!'))

        // 输出统计信息
        const totalEdges = result.stats.totalEdges + crossLayerResult.edges.length
        console.log('')
        console.log(chalk.blue('Statistics:'))
        console.log(`  Nodes: ${graph.nodes.length}`)
        console.log(`  Edges: ${totalEdges}`)
        console.log(`  Errors: ${result.stats.totalErrors}`)

        // 跨层连线统计
        if (crossLayerResult.edges.length > 0) {
          console.log('')
          console.log(chalk.blue('Cross-layer links:'))
          console.log(`  calls_api:      ${crossLayerResult.stats.callsApiEdges}`)
          console.log(`  handles:        ${crossLayerResult.stats.handlesEdges}`)
          console.log(`  calls_service:  ${crossLayerResult.stats.callsServiceEdges}`)
          console.log(`  queries_db:     ${crossLayerResult.stats.queriesDbEdges}`)
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

        // 关闭数据库
        db.close()
      } catch (err) {
        spinner.fail(chalk.red('Analysis failed'))
        console.error(err)
        process.exit(1)
      }
    })
}
