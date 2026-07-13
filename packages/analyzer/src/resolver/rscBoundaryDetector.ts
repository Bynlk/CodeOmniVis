/**
 * React Server Component 边界检测器
 *
 * 检测 'use client' / 'use server' 指令。
 * 检测 server component import client component 的违规。
 *
 * 遵循"降级而非崩溃"原则。
 */

import * as fs from 'fs'
import * as path from 'path'
import type { OmniGraph, OmniNode, Issue } from '@codeomnivis/shared'

// ============================================================
// RSC 边界检测器
// ============================================================

export class RSCBoundaryDetector {
  /**
   * 检测图中所有组件的 RSC 边界违规
   */
  detect(graph: OmniGraph, projectRoot: string): Issue[] {
    const issues: Issue[] = []

    // 只检测 component 和 page 节点
    const componentNodes = graph.nodes.filter(n =>
      n.type === 'component' || n.type === 'page'
    )

    // 按文件分组
    const byFile = new Map<string, OmniNode[]>()
    for (const node of componentNodes) {
      const fullPath = this.resolveFilePath(node.filePath, projectRoot)
      if (!fullPath) continue
      const existing = byFile.get(fullPath) || []
      existing.push(node)
      byFile.set(fullPath, existing)
    }

    // 预先检测所有文件的 directive
    const fileDirectives = new Map<string, 'client' | 'server' | 'none'>()
    for (const [fullPath] of byFile) {
      if (!fs.existsSync(fullPath)) continue
      try {
        const content = fs.readFileSync(fullPath, 'utf-8')
        fileDirectives.set(fullPath, this.detectDirective(content))
      } catch {
        // 降级
      }
    }

    // 检测违规
    for (const [fullPath, nodes] of byFile) {
      if (!fs.existsSync(fullPath)) continue

      const directive = fileDirectives.get(fullPath) || 'none'

      // 只检查 server component（默认没有 'use client' 指令的组件）
      if (directive === 'client') continue

      try {
        const fileIssues = this.checkBoundaryViolations(fullPath, nodes, fileDirectives, projectRoot)
        issues.push(...fileIssues)
      } catch {
        // 降级
      }
    }

    return issues
  }

  /**
   * 检测文件头部的 directive
   */
  private detectDirective(content: string): 'client' | 'server' | 'none' {
    // 只检查文件开头的前 500 个字符（directive 必须在文件最顶部）
    const header = content.substring(0, 500).trimStart()

    if (/^['"]use client['"]/.test(header)) return 'client'
    if (/^['"]use server['"]/.test(header)) return 'server'
    return 'none'
  }

  /**
   * 检查 server component 是否 import 了 client component
   */
  private checkBoundaryViolations(
    fullPath: string,
    nodes: OmniNode[],
    fileDirectives: Map<string, 'client' | 'server' | 'none'>,
    projectRoot: string
  ): Issue[] {
    const issues: Issue[] = []

    const content = fs.readFileSync(fullPath, 'utf-8')

    // 解析 import 语句
    const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null

    while ((m = importRegex.exec(content)) !== null) {
      if (m[0].includes('import type')) continue

      const importPath = m[3]

      // 只检查相对路径 import
      if (!importPath.startsWith('.')) continue

      // 解析目标文件路径
      const targetPath = this.resolveImportPath(fullPath, importPath, projectRoot)
      if (!targetPath) continue

      // 检查目标文件是否是 'use client'
      const targetDirective = fileDirectives.get(targetPath)
      if (targetDirective !== 'client') continue

      // 找到 import 所在行号
      const importLine = this.findLineNumber(content, m[0])

      // 为每个 server component 节点创建 Issue
      for (const node of nodes) {
        issues.push(this.createIssue(node, importPath, importLine))
      }
    }

    return issues
  }

  /**
   * 解析 import 路径
   */
  private resolveImportPath(fromFile: string, importPath: string, projectRoot: string): string | null {
    try {
      const fromDir = path.dirname(fromFile)
      const resolved = path.join(fromDir, importPath).replace(/\\/g, '/')

      const exts = ['.tsx', '.ts', '.jsx', '.js']
      for (const ext of exts) {
        const candidate = path.resolve(projectRoot, resolved + ext)
        if (fs.existsSync(candidate)) return candidate
      }
      for (const ext of exts) {
        const candidate = path.resolve(projectRoot, resolved, 'index' + ext)
        if (fs.existsSync(candidate)) return candidate
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * 查找字符串在内容中的行号
   */
  private findLineNumber(content: string, search: string): number {
    const index = content.indexOf(search)
    if (index === -1) return 1
    return content.substring(0, index).split('\n').length
  }

  /**
   * 解析文件路径（支持 monorepo 子目录）
   */
  private resolveFilePath(filePath: string, projectRoot: string): string | null {
    const direct = path.resolve(projectRoot, filePath)
    if (fs.existsSync(direct)) return direct
    const appsWeb = path.resolve(projectRoot, 'apps', 'web', filePath)
    if (fs.existsSync(appsWeb)) return appsWeb
    const srcDir = path.resolve(projectRoot, 'src', filePath)
    if (fs.existsSync(srcDir)) return srcDir
    return null
  }

  /**
   * 创建 RSC 边界违规 Issue
   */
  private createIssue(node: OmniNode, importPath: string, importLine: number): Issue {
    return {
      id: `rsc-${node.id}-${importLine}`,
      type: 'rsc_boundary_violation',
      severity: 'warning',
      description: `Server Component "${node.name}" imports Client Component from "${importPath}"`,
      messageKey: 'rsc_boundary_violation',
      messageParams: { component: node.name, importPath },
      locations: [
        { file: node.filePath, line: node.line, note: 'server component' },
        { file: node.filePath, line: importLine, note: `import of client component: ${importPath}` },
      ],
      relatedNodeIds: [node.id],
      relatedEdgeIds: [],
    }
  }
}
