/**
 * Prisma Schema 解析器
 *
 * 使用 @prisma/internals 的 getDMMF 提取 Model 和 Relation。
 * Prisma DMMF 不暴露行号，需要在原始文件中用 regex 定位。
 *
 * 遵循"降级而非崩溃"原则：解析失败返回空结果 + warning。
 */

import * as fs from 'fs'
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
  DbRelationMetadata,
} from '@omnivis/shared'
import { createNodeId, createEdgeId } from '@omnivis/shared'

// ============================================================
// Prisma 解析器
// ============================================================

export class PrismaParser implements Parser {
  readonly name = 'prisma'

  /**
   * 判断是否能处理该文件
   */
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    // 如果是 prisma schema 文件
    if (filePath.endsWith('.prisma')) {
      return true
    }

    // 如果项目检测到使用 prisma
    if (projectMeta.databaseType === 'prisma') {
      return filePath === projectMeta.prismaSchemaPath
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
      // 动态导入 @prisma/internals (CJS 兼容)
      const prismaInternals = await import('@prisma/internals')
      const getDMMF = prismaInternals.getDMMF || prismaInternals.default?.getDMMF

      if (!getDMMF) {
        errors.push({
          file: filePath,
          message: 'Failed to load @prisma/internals',
          severity: 'error',
        })
        return { nodes, edges, errors }
      }

      // 读取 schema 文件
      const schemaPath = path.resolve(context.projectRoot, filePath)
      if (!fs.existsSync(schemaPath)) {
        errors.push({
          file: filePath,
          message: `Prisma schema file not found: ${schemaPath}`,
          severity: 'error',
        })
        return { nodes, edges, errors }
      }

      const schemaContent = fs.readFileSync(schemaPath, 'utf-8')

      // 使用 DMMF 解析
      const dmmf = await getDMMF({
        datamodel: schemaContent,
      })

      // 解析所有 Model
      for (const model of dmmf.datamodel.models) {
        try {
          const modelNode = this.parseModel(model, filePath, schemaContent)
          nodes.push(modelNode)

          // 解析关系字段，生成边
          const relationEdges = this.parseRelations(model, filePath, dmmf)
          edges.push(...relationEdges)
        } catch (err) {
          errors.push({
            file: filePath,
            message: `Failed to parse model ${model.name}: ${err instanceof Error ? err.message : String(err)}`,
            severity: 'warning',
          })
        }
      }

      // 解析 Enum（作为特殊节点）
      // 当前版本不处理 Enum，后续可扩展

    } catch (err) {
      errors.push({
        file: filePath,
        message: `Prisma DMMF parsing failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  /**
   * 解析单个 Model 为 OmniNode
   */
  private parseModel(model: any, filePath: string, schemaContent: string): OmniNode {
    const nodeId = createNodeId('db_model', filePath, model.name)
    const line = this.findModelLine(schemaContent, model.name)

    // 提取字段信息
    const fields: DbFieldInfo[] = model.fields
      .filter((f: any) => !f.relationName)  // 排除关系字段
      .map((f: any) => ({
        name: f.name,
        type: f.type,
        isRequired: f.isRequired,
        isId: f.isId,
        isRelation: false,
      }))

    const metadata: DbModelMetadata = {
      tableName: model.dbName || model.name.toLowerCase() + 's',
      fieldCount: fields.length,
      fields,
    }

    return {
      id: nodeId,
      type: 'db_model',
      name: model.name,
      filePath,
      line,
      column: 1,
      metadata,
    }
  }

  /**
   * 解析 Model 的关系字段，生成 db_relation 边
   */
  private parseRelations(model: any, filePath: string, dmmf: any): OmniEdge[] {
    const edges: OmniEdge[] = []

    for (const field of model.fields) {
      if (!field.relationName) continue

      // 找到关系的对方 Model
      const targetModelName = field.type
      const sourceNodeId = createNodeId('db_model', filePath, model.name)
      const targetNodeId = createNodeId('db_model', filePath, targetModelName)

      // 确定关系类型
      const relationType = this.getRelationType(field)

      // 获取关系详情
      const relation = model.relationFrom?.find((r: any) => r.name === field.relationName) || null

      const edgeId = createEdgeId(sourceNodeId, 'db_relation', targetNodeId)

      const metadata: DbRelationMetadata = {
        relationType,
        fieldName: field.name,
        relationName: field.relationName,
      }

      const edge: OmniEdge = {
        id: edgeId,
        source: sourceNodeId,
        target: targetNodeId,
        type: 'db_relation',
        confidence: 'certain',
        metadata,
      }

      edges.push(edge)
    }

    return edges
  }

  /**
   * 根据字段信息判断关系类型
   */
  private getRelationType(field: any): 'one_to_one' | 'one_to_many' | 'many_to_many' {
    // 如果字段是列表，那就是一对多（从对方角度看）
    if (field.isList) {
      return 'one_to_many'
    }

    // 如果字段有 @unique，那就是一对一
    if (field.isUnique) {
      return 'one_to_one'
    }

    // 默认一对一
    return 'one_to_one'
  }

  /**
   * 在原始文件中查找 Model 定义的行号
   * Prisma DMMF 不暴露行号，所以需要 grep 原始文件
   */
  private findModelLine(schemaContent: string, modelName: string): number {
    const lines = schemaContent.split('\n')
    const modelPattern = new RegExp(`^model\\s+${modelName}\\s*\\{`)

    for (let i = 0; i < lines.length; i++) {
      if (modelPattern.test(lines[i].trim())) {
        return i + 1  // 行号从 1 开始
      }
    }

    return 1  // 默认行号
  }
}
