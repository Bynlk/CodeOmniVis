/**
 * 路径别名解析器
 *
 * 读取 tsconfig.json 的 paths 配置。
 * 使用 TypeScript 的 resolveModuleName 解析别名。
 *
 * 遵循"降级而非崩溃"原则。
 */

import * as path from 'path'
import * as fs from 'fs'
import * as ts from 'typescript'

// ============================================================
// 类型定义
// ============================================================

export interface PathAliasConfig {
  /** 别名映射：@/components → ./src/components */
  aliases: Record<string, string[]>
  /** baseUrl */
  baseUrl: string
}

// ============================================================
// 路径别名解析器
// ============================================================

export class PathAliasResolver {
  private config: PathAliasConfig | null = null
  private projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  /**
   * 加载 tsconfig.json 的 paths 配置
   */
  loadConfig(tsConfigPath?: string | null): void {
    const configPath = tsConfigPath || this.findTsConfig()

    if (!configPath) {
      this.config = { aliases: {}, baseUrl: this.projectRoot }
      return
    }

    try {
      const fullPath = path.resolve(this.projectRoot, configPath)
      const configFile = ts.readConfigFile(fullPath, ts.sys.readFile)

      if (configFile.error) {
        console.warn(`Failed to read tsconfig: ${configFile.error.messageText}`)
        this.config = { aliases: {}, baseUrl: this.projectRoot }
        return
      }

      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        this.projectRoot
      )

      const baseUrl = parsedConfig.options.baseUrl || '.'
      const paths = parsedConfig.options.paths || {}

      // 转换 paths 格式
      const aliases: Record<string, string[]> = {}
      for (const [key, values] of Object.entries(paths)) {
        aliases[key] = (values as string[]).map(v =>
          path.resolve(this.projectRoot, baseUrl, v)
        )
      }

      this.config = {
        aliases,
        baseUrl: path.resolve(this.projectRoot, baseUrl),
      }
    } catch (err) {
      console.warn(`Failed to parse tsconfig: ${err}`)
      this.config = { aliases: {}, baseUrl: this.projectRoot }
    }
  }

  /**
   * 解析路径别名
   * @param importPath - import 路径（如 @/components/Button）
   * @param fromFile - 导入文件的路径
   * @returns 解析后的绝对路径，如果无法解析返回 null
   */
  resolve(importPath: string, fromFile: string): string | null {
    if (!this.config) {
      this.loadConfig()
    }

    // 如果不是别名路径，直接返回 null
    if (!this.isAliasPath(importPath)) {
      return null
    }

    // 尝试匹配别名
    for (const [alias, targets] of Object.entries(this.config!.aliases)) {
      const aliasPattern = alias.replace('*', '(.*)')
      const match = importPath.match(new RegExp(`^${aliasPattern}$`))

      if (match) {
        // 替换通配符
        const captured = match[1] || ''

        for (const target of targets) {
          const resolved = target.replace('*', captured)

          // 尝试添加扩展名
          const withExt = this.tryAddExtension(resolved)
          if (withExt) {
            return withExt
          }

          // 尝试作为目录（index 文件）
          const asDir = this.tryAsDirectory(resolved)
          if (asDir) {
            return asDir
          }
        }
      }
    }

    return null
  }

  /**
   * 判断是否是别名路径
   */
  private isAliasPath(importPath: string): boolean {
    // 以 @ 开头的通常是别名
    if (importPath.startsWith('@')) {
      return true
    }

    // 检查是否匹配任何配置的别名
    if (this.config) {
      for (const alias of Object.keys(this.config.aliases)) {
        const pattern = alias.replace('*', '.*')
        if (new RegExp(`^${pattern}$`).test(importPath)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * 尝试添加扩展名
   */
  private tryAddExtension(filePath: string): string | null {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.d.ts']

    for (const ext of extensions) {
      const withExt = filePath + ext
      if (fs.existsSync(withExt)) {
        return withExt
      }
    }

    return null
  }

  /**
   * 尝试作为目录（查找 index 文件）
   */
  private tryAsDirectory(dirPath: string): string | null {
    const indexNames = ['index.ts', 'index.tsx', 'index.js', 'index.jsx']

    for (const indexName of indexNames) {
      const indexPath = path.join(dirPath, indexName)
      if (fs.existsSync(indexPath)) {
        return indexPath
      }
    }

    return null
  }

  /**
   * 查找 tsconfig.json
   */
  private findTsConfig(): string | null {
    const possiblePaths = [
      'tsconfig.json',
      'tsconfig.base.json',
      'tsconfig.app.json',
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(path.join(this.projectRoot, p))) {
        return p
      }
    }

    return null
  }

  /**
   * 获取所有别名前缀
   */
  getAliasPrefixes(): string[] {
    if (!this.config) {
      this.loadConfig()
    }

    return Object.keys(this.config!.aliases).map(alias =>
      alias.replace('/*', '')
    )
  }
}
