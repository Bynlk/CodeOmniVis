/**
 * @codeomnivis/shared — 共享类型和常量
 *
 * 所有包通过此入口导入共享类型。
 * 不包含任何运行时逻辑，仅类型定义和常量。
 */

// JSON 边界类型导出
export type { JsonPrimitive, JsonValue, JsonObject } from './types/json'
export { isJsonObject, jsonObjectOrEmpty, readDependencies } from './types/json'

// 类型导出
export type {
  NodeType,
  OmniNode,
  NodeMetadata,
  NodeTypeMetadataMap,
  TypedOmniNode,
  PageMetadata,
  ComponentMetadata,
  ApiRouteMetadata,
  TrpcProcedureMetadata,
  TsrpcServiceMetadata,
  TsrpcApiMetadata,
  TsrpcMsgMetadata,
  ExpressRouteMetadata,
  HandlerMetadata,
  ServiceMetadata,
  DbFieldInfo,
  DbModelMetadata,
  ModuleMetadata,
  KotlinClassMetadata,
  KotlinInterfaceMetadata,
  KotlinObjectMetadata,
  KotlinFunctionMetadata,
  KotlinRouteMetadata,
} from './types/node'

export {
  createNodeId,
  createTypedNode,
  isNodeOfType,
  isNodeType,
  parseNodeId,
} from './types/node'

export type {
  EdgeType,
  EdgeConfidence,
  OmniEdge,
  EdgeMetadata,
  EdgeTypeMetadataMap,
  TypedOmniEdge,
  RendersMetadata,
  NavigatesToMetadata,
  CallsApiMetadata,
  HandlesMetadata,
  CallsServiceMetadata,
  QueriesDbMetadata,
  DbRelationMetadata,
  ContainsMetadata,
  ImportsMetadata,
  DataFlowsToMetadata,
} from './types/edge'

export {
  createEdgeId,
  createTypedEdge,
  isEdgeOfType,
  isEdgeType,
  parseEdgeId,
} from './types/edge'

export type {
  OmniGraph,
  ParseResult,
  ParseError,
  ParseContext,
  Parser,
  ProjectMeta,
  PackageInfo,
  FrameworkType,
  DatabaseType,
  MonorepoType,
  GraphSanitizeStats,
  GraphSanitizeResult,
} from './types/graph'

export {
  sanitizeGraph,
  mergeParseResults,
  getNode,
  getInEdges,
  getOutEdges,
  filterNodesByType,
  filterEdgesByType,
} from './types/graph'

export type {
  Issue,
  IssueSeverity,
  IssueType,
  IssueLocation,
  ConsistencyReport,
} from './types/issue'

export type {
  CodeOmniVisConfig,
} from './types/config'

// AI 请求/响应契约导出
export type {
  ChatRole,
  ChatMessage,
  AiConfig,
  AiChatRequest,
  AiChatResponse,
  AiEnvConfig,
  UpstreamUrlCheck,
} from './types/ai'

export {
  isChatMessage,
  isAiConfig,
  parseAiChatRequest,
  resolveAiConfig,
  validateUpstreamBaseUrl,
} from './types/ai'

// 数据新鲜度契约导出
export type {
  FreshnessState,
  FreshnessStatus,
} from './types/freshness'

export {
  isFreshnessState,
  isFreshnessStatus,
} from './types/freshness'

// 全链路追踪契约导出
export type {
  TraceLayer,
  TraceStep,
  TraceResult,
} from './types/trace'

export {
  TRACE_LAYER_ORDER,
  traceLayerForNodeType,
  isTraceLayer,
  isTraceStep,
  isTraceResult,
} from './types/trace'

// 常量导出
export { NODE_COLORS, NODE_COLORS_ALPHA, NODE_ICONS } from './constants/nodeColors'

export {
  DEFAULT_PORT,
  DEFAULT_MAX_TRACE_DEPTH,
  DEFAULT_AGGREGATE_THRESHOLD,
  MODULE_FOLD_THRESHOLD,
  DEFAULT_EXCLUDE,
  FILE_PATTERNS,
} from './constants/defaults'

// 工具函数导出（浏览器安全）
// 注意：getDbPath/hasDbCache/clearDbCache/loadConfig 依赖 Node.js API，
// 已移至 @codeomnivis/shared/node 入口，仅供 CLI/Server/MCP 使用。
