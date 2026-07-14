/**
 * @codeomnivis/analyzer — 代码分析引擎
 *
 * 负责解析 TypeScript 全栈项目，提取前端组件、后端 API、数据库关系三层结构。
 * 所有解析器遵循统一接口，输出标准化的 OmniGraph 数据。
 */

// 存储层
export { OmniDatabase } from './storage'
export type { DbError, DbStats } from './storage'

// 解析器
export { PrismaParser, NextjsAppParser, NextjsPagesParser, TrpcParser, TsRpcParser, ExpressParser, TypeormParser, ApiCallsParser, ReactComponentParser, NestjsControllerParser, NestjsModuleParser, NestjsServiceParser, DrizzleParser } from './parsers'

// 文件分类器
export { classifyFile } from './classifier'
export type { FileType, ClassificationResult } from './classifier'

// 图构建器
export { GraphBuilder } from './graph/builder'
export { createDefaultParsers } from './graph/createDefaultParsers'
export type { BuildResult } from './graph/builder'

// 一键分析
export { runAnalysis } from './graph/runAnalysis'
export type { RunAnalysisOptions, RunAnalysisResult } from './graph/runAnalysis'
export { collectAnalysisFiles, collectSourceFiles } from './graph/collectAnalysisFiles'
export { AnalysisError } from './graph/analysisError'
export type { AnalysisErrorCode } from './graph/analysisError'
export { runFullAnalysis } from './graph/runFullAnalysis'
export type { FullAnalysisOptions, FullAnalysisResult } from './graph/runFullAnalysis'
export { analyzeProject } from './graph/analyzeProject'
export type {
  AnalysisProgressEvent,
  AnalysisProgressPhase,
  AnalysisStore,
  AnalyzeProjectOptions,
} from './graph/analyzeProject'
export {
  collectConfiguredScanDirs,
  computeProjectFingerprint,
  computeSourceDigest,
  detectProject,
  discoverWorkspacePackages,
  ProjectDetectionError,
  resolveProjectRoot,
} from './project'
export type { ProjectDetectionWarning } from './project'

export { createDefaultTestAdapters, discoverTests, importJunitXml, projectTestView } from './tests'
export type { TestView, TestViewFilters, TestViewSummary } from './tests'
export type { TestAdapter, TestDiscoveryContext } from './tests'

// Resolver
export { PathAliasResolver } from './resolver/pathAlias'
export type { PathAliasConfig } from './resolver/pathAlias'
export { CrossLayerLinker } from './resolver/crossLayer'
export type { CrossLayerResult } from './resolver/crossLayer'
export { SymbolResolver } from './resolver/symbolResolver'
export type { DbCall, TraceResult } from './resolver/symbolResolver'

// 一致性检测
export { ConsistencyChecker } from './graph/consistency'
export type { ConsistencyReport } from '@codeomnivis/shared'

// 数据流追踪
export { DataFlowTracer } from './resolver/dataFlowTracer'
export type { DataFlowPath, DataFlowEdge, DataFlowResult } from './resolver/dataFlowTracer'

// 深度分析检测器
export { NPlusOneDetector } from './resolver/nPlusOneDetector'
export { AuthDetector } from './resolver/authDetector'
export { RSCBoundaryDetector } from './resolver/rscBoundaryDetector'
