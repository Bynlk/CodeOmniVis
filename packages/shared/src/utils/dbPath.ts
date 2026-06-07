import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as crypto from 'crypto'

/**
 * 根据项目根路径生成唯一的 SQLite 文件路径
 * 存放在 ~/.codeomnivis/projects/{hash}.db
 * 同一个项目无论从哪里调用，总是得到同一个路径
 */
export function getDbPath(projectRoot: string): string {
  const absRoot = path.resolve(projectRoot)
  const hash = crypto
    .createHash('md5')
    .update(absRoot)
    .digest('hex')
    .slice(0, 12)

  const dir = path.join(os.homedir(), '.codeomnivis', 'projects')
  fs.mkdirSync(dir, { recursive: true })

  return path.join(dir, `${hash}.db`)
}

/**
 * 检查项目是否已有分析缓存
 */
export function hasDbCache(projectRoot: string): boolean {
  return fs.existsSync(getDbPath(projectRoot))
}

/**
 * 删除项目缓存（用于 codeomnivis init --clean）
 */
export function clearDbCache(projectRoot: string): void {
  const p = getDbPath(projectRoot)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
