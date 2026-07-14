/**
 * @codeomnivis/cli — CLI 入口
 *
 * 使用 Commander.js 构建命令行工具。
 * 支持命令：serve, analyze, check, mcp, init
 */

import { pathToFileURL } from 'node:url'
import { createCliProgram } from './program'

interface CliProgram {
  parseAsync: () => Promise<unknown>
}

interface CliRuntime {
  exitCode?: string | number
}

export function isCliMainModule(entry: string | undefined, moduleUrl: string): boolean {
  return entry !== undefined && pathToFileURL(entry).href === moduleUrl
}

export async function runCli(
  program: CliProgram = createCliProgram(),
  runtime: CliRuntime = process,
  reportError: (message: string) => void = (message) => console.error(message),
): Promise<void> {
  try {
    await program.parseAsync()
  } catch (err) {
    reportError(err instanceof Error ? err.message : String(err))
    runtime.exitCode = 1
  }
}

if (isCliMainModule(process.argv[1], import.meta.url)) void runCli()
