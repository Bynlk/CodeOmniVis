/**
 * CodeOmniVis 配置文件类型定义
 *
 * 对应 .codeomnivis.json 配置文件。
 * "零配置"意味着无需配置也能运行，但支持可选配置覆盖默认行为。
 */

export interface CodeOmniVisConfig {
  /** 项目根目录（默认 "."） */
  root?: string

  /** 前端配置 */
  frontend?: {
    /** 前端源码目录 */
    dirs?: string[]
    /** 前端框架（auto = 自动检测） */
    framework?: 'next' | 'react' | 'vue' | 'auto'
  }

  /** 后端配置 */
  backend?: {
    /** 后端源码目录 */
    dirs?: string[]
    /** 后端框架（auto = 自动检测） */
    framework?: 'express' | 'trpc' | 'fastify' | 'auto'
  }

  /** 数据库配置 */
  database?: {
    /** Prisma schema 文件路径 */
    prismaSchema?: string
    /** TypeORM entity 目录 */
    typeormDirs?: string[]
  }

  /** 排除的目录/文件模式 */
  exclude?: string[]

  /** Web 服务端口（默认 4321） */
  port?: number

  /** 解析器配置 */
  parser?: {
    /** 最大追踪深度（默认 5） */
    maxTraceDepth?: number
    /** 是否启用增量解析（默认 true） */
    incremental?: boolean
  }

  /** 可视化配置 */
  ui?: {
    /** 主题 */
    theme?: 'dark' | 'light'
    /** 默认布局 */
    layout?: 'dagre' | 'grid' | 'circle'
    /** 聚合阈值（节点数超过此值时自动聚合，默认 100） */
    aggregateThreshold?: number
  }
}
