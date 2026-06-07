/**
 * CodeOmniVis 图数据结构定义
 *
 * OmniGraph 是整个系统的核心数据结构，
 * 所有解析结果最终统一转换为此格式。
 */

import type { OmniNode, NodeType } from './node'
import type { OmniEdge, EdgeType } from './edge'

// ============================================================
// 图数据结构
// ============================================================

export interface OmniGraph {
  nodes: OmniNode[]
  edges: OmniEdge[]
}

// ============================================================
// 解析结果（Parser 输出）
// ============================================================

export interface ParseError {
  /** 出错的文件路径 */
  file: string
  /** 错误消息 */
  message: string
  /** 严重级别 */
  severity: 'error' | 'warning' | 'info'
  /** 原始错误对象（可选） */
  originalError?: Error
}

export interface ParseResult {
  nodes: OmniNode[]
  edges: OmniEdge[]
  errors: ParseError[]
}

// ============================================================
// 项目元数据
// ============================================================

export type FrameworkType = 'next' | 'express' | 'trpc' | 'nestjs' | 'spring' | 'ktor' | 'unknown'
export type DatabaseType = 'prisma' | 'typeorm' | 'drizzle' | 'exposed' | 'room' | 'unknown'
export type MonorepoType = 'turborepo' | 'pnpm' | 'none'

export interface ProjectMeta {
  /** 项目根目录 */
  root: string
  /** 检测到的前端框架 */
  frontendFramework: FrameworkType
  /** 检测到的后端框架 */
  backendFramework: FrameworkType
  /** 检测到的数据库 ORM */
  databaseType: DatabaseType
  /** monorepo 类型 */
  monorepoType: MonorepoType
  /** 前端目录 */
  frontendDirs: string[]
  /** 后端目录 */
  backendDirs: string[]
  /** tRPC router 文件路径 */
  trpcRouterPaths: string[]
  /** Prisma schema 路径 */
  prismaSchemaPath: string | null
  /** TypeORM entity 目录 */
  typeormEntityDirs: string[]
  /** tsconfig.json 路径 */
  tsConfigPath: string | null
  /** Gradle 构建文件路径（Kotlin 项目） */
  buildFile: string | null
  /** 包列表（monorepo 时） */
  packages: PackageInfo[]
}

export interface PackageInfo {
  name: string
  path: string
  dependencies: string[]
  devDependencies: string[]
}

// ============================================================
// 解析上下文（传给 Parser）
// ============================================================

export interface ParseContext {
  /** 项目根目录 */
  projectRoot: string
  /** 项目元数据 */
  projectMeta: ProjectMeta
  /** tsconfig 解析结果 */
  tsConfig: import('typescript').ParsedCommandLine | null
  /** 路径别名映射 */
  pathAliases: Record<string, string>
}

// ============================================================
// Parser 接口
// ============================================================

export interface Parser {
  /** 解析器名称 */
  name: string
  /** 判断是否能处理该文件 */
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean
  /** 执行解析 */
  parse(filePath: string, context: ParseContext): Promise<ParseResult>
}

// ============================================================
// 工具函数
// ============================================================

/** 合并多个 ParseResult */
export function mergeParseResults(...results: ParseResult[]): ParseResult {
  return {
    nodes: results.flatMap(r => r.nodes),
    edges: results.flatMap(r => r.edges),
    errors: results.flatMap(r => r.errors),
  }
}

/** 从图中获取节点 */
export function getNode(graph: OmniGraph, id: string): OmniNode | undefined {
  return graph.nodes.find(n => n.id === id)
}

/** 从图中获取节点的入边 */
export function getInEdges(graph: OmniGraph, nodeId: string): OmniEdge[] {
  return graph.edges.filter(e => e.target === nodeId)
}

/** 从图中获取节点的出边 */
export function getOutEdges(graph: OmniGraph, nodeId: string): OmniEdge[] {
  return graph.edges.filter(e => e.source === nodeId)
}

/** 按类型过滤节点 */
export function filterNodesByType(graph: OmniGraph, type: NodeType): OmniNode[] {
  return graph.nodes.filter(n => n.type === type)
}

/** 按类型过滤边 */
export function filterEdgesByType(graph: OmniGraph, type: EdgeType): OmniEdge[] {
  return graph.edges.filter(e => e.type === type)
}
