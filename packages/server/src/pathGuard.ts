/**
 * 路径边界守卫(H3 · S-01)
 *
 * 将外部传入路径规整后约束在配置边界根之内,阻断 `../` 穿越与越界绝对路径。
 * 相对路径相对边界根解析;绝对路径直接规整后比对。规范化后越界即拒绝。
 */

import path from 'path'

export interface BoundaryResolution {
  /** 规整后路径是否仍在边界根之内(含边界根本身)。 */
  readonly ok: boolean
  /** 规整后的绝对路径。 */
  readonly resolved: string
}

/**
 * 相对边界根解析输入路径并校验其未越界。
 *
 * @param boundaryRoot 允许访问的边界根(配置项目根)。
 * @param input 外部传入的路径(相对或绝对)。
 */
export function resolveWithinBoundary(boundaryRoot: string, input: string): BoundaryResolution {
  const root = path.resolve(boundaryRoot)
  const resolved = path.resolve(root, input)
  const rel = path.relative(root, resolved)
  const escapes = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)
  return { ok: !escapes, resolved }
}
