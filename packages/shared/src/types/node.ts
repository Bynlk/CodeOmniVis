/**
 * CodeOmniVis 节点类型定义
 *
 * 所有解析器输出的节点必须符合 OmniNode 接口。
 * 节点 ID 格式：{type}:{filePath}:{name}
 */

// ============================================================
// 节点类型枚举
// ============================================================

export type NodeType =
  | 'page'            // Next.js 页面路由 (/app/booking/page.tsx → /booking)
  | 'component'       // React 组件
  | 'api_route'       // Next.js API Route (/app/api/booking/route.ts)
  | 'trpc_procedure'  // tRPC procedure (booking.create)
  | 'tsrpc_service'   // TSRPC service API (xxx/login)
  | 'tsrpc_api'       // TSRPC API 接口（ApiCall 模式）
  | 'tsrpc_msg'       // TSRPC 消息服务（Msg 模式，发布/订阅）
  | 'express_route'   // Express 路由 (POST /api/booking)
  | 'handler'         // 路由 handler 函数
  | 'service'         // Service 层函数/类方法
  | 'db_model'        // Prisma Model / TypeORM Entity
  | 'module'          // 聚合节点（代表一组路由/组件的折叠视图）
  | 'kotlin_class'    // Kotlin class / data class / sealed class
  | 'kotlin_interface' // Kotlin interface
  | 'kotlin_object'   // Kotlin object 声明（含 companion object）
  | 'kotlin_function' // Kotlin 顶级函数 / 扩展函数
  | 'kotlin_route'    // Kotlin 路由端点（Spring @RequestMapping / Ktor routing）

const NODE_TYPES: NodeType[] = [
  'page',
  'component',
  'api_route',
  'trpc_procedure',
  'tsrpc_service',
  'tsrpc_api',
  'tsrpc_msg',
  'express_route',
  'handler',
  'service',
  'db_model',
  'module',
  'kotlin_class',
  'kotlin_interface',
  'kotlin_object',
  'kotlin_function',
  'kotlin_route',
]
const NODE_TYPE_SET = new Set<string>(NODE_TYPES)

// ============================================================
// 各类型节点的 Metadata
// ============================================================

export interface PageMetadata {
  route: string
  isDynamic: boolean
  params: string[]
  isGroupLayout: boolean
  layoutFile: string | null
}

export interface ComponentMetadata {
  props: string[]
  hasState: boolean
  isPage: boolean
  jsxChildCount: number
}

export interface ApiRouteMetadata {
  method: string
  route: string
  isNextApiRoute: boolean
}

export interface TrpcProcedureMetadata {
  procedureType: 'query' | 'mutation' | 'subscription'
  routerName: string
  procedureName: string
  hasInput: boolean
  hasOutput: boolean
}

export interface TsrpcServiceMetadata {
  /** TSRPC service 路径（如 xxx/login） */
  servicePath: string
  /** 传输协议 */
  transport: 'http' | 'ws'
  /** 请求类型名称 */
  reqTypeName: string | null
  /** 响应类型名称 */
  resTypeName: string | null
  /** 是否有自定义错误类型 */
  hasCustomError: boolean
  /** 是否是 WebSocket 消息类型（Msg* 前缀） */
  isMessage?: boolean
}

export interface TsrpcApiMetadata {
  /** TSRPC API 路径（如 user/login） */
  apiPath: string
  /** 传输协议 */
  transport: 'http' | 'ws'
  /** 请求类型名称 */
  reqTypeName: string | null
  /** 响应类型名称 */
  resTypeName: string | null
  /** 是否有自定义错误处理 */
  hasCustomError: boolean
  /** conf 配置项（如 needLogin） */
  conf?: Record<string, unknown>
  /** 对应的协议文件路径 */
  protocolFilePath?: string
}

export interface TsrpcMsgMetadata {
  /** 消息名称（如 Chat、TodoUpdate） */
  msgName: string
  /** 消息类型名称（如 MsgChat） */
  msgTypeName: string
  /** 传输协议（通常为 ws） */
  transport: 'ws' | 'http'
  /** 是否有实现文件（通常为 false，Msg 走发布/订阅） */
  hasImplementation: boolean
}

export interface ExpressRouteMetadata {
  method: string
  route: string
  middleware: string[]
}

export interface HandlerMetadata {
  functionName: string
  routeId: string | null  // 关联的路由节点 ID
}

export interface ServiceMetadata {
  className: string | null
  methodName: string
}

