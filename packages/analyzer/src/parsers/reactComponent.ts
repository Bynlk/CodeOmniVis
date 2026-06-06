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
import * as fs from 'fs'
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
          const props = this.extractPropsFromFunction(node)
          const hasState = this.detectUseState(node)
          const componentNode = this.createComponentNode(name, filePath, node.getStartLineNumber(), 'function', props, hasState)
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
            const props = this.extractPropsFromFunction(initializer)
            const hasState = this.detectUseState(initializer)
            const componentNode = this.createComponentNode(name, filePath, node.getStartLineNumber(), 'function', props, hasState)
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
    componentType: 'function' | 'class',
    props: string[] = [],
    hasState: boolean = false
  ): OmniNode {
    const nodeId = createNodeId('component', filePath, name)

    const metadata: ComponentMetadata = {
      props,
      hasState,
      isPage: filePath.includes('/page.'),
      jsxChildCount: 0,
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
   * 从函数参数提取 props 名称
   */
  private extractPropsFromFunction(funcNode: any): string[] {
    const props: string[] = []

    try {
      const params = funcNode.getParameters()
      if (params.length === 0) return props

      const firstParam = params[0]
      const typeNode = firstParam.getTypeNode()

      // 解构参数：{ name, age, ... }
      if (firstParam.isDestructured()) {
        const bindingPattern = firstParam.getNameNode()
        if (Node.isObjectBindingPattern(bindingPattern)) {
          for (const element of bindingPattern.getElements()) {
            props.push(element.getName())
          }
        }
      }
      // 类型注解中的属性：Props { name: string }
      else if (typeNode && Node.isTypeLiteral(typeNode)) {
        for (const member of typeNode.getMembers()) {
          if (Node.isPropertySignature(member)) {
            props.push(member.getName())
          }
        }
      }
    } catch {
      // 降级：忽略解析错误
    }

    return props
  }

  /**
   * 检测函数体中是否使用了 useState
   */
  private detectUseState(funcNode: any): boolean {
    let hasState = false

    try {
      funcNode.forEachDescendant((node: any) => {
        if (hasState) return

        if (Node.isCallExpression(node)) {
          const expression = node.getExpression()
          const text = expression.getText()
          if (text === 'useState' || text.endsWith('.useState')) {
            hasState = true
          }
        }
      })
    } catch {
      // 降级：忽略解析错误
    }

    return hasState
  }

  /**
   * 提取子组件关系（renders 边）
   */
  private extractChildComponents(sourceFile: any, filePath: string, parentName: string): OmniEdge[] {
    const edges: OmniEdge[] = []
    const childComponents = new Set<string>()

    // 构建 import 映射：组件名 → 来源文件路径
    const importMap = this.buildImportMap(sourceFile, filePath)

    // 查找 JSX 元素
    sourceFile.forEachDescendant((node: any) => {
      // <ComponentName /> 或 <ComponentName>...</ComponentName>
      if (Node.isJsxSelfClosingElement(node) || Node.isJsxOpeningElement(node)) {
        // 使用 getTagNameNode 获取标签名
        const tagNameNode = node.getTagNameNode?.()
        const tagName = tagNameNode?.getText?.()

        if (tagName && this.isComponentName(tagName)) {
          childComponents.add(tagName)
        }
      }
    })

    // 创建 renders 边
    const parentId = createNodeId('component', filePath, parentName)

    for (const childName of childComponents) {
      // 优先使用 import 解析的文件路径，否则用父组件的文件路径
      const childFilePath = importMap.get(childName) || filePath
      const childId = createNodeId('component', childFilePath, childName)
      const edgeId = createEdgeId(parentId, 'renders', childId)

      edges.push({
        id: edgeId,
        source: parentId,
        target: childId,
        type: 'renders',
        confidence: importMap.has(childName) ? 'certain' : 'inferred',
        metadata: {
          jsxLine: 0,
        },
      })
    }

    return edges
  }

  /**
   * 从 import 语句构建 组件名 → 文件路径 映射
   */
  private buildImportMap(sourceFile: any, currentFilePath: string): Map<string, string> {
    const importMap = new Map<string, string>()

    try {
      sourceFile.forEachDescendant((node: any) => {
        if (!Node.isImportDeclaration(node)) return

        const moduleSpecifier = node.getModuleSpecifier()?.getText?.() || ''
        // 去掉引号
        const importPath = moduleSpecifier.replace(/^['"]|['"]$/g, '')
        if (!importPath) return

        // 只处理相对路径（跨文件组件）
        if (!importPath.startsWith('.')) return

        // 解析绝对路径
        const resolvedPath = this.resolveImportPath(currentFilePath, importPath)

        // 默认导入：import ComponentName from '...'
        const defaultImport = node.getDefaultImport()
        if (defaultImport) {
          const name = defaultImport.getText()
          if (this.isComponentName(name)) {
            importMap.set(name, resolvedPath)
          }
        }

        // 命名导入：import { A, B } from '...'
        const namedImports = node.getNamedImports()
        for (const named of namedImports) {
          const name = named.getName()
          if (this.isComponentName(name)) {
            importMap.set(name, resolvedPath)
          }
        }
      })
    } catch {
      // 降级：import 解析失败时返回空映射
    }

    return importMap
  }

  /**
   * 解析 import 路径为相对于项目根的路径，并补全文件扩展名
   */
  private resolveImportPath(fromFile: string, importPath: string): string {
    try {
      const fromDir = path.dirname(fromFile)
      let resolved = path.join(fromDir, importPath)
      // 规范化路径分隔符
      resolved = resolved.replace(/\\/g, '/')
      // 补全扩展名
      resolved = this.resolveWithExtension(resolved)
      return resolved
    } catch {
      return importPath
    }
  }

  /**
   * 补全文件扩展名
   * 如果路径已有扩展名则直接返回，否则按优先级尝试 .tsx → .ts → .jsx → .js，
   * 再尝试 index 文件。找不到时返回原路径（降级，不抛异常）。
   */
  private resolveWithExtension(resolvedPath: string): string {
    // 如果路径已有扩展名，直接返回
    if (/\.(tsx|ts|jsx|js)$/.test(resolvedPath)) return resolvedPath

    // 按优先级依次尝试补全
    const exts = ['.tsx', '.ts', '.jsx', '.js']
    for (const ext of exts) {
      if (fs.existsSync(resolvedPath + ext)) return resolvedPath + ext
    }

    // 处理 index 文件：../components/Booking → ../components/Booking/index.tsx
    for (const ext of exts) {
      const indexPath = path.join(resolvedPath, 'index' + ext)
      if (fs.existsSync(indexPath)) return indexPath
    }

    // 文件不存在：返回原路径（降级，不抛异常）
    return resolvedPath
  }
}
