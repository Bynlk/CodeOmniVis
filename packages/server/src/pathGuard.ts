/**
 * 路径边界守卫(H3 · S-01 / S-05)
 *
 * 将外部传入路径规整后约束在配置边界根之内,阻断 `../` 穿越与越界绝对路径。
 * 相对路径相对边界根解析;绝对路径直接规整后比对。规范化后越界即拒绝。
 *
 * S-05:仅靠 `path.resolve/relative` 的字面量比对无法防御 symlink ——
 * 边界内的 symlink 可指向边界外目录,后续 `fs.statSync` 会跟随它逃逸边界。
 * 因此在字面量校验通过后,再对边界根与候选路径做 `fs.realpathSync.native`,
 * 用解析真实路径后的结果二次比对;任一已存在的路径段指向边界外即拒绝。
 */

import path from 'path'
import fs from 'fs'

export interface BoundaryResolution {
  /** 规整后路径是否仍在边界根之内(含边界根本身)。 */
  readonly ok: boolean
  /** 规整后的绝对路径。 */
  readonly resolved: string
}

/** 判断 child 是否在 parent 之内(含 parent 本身)。两者均须为已规整的绝对路径。 */
function isWithin(parent: string, child: string): boolean {
  if (parent === child) return true
  const rel = path.relative(parent, child)
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
}

/**
 * 对路径做 realpath 解析。若路径(或其父链)尚不存在,则解析能解析到的最深前缀,
 * 再把剩余不存在的尾部拼回。这样既能解开已存在的 symlink,又不会因目标尚未创建而抛错。
 */
function realpathBestEffort(target: string): string {
  let current = path.resolve(target)
  const tail: string[] = []
  // 逐级向上回退,直到找到一个真实存在的前缀。
  for (;;) {
    try {
      const real = fs.realpathSync.native(current)
      return tail.length === 0 ? real : path.join(real, ...tail.reverse())
    } catch {
      const parent = path.dirname(current)
      if (parent === current) {
        // 到达根仍无法解析:返回原始规整路径。
        return path.resolve(target)
      }
      tail.push(path.basename(current))
      current = parent
    }
  }
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
  if (escapes) {
    return { ok: false, resolved }
  }

  // S-05:字面量校验通过后,再用真实路径(解开 symlink)做二次边界校验。
  const realRoot = realpathBestEffort(root)
  const realResolved = realpathBestEffort(resolved)
  if (!isWithin(realRoot, realResolved)) {
    return { ok: false, resolved }
  }

  return { ok: true, resolved }
}
