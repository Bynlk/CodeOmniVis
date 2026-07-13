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
import { fileURLToPath } from 'url'
import { autoDetectProject } from '../utils/autoDetect'
import { validateProjectRoot } from '../utils/validateProjectRoot'
import { createOmniServer, isLoopbackHost } from '@codeomnivis/server'
import { getDbPath, loadConfig } from '@codeomnivis/shared/node'

/**
 * 解析自包含 UI 产物目录。
 * 打包后 CLI 与 UI 同处 dist/(dist/index.js + dist/ui),故 ui 位于 import.meta.url 同级的 ./ui。
 * 该目录不存在时(如开发态)回退到 monorepo 内的 packages/ui/dist,由 server 默认值兜底。
 */
function resolveUiDistPath(): string | undefined {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const bundled = path.join(here, 'ui')
  if (fs.existsSync(bundled)) return bundled
  return undefined
}

interface ServeOptions {
  port: string
  host: string
  project?: string
  open: boolean
  token?: string
}

export function serveCommand(program: Command): void {
  program
    .command('serve')
    .description('Start CodeOmniVis server and visualize your project')
    .option('-p, --port <port>', 'Server port', '4321')
    .option('-h, --host <host>', 'Server host', 'localhost')
    .option('--project <path>', 'Project root path', '.')
    .option('--no-open', 'Do not open browser automatically')
    .option('--token <token>', 'Access token required for mutating endpoints when binding to a non-loopback host')
    .action(async (options: ServeOptions) => {
      const spinner = ora('Starting CodeOmniVis server...').start()

      try {
        // 加载配置 + 自动检测项目
        spinner.text = 'Detecting project structure...'
        const projectRoot = validateProjectRoot(options.project ?? '.')
        const config = loadConfig(projectRoot)
        const projectMeta = await autoDetectProject(projectRoot, config)

        // 提示配置文件状态
        const configPath = path.join(projectRoot, '.codeomnivis.json')
        if (fs.existsSync(configPath)) {
          console.log(chalk.gray('Configuration loaded from .codeomnivis.json'))
        }

        // S-07:绑定到非 loopback 地址时,必须显式提供访问 token,
        // 否则 mutating endpoints 在公网/局域网将无鉴权暴露。
        const accessToken = options.token ?? process.env.CODEOMNIVIS_TOKEN
        if (!isLoopbackHost(options.host) && (accessToken === undefined || accessToken === '')) {
          spinner.fail(chalk.red('Refusing to bind to a non-loopback host without an access token'))
          console.error(
            chalk.yellow(
              `Host "${options.host}" is not loopback. Provide --token <token> or set CODEOMNIVIS_TOKEN ` +
                'to protect mutating endpoints (/api/analyze, /api/project, DELETE /api/graph).'
            )
          )
          process.exit(1)
        }

        // 创建服务器
        spinner.text = 'Starting server...'
        const dbPath = getDbPath(projectRoot)
        const server = createOmniServer({
          port: parseInt(options.port, 10),
          host: options.host,
          dbPath,
          projectRoot,
          projectMeta,
          detectProjectMeta: async root => autoDetectProject(root, loadConfig(root)),
          uiDistPath: resolveUiDistPath(),
          accessToken,
        })

        // 启动服务器
        await server.start()

        // 自动分析项目
        spinner.text = 'Analyzing project...'
        let filesScanned = 0
        await server.analyze(count => {
          filesScanned = count
          spinner.text = `Analyzing ${count} files...`
        })
        console.log(chalk.gray(`\nScanned ${filesScanned} files.`))

        const finalGraph = server.db.loadGraph()
        spinner.succeed(chalk.green(`Server running at http://${options.host}:${options.port}`))

        console.log('')
        console.log(chalk.blue('Analysis results:'))
        console.log(`  Files scanned: ${filesScanned}`)
        console.log(`  Nodes: ${finalGraph.nodes.length}`)
        console.log(`  Edges: ${finalGraph.edges.length}`)

        const countEdge = (type: string): number => finalGraph.edges.filter(edge => edge.type === type).length
        const crossLayerEdges = ['calls_api', 'handles', 'calls_service', 'queries_db']
          .reduce((count, type) => count + countEdge(type), 0)
        if (crossLayerEdges > 0) {
          console.log('')
          console.log(chalk.blue('Cross-layer links:'))
          console.log(`  calls_api:      ${countEdge('calls_api')}`)
          console.log(`  handles:        ${countEdge('handles')}`)
          console.log(`  calls_service:  ${countEdge('calls_service')}`)
          console.log(`  queries_db:     ${countEdge('queries_db')}`)
        }

        const nodesByType = finalGraph.nodes.reduce<Record<string, number>>((counts, node) => {
          counts[node.type] = (counts[node.type] ?? 0) + 1
          return counts
        }, {})
        if (Object.keys(nodesByType).length > 0) {
          console.log('')
          console.log(chalk.blue('Node types:'))
          for (const [type, count] of Object.entries(nodesByType)) {
            console.log(`  ${type}: ${count}`)
          }
        }

        const errorCount = server.db.getAllErrors().length
        if (errorCount > 0) {
          console.log(`\n  Errors: ${errorCount}`)
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
