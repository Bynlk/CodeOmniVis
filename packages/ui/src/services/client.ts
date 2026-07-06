/**
 * 统一 API 客户端底层封装（feature-001-service-layer）。
 *
 * 所有服务器请求必须经由此模块，禁止组件/hook 内散落裸 fetch。
 * 保持与重构前 100% 兼容：URL、method、body、返回结构均不变。
 */

import { isJsonObject } from '@codeomnivis/shared'

/** 统一 API 错误。携带 HTTP 状态，便于上层区分处理（如 429 限流）。 */
export class ApiError extends Error {
  readonly status: number
  readonly statusText: string
  constructor(status: number, statusText: string, message?: string) {
    super(message ?? `Request failed: ${status} ${statusText}`)
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
  }
}

export interface RequestOptions {
  signal?: AbortSignal
}

/**
 * 发起请求并解析为 JSON（返回 unknown 边界值，交由调用方类型收敛）。
 * 非 2xx 抛出 ApiError（保留 status，兼容 429 等分支判断）。
 */
export async function requestJson(
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText)
  }
  return (await res.json()) as unknown
}

/**
 * 仅需成功与否、不关心响应体的请求（如 POST /api/analyze）。
 * 非 2xx 抛出 ApiError。
 */
export async function requestOk(url: string, init?: RequestInit): Promise<void> {
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText)
  }
}

/** 从 { data } 包装中安全取出 data 字段。 */
export function unwrap(value: unknown): unknown {
  if (isJsonObject(value) && 'data' in value) return value.data
  return undefined
}

/** 构造 JSON POST 的 RequestInit（统一 header + body 序列化）。 */
export function jsonPost(body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }
}
