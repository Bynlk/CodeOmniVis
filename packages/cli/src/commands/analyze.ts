/**
 * analyze 命令
 *
 * 分析项目并输出 JSON 结果。
 * npx omnivis analyze → 分析项目 → 输出 JSON
 */

import type { Command } from 'commander'
import ora from 'ora'
import chalk from 'chalk'
import { autoDetectProject } from '../utils/autoDetect'
import { OmniDatabase, PrismaParser, GraphBuilder } from '@omnivis/analyzer'

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
          const fs = await import('fs')
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
