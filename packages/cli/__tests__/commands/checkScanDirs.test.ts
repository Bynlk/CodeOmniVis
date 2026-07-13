/**
 * DUP-04 / F18 回归测试 —— check 命令必须复用 collectScanDirs(projectRoot, config),
 * 而不是硬编码扫描目录 + process.cwd()。
 *
 * 缺陷:check.ts 用 ['app','src/app','pages',...] 硬编码列表,且以 process.cwd() 拼路径,
 * 既不支持配置目录,也不支持 monorepo packages/STAR/src。analyze.ts 早已改用 collectScanDirs。
 *
 * 用例:构造一个临时 Turborepo 工程,唯一的 TS 文件位于 packages/foo/src 下。
 * 硬编码列表永远扫不到该目录 → Parsing 0 files;collectScanDirs 能发现 packages/STAR/src
 * → Parsing >= 1 files。通过注入 cwd 指向 fixture(避免 worker 不支持 process.chdir),
 * 并用 onProgress 捕获 "Parsing N files..." 断言行为。
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { runCheck } from '../../src/commands/check'

function makeMonorepoFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-check-'))
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture-root', private: true }, null, 2),
    'utf-8',
  )
  // Turborepo 标记,触发 collectScanDirs 的 packages/STAR/src 探测分支
  fs.writeFileSync(path.join(dir, 'turbo.json'), JSON.stringify({ tasks: {} }, null, 2), 'utf-8')

  const pkgSrc = path.join(dir, 'packages', 'foo', 'src')
  fs.mkdirSync(pkgSrc, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'packages', 'foo', 'package.json'),
    JSON.stringify({ name: 'foo' }, null, 2),
    'utf-8',
  )
  fs.writeFileSync(
    path.join(pkgSrc, 'Panel.tsx'),
    'export function Panel(){ return <section>ok</section> }\n',
    'utf-8',
  )
  return dir
}

function parseFileCount(messages: string[]): number {
  for (const s of messages) {
    const m = /^Parsing (\d+) files/.exec(s)
    if (m) return Number(m[1])
  }
  throw new Error('no "Parsing N files" progress captured: ' + JSON.stringify(messages))
}

describe('check 命令复用 collectScanDirs (DUP-04/F18)', () => {
  it('扫描 monorepo packages/STAR/src(硬编码列表扫不到,collectScanDirs 能)', async () => {
    const fixture = makeMonorepoFixture()

    const messages: string[] = []
    await runCheck({
      cwd: fixture,
      openDatabase: (): OmniDatabase => new OmniDatabase(':memory:'),
      onProgress: (msg: string): void => {
        messages.push(msg)
      },
    })

    // packages/foo/src/handler.ts 只能通过 collectScanDirs 的 monorepo 分支被发现
    expect(parseFileCount(messages)).toBeGreaterThanOrEqual(1)
  })
})
