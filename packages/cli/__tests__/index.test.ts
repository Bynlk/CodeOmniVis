import { describe, expect, it } from 'vitest'
import { isCliMainModule, runCli } from '../src/index'

describe('CLI entrypoint', () => {
  it('identifies direct module execution', () => {
    expect(isCliMainModule(undefined, 'file:///entry.js')).toBe(false)
    expect(isCliMainModule('/entry.js', 'file:///entry.js')).toBe(true)
  })

  it('awaits a successful command program', async () => {
    let parsed = false
    await runCli({ parseAsync: async () => { parsed = true } })
    expect(parsed).toBe(true)
  })

  it('reports a controlled error and sets the exit code', async () => {
    const runtime = { exitCode: 0 }
    const errors: string[] = []
    await runCli(
      { parseAsync: async () => { throw new Error('invalid command') } },
      runtime,
      message => errors.push(message),
    )
    expect(errors).toEqual(['invalid command'])
    expect(runtime.exitCode).toBe(1)
  })
})