export interface DbFieldInfo {
  name: string
  type: string
  isRequired: boolean
  isId: boolean
  isRelation: boolean
}

export interface DbModelMetadata {
  tableName: string
  fieldCount: number
  fields: DbFieldInfo[]
}

export interface ModuleMetadata {
  childCount: number
  childTypes: NodeType[]
  routePrefix?: string    // 对于 API 路由模块
  dirPath?: string        // 对于组件模块
}

// ============================================================
// Kotlin 节点 Metadata
// ============================================================

export interface KotlinClassMetadata {
  className: string
  kind: 'data' | 'sealed' | 'abstract' | 'open' | 'value' | 'inner' | 'regular'
  packageName: string
  annotations: string[]
  superClass?: string
  interfaces: string[]
}

export interface KotlinInterfaceMetadata {
  interfaceName: string
  packageName: string
  annotations: string[]
  superInterfaces: string[]
}

export interface KotlinObjectMetadata {
  objectName: string
  packageName: string
  isCompanion: boolean
  annotations: string[]
}

export interface KotlinFunctionMetadata {
  functionName: string
  packageName: string
  isTopLevel: boolean
  isExtension: boolean
  receiverType?: string
  returnType?: string
  annotations: string[]
}

export interface KotlinRouteMetadata {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  path: string
  framework: 'ktor' | 'spring'
  annotations: string[]
}

// ============================================================
// Metadata 联合类型
// ============================================================

export type NodeMetadata = NodeTypeMetadataMap[NodeType]

// ============================================================
// 核心节点接口
// ============================================================

/**
 * 由 `type` 字段驱动 `metadata` 的封闭节点类型。
 * `type` 决定 `metadata` 的具体形状，业务层通过 isNodeOfType 收窄后直接读字段。
 */
export type TypedOmniNode<T extends NodeType> = {
  /** 唯一 ID，格式：{type}:{filePath}:{name} */
  id: string
  /** 节点类型 */
  type: T
  /** 显示名称 */
  name: string
  /** 相对于项目根目录的文件路径 */
  filePath: string
  /** 定义所在行号 */
  line: number
  /** 定义所在列号 */
  column: number
  /** 类型特定的额外信息 */
  metadata: NodeTypeMetadataMap[T]
}

/** 所有节点类型的判别联合（discriminated union）。 */
export type OmniNode = {
  [T in NodeType]: TypedOmniNode<T>
}[NodeType]

// ============================================================
// 节点类型 → Metadata 类型映射（用于类型推导）
// ============================================================

export type NodeTypeMetadataMap = {
  page: PageMetadata
  component: ComponentMetadata
  api_route: ApiRouteMetadata
  trpc_procedure: TrpcProcedureMetadata
  tsrpc_service: TsrpcServiceMetadata
  tsrpc_api: TsrpcApiMetadata
  tsrpc_msg: TsrpcMsgMetadata
  express_route: ExpressRouteMetadata
  handler: HandlerMetadata
  service: ServiceMetadata
  db_model: DbModelMetadata
  module: ModuleMetadata
  kotlin_class: KotlinClassMetadata
  kotlin_interface: KotlinInterfaceMetadata
  kotlin_object: KotlinObjectMetadata
  kotlin_function: KotlinFunctionMetadata
  kotlin_route: KotlinRouteMetadata
}

// ============================================================
// 工具函数
// ============================================================

export function isNodeType(value: string): value is NodeType {
  return NODE_TYPE_SET.has(value)
}

export function isNodeOfType<T extends NodeType>(
  node: OmniNode,
  type: T
): node is Extract<OmniNode, { type: T }> {
  return node.type === type
}

/** 类型安全的节点工厂：`type` 与 `metadata` 由编译器强制对应。 */
export function createTypedNode<T extends NodeType>(
  node: TypedOmniNode<T>
): TypedOmniNode<T> {
  return node
}

/** 生成节点 ID */
export function createNodeId(type: NodeType, filePath: string, name: string): string {
  return `${type}:${filePath}:${name}`
}

/** 解析节点 ID */
export function parseNodeId(id: string): { type: NodeType; filePath: string; name: string } {
  const parts = id.split(':')
  if (parts.length < 3) {
    throw new Error(`Invalid node ID format: ${id}`)
  }
  if (!isNodeType(parts[0])) {
    throw new Error(`Invalid node type in ID: ${id}`)
  }
  return {
    type: parts[0],
    filePath: parts[1],
    name: parts.slice(2).join(':'),  // name 可能包含 ':'
  }
}
