/**
 * serve 命令
 *
 * 启动 Web 服务并自动检测项目。
 * npx codeomnivis serve → 启动服务器 → 分析项目 → 打开浏览器
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'
import { autoDetectProject, findTsConfig, collectScanDirs } from '../utils/autoDetect'
import { scanDirectory } from '../utils/scanDirectory'
import { createOmniServer } from '@codeomnivis/server'
import { getDbPath, loadConfig } from '@codeomnivis/shared/node'
import { PrismaParser, NextjsAppParser, NextjsPagesParser, TrpcParser, TsRpcParser, ExpressParser, TypeormParser, ApiCallsParser, ReactComponentParser, NestjsControllerParser, NestjsModuleParser, NestjsServiceParser, DrizzleParser, GraphBuilder, CrossLayerLinker } from '@codeomnivis/analyzer'

export function serveCommand(program: Command): void {
  program
    .command('serve')
    .description('Start CodeOmniVis server and visualize your project')
    .option('-p, --port <port>', 'Server port', '4321')
    .option('-h, --host <host>', 'Server host', 'localhost')
    .option('--project <path>', 'Project root path', '.')
    .option('--no-open', 'Do not open browser automatically')
    .action(async (options) => {
      const spinner = ora('Starting CodeOmniVis server...').start()

      try {
        // 加载配置 + 自动检测项目
        spinner.text = 'Detecting project structure...'
        const projectRoot = path.resolve(options.project ?? '.')
        const config = loadConfig(projectRoot)
        const projectMeta = await autoDetectProject(projectRoot, config)

        // 提示配置文件状态
        const configPath = path.join(projectRoot, '.codeomnivis.json')
        if (fs.existsSync(configPath)) {
          console.log(chalk.gray('Configuration loaded from .codeomnivis.json'))
        }

        // 创建服务器
        spinner.text = 'Starting server...'
        const dbPath = getDbPath(projectRoot)
        const server = createOmniServer({
          port: parseInt(options.port, 10),
          host: options.host,
          dbPath,
          projectRoot,
        })

        // 启动服务器
        await server.start()

        // 自动分析项目
        spinner.text = 'Analyzing project...'
        const builder = new GraphBuilder(server.db)
        builder.registerParsers([
          new PrismaParser(),
          new NextjsAppParser(),
          new NextjsPagesParser(),
          new TrpcParser(),
          new TsRpcParser(),
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
        if (files.length > 0) {
          console.log(chalk.gray(`\nScanning ${files.length} files...`))

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

          if (crossLayerResult.edges.length > 0) {
            server.db.upsertEdges(crossLayerResult.edges)
          }
          // 将跨层连线产生的 synthetic 节点写入 DB
          const syntheticNodes = graph.nodes.filter(n => 'isSynthetic' in n.metadata && (n.metadata as { isSynthetic?: boolean }).isSynthetic)
          if (syntheticNodes.length > 0) {
            server.db.upsertNodes(syntheticNodes)
          }

          // 从 DB 加载最终图（包含所有节点和边）
          const finalGraph = server.db.loadGraph()

          spinner.succeed(chalk.green(`Server running at http://${options.host}:${options.port}`))

          // 显示统计
          console.log('')
          console.log(chalk.blue('Analysis results:'))
          console.log(`  Files scanned: ${files.length}`)
          console.log(`  Nodes: ${finalGraph.nodes.length}`)
          console.log(`  Edges: ${finalGraph.edges.length}`)

          // 跨层连线统计
          if (crossLayerResult.edges.length > 0) {
            console.log('')
            console.log(chalk.blue('Cross-layer links:'))
            console.log(`  calls_api:      ${crossLayerResult.stats.callsApiEdges}`)
            console.log(`  handles:        ${crossLayerResult.stats.handlesEdges}`)
            console.log(`  calls_service:  ${crossLayerResult.stats.callsServiceEdges}`)
            console.log(`  queries_db:     ${crossLayerResult.stats.queriesDbEdges}`)
          }

          // 显示节点类型分布
          if (Object.keys(result.stats.nodesByType).length > 0) {
            console.log('')
            console.log(chalk.blue('Node types:'))
            for (const [type, count] of Object.entries(result.stats.nodesByType)) {
              console.log(`  ${type}: ${count}`)
            }
          }

          if (result.stats.totalErrors > 0) {
            console.log(`\n  Errors: ${result.stats.totalErrors}`)
          }
        } else {
          spinner.succeed(chalk.green(`Server running at http://${options.host}:${options.port}`))
          console.log(chalk.yellow('\nNo Prisma schema found. Place your schema.prisma in the project root.'))
        }

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
