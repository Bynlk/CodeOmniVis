import { isJsonObject } from '@codeomnivis/shared'

/** 从 unknown 对象中安全读取字符串属性，不存在则返回 undefined。 */
export function readString(obj: unknown, key: string): string | undefined {
  if (isJsonObject(obj) && typeof obj[key] === 'string') return obj[key]
  return undefined
}
