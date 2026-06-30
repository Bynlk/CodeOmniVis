/**
 * LEAK-02 / F11 回归测试 —— start() 监听失败必须 reject 并清理,且禁止重复启动。
 *
 * 缺陷:start() 仅在 listen 成功回调里 resolve,从不监听 server 'error',
 * 监听失败(如 EADDRINUSE)时 Promise 永久挂起,且已注册的退出钩子 / 增量分析器泄漏。
 *
 * 用真实端口占用触发 EADDRINUSE(端口 0 取得系统分配端口后让第二个实例抢占),
 * 全部实例在用例结束前关闭,不留监听进程。
 *
 * projectRoot 指向独立空临时目录:增量分析器的文件监听几乎不持有 fs 句柄,
 * 避免在 CI / 本地一次性监听整个 monorepo 触发 EMFILE。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createOmniServer } from '../../src/index'

function getBoundPort(server: ReturnType<typeof createOmniServer>): number {
  const addr = server.server.address()
  if (addr && typeof addr === 'object') return addr.port
  throw new Error('server is not bound to a numeric port')
}

let projectRoot = ''

beforeAll(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codeomnivis-leak02-'))
})

afterAll(() => {
  if (projectRoot) fs.rmSync(projectRoot, { recursive: true, force: true })
})

describe('start() 监听失败处理 (LEAK-02/F11)', () => {
  it('监听端口被占用时 start() reject(而非永久挂起)', async () => {
    const first = createOmniServer({ projectRoot, dbPath: ':memory:', port: 0, host: '127.0.0.1' })
    await first.start()
    const takenPort = getBoundPort(first)

    const second = createOmniServer({ projectRoot, dbPath: ':memory:', port: takenPort, host: '127.0.0.1' })

    await expect(second.start()).rejects.toBeDefined()

    // 失败后 stop() 仍可安全调用(资源已清理,不抛)。
    await expect(second.stop()).resolves.toBeUndefined()
    await first.stop()
  })

  it('重复 start() 被拒绝(start 状态机防重复启动)', async () => {
    const server = createOmniServer({ projectRoot, dbPath: ':memory:', port: 0, host: '127.0.0.1' })
    await server.start()

    await expect(server.start()).rejects.toBeDefined()

    await server.stop()
  })
})
