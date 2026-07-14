import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import { isJsonObject } from '@codeomnivis/shared'
import { analyzeCommand } from './commands/analyze'
import { checkCommand } from './commands/check'
import { initCommand } from './commands/init'
import { mcpCommand } from './commands/mcp'
import { serveCommand } from './commands/serve'

function readCliVersion(): string {
  try {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    )
    if (isJsonObject(manifest) && typeof manifest.version === 'string') {
      return manifest.version
    }
  } catch {
    // A missing package manifest should not prevent help output in development builds.
  }
  return '0.0.0'
}

export function createCliProgram(): Command {
  const program = new Command()

  program
    .name('codeomnivis')
    .description('Full-stack architecture visualizer for TypeScript projects')
    .version(readCliVersion())

  serveCommand(program)
  analyzeCommand(program)
  checkCommand(program)
  mcpCommand(program)
  initCommand(program)

  return program
}
