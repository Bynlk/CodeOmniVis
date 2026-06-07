/**
 * Ktor 解析器
 *
 * 识别 Ktor routing DSL（routing { get() / post() / ... }）
 * 和 @Route 注解，生成路由节点。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Parser, ParseResult, ParseContext, ProjectMeta } from '@codeomnivis/shared'
import { createNodeId, createEdgeId } from '@codeomnivis/shared'
import type { OmniNode, OmniEdge } from '@codeomnivis/shared'
import { parseKotlinSource } from './treeSitterInit'
import { walkKotlinTree } from './kotlinWalker'

const KTOR_HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options'])

export class KtorParser implements Parser {
  readonly name = 'ktor'

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (projectMeta.backendFramework !== 'ktor') return false
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

      // 处理 @Route 注解的函数
      for (const fn of analysis.functions) {
        const hasRouteAnnotation = fn.annotations.some(a => a === 'Route')
        if (hasRouteAnnotation) {
          const routeNodeId = createNodeId('kotlin_route', normalizedPath, fn.name)
          nodes.push({
            id: routeNodeId,
            type: 'kotlin_route',
            name: fn.name,
            filePath: normalizedPath,
            line: fn.line,
            column: fn.column,
            metadata: {
              method: 'GET', // 默认，实际应从注解参数提取
              path: '',
              framework: 'ktor',
              annotations: fn.annotations,
            },
          })

          const fnNodeId = createNodeId('kotlin_function', normalizedPath, fn.name)
          edges.push({
            id: createEdgeId(routeNodeId, 'handles', fnNodeId),
            source: routeNodeId,
            target: fnNodeId,
            type: 'handles',
            confidence: 'certain',
            metadata: { handlerName: fn.name },
          })
        }
      }

      // 通过正则匹配 Ktor routing DSL: get("path") { ... }, post("path") { ... }
      // tree-sitter 会将这些解析为 call_expression，需要在原始文本中提取
      const routingPattern = /\b(get|post|put|delete|patch|head|options)\s*\(\s*"([^"]*)"/g
      let match: RegExpExecArray | null
      while ((match = routingPattern.exec(source)) !== null) {
        const method = match[1].toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
        const routePath = match[2]

        // 计算行号
        const beforeMatch = source.substring(0, match.index)
        const line = beforeMatch.split('\n').length

        const routeName = `${method} ${routePath}`
        const routeNodeId = createNodeId('kotlin_route', normalizedPath, routeName)
        nodes.push({
          id: routeNodeId,
          type: 'kotlin_route',
          name: routeName,
          filePath: normalizedPath,
          line,
          column: 1,
          metadata: {
            method,
            path: routePath,
            framework: 'ktor',
            annotations: [],
          },
        })
      }

      tree.delete()
    } catch (err: unknown) {
      errors.push({
        file: filePath,
        message: err instanceof Error ? err.message : 'Unknown error in KtorParser',
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }
}
