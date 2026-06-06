/**
 * Exposed ORM 解析器
 *
 * 识别 Exposed 表定义（object XxxTable : IntIdTable()）和
 * 实体类（class Xxx : IntEntity()），生成 db_model 节点。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Parser, ParseResult, ParseContext, ProjectMeta } from '@omnivis/shared'
import { createNodeId, createEdgeId } from '@omnivis/shared'
import type { OmniNode, OmniEdge } from '@omnivis/shared'
import { parseKotlinSource } from './treeSitterInit'
import { walkKotlinTree } from './kotlinWalker'

const EXPOSED_TABLE_BASES = new Set(['IntIdTable', 'LongIdTable', 'UUIDTable', 'CompositeIdTable'])
const EXPOSED_ENTITY_BASES = new Set(['IntEntity', 'LongEntity', 'UUIDEntity'])

export class ExposedParser implements Parser {
  readonly name = 'exposed'

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (projectMeta.databaseType !== 'exposed') return false
    const normalized = filePath.replace(/\\/g, '/')
    if (!normalized.endsWith('.kt')) return false
    if (normalized.includes('/test/') || normalized.includes('.test.')) return false
    return true
  }

  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const errors: ParseResult['errors'] = []

    try {
      const fullPath = path.resolve(context.projectRoot, filePath)
      const source = fs.readFileSync(fullPath, 'utf-8')
      const tree = await parseKotlinSource(source)
      const analysis = walkKotlinTree(tree)
      const normalizedPath = filePath.replace(/\\/g, '/')

      // 处理 object 声明（Exposed Table 定义）
      for (const obj of analysis.objects) {
        // 检查是否继承自 Exposed Table 类型
        // object Users : IntIdTable() 模式
        const isExposedTable = source.includes(`${obj.name}`) &&
          EXPOSED_TABLE_BASES.some(base => source.includes(`${obj.name} : ${base}`))

        if (isExposedTable) {
          const nodeId = createNodeId('db_model', normalizedPath, obj.name)
          nodes.push({
            id: nodeId,
            type: 'db_model',
            name: obj.name,
            filePath: normalizedPath,
            line: obj.line,
            column: obj.column,
            metadata: {
              tableName: obj.name,
              fieldCount: 0,
              fields: [],
            },
          })
        }
      }

      // 处理 class 声明（Exposed Entity 类）
      for (const cls of analysis.classes) {
        const isExposedEntity = cls.superClass
          ? EXPOSED_ENTITY_BASES.has(cls.superClass)
          : false

        if (isExposedEntity) {
          const nodeId = createNodeId('db_model', normalizedPath, cls.name)
          nodes.push({
            id: nodeId,
            type: 'db_model',
            name: cls.name,
            filePath: normalizedPath,
            line: cls.line,
            column: cls.column,
            metadata: {
              tableName: cls.name,
              fieldCount: 0,
              fields: [],
            },
          })

          // 关联 entity 到 table 的边
          // 通过模式匹配推断 table 名（通常 Entity 名去掉 "Entity" 后缀 + "s" = Table 名）
          const tableGuess = cls.name.replace(/Entity$/, '') + 's'
          const tableNodeId = createNodeId('db_model', normalizedPath, tableGuess)
          edges.push({
            id: createEdgeId(nodeId, 'db_relation', tableNodeId),
            source: nodeId,
            target: tableNodeId,
            type: 'db_relation',
            confidence: 'inferred',
            metadata: {
              relationType: 'many_to_one',
              fieldName: 'table',
              relationName: `${cls.name}->${tableGuess}`,
            },
          })
        }
      }

      // 正则匹配 transaction { } 块中的 CRUD 操作
      const transactionPattern = /\btransaction\s*\{([^}]+)\}/g
      let match: RegExpExecArray | null
      while ((match = transactionPattern.exec(source)) !== null) {
        const block = match[1]
        const operations = ['find', 'new', 'all', 'count', 'update', 'delete']

        for (const op of operations) {
          const opPattern = new RegExp(`\\.${op}\\b`, 'g')
          let opMatch: RegExpExecArray | null
          while ((opMatch = opPattern.exec(block)) !== null) {
            const beforeOp = source.substring(0, match.index + opMatch.index)
            const line = beforeOp.split('\n').length

            edges.push({
              id: createEdgeId(
                createNodeId('kotlin_function', normalizedPath, 'transaction'),
                'queries_db',
                `db_model:${normalizedPath}:unknown`,
              ),
              source: createNodeId('kotlin_function', normalizedPath, 'transaction'),
              target: `db_model:${normalizedPath}:unknown`,
              type: 'queries_db',
              confidence: 'inferred',
              metadata: {
                operation: op,
                callLine: line,
              },
            })
          }
        }
      }

      tree.delete()
    } catch (err: any) {
      errors.push({
        file: filePath,
        message: err.message ?? 'Unknown error in ExposedParser',
        severity: 'warning',
        originalError: err,
      })
    }

    return { nodes, edges, errors }
  }
}
