/**
 * logger 测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    delete process.env.DEBUG
  })

  it('info 调用 console.log', async () => {
    const { logger } = await import('../../src/utils/logger')
    logger.info('test message')
    expect(consoleSpy).toHaveBeenCalled()
    expect(consoleSpy.mock.calls[0][1]).toBe('test message')
  })

  it('success 调用 console.log', async () => {
    const { logger } = await import('../../src/utils/logger')
    logger.success('done')
    expect(consoleSpy).toHaveBeenCalled()
    expect(consoleSpy.mock.calls[0][1]).toBe('done')
  })

  it('warn 调用 console.log', async () => {
    const { logger } = await import('../../src/utils/logger')
    logger.warn('warning')
    expect(consoleSpy).toHaveBeenCalled()
    expect(consoleSpy.mock.calls[0][1]).toBe('warning')
  })

  it('error 调用 console.log', async () => {
    const { logger } = await import('../../src/utils/logger')
    logger.error('error msg')
    expect(consoleSpy).toHaveBeenCalled()
    expect(consoleSpy.mock.calls[0][1]).toBe('error msg')
  })

  it('debug 在 DEBUG 环境变量下输出', async () => {
    process.env.DEBUG = '1'
    const { logger } = await import('../../src/utils/logger')
    logger.debug('debug msg')
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('debug 在无 DEBUG 环境变量时不输出', async () => {
    delete process.env.DEBUG
    const { logger } = await import('../../src/utils/logger')
    logger.debug('debug msg')
    expect(consoleSpy).not.toHaveBeenCalled()
  })
})
