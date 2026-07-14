import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []

function read(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath)
  if (!existsSync(absolutePath)) {
    errors.push(relativePath + ': required contract source is missing')
    return ''
  }
  return readFileSync(absolutePath, 'utf8')
}

function contractBlock(relativePath, label) {
  const content = read(relativePath)
  const fence = String.fromCharCode(96).repeat(3)
  const pattern = new RegExp(fence + label + '\\n([\\s\\S]*?)\\n' + fence, 'u')
  const match = pattern.exec(content)
  if (!match) {
    errors.push(relativePath + ': missing fenced ' + label + ' contract block')
    return []
  }
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .sort()
}

function compare(label, actualValues, documentedValues) {
  const actual = [...new Set(actualValues)].sort()
  const documented = [...new Set(documentedValues)].sort()
  for (const value of actual) {
    if (!documented.includes(value)) {
      errors.push(label + ': undocumented public contract "' + value + '"')
    }
  }
  for (const value of documented) {
    if (!actual.includes(value)) {
      errors.push(label + ': documented contract does not exist "' + value + '"')
    }
  }
}

function cliCommands() {
  const programSource = read('packages/cli/src/program.ts')
  const imports = new Map()
  for (const match of programSource.matchAll(
    /import\s*\{\s*(\w+Command)\s*\}\s*from\s*['"]([^'"]+)['"]/gu,
  )) {
    imports.set(match[1], match[2])
  }
  const commands = []
  for (const match of programSource.matchAll(/^\s*(\w+Command)\(program\)/gmu)) {
    const modulePath = imports.get(match[1])
    if (!modulePath) {
      errors.push('CLI registry: cannot resolve ' + match[1])
      continue
    }
    const source = read('packages/cli/src/' + modulePath.replace(/^\.\/+/u, '') + '.ts')
    const command = /\.command\(['"]([^'"]+)['"]\)/u.exec(source)?.[1]
    if (command) commands.push(command)
    else errors.push('CLI registry: ' + modulePath + ' has no literal command name')
  }
  return commands
}

function sourceRoutes(relativePath, prefix = '') {
  const source = read(relativePath)
  const routes = []
  for (const match of source.matchAll(
    /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/gu,
  )) {
    if (match[2] === '*') continue
    const suffix = match[2] === '/' ? '' : match[2]
    routes.push(match[1].toUpperCase() + ' ' + prefix + suffix)
  }
  return routes
}

function restRoutes() {
  return [
    ...sourceRoutes('packages/server/src/index.ts'),
    ...sourceRoutes('packages/server/src/ai.ts'),
    ...sourceRoutes('packages/server/src/routes/graph.ts', '/api/graph'),
    ...sourceRoutes('packages/server/src/routes/tests.ts', '/api/tests'),
  ]
}

function mcpTools() {
  const source = read('packages/mcp/src/server.ts')
  const start = source.indexOf('export const MCP_TOOL_NAMES = {')
  const end = source.indexOf('} as const', start)
  if (start < 0 || end < 0) {
    errors.push('MCP registry: MCP_TOOL_NAMES object was not found')
    return []
  }
  return [...source.slice(start, end).matchAll(/^\s+\w+:\s*['"]([^'"]+)['"]/gmu)].map(
    (match) => match[1],
  )
}

function workspacePackageNames() {
  const names = new Set()
  for (const directory of readdirSync(resolve(repoRoot, 'packages'), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue
    const manifestPath = join('packages', directory.name, 'package.json')
    const manifest = JSON.parse(read(manifestPath))
    if (typeof manifest.name === 'string') names.add(manifest.name)
  }
  return names
}

function verifyWorkspaceFilters() {
  const packages = workspacePackageNames()
  const files = [
    'README.md',
    'README.zh-CN.md',
    'packages/cli/README.md',
    'CONTRIBUTING.md',
    'docs/architecture/parser-pipeline.md',
    'docs/api/rest-api.md',
    'docs/api/mcp-tools.md',
    'docs/demo/cal-com-validation.md',
  ]
  for (const relativePath of files) {
    for (const match of read(relativePath).matchAll(/pnpm\s+--filter\s+([^\s\x60]+)/gu)) {
      const filter = match[1].replace(/^['"]|['"]$/gu, '')
      if (!packages.has(filter)) {
        errors.push(relativePath + ': nonexistent pnpm filter "' + filter + '"')
      }
    }
  }
}

function verifyCalEvidence() {
  const relativePath = 'docs/demo/cal-com-validation.md'
  const content = read(relativePath)
  if (/待编写|待补充|TODO|placeholder/iu.test(content)) {
    errors.push(relativePath + ': placeholder validation evidence remains')
  }
  const evidence = contractBlock(relativePath, 'codeomnivis-cal-validation')
  const required = {
    revision: /^revision=[0-9a-f]{40}$/u,
    duration: /^duration_ms=\d+$/u,
    nodes: /^nodes=\d+$/u,
    edges: /^edges=\d+$/u,
    errors: /^parse_errors=\d+$/u,
  }
  for (const [name, pattern] of Object.entries(required)) {
    if (!evidence.some((line) => pattern.test(line))) {
      errors.push(relativePath + ': missing measured ' + name + ' evidence')
    }
  }
}

function verifyAiDocumentation() {
  const files = ['README.md', 'README.zh-CN.md', 'docs/api/rest-api.md']
  const obsolete = [
    /AI[^\n.]*always[^\n.]*501/iu,
    /AI[^\n。]*总是[^\n。]*501/iu,
    /预留[^\n。]*\/api\/ai\/chat[^\n。]*501/iu,
    /当前是保留接口[^\n。]*501/iu,
  ]
  for (const relativePath of files) {
    const content = read(relativePath)
    if (obsolete.some((pattern) => pattern.test(content))) {
      errors.push(relativePath + ': obsolete AI 501-only statement remains')
    }
  }
}

compare(
  'CLI documentation',
  cliCommands(),
  contractBlock('packages/cli/README.md', 'codeomnivis-cli-contract'),
)
compare(
  'REST documentation',
  restRoutes(),
  contractBlock('docs/api/rest-api.md', 'codeomnivis-rest-contract'),
)
compare(
  'MCP documentation',
  mcpTools(),
  contractBlock('docs/api/mcp-tools.md', 'codeomnivis-mcp-contract'),
)
verifyWorkspaceFilters()
verifyCalEvidence()
verifyAiDocumentation()

if (errors.length > 0) {
  console.error('Public contract verification failed with ' + errors.length + ' issue(s):')
  for (const error of errors) console.error('- ' + error)
  process.exitCode = 1
} else {
  console.log('Public contract verification passed')
}
