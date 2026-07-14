import * as path from 'node:path'
import type { Command } from 'commander'
import { runTestRunner, type SupportedTestRunner } from '../utils/testRunner'
import { runTestImport } from './testImport'

export interface TestRunOptions {
  project: string
  runner: SupportedTestRunner
  timeout: string
  junit?: string
}

export interface TestRunCommandDeps {
  run: typeof runTestRunner
  importResults: typeof runTestImport
  stdout: (value: string) => void
  stderr: (value: string) => void
}

const defaultDeps: TestRunCommandDeps = {
  run: runTestRunner,
  importResults: runTestImport,
  stdout: value => { process.stdout.write(value) },
  stderr: value => { process.stderr.write(value) },
}

export async function runTestCommand(
  runnerArgs: string[],
  options: TestRunOptions,
  deps: TestRunCommandDeps = defaultDeps,
): Promise<void> {
  const projectRoot = path.resolve(options.project)
  const request = { projectRoot, runner: options.runner, timeoutMs: Number(options.timeout), extraArgs: runnerArgs }
  const plan = { cwd: projectRoot, runner: options.runner, args: runnerArgs }
  deps.stderr(`[codeomnivis] test-run ${JSON.stringify(plan)}\n`)
  const result = await deps.run(request)
  deps.stdout(result.stdout)
  deps.stderr(result.stderr)
  if (options.junit) await deps.importResults({ project: projectRoot, junit: options.junit })
  if (result.exitCode !== 0) process.exitCode = result.exitCode ?? 1
}

export function testRunCommand(program: Command): void {
  program
    .command('test-run')
    .description('Explicitly run one supported test runner with resource bounds')
    .requiredOption('-p, --project <path>', 'Project root')
    .requiredOption('--runner <runner>', 'vitest, jest, playwright, cypress, or gradle')
    .option('--timeout <ms>', 'Timeout in milliseconds', '600000')
    .option('--junit <path>', 'Import this JUnit XML after the run')
    .argument('[runnerArgs...]')
    .allowUnknownOption()
    .action(async (runnerArgs: string[], options: TestRunOptions) => {
      await runTestCommand(runnerArgs, options)
    })
}
