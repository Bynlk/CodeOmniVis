/**
 * React 组件解析器
 *
 * 使用 ts-morph 分析 import 关系和 JSX 结构。
 * 提取组件名、props、state 使用，构建 parent → child 渲染关系。
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, SyntaxKind, Node, CallExpression, JsxElement, JsxSelfClosingElement } from 'ts-morph'
import * as path from 'path'
import type {
  Parser,
  ParseContext,
  ParseResult,
  ParseError,
  OmniNode,
  OmniEdge,
  ProjectMeta,
  ComponentMetadata,
} from '@omnivis/shared'
import { createNodeId, createEdgeId } from '@omnivis/shared'

// ============================================================
// React 组件解析器
// ============================================================

export class ReactComponentParser implements Parser {
  readonly name = 'react-component'
  private project: Project | null = null

  /**
   * 判断是否能处理该文件
   */
  canHandle(filePath: string, _projectMeta: ProjectMeta): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/')

    // 只处理 .tsx 和 .jsx 文件
    if (!/\.(tsx|jsx)$/.test(normalizedPath)) {
      return false
    }

    // 排除测试文件
    if (/__tests__|\.test\.|\.spec\./.test(normalizedPath)) {
      return false
    }

    // 排除 node_modules
    if (/node_modules/.test(normalizedPath)) {
      return false
    }

    return true
  }

  /**
   * 执行解析
   */
  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const errors: ParseError[] = []

    try {
      // 初始化 ts-morph Project
      if (!this.project) {
        this.project = new Project({
          tsConfigFilePath: context.tsConfig?.options?.configFilePath as string,
          skipAddingFilesFromTsConfig: true,
        })
      }

      const fullPath = path.resolve(context.projectRoot, filePath)
      const sourceFile = this.project.addSourceFileAtPath(fullPath)

      // 提取组件
      const components = this.extractComponents(sourceFile, filePath)

      for (const component of components) {
        nodes.push(component.node)

        // 提取 JSX 子组件关系
        const childEdges = this.extractChildComponents(sourceFile, filePath, component.name)
        edges.push(...childEdges)
      }

      // 移除源文件以释放内存
      this.project.removeSourceFile(sourceFile)
    } catch (err) {
      errors.push({
        file: filePath,
        message: `React component parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  /**
   * 提取组件
   */
  private extractComponents(sourceFile: any, filePath: string): Array<{ node: OmniNode; name: string }> {
    const components: Array<{ node: OmniNode; name: string }> = []

    // 查找函数组件
    sourceFile.forEachDescendant((node: any) => {
      // export function ComponentName() {}
      if (Node.isFunctionDeclaration(node)) {
        const isExported = node.isExported()
        const name = node.getName()

        if (name && isExported && this.isComponentName(name)) {
          const componentNode = this.createComponentNode(name, filePath, node.getStartLineNumber(), 'function')
          components.push({ node: componentNode, name })
        }
      }

      // export const ComponentName = () => {}
      if (Node.isVariableDeclaration(node)) {
        const name = node.getName()
        const initializer = node.getInitializer()

        if (name && initializer && Node.isArrowFunction(initializer)) {
          const isExported = this.isVariableExported(node)
          if (isExported && this.isComponentName(name)) {
            const componentNode = this.createComponentNode(name, filePath, node.getStartLineNumber(), 'function')
            components.push({ node: componentNode, name })
          }
        }
      }
    })

    return components
  }

  /**
   * 判断是否是组件名（首字母大写）
   */
  private isComponentName(name: string): boolean {
    return /^[A-Z]/.test(name)
  }

  /**
   * 判断变量是否被导出
   */
  private isVariableExported(node: any): boolean {
    const parent = node.getParent()
    if (!parent) return false

    // 检查 VariableStatement 是否有 export
    if (Node.isVariableStatement(parent)) {
      return parent.isExported()
    }

    return false
  }

  /**
   * 创建组件节点
   */
  private createComponentNode(
    name: string,
    filePath: string,
    line: number,
    componentType: 'function' | 'class'
  ): OmniNode {
    const nodeId = createNodeId('component', filePath, name)

    const metadata: ComponentMetadata = {
      props: [], // TODO: 提取 props
      hasState: false, // TODO: 检测 useState
      isPage: filePath.includes('/page.'),
      jsxChildCount: 0, // TODO: 统计 JSX 子元素
    }

    return {
      id: nodeId,
      type: 'component',
      name,
      filePath,
      line,
      column: 1,
      metadata,
    }
  }

  /**
   * 提取子组件关系（renders 边）
   */
  private extractChildComponents(sourceFile: any, filePath: string, parentName: string): OmniEdge[] {
    const edges: OmniEdge[] = []
    const childComponents = new Set<string>()

    // 查找 JSX 元素
    sourceFile.forEachDescendant((node: any) => {
      // <ComponentName /> 或 <ComponentName>...</ComponentName>
      if (Node.isJsxSelfClosingElement(node) || Node.isJsxOpeningElement(node)) {
        const tagName = node.getTagNameNode?.()?.getText?.() || node.getTagName?.()?.getText?.()

        if (tagName && this.isComponentName(tagName)) {
          childComponents.add(tagName)
        }
      }
    })

    // 创建 renders 边
    const parentId = createNodeId('component', filePath, parentName)

    for (const childName of childComponents) {
      const childId = createNodeId('component', filePath, childName)
      const edgeId = createEdgeId(parentId, 'renders', childId)

      edges.push({
        id: edgeId,
        source: parentId,
        target: childId,
        type: 'renders',
        confidence: 'inferred',
        metadata: {
          jsxLine: 0, // TODO: 获取实际行号
        },
      })
    }

    return edges
  }
}
