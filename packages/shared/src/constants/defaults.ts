/**
 * 默认配置值
 *
 * 当用户未提供 .omnivis.json 时使用这些默认值。
 */

/** 默认 Web 服务端口 */
export const DEFAULT_PORT = 4321

/** 默认最大追踪深度 */
export const DEFAULT_MAX_TRACE_DEPTH = 5

/** 默认聚合阈值（节点数超过此值时自动聚合） */
export const DEFAULT_AGGREGATE_THRESHOLD = 100

/** 单个模块内节点超过此数才触发折叠 */
export const MODULE_FOLD_THRESHOLD = 5

/** 默认排除的目录/文件模式 */
export const DEFAULT_EXCLUDE = [
  'node_modules',
  'dist',
  '.next',
  'coverage',
  '.git',
  '.turbo',
  'build',
  'out',
]

/** 文件分类正则表达式 */
export const FILE_PATTERNS = {
  prismaSchema: /schema\.prisma$/,
  typeormEntity: /\.entity\.(ts|js)$/,
  nextjsPage: /app\/.*\/page\.(tsx|jsx|ts|js)$/,
  nextjsApiRoute: /app\/.*\/route\.(ts|js)$/,
  nextjsPagesApi: /pages\/api\//,
  nextjsPageLegacy: /pages\/(?!api\/)/,
  reactComponent: /\.(tsx|jsx)$/,
  typescriptFile: /\.(ts|js)$/,
  testFile: /__tests__/,
} as const
