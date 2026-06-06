/**
 * analyze 命令
 *
 * 分析项目并输出 JSON 结果。
 * npx omnivis analyze → 分析项目 → 输出 JSON
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'
import { autoDetectProject, findTsConfig } from '../utils/autoDetect'
import { scanDirectory } from '../utils/scanDirectory'
import { getDbPath, loadConfig } from '@omnivis/shared'
import { OmniDatabase, PrismaParser, NextjsAppParser, NextjsPagesParser, TrpcParser, ExpressParser, TypeormParser, ApiCallsParser, ReactComponentParser, NestjsControllerParser, NestjsModuleParser, NestjsServiceParser, DrizzleParser, GraphBuilder, CrossLayerLinker } from '@omnivis/analyzer'

export function analyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze project and output graph as JSON')
    .option('-o, --output <file>', 'Output file path', 'omnivis-graph.json')
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

        // 跨层连线
        const tsConfigPath = findTsConfig(process.cwd())
        const linker = new CrossLayerLinker(tsConfigPath)
        const graph = builder.loadGraph()
        const crossLayerResult = await linker.link(graph)

        // 将跨层边加入 graph 并保存到数据库
        graph.edges.push(...crossLayerResult.edges)
        if (crossLayerResult.edges.length > 0) {
          db.upsertEdges(crossLayerResult.edges)
        }
        // linker.link 可能向 graph.nodes 中添加了 synthetic 节点
        const syntheticNodes = graph.nodes.filter(n => (n.metadata as any)?.isSynthetic)
        if (syntheticNodes.length > 0) {
          db.upsertNodes(syntheticNodes)
        }

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
