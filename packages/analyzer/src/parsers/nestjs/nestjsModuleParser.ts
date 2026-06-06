/**
 * NestJS Module 解析器
 *
 * 解析 @Module({}) 装饰器，提取 imports/providers/controllers 数组。
 * 生成 module 节点。
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, SyntaxKind, Node, Decorator, ClassDeclaration } from 'ts-morph'
import * as path from 'path'
import type {
  Parser,
  ParseContext,
  ParseResult,
  ParseError,
  OmniNode,
  ProjectMeta,
  ModuleMetadata,
  NodeType,
} from '@omnivis/shared'
import { createNodeId } from '@omnivis/shared'

// ============================================================
// NestJS Module 解析器
// ============================================================

export class NestjsModuleParser implements Parser {
  readonly name = 'nestjs-module'
  private project: Project | null = null

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (projectMeta.backendFramework !== 'nestjs') return false

    const normalizedPath = filePath.replace(/\\/g, '/')
    if (/__tests__|\.test\.|\.spec\.|node_modules/.test(normalizedPath)) return false

    // .module.ts 文件
    if (/\.module\.(ts|tsx)$/.test(normalizedPath)) return true
    if (/\/modules?\//.test(normalizedPath)) return true

    return false
  }

  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const nodes: OmniNode[] = []
    const errors: ParseError[] = []

    try {
      if (!this.project) {
        this.project = new Project({
          tsConfigFilePath: context.tsConfig?.options?.configFilePath as string,
          skipAddingFilesFromTsConfig: true,
        })
      }

      const fullPath = path.resolve(context.projectRoot, filePath)
      const sourceFile = this.project.addSourceFileAtPath(fullPath)

      // 查找所有 Module 类
      const classes = sourceFile.getClasses()
      for (const cls of classes) {
        const moduleDecorator = this.findDecorator(cls, 'Module')
        if (!moduleDecorator) continue

        const moduleName = cls.getName() ?? 'UnknownModule'
        const line = cls.getStartLineNumber()

        // 提取模块元数据
        const { imports, controllers, providers } = this.extractModuleMetadata(moduleDecorator)

        const nodeId = createNodeId('module', filePath, moduleName)
        const metadata: ModuleMetadata = {
          childCount: imports.length + controllers.length + providers.length,
          childTypes: ['module', 'api_route', 'service'] as NodeType[],
        }

        nodes.push({
          id: nodeId,
          type: 'module',
          name: moduleName,
          filePath,
          line,
          column: 1,
          metadata,
        })
      }

      this.project.removeSourceFile(sourceFile)
    } catch (err) {
      errors.push({
        file: filePath,
        message: `NestJS module parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges: [], errors }
  }

  private findDecorator(node: ClassDeclaration, name: string): Decorator | undefined {
    return node.getDecorators().find(d => d.getName() === name)
  }

  /**
   * 从 @Module({ imports: [...], controllers: [...], providers: [...] }) 提取元数据
   */
  private extractModuleMetadata(decorator: Decorator): {
    imports: string[]
    controllers: string[]
    providers: string[]
  } {
    const result = { imports: [] as string[], controllers: [] as string[], providers: [] as string[] }

    const args = decorator.getArguments()
    if (args.length === 0) return result

    const config = args[0]
    if (!Node.isObjectLiteralExpression(config)) return result

    for (const prop of config.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue

      const name = prop.getName()
      const initializer = prop.getInitializer()

      if (!initializer || !Node.isArrayLiteralExpression(initializer)) continue

      const elements = initializer.getElements()
      const values: string[] = []

      for (const elem of elements) {
        if (Node.isIdentifier(elem)) {
          values.push(elem.getText())
        } else if (Node.isPropertyAccessExpression(elem)) {
          values.push(elem.getText())
        }
      }

      if (name === 'imports') result.imports = values
      else if (name === 'controllers') result.controllers = values
      else if (name === 'providers') result.providers = values
    }

    return result
  }
}
