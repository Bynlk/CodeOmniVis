/**
 * 基础 Kotlin 解析器
 *
 * 解析 .kt 文件中的类、接口、对象、函数声明。
 * 不绑定特定框架，适用于任何 Kotlin 项目。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Parser, ParseResult, ParseContext, ProjectMeta } from '@omnivis/shared'
import { createNodeId, createEdgeId } from '@omnivis/shared'
import type { OmniNode, OmniEdge } from '@omnivis/shared'
import { parseKotlinSource } from './treeSitterInit'
import { walkKotlinTree } from './kotlinWalker'

export class KotlinParser implements Parser {
  readonly name = 'kotlin'

  canHandle(filePath: string, _projectMeta: ProjectMeta): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    if (!normalized.endsWith('.kt')) return false
    if (normalized.includes('/test/') || normalized.includes('/tests/') || normalized.includes('.test.')) return false
    if (normalized.includes('/androidTest/')) return false
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

      // 生成 class 节点
      for (const cls of analysis.classes) {
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

        // 继承边
        if (cls.superClass) {
          edges.push({
            id: createEdgeId(nodeId, 'kotlin_inherits', `kotlin_class:${normalizedPath}:${cls.superClass}`),
            source: nodeId,
            target: `kotlin_class:${normalizedPath}:${cls.superClass}`,
            type: 'kotlin_inherits',
            confidence: 'inferred',
            metadata: { superClass: cls.superClass, line: cls.line },
          })
        }

        // 接口实现边
        for (const iface of cls.interfaces) {
          edges.push({
            id: createEdgeId(nodeId, 'kotlin_implements', `kotlin_interface:${normalizedPath}:${iface}`),
            source: nodeId,
            target: `kotlin_interface:${normalizedPath}:${iface}`,
            type: 'kotlin_implements',
            confidence: 'inferred',
            metadata: { interfaceName: iface, line: cls.line },
          })
        }
      }

      // 生成 interface 节点
      for (const iface of analysis.interfaces) {
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

      // 生成 object 节点
      for (const obj of analysis.objects) {
        const nodeId = createNodeId('kotlin_object', normalizedPath, obj.name)
        nodes.push({
          id: nodeId,
          type: 'kotlin_object',
          name: obj.name,
          filePath: normalizedPath,
          line: obj.line,
          column: obj.column,
          metadata: {
            objectName: obj.name,
            packageName: obj.packageName,
            isCompanion: obj.isCompanion,
            annotations: obj.annotations,
          },
        })
      }

      // 生成顶级函数节点
      for (const fn of analysis.functions.filter(f => f.isTopLevel)) {
        const nodeId = createNodeId('kotlin_function', normalizedPath, fn.name)
        nodes.push({
          id: nodeId,
          type: 'kotlin_function',
          name: fn.name,
          filePath: normalizedPath,
          line: fn.line,
          column: fn.column,
          metadata: {
            functionName: fn.name,
            packageName: fn.packageName,
            isTopLevel: fn.isTopLevel,
            isExtension: fn.isExtension,
            receiverType: fn.receiverType,
            returnType: fn.returnType,
            annotations: fn.annotations,
          },
        })
      }

      tree.delete()
    } catch (err: any) {
      errors.push({
        file: filePath,
        message: err.message ?? 'Unknown error in KotlinParser',
        severity: 'warning',
        originalError: err,
      })
    }

    return { nodes, edges, errors }
  }
}
