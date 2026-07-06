/**
 * 状态领域服务（feature-001-service-layer）。
 * 封装 GET /api/status 与 GET /api/health。
 */

import type { FreshnessStatus } from '@codeomnivis/shared'
import { isJsonObject, isFreshnessStatus } from '@codeomnivis/shared'
import { requestJson } from './client'

export async function getStatus(): Promise<FreshnessStatus> {
  const json = await requestJson('/api/status')
  const data = isJsonObject(json) ? json.data : undefined
  if (!isFreshnessStatus(data)) throw new Error('Invalid status response')
  return data
}

export async function getHealth(): Promise<unknown> {
  return requestJson('/api/health')
}
