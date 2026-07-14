import * as fs from 'node:fs'
import * as path from 'node:path'
import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process'

export type SupportedTestRunner = 'vitest' | 'jest' | 'playwright' | 'cypress' | 'gradle'

export interface TestRunRequest {
  projectRoot: string
  runner: SupportedTestRunner
  timeoutMs: number
  extraArgs: readonly string[]
}

export interface TestRunResult {
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  stdout: string
  stderr: string
  truncated: boolean
}

export interface TestRunPlan {
  command: string
  args: string[]
  options: SpawnOptionsWithoutStdio
}

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 30 * 60 * 1_000

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function validateArgs(root: string, args: readonly string[]): void {
  for (const argument of args) {
    if (argument.includes('\0')) throw new Error('Runner arguments cannot contain NUL')
    const possiblePath = argument.includes('=')
      ? argument.slice(argument.indexOf('=') + 1)
      : argument
    if (path.isAbsolute(possiblePath) && !isInside(root, path.resolve(possiblePath))) {
      throw new Error('Runner argument path is outside the project')
    }
  }
}

export function createTestRunPlan(request: TestRunRequest): TestRunPlan {
  const root = path.resolve(request.projectRoot)
  if (!fs.statSync(root).isDirectory()) throw new Error('Project root must be a directory')
  if (
    !Number.isInteger(request.timeoutMs) ||
    request.timeoutMs < MIN_TIMEOUT_MS ||
    request.timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error('Test timeout must be between 1000 and 1800000 milliseconds')
  }
  validateArgs(root, request.extraArgs)
  let command = 'pnpm'
  let args: string[]
  switch (request.runner) {
    case 'vitest':
      args = ['exec', 'vitest', '--run', ...request.extraArgs]
      break
    case 'jest':
      args = ['exec', 'jest', '--runInBand', ...request.extraArgs]
      break
    case 'playwright':
      args = ['exec', 'playwright', 'test', ...request.extraArgs]
      break
    case 'cypress':
      args = ['exec', 'cypress', 'run', ...request.extraArgs]
      break
    case 'gradle': {
      command = path.join(root, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
      if (!fs.existsSync(command))
        throw new Error('Validated Gradle wrapper was not found in the project root')
      args = ['test', ...request.extraArgs]
      break
    }
    default:
      throw new Error(`Unsupported test runner: ${String(request.runner)}`)
  }
  return { command, args, options: { cwd: root, shell: false, env: process.env } }
}

export async function runTestRunner(request: TestRunRequest): Promise<TestRunResult> {
  const plan = createTestRunPlan(request)
  return new Promise((resolve) => {
    const child = spawn(plan.command, plan.args, {
      ...plan.options,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0)
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0)
    let truncated = false
    let timedOut = false
    let settled = false
    const append = (
      current: Buffer<ArrayBufferLike>,
      chunk: Buffer<ArrayBufferLike>,
    ): Buffer<ArrayBufferLike> => {
      if (current.length >= MAX_OUTPUT_BYTES) {
        truncated = true
        return current
      }
      const available = MAX_OUTPUT_BYTES - current.length
      if (chunk.length > available) truncated = true
      return Buffer.concat([current, chunk.subarray(0, available)])
    }
    child.stdout.on('data', (chunk: Buffer<ArrayBufferLike>) => {
      stdout = append(stdout, chunk)
    })
    child.stderr.on('data', (chunk: Buffer<ArrayBufferLike>) => {
      stderr = append(stderr, chunk)
    })
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      const force = setTimeout(() => child.kill('SIGKILL'), 2_000)
      force.unref()
    }, request.timeoutMs)
    timeout.unref()
    const finish = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve({
        exitCode,
        signal,
        timedOut,
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
        truncated,
      })
    }
    child.once('error', (error) => {
      stderr = append(stderr, Buffer.from(error.message))
      finish(null, null)
    })
    child.once('close', finish)
  })
}
