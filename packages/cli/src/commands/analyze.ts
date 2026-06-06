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
import { autoDetectProject } from '../utils/autoDetect'
import { OmniDatabase, PrismaParser, NextjsAppParser, NextjsPagesParser, TrpcParser, ExpressParser, TypeormParser, ApiCallsParser, ReactComponentParser, GraphBuilder } from '@omnivis/analyzer'

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

export function analyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze project and output graph as JSON')
    .option('-o, --output <file>', 'Output file path', 'omnivis-graph.json')
    .action(async (options) => {
      const spinner = ora('Analyzing project...').start()

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

        spinner.succeed(chalk.green('Analysis complete!'))

        // 输出统计信息
        console.log('')
        console.log(chalk.blue('Statistics:'))
        console.log(`  Nodes: ${result.stats.totalNodes}`)
        console.log(`  Edges: ${result.stats.totalEdges}`)
        console.log(`  Errors: ${result.stats.totalErrors}`)

        // 输出 JSON
        const graph = builder.loadGraph()
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
