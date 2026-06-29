/**
 * Room (Android) 解析器
 *
 * 识别 Room 注解（@Entity, @Dao, @Database），
 * 生成 db_model 节点和查询边。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Parser, ParseResult, ParseContext, ProjectMeta } from '@codeomnivis/shared'
import { createNodeId, createEdgeId } from '@codeomnivis/shared'
import type { OmniNode, OmniEdge } from '@codeomnivis/shared'
import { parseKotlinSource } from './treeSitterInit'
import { walkKotlinTree } from './kotlinWalker'

const ROOM_ENTITY_ANNOTATIONS = new Set(['Entity'])
const ROOM_DAO_ANNOTATIONS = new Set(['Dao'])
const ROOM_QUERY_ANNOTATIONS = new Set(['Query', 'Insert', 'Update', 'Delete'])

export class RoomParser implements Parser {
  readonly name = 'room'

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (projectMeta.databaseType !== 'room') return false
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

      // 处理 @Entity 类
      for (const cls of analysis.classes) {
        const isEntity = cls.annotations.some(a => ROOM_ENTITY_ANNOTATIONS.has(a))
        if (isEntity) {
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
        }
      }

      // 处理 @Dao 接口
      for (const iface of analysis.interfaces) {
        const isDao = iface.annotations.some(a => ROOM_DAO_ANNOTATIONS.has(a))
        if (isDao) {
          const nodeId = createNodeId('kotlin_interface', normalizedPath, iface.name)
          nodes.push({
            id: nodeId,
            type: 'kotlin_interface',
            name: iface.name,
            filePath: normalizedPath,
            line: iface.line,
            column: iface.column,
            metadata: {
              interfaceName: iface.name,
              packageName: iface.packageName,
              annotations: iface.annotations,
              superInterfaces: iface.superInterfaces,
            },
          })
        }
      }

      // 处理 @Query / @Insert / @Update / @Delete 函数 -> queries_db 边
      for (const fn of analysis.functions) {
        const hasQueryAnnotation = fn.annotations.some(a => ROOM_QUERY_ANNOTATIONS.has(a))
        if (hasQueryAnnotation) {
          // 从注解参数中提取 SQL 操作类型
          const operation = fn.annotations.find(a => ROOM_QUERY_ANNOTATIONS.has(a)) ?? 'query'

          // 创建 queries_db 边（目标 db_model 需要通过推断确定）
          // 这里先记录函数信息，后续 CrossLayerLinker 会处理连线
          edges.push({
            id: createEdgeId(
              createNodeId('kotlin_function', normalizedPath, fn.name),
              'queries_db',
              `db_model:${normalizedPath}:unknown`,
            ),
            source: createNodeId('kotlin_function', normalizedPath, fn.name),
            target: `db_model:${normalizedPath}:unknown`,
            type: 'queries_db',
            confidence: 'inferred',
            metadata: {
              operation,
              callLine: fn.line,
            },
          })
        }
      }

      tree.delete()
      } catch (err) {
      errors.push({
        file: filePath,
        message: err instanceof Error ? err.message : 'Unknown error in RoomParser',
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }
}
