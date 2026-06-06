/**
 * Spring Boot Kotlin 解析器
 *
 * 识别 Spring 注解（@RestController, @Service, @Repository, @Entity），
 * 生成路由节点和处理函数边。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Parser, ParseResult, ParseContext, ProjectMeta } from '@omnivis/shared'
import { createNodeId, createEdgeId } from '@omnivis/shared'
import type { OmniNode, OmniEdge } from '@omnivis/shared'
import { parseKotlinSource } from './treeSitterInit'
import { walkKotlinTree, type KotlinClassInfo, type KotlinFunctionInfo } from './kotlinWalker'

const SPRING_CONTROLLER_ANNOTATIONS = new Set(['RestController', 'Controller'])
const SPRING_ROUTE_ANNOTATIONS = new Set(['GetMapping', 'PostMapping', 'PutMapping', 'DeleteMapping', 'PatchMapping', 'RequestMapping'])
const SPRING_SERVICE_ANNOTATIONS = new Set(['Service'])
const SPRING_REPOSITORY_ANNOTATIONS = new Set(['Repository'])
const SPRING_ENTITY_ANNOTATIONS = new Set(['Entity'])

function extractRouteFromAnnotation(annotations: string[]): { method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; path: string } | null {
  for (const ann of annotations) {
    if (ann === 'GetMapping') return { method: 'GET', path: '' }
    if (ann === 'PostMapping') return { method: 'POST', path: '' }
    if (ann === 'PutMapping') return { method: 'PUT', path: '' }
    if (ann === 'DeleteMapping') return { method: 'DELETE', path: '' }
    if (ann === 'PatchMapping') return { method: 'PATCH', path: '' }
  }
  return null
}

export class SpringKotlinParser implements Parser {
  readonly name = 'spring-kotlin'

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (projectMeta.backendFramework !== 'spring') return false
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

      // 处理类声明
      for (const cls of analysis.classes) {
        const isController = cls.annotations.some(a => SPRING_CONTROLLER_ANNOTATIONS.has(a))
        const isService = cls.annotations.some(a => SPRING_SERVICE_ANNOTATIONS.has(a))
        const isRepository = cls.annotations.some(a => SPRING_REPOSITORY_ANNOTATIONS.has(a))
        const isEntity = cls.annotations.some(a => SPRING_ENTITY_ANNOTATIONS.has(a))

        if (isEntity) {
          // @Entity -> db_model 节点
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
        } else if (isService) {
          // @Service -> kotlin_class 节点（带 service 注解标记）
          const nodeId = createNodeId('kotlin_class', normalizedPath, cls.name)
          nodes.push({
            id: nodeId,
            type: 'kotlin_class',
            name: cls.name,
            filePath: normalizedPath,
            line: cls.line,
            column: cls.column,
            metadata: {
              className: cls.name,
              kind: cls.kind,
              packageName: cls.packageName,
              annotations: cls.annotations,
              superClass: cls.superClass,
              interfaces: cls.interfaces,
            },
          })
        } else if (isRepository) {
          // @Repository -> kotlin_class 节点
          const nodeId = createNodeId('kotlin_class', normalizedPath, cls.name)
          nodes.push({
            id: nodeId,
            type: 'kotlin_class',
            name: cls.name,
            filePath: normalizedPath,
            line: cls.line,
            column: cls.column,
            metadata: {
              className: cls.name,
              kind: cls.kind,
              packageName: cls.packageName,
              annotations: cls.annotations,
              superClass: cls.superClass,
              interfaces: cls.interfaces,
            },
          })
        } else if (isController) {
          // @RestController -> 处理路由方法
          // 类本身作为 kotlin_class 节点
          const classNodeId = createNodeId('kotlin_class', normalizedPath, cls.name)
          nodes.push({
            id: classNodeId,
            type: 'kotlin_class',
            name: cls.name,
            filePath: normalizedPath,
            line: cls.line,
            column: cls.column,
            metadata: {
              className: cls.name,
              kind: cls.kind,
              packageName: cls.packageName,
              annotations: cls.annotations,
              superClass: cls.superClass,
              interfaces: cls.interfaces,
            },
          })
        }
      }

      // 处理带有路由注解的函数
      for (const fn of analysis.functions) {
        const routeInfo = extractRouteFromAnnotation(fn.annotations)
        if (routeInfo) {
          const routeNodeId = createNodeId('kotlin_route', normalizedPath, fn.name)
          nodes.push({
            id: routeNodeId,
            type: 'kotlin_route',
            name: fn.name,
            filePath: normalizedPath,
            line: fn.line,
            column: fn.column,
            metadata: {
              method: routeInfo.method,
              path: routeInfo.path,
              framework: 'spring',
              annotations: fn.annotations,
            },
          })

          // handles 边：route -> function
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

      tree.delete()
    } catch (err: any) {
      errors.push({
        file: filePath,
        message: err.message ?? 'Unknown error in SpringKotlinParser',
        severity: 'warning',
        originalError: err,
      })
    }

    return { nodes, edges, errors }
  }
}
