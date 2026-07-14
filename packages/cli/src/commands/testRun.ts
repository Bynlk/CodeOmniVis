import * as path from 'node:path'
import type { Command } from 'commander'
import { runTestRunner, type SupportedTestRunner } from '../utils/testRunner'
import { runTestImport } from './testImport'

interface TestRunOptions {
  project: string
  runner: SupportedTestRunner
  timeout: string
  junit?: string
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
      const projectRoot = path.resolve(options.project)
      const request = { projectRoot, runner: options.runner, timeoutMs: Number(options.timeout), extraArgs: runnerArgs }
      const plan = { cwd: projectRoot, runner: options.runner, args: runnerArgs }
      process.stderr.write(`[codeomnivis] test-run ${JSON.stringify(plan)}\n`)
      const result = await runTestRunner(request)
      process.stdout.write(result.stdout)
      process.stderr.write(result.stderr)
      if (options.junit) await runTestImport({ project: projectRoot, junit: options.junit })
      if (result.exitCode !== 0) process.exitCode = result.exitCode ?? 1
    })
}
