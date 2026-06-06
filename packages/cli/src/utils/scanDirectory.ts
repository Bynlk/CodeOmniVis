/**
 * 递归扫描目录，返回所有 TypeScript/JavaScript 文件
 *
 * @param dir - 要扫描的目录
 * @param rootDir - 项目根目录（用于返回相对路径）
 * @returns 相对路径数组（使用 / 分隔符）
 */

import * as fs from 'fs'
import * as path from 'path'

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']
const IGNORE_DIRS = ['node_modules', '.next', 'dist', 'build', '.git']

export function scanDirectory(dir: string, rootDir: string): string[] {
  const files: string[] = []

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name)) {
          files.push(...scanDirectory(fullPath, rootDir))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (EXTENSIONS.includes(ext)) {
          // 返回相对路径
          files.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'))
        }
      }
    }
  } catch (err) {
    // 忽略无法读取的目录
  }

  return files
}
