/**
 * 回归测试 —— analyze 命令跨多次运行不得累积重复跨层边。
 *
 * 缺陷:analyze.ts 在跨层连线后用 `graph.edges.push(...crossLayerResult.edges)` 无条件合并。
 * 由于使用持久化 DB,loadGraph() 会带出上次运行已写库的 resolved 跨层边,而本次 linker.link
 * 又基于 unknown 占位边重新生成同 id 的 resolved 边。两者在内存 graph.edges 中叠加,
 * 导致每重复运行一次就多一条完全相同(同 id)的 calls_api 边。
 *
 * 用例:构造一个最小 Next.js 工程(顶层 components/ 内组件 fetch('/api/items'),
 * app/api/items/route.ts 提供路由)。用同一个持久化 DB 实例连续运行 runAnalyze 两次,
 * 断言第二次输出图中不存在重复边(按 edge.id 唯一)。
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { runAnalyze } from '../../src/commands/analyze'

function makeNextFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-analyze-dedup-'))
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies: { next: '14.0.0', react: '18.0.0' } }, null, 2),
    'utf-8',
  )
  fs.mkdirSync(path.join(dir, 'app', 'api', 'items'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'app', 'page.tsx'), 'export default function Page(){return null}\n', 'utf-8')
  fs.writeFileSync(
    path.join(dir, 'app', 'api', 'items', 'route.ts'),
    'export async function GET(){ return Response.json([]) }\n',
    'utf-8',
  )
  // 与 app/ 平级的顶层组件,内部 fetch API
  fs.mkdirSync(path.join(dir, 'components'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'components', 'ItemList.tsx'),
    'export function ItemList(){ fetch("/api/items"); return null }\n',
    'utf-8',
  )
  return dir
}

function countDuplicateEdges(graphPath: string): number {
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8')) as { edges: Array<{ id: string }> }
  const seen = new Set<string>()
  let dup = 0
  for (const e of graph.edges) {
    if (seen.has(e.id)) dup++
    else seen.add(e.id)
  }
  return dup
}

describe('analyze 跨多次运行不累积重复跨层边(缓存去重回归)', () => {
  it('用同一持久化 DB 连续运行两次,输出图不含重复边', async () => {
    const fixture = makeNextFixture()
    const dbFile = path.join(fixture, '.cache.db')
    const out = path.join(fixture, 'graph.json')

    // 关键:两次运行指向同一个持久化 DB 文件(模拟真实的 ~/.codeomnivis 缓存跨运行复用)。
    // runAnalyze 在 finally 中会 close(),因此每次运行都新开一个指向同一文件的句柄。
    const deps = { openDatabase: (): OmniDatabase => new OmniDatabase(dbFile) }

    await runAnalyze({ project: fixture, output: out }, deps)
    expect(countDuplicateEdges(out)).toBe(0)

    // 第二次运行:若无按 id 去重,resolved 边会叠加成重复边
    await runAnalyze({ project: fixture, output: out }, deps)
    expect(countDuplicateEdges(out)).toBe(0)

    // 且 calls_api 边应稳定存在(修复未误伤功能)
    const graph = JSON.parse(fs.readFileSync(out, 'utf-8')) as { edges: Array<{ type: string }> }
    const calls = graph.edges.filter(e => e.type === 'calls_api')
    expect(calls.length).toBeGreaterThanOrEqual(2)

    fs.rmSync(fixture, { recursive: true, force: true })
  })
})
