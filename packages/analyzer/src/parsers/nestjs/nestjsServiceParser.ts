/**
 * NestJS Service/Provider 解析器
 *
 * 解析 @Injectable() 装饰器，检测 constructor 注入的依赖。
 * 特殊处理 @InjectRepository → 生成 queries_db 边。
 * 生成 service 节点。
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, SyntaxKind, Node, Decorator, ClassDeclaration, ParameterDeclaration } from 'ts-morph'
import * as path from 'path'
import type {
  Parser,
  ParseContext,
  ParseResult,
  ParseError,
  OmniNode,
  OmniEdge,
  ProjectMeta,
  ServiceMetadata,
  EdgeType,
} from '@codeomnivis/shared'
import { createNodeId, createEdgeId } from '@codeomnivis/shared'

// ============================================================
// NestJS Service 解析器
// ============================================================

export class NestjsServiceParser implements Parser {
  readonly name = 'nestjs-service'
  private project: Project | null = null

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (projectMeta.backendFramework !== 'nestjs') return false

    const normalizedPath = filePath.replace(/\\/g, '/')
    if (/__tests__|\.test\.|\.spec\.|node_modules/.test(normalizedPath)) return false

    // .service.ts 文件或包含 @Injectable 的文件
    if (/\.service\.(ts|tsx)$/.test(normalizedPath)) return true
    if (/\/services?\//.test(normalizedPath)) return true
    if (/\/providers?\//.test(normalizedPath)) return true

    return false
  }

  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const errors: ParseError[] = []

    try {
      if (!this.project) {
          const configFilePath = context.tsConfig?.options?.configFilePath
        this.project = new Project({
            tsConfigFilePath: typeof configFilePath === 'string' ? configFilePath : undefined,
          skipAddingFilesFromTsConfig: true,
        })
      }

      const fullPath = path.resolve(context.projectRoot, filePath)
      const sourceFile = this.project.addSourceFileAtPath(fullPath)

      // 查找所有 @Injectable 类
      const classes = sourceFile.getClasses()
      for (const cls of classes) {
        const injectableDecorator = this.findDecorator(cls, 'Injectable')
        if (!injectableDecorator) continue

        const className = cls.getName() ?? 'UnknownService'
        const line = cls.getStartLineNumber()

        // 创建 service 节点
        const serviceNodeId = createNodeId('service', filePath, className)
        const metadata: ServiceMetadata = {
          className,
          methodName: className,
        }

        nodes.push({
          id: serviceNodeId,
          type: 'service',
          name: className,
          filePath,
          line,
          column: 1,
          metadata,
        })

        // 分析 constructor 注入
        const constructor = cls.getConstructors()[0]
        if (constructor) {
          for (const param of constructor.getParameters()) {
            // 检查 @InjectRepository 装饰器
            const repoDecorator = this.findDecorator(param, 'InjectRepository')
            if (repoDecorator) {
              const repoType = this.extractRepositoryType(param)
              if (repoType) {
                // 创建 db_model 节点引用
                const dbNodeId = createNodeId('db_model', filePath, repoType)

                // 创建 queries_db 边（service → db_model）
                const edgeId = createEdgeId(serviceNodeId, 'queries_db', dbNodeId)
                edges.push({
                  id: edgeId,
                  source: serviceNodeId,
                  target: dbNodeId,
                  type: 'queries_db',
                  confidence: 'inferred',
                  metadata: { repository: repoType },
                })
              }
            }
          }
        }
      }

      this.project.removeSourceFile(sourceFile)
    } catch (err) {
      errors.push({
        file: filePath,
        message: `NestJS service parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  private findDecorator(node: ClassDeclaration | ParameterDeclaration, name: string): Decorator | undefined {
    return node.getDecorators().find((d: Decorator) => d.getName() === name)
  }

  /**
   * 从 @InjectRepository(User) 提取实体类型
   */
  private extractRepositoryType(param: ParameterDeclaration): string | null {
    const repoDecorator = this.findDecorator(param, 'InjectRepository')
    if (!repoDecorator) return null

    const args = repoDecorator.getArguments()
    if (args.length === 0) return null

    const firstArg = args[0]
    if (Node.isIdentifier(firstArg)) {
      return firstArg.getText()
    }

    return null
  }
}
