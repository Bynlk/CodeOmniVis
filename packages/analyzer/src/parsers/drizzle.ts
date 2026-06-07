/**
 * Drizzle ORM 解析器
 *
 * 解析 pgTable/mysqlTable/sqliteTable 定义，提取表名和列信息。
 * 解析 relations() 调用，提取表间关系。
 * 生成 db_model 节点和 db_relation 边。
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, SyntaxKind, CallExpression, Node, VariableDeclaration, SourceFile, ObjectLiteralExpression } from 'ts-morph'
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
// 常量
// ============================================================

const TABLE_FUNCTIONS = ['pgTable', 'mysqlTable', 'sqliteTable'] as const

const DIALECT_MAP: Record<string, string> = {
  pgTable: 'pg',
  mysqlTable: 'mysql',
  sqliteTable: 'sqlite',
}

// Drizzle 列类型函数名
const COLUMN_TYPES = [
  'serial', 'bigserial', 'smallserial',
  'integer', 'bigint', 'smallint', 'tinyint',
  'text', 'varchar', 'char', 'mediumtext', 'longtext',
  'boolean',
  'date', 'datetime', 'timestamp', 'time',
  'real', 'float', 'double', 'decimal', 'numeric',
  'json', 'jsonb',
  'uuid',
  'blob', 'mediumblob', 'longblob',
  'enum',
  'custom',
] as const

// ============================================================
// Drizzle 解析器
// ============================================================

export class DrizzleParser implements Parser {
  readonly name = 'drizzle'
  private project: Project | null = null

  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (projectMeta.databaseType !== 'drizzle') return false

    const normalizedPath = filePath.replace(/\\/g, '/')
    if (/__tests__|\.test\.|\.spec\.|node_modules/.test(normalizedPath)) return false

    // schema 文件
    if (/\/schema\.(ts|tsx)$/.test(normalizedPath)) return true
    if (/\/schemas?\//.test(normalizedPath)) return true
    if (/\/models?\//.test(normalizedPath)) return true

    return false
  }

  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
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

      // 1. 解析表定义
      const tables = this.parseTableDefinitions(sourceFile, filePath)
      nodes.push(...tables.nodes)

      // 2. 解析关系定义
      const relations = this.parseRelationDefinitions(sourceFile, filePath, tables.tableMap)
      edges.push(...relations)

      this.project.removeSourceFile(sourceFile)
    } catch (err) {
      errors.push({
        file: filePath,
        message: `Drizzle parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  /**
   * 解析表定义：const xxxTable = pgTable('xxx', { ... })
   */
  private parseTableDefinitions(sourceFile: SourceFile, filePath: string): { nodes: OmniNode[]; tableMap: Map<string, string> } {
    const nodes: OmniNode[] = []
    const tableMap = new Map<string, string>() // constName → nodeId

    sourceFile.forEachDescendant((node: Node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return

      const callExpr = node as CallExpression
      const expression = callExpr.getExpression()

      // 检查是否是 pgTable/mysqlTable/sqliteTable 调用
      const funcName = this.getTableFunctionName(expression)
      if (!funcName) return

      const args = callExpr.getArguments()
      if (args.length < 2) return

      // 提取表名（第一个参数）
      const tableNameArg = args[0]
      let tableName = ''
      if (Node.isStringLiteral(tableNameArg)) {
        tableName = tableNameArg.getLiteralValue()
      } else {
        tableName = tableNameArg.getText()
      }

      // 提取列定义（第二个参数）
      const columnsArg = args[1]
      const fields = Node.isObjectLiteralExpression(columnsArg)
        ? this.extractColumns(columnsArg)
        : []

      // 获取变量名
      let constName = tableName
      const parent = callExpr.getParent()
      if (parent && Node.isVariableDeclaration(parent)) {
        constName = parent.getName()
      }

      const nodeId = createNodeId('db_model', filePath, constName)
      const line = callExpr.getStartLineNumber()
      const dialect = DIALECT_MAP[funcName] ?? 'unknown'

      const metadata: DbModelMetadata & { dialect: string; isDrizzle: boolean } = {
        tableName,
        fieldCount: fields.length,
        fields,
        dialect,
        isDrizzle: true,
      }

      nodes.push({
        id: nodeId,
        type: 'db_model',
        name: constName,
        filePath,
        line,
        column: 1,
        metadata,
      })

      tableMap.set(constName, nodeId)
    })

    return { nodes, tableMap }
  }

  /**
   * 提取列定义
   */
  private extractColumns(objLiteral: ObjectLiteralExpression): DbFieldInfo[] {
    const fields: DbFieldInfo[] = []

    for (const prop of objLiteral.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue

      const name = prop.getName()
      const initializer = prop.getInitializer()

      let type = 'unknown'
      let isRequired = false
      let isId = false

      if (initializer) {
        // 检查链式调用
        const fullText = initializer.getText()

        // 提取列类型
        for (const colType of COLUMN_TYPES) {
          if (fullText.includes(`${colType}(`) || fullText.startsWith(colType)) {
            type = colType
            break
          }
        }

        // 检测 .notNull()
        isRequired = fullText.includes('.notNull()')
        // 检测 .primaryKey()
        isId = fullText.includes('.primaryKey()')
      }

      fields.push({
        name,
        type,
        isRequired,
        isId,
        isRelation: false,
      })
    }

    return fields
  }

  /**
   * 解析关系定义：relations(xxxTable, ({ one, many }) => ({ ... }))
   */
  private parseRelationDefinitions(sourceFile: SourceFile, filePath: string, tableMap: Map<string, string>): OmniEdge[] {
    const edges: OmniEdge[] = []

    sourceFile.forEachDescendant((node: Node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return

      const callExpr = node as CallExpression
      const expression = callExpr.getExpression()

      // 检查是否是 relations() 调用
      if (!Node.isIdentifier(expression) || expression.getText() !== 'relations') return

      const args = callExpr.getArguments()
      if (args.length < 2) return

      // 第一个参数是表引用
      const tableArg = args[0]
      let sourceTableName = ''
      if (Node.isIdentifier(tableArg)) {
        sourceTableName = tableArg.getText()
      }

      const sourceNodeId = tableMap.get(sourceTableName)
      if (!sourceNodeId) return

      // 第二个参数是回调函数，返回关系对象
      const callback = args[1]
      if (!Node.isArrowFunction(callback)) return

      const body = callback.getBody()
      if (!Node.isObjectLiteralExpression(body)) return

      // 解析关系属性
      for (const prop of body.getProperties()) {
        if (!Node.isPropertyAssignment(prop)) continue

        const relName = prop.getName()
        const initializer = prop.getInitializer()
        if (!initializer) continue

        const initText = initializer.getText()

        // 提取目标表名：many(postsTable) 或 one(postsTable)
        const manyMatch = initText.match(/many\((\w+)\)/)
        const oneMatch = initText.match(/one\((\w+)\)/)

        let targetTableName = ''
        let relationType: 'one_to_many' | 'one_to_one' = 'one_to_many'

        if (manyMatch) {
          targetTableName = manyMatch[1]
          relationType = 'one_to_many'
        } else if (oneMatch) {
          targetTableName = oneMatch[1]
          relationType = 'one_to_one'
        }

        const targetNodeId = tableMap.get(targetTableName)
        if (!targetNodeId) continue

        const edgeId = createEdgeId(sourceNodeId, 'db_relation', targetNodeId)
        edges.push({
          id: edgeId,
          source: sourceNodeId,
          target: targetNodeId,
          type: 'db_relation',
          confidence: 'certain',
          metadata: {
            relationType,
            relationName: relName,
          },
        })
      }
    })

    return edges
  }

  /**
   * 获取表函数名
   */
  private getTableFunctionName(expression: Node): string | null {
    if (Node.isIdentifier(expression)) {
      const name = expression.getText()
      if ((TABLE_FUNCTIONS as readonly string[]).includes(name)) return name
    }

    if (Node.isPropertyAccessExpression(expression)) {
      const methodName = expression.getName()
      if ((TABLE_FUNCTIONS as readonly string[]).includes(methodName)) return methodName
    }

    return null
  }
}
