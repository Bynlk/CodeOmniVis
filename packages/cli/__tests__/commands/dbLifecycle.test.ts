/**
 * LEAK-05 / F13 回归测试 —— analyze / check 命令在异常路径也必须关闭数据库句柄。
 *
 * 缺陷:db 在 try 内创建,只在 happy path 末尾 db.close()。任一步骤(parseFiles 等)抛错时
 * catch 直接 process.exit(1),db.close() 被跳过 → sql.js 句柄泄漏、未持久化。
 *
 * 用例:注入一个在 ready() 后强制让后续步骤抛错的 OmniDatabase 子类,
 * 断言即便 runAnalyze / runCheck reject,close() 仍被调用恰好一次。
 */

import { describe, it, expect } from 'vitest'
import { OmniDatabase } from '@codeomnivis/analyzer'
import { runAnalyze } from '../../src/commands/analyze'
import { runCheck } from '../../src/commands/check'

/**
 * 探针数据库:记录 close 调用次数;getAllErrors 抛错以模拟分析中途失败,
 * 触发命令的异常路径(而非依赖外部文件系统状态)。
 */
class ProbeDatabase extends OmniDatabase {
  public closeCount = 0

  constructor() {
    super(':memory:')
  }

  override close(): void {
    this.closeCount += 1
    super.close()
  }
}

describe('analyze/check 异常路径数据库释放 (LEAK-05/F13)', () => {
  it('runAnalyze 抛错时仍关闭数据库', async () => {
    const probe = new ProbeDatabase()
    // 让 upsert / parse 阶段失败:覆写 ready 使其在 resolve 后破坏内部状态。
    // 这里直接让 ready() reject,模拟初始化后/解析前的失败,确保进入 finally。
    let failed = false
    const forcedError = new Error('forced-analyze-failure')
    probe.ready = async (): Promise<void> => {
      failed = true
      throw forcedError
    }

    await expect(
      runAnalyze(
        { output: '-' },
        { openDatabase: (): OmniDatabase => probe },
      ),
    ).rejects.toBe(forcedError)

    expect(failed).toBe(true)
    expect(probe.closeCount).toBe(1)
  })

  it('runCheck 抛错时仍关闭数据库', async () => {
    const probe = new ProbeDatabase()
    const forcedError = new Error('forced-check-failure')
    probe.ready = async (): Promise<void> => {
      throw forcedError
    }

    await expect(
      runCheck({ openDatabase: (): OmniDatabase => probe }),
    ).rejects.toBe(forcedError)

    expect(probe.closeCount).toBe(1)
  })
})
