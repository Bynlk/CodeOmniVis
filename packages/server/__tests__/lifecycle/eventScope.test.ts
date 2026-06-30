/**
 * LEAK-03 / F12 回归测试 —— stop() 只能注销自身注册的事件监听器,不得清空共享 emitter。
 *
 * 缺陷:stop() 调用 codeomnivisEvents.removeAllListeners(),而 codeomnivisEvents 是模块级
 * 单例。多实例场景下,任一实例 stop() 会连带删除其它实例(以及外部模块)注册的监听器,
 * 造成另一实例彻底失聪——状态/图更新事件不再广播。
 *
 * 用例:两个实例各自注册监听器(GRAPH_UPDATED / STATUS_CHANGED 各一),
 * 停掉其一后,另一实例的监听器必须仍在;再注入一个外部监听器验证不被误删。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createOmniServer } from '../../src/index'
import { codeomnivisEvents, EVENTS } from '../../src/events'

let projectRoot = ''

beforeAll(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codeomnivis-leak03-'))
})

afterAll(() => {
  if (projectRoot) fs.rmSync(projectRoot, { recursive: true, force: true })
})

describe('stop() 事件监听器作用域 (LEAK-03/F12)', () => {
  it('stop() 不得删除其它实例 / 外部注册的监听器', async () => {
    // 外部模块注册的监听器,代表非 server 拥有的订阅。
    const externalListener = (): void => {}
    codeomnivisEvents.on(EVENTS.GRAPH_UPDATED, externalListener)
    const baseGraph = codeomnivisEvents.listenerCount(EVENTS.GRAPH_UPDATED)
    const baseStatus = codeomnivisEvents.listenerCount(EVENTS.STATUS_CHANGED)

    const a = createOmniServer({ projectRoot, dbPath: ':memory:', port: 0, host: '127.0.0.1' })
    const b = createOmniServer({ projectRoot, dbPath: ':memory:', port: 0, host: '127.0.0.1' })

    // 每个实例各注册 1 个 GRAPH_UPDATED + 1 个 STATUS_CHANGED 监听器。
    expect(codeomnivisEvents.listenerCount(EVENTS.GRAPH_UPDATED)).toBe(baseGraph + 2)
    expect(codeomnivisEvents.listenerCount(EVENTS.STATUS_CHANGED)).toBe(baseStatus + 2)

    await a.start()
    await b.start()

    // 停掉 a:只应注销 a 自己的监听器,b 与外部监听器保持不变。
    await a.stop()

    expect(codeomnivisEvents.listenerCount(EVENTS.GRAPH_UPDATED)).toBe(baseGraph + 1)
    expect(codeomnivisEvents.listenerCount(EVENTS.STATUS_CHANGED)).toBe(baseStatus + 1)
    expect(codeomnivisEvents.listeners(EVENTS.GRAPH_UPDATED)).toContain(externalListener)

    await b.stop()

    // b 停止后回到基线(外部监听器仍在)。
    expect(codeomnivisEvents.listenerCount(EVENTS.GRAPH_UPDATED)).toBe(baseGraph)
    expect(codeomnivisEvents.listenerCount(EVENTS.STATUS_CHANGED)).toBe(baseStatus)
    expect(codeomnivisEvents.listeners(EVENTS.GRAPH_UPDATED)).toContain(externalListener)

    codeomnivisEvents.removeListener(EVENTS.GRAPH_UPDATED, externalListener)
  })
})
