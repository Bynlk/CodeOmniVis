/**
 * 项目领域服务（feature-001-service-layer）。
 * 封装 POST /api/analyze 与 POST /api/project。
 */

import { isJsonObject } from '@codeomnivis/shared'
import { requestJson, requestOk, jsonPost } from './client'

export interface ProjectInfo {
  projectRoot: string
}

export async function getProject(): Promise<ProjectInfo> {
  const payload = await requestJson('/api/project')
  const data = isJsonObject(payload) ? payload.data : undefined
  if (!isJsonObject(data) || typeof data.projectRoot !== 'string') {
    throw new Error('Invalid project response')
  }
  return { projectRoot: data.projectRoot }
}

export function isAbsoluteProjectPath(projectRoot: string): boolean {
  const value = projectRoot.trim()
  return value.startsWith('/')
    || /^[A-Za-z]:[\\/]/.test(value)
    || /^\\\\[^\\]+\\[^\\]+/.test(value)
}

/** 触发重新分析。成功即可，非 2xx 抛 ApiError。 */
export async function postAnalyze(): Promise<void> {
  await requestOk('/api/analyze', { method: 'POST' })
}

export interface SwitchProjectResult {
  ok: boolean
  projectRoot?: string
  errorMessage?: string
}

/**
 * 切换项目根目录。保留原有 { data.projectRoot } / { error.message } 解析语义，
 * 返回结构化结果，不在此抛错（由调用方决定 UI 反馈）。
 */
export async function postProject(projectRoot: string): Promise<SwitchProjectResult> {
  const res = await fetch('/api/project', jsonPost({ projectRoot }))
  const payload: unknown = await res.json().catch(() => undefined)
  if (res.ok) {
    const data = isJsonObject(payload) ? payload.data : undefined
    const resolved = isJsonObject(data) && typeof data.projectRoot === 'string'
      ? data.projectRoot
      : undefined
    return { ok: true, projectRoot: resolved }
  }
  const err = isJsonObject(payload) ? payload.error : undefined
  const message = isJsonObject(err) && typeof err.message === 'string' ? err.message : undefined
  return { ok: false, errorMessage: message }
}
