import { isJsonObject } from '@codeomnivis/shared'

/** 从 API 响应中提取 data 字段。输入为 unknown 边界值，安全提取。 */
export function unwrapData(value: unknown): unknown {
  if (isJsonObject(value) && 'data' in value) return value.data
  return undefined
}
