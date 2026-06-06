/**
 * @omnivis/analyzer — 代码分析引擎
 *
 * 负责解析 TypeScript 全栈项目，提取前端组件、后端 API、数据库关系三层结构。
 * 所有解析器遵循统一接口，输出标准化的 OmniGraph 数据。
 */

// 存储层
export { OmniDatabase } from './storage'
export type { DbError, DbStats } from './storage'

// 解析器
export { PrismaParser, NextjsAppParser, NextjsPagesParser, TrpcParser, ExpressParser, TypeormParser, ApiCallsParser, ReactComponentParser } from './parsers'

// 文件分类器
export { classifyFile } from './classifier'
export type { FileType, ClassificationResult } from './classifier'

// 图构建器
export { GraphBuilder } from './graph/builder'
export type { BuildResult } from './graph/builder'

// Resolver
export { PathAliasResolver } from './resolver/pathAlias'
export type { PathAliasConfig } from './resolver/pathAlias'
export { CrossLayerLinker } from './resolver/crossLayer'
export type { CrossLayerResult } from './resolver/crossLayer'

// 一致性检测
export { ConsistencyChecker } from './graph/consistency'
export type { ConsistencyReport } from './graph/consistency'
