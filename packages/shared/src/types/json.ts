/**
 * JSON 边界类型。
 *
 * 外部输入（DB JSON、HTTP body、MCP 参数）以 `unknown` 进入系统，
 * 通过这些 guard 在边界收敛为 `JsonObject`，业务层不再读 `Record<string, unknown>`。
 */

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject
export type JsonObject = { [key: string]: JsonValue }

/** 是否为普通 JSON 对象（排除数组与 null）。 */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 非对象输入归一化为空对象，保持调用方拿到的始终是 `JsonObject`。 */
export function jsonObjectOrEmpty(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {}
}

/**
 * 从 package.json 解析结果(unknown)中提取并合并 dependencies / devDependencies。
 * 在边界处把 `any`/`unknown` 收敛为字符串依赖映射,调用方按 key 查询恒为 `string | undefined`。
 */
export function readDependencies(value: unknown): Record<string, string> {
  const root = jsonObjectOrEmpty(value)
  const deps = jsonObjectOrEmpty(root.dependencies)
  const devDeps = jsonObjectOrEmpty(root.devDependencies)
  const result: Record<string, string> = {}
  for (const [name, version] of Object.entries({ ...deps, ...devDeps })) {
    if (typeof version === 'string') result[name] = version
  }
  return result
}
