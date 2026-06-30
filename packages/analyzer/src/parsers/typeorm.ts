/**
 * TypeORM Entity 解析器
 *
 * 识别 @Entity、@Column、@OneToMany、@ManyToOne、@ManyToMany、@OneToOne 装饰器。
 * 提取实体节点和关系边。
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, ClassDeclaration, PropertyDeclaration, Decorator, Node } from 'ts-morph'
import * as path from 'path'
import type {
  Parser,
  ParseContext,
  ParseResult,
  ParseError,
  OmniNode,
  OmniEdge,
  ProjectMeta,
  DbModelMetadata,
  DbFieldInfo,
} from '@codeomnivis/shared'
import { createNodeId, createEdgeId } from '@codeomnivis/shared'

// ============================================================
// 关系装饰器类型
// ============================================================

interface RelationInfo {
  propertyName: string
  targetEntity: string
  relationType: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many'
  line: number
}

// ============================================================
// TypeORM 解析器
// ============================================================

export class TypeormParser implements Parser {
  readonly name = 'typeorm'
  private project: Project | null = null

  /**
   * 判断是否能处理该文件
   */
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    // 只有当数据库类型是 TypeORM 时才处理
    if (projectMeta.databaseType !== 'typeorm') {
      return false
    }

    const normalizedPath = filePath.replace(/\\/g, '/')

    // 排除测试文件和 node_modules
    if (/__tests__|\.test\.|\.spec\.|node_modules/.test(normalizedPath)) {
      return false
    }

    // 只处理 TypeScript 文件
    if (!/\.(ts|tsx)$/.test(normalizedPath)) {
      return false
    }

    // 检查是否在 entity 目录下
    if (/\/entit(y|ies)\//i.test(normalizedPath)) {
      return true
    }

    // 检查文件名是否包含 entity
    if (/\.entity\.(ts|tsx)$/.test(normalizedPath)) {
      return true
    }

    return false
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
          const configFilePath = context.tsConfig?.options?.configFilePath
        this.project = new Project({
            tsConfigFilePath: typeof configFilePath === 'string' ? configFilePath : undefined,
          skipAddingFilesFromTsConfig: true,
        })
      }

      const fullPath = path.resolve(context.projectRoot, filePath)
      const sourceFile = this.project.addSourceFileAtPath(fullPath)

      // 查找所有类声明
      sourceFile.forEachDescendant((node: Node) => {
        if (Node.isClassDeclaration(node)) {
          try {
            const result = this.parseEntity(node, filePath)
            if (result) {
              nodes.push(result.node)
              edges.push(...result.edges)
            }
          } catch (err) {
            errors.push({
              file: filePath,
              message: `Failed to parse entity: ${err instanceof Error ? err.message : String(err)}`,
              severity: 'warning',
            })
          }
        }
      })

      // 移除源文件以释放内存
      this.project.removeSourceFile(sourceFile)
    } catch (err) {
      errors.push({
        file: filePath,
        message: `TypeORM parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  /**
   * 解析单个实体类
   */
  private parseEntity(classDecl: ClassDeclaration, filePath: string): { node: OmniNode; edges: OmniEdge[] } | null {
    // 检查是否有 @Entity 装饰器
    const entityDecorator = this.findDecorator(classDecl, 'Entity')
    if (!entityDecorator) return null

    const className = classDecl.getName() || 'Unknown'
    const line = classDecl.getStartLineNumber()

    // 提取表名
    const tableName = this.extractTableName(entityDecorator) || className.toLowerCase() + 's'

    // 提取字段
    const fields = this.extractColumns(classDecl)

    // 提取关系
    const relations = this.extractRelations(classDecl, filePath)

    const nodeId = createNodeId('db_model', filePath, className)

    const metadata: DbModelMetadata = {
      tableName,
      fieldCount: fields.length,
      fields,
    }

    const node: OmniNode = {
      id: nodeId,
      type: 'db_model',
      name: className,
      filePath,
      line,
      column: 1,
      metadata,
    }

    // 创建关系边
    const edges: OmniEdge[] = []
    for (const relation of relations) {
      const targetNodeId = createNodeId('db_model', filePath, relation.targetEntity)
      const edgeId = createEdgeId(nodeId, 'db_relation', targetNodeId)

      edges.push({
        id: edgeId,
        source: nodeId,
        target: targetNodeId,
        type: 'db_relation',
        confidence: 'certain',
        metadata: {
          relationType: relation.relationType,
          fieldName: relation.propertyName,
          relationName: `${className}.${relation.propertyName}`,
        },
      })
    }

    return { node, edges }
  }

  /**
   * 查找指定名称的装饰器
   */
  private findDecorator(node: ClassDeclaration | PropertyDeclaration, name: string): Decorator | undefined {
    return node.getDecorators().find((d: Decorator) => {
      const expression = d.getCallExpression()
      if (!expression) {
        return d.getName() === name
      }
      return d.getName() === name
    })
  }

  /**
   * 从 @Entity 装饰器提取表名
   */
  private extractTableName(decorator: Decorator): string | null {
    const callExpression = decorator.getCallExpression()
    if (!callExpression) return null

    const args = callExpression.getArguments()
    if (args.length > 0 && Node.isStringLiteral(args[0])) {
      return args[0].getLiteralValue()
    }

    return null
  }

  /**
   * 提取 @Column 装饰的字段
   */
  private extractColumns(classDecl: ClassDeclaration): DbFieldInfo[] {
    const fields: DbFieldInfo[] = []

    for (const property of classDecl.getProperties()) {
      const columnDecorator = this.findDecorator(property, 'Column')
      if (!columnDecorator) continue

      const name = property.getName()
      const typeNode = property.getTypeNode()
      const type = typeNode ? typeNode.getText() : 'any'
      const isRequired = !property.hasQuestionToken()

      fields.push({
        name,
        type,
        isRequired,
        isId: !!this.findDecorator(property, 'PrimaryColumn') || !!this.findDecorator(property, 'PrimaryGeneratedColumn'),
        isRelation: false,
      })
    }

    return fields
  }

  /**
   * 提取关系装饰器
   */
  private extractRelations(classDecl: ClassDeclaration, _filePath: string): RelationInfo[] {
    const relations: RelationInfo[] = []

    const relationDecorators = ['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany']

    for (const property of classDecl.getProperties()) {
      for (const decoratorName of relationDecorators) {
        const decorator = this.findDecorator(property, decoratorName)
        if (!decorator) continue

        const callExpression = decorator.getCallExpression()
        if (!callExpression) continue

        const args = callExpression.getArguments()
        if (args.length === 0) continue

        // 第一个参数通常是目标实体的类型
        let targetEntity = 'unknown'

        // 尝试从箭头函数中提取：() => User
        if (Node.isArrowFunction(args[0])) {
          const body = args[0].getBody()
          if (Node.isIdentifier(body)) {
            targetEntity = body.getText()
          }
        }
        // 直接是标识符
        else if (Node.isIdentifier(args[0])) {
          targetEntity = args[0].getText()
        }

        // 从类型注解中提取
        if (targetEntity === 'unknown') {
          const typeNode = property.getTypeNode()
          if (typeNode) {
            const typeText = typeNode.getText()
            // 提取泛型参数中的类型：Promise<User> → User, User[] → User
            const match = typeText.match(/(?:Promise<)?(\w+)(?:\[\])?>?/)
            if (match) {
              targetEntity = match[1]
            }
          }
        }

        const relationType = this.mapRelationType(decoratorName)

        relations.push({
          propertyName: property.getName(),
          targetEntity,
          relationType,
          line: property.getStartLineNumber(),
        })

        break // 一个属性只匹配一个关系装饰器
      }
    }

    return relations
  }

  /**
   * 映射装饰器名称到关系类型
   */
  private mapRelationType(decoratorName: string): 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many' {
    switch (decoratorName) {
      case 'OneToOne': return 'one_to_one'
      case 'OneToMany': return 'one_to_many'
      case 'ManyToOne': return 'many_to_one'
      case 'ManyToMany': return 'many_to_many'
      default: return 'one_to_one'
    }
  }
}
