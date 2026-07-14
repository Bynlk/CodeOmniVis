import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = new URL('../../../..', import.meta.url).pathname
const cliBin = resolve(repoRoot, 'packages/cli/bin/codeomnivis.js')
const demoRoot = resolve(repoRoot, 'demo')

function waitForStderr(
  process: ChildProcessWithoutNullStreams,
  expected: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolveReady, rejectReady) => {
    let stderr = ''
    const timeout = setTimeout(() => {
      cleanup()
      rejectReady(new Error(`Timed out waiting for stderr: ${expected}\n${stderr}`))
    }, timeoutMs)
    const onData = (chunk: Buffer): void => {
      stderr += chunk.toString('utf8')
      if (stderr.includes(expected)) {
        cleanup()
        resolveReady()
      }
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      cleanup()
      rejectReady(new Error(`MCP exited before ready: code=${code} signal=${signal}\n${stderr}`))
    }
    const cleanup = (): void => {
      clearTimeout(timeout)
      process.stderr.off('data', onData)
      process.off('exit', onExit)
    }
    process.stderr.on('data', onData)
    process.once('exit', onExit)
  })
}

describe('mcp command lifecycle', () => {
  let child: ChildProcessWithoutNullStreams | undefined

  afterEach(async () => {
    if (child?.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await once(child, 'exit')
    }
  })

  it('stays alive on stdio until SIGTERM and keeps stdout protocol-only', async () => {
    child = spawn(process.execPath, [cliBin, 'mcp', '--project', demoRoot], {
      cwd: repoRoot,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })

    await waitForStderr(child, 'MCP Server running on stdio', 30_000)
    expect(child.exitCode).toBeNull()
    expect(stdout).toBe('')

    child.kill('SIGTERM')
    const [code, signal] = await once(child, 'exit')
    expect({ code, signal }).toEqual({ code: 0, signal: null })
  }, 35_000)
})
