/**
 * scanDirectory 测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { scanDirectory } from '../../src/utils/scanDirectory'

describe('scanDirectory', () => {
  let tmpDir: string

  beforeAll(() => {
    // 创建临时目录结构
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codeomnivis-test-'))

    // 创建文件
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'export {}')
    fs.writeFileSync(path.join(tmpDir, 'App.tsx'), 'export {}')
    fs.writeFileSync(path.join(tmpDir, 'utils.js'), 'export {}')
    fs.writeFileSync(path.join(tmpDir, 'helper.jsx'), 'export {}')
    fs.writeFileSync(path.join(tmpDir, 'style.css'), '') // 应被忽略
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '') // 应被忽略

    // 子目录
    const subDir = path.join(tmpDir, 'components')
    fs.mkdirSync(subDir)
    fs.writeFileSync(path.join(subDir, 'Button.tsx'), 'export {}')
    fs.writeFileSync(path.join(subDir, 'Card.ts'), 'export {}')

    // 应被忽略的目录
    const nodeModules = path.join(tmpDir, 'node_modules')
    fs.mkdirSync(nodeModules)
    fs.writeFileSync(path.join(nodeModules, 'pkg.ts'), 'export {}')

    const nextDir = path.join(tmpDir, '.next')
    fs.mkdirSync(nextDir)
    fs.writeFileSync(path.join(nextDir, 'page.js'), 'export {}')

    const distDir = path.join(tmpDir, 'dist')
    fs.mkdirSync(distDir)
    fs.writeFileSync(path.join(distDir, 'bundle.js'), 'export {}')
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('递归扫描 .ts/.tsx/.js/.jsx 文件', () => {
    const files = scanDirectory(tmpDir, tmpDir)

    expect(files).toContain('index.ts')
    expect(files).toContain('App.tsx')
    expect(files).toContain('utils.js')
    expect(files).toContain('helper.jsx')
    expect(files).toContain('components/Button.tsx')
    expect(files).toContain('components/Card.ts')
  })

  it('忽略非目标扩展名', () => {
    const files = scanDirectory(tmpDir, tmpDir)

    expect(files).not.toContain('style.css')
    expect(files).not.toContain('README.md')
  })

  it('忽略 node_modules/.next/dist 目录', () => {
    const files = scanDirectory(tmpDir, tmpDir)

    expect(files).not.toContain('node_modules/pkg.ts')
    expect(files).not.toContain('.next/page.js')
    expect(files).not.toContain('dist/bundle.js')
  })

  it('返回相对路径（/ 分隔符）', () => {
    const files = scanDirectory(tmpDir, tmpDir)

    for (const file of files) {
      expect(file).not.toMatch(/^[A-Z]:\\/) // 不是绝对路径
      expect(file).not.toContain('\\') // 不含反斜杠
    }
  })
})
