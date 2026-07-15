import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const README_FILES = ['README.md', 'README.zh-CN.md']
const REQUIRED_SECTION_IDS = [
  'quick-start',
  'workflows',
  'how-it-works',
  'supported-stack',
  'mcp',
  'trust',
  'development',
  'contributing',
  'license',
]
const REQUIRED_ASSETS = [
  'docs/assets/readme/codeomnivis-workbench-focus.jpg',
  'docs/assets/readme/typescript-full-stack-architecture-graph.svg',
]
const REQUIRED_BADGE_ALT_TEXT = [
  'CI',
  'npm version',
  'Node.js >= 18',
  'License: PolyForm Noncommercial',
]
const FORBIDDEN_BADGE_ALT_TEXT = ['npm downloads', 'GitHub stars']
const MAX_README_LINES = 200
const REQUIRED_ENGLISH_INTENT = [
  'TypeScript architecture visualizer',
  'full-stack architecture graph',
  'Next.js dependency graph',
  'React component graph',
  'Prisma ER diagram',
  'API and database dependency visualization',
  'MCP server for codebase architecture',
  'AI coding agent context',
  'Cursor, Claude Code, and Cline',
]
const QUICK_START = 'npx @bynlk/codeomnivis serve'
const NPM_PACKAGE_URL = 'https://www.npmjs.com/package/@bynlk/codeomnivis'

const errors = []

function readRequiredFile(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath)
  if (!existsSync(absolutePath)) {
    errors.push(`${relativePath}: required file is missing`)
    return ''
  }
  return readFileSync(absolutePath, 'utf8')
}

function localMarkdownTargets(markdown) {
  const targets = []
  const pattern = /!?\[[^\]]*\]\(([^)]+)\)/g
  for (const match of markdown.matchAll(pattern)) {
    const rawTarget = match[1]
      .trim()
      .replace(/^<|>$/g, '')
      .split(/\s+["']/u, 1)[0]
    if (!rawTarget || /^(?:https?:|mailto:|#)/u.test(rawTarget)) continue
    targets.push(rawTarget)
  }
  return targets
}

function verifyLocalTargets(readmePath, markdown) {
  for (const target of localMarkdownTargets(markdown)) {
    const pathOnly = target.split('#', 1)[0].split('?', 1)[0]
    let decodedPath
    try {
      decodedPath = decodeURIComponent(pathOnly)
    } catch {
      errors.push(`${readmePath}: invalid URI encoding in link "${target}"`)
      continue
    }
    if (!existsSync(resolve(repoRoot, decodedPath))) {
      errors.push(`${readmePath}: local target does not exist: ${decodedPath}`)
    }
  }
}

function verifySharedContract(readmePath, markdown) {
  for (const sectionId of REQUIRED_SECTION_IDS) {
    if (!markdown.includes(`<a id="${sectionId}"></a>`)) {
      errors.push(`${readmePath}: missing shared section anchor "${sectionId}"`)
    }
  }
  for (const asset of REQUIRED_ASSETS) {
    if (!markdown.includes(`](${asset})`)) {
      errors.push(`${readmePath}: missing required visual with alt text: ${asset}`)
    }
  }
  if (!markdown.includes(QUICK_START)) {
    errors.push(`${readmePath}: missing quick-start command "${QUICK_START}"`)
  }
  if (!markdown.includes(NPM_PACKAGE_URL)) {
    errors.push(`${readmePath}: missing npm package link "${NPM_PACKAGE_URL}"`)
  }
}

function verifyCompactLanding(readmePath, markdown) {
  const lineCount = markdown.split(/\r?\n/u).length
  if (lineCount > MAX_README_LINES) {
    errors.push(
      `${readmePath}: exceeds compact landing limit (${lineCount}/${MAX_README_LINES} lines)`,
    )
  }
  for (const altText of REQUIRED_BADGE_ALT_TEXT) {
    if (!hasBadgeAltText(markdown, altText)) {
      errors.push(`${readmePath}: missing stable badge alt text "${altText}"`)
    }
  }
  for (const altText of FORBIDDEN_BADGE_ALT_TEXT) {
    if (hasBadgeAltText(markdown, altText)) {
      errors.push(`${readmePath}: forbidden unstable badge alt text "${altText}"`)
    }
  }
}

function hasBadgeAltText(markdown, altText) {
  return markdown.includes(`![${altText}](`) || markdown.includes(`alt="${altText}"`)
}

const readmes = new Map(README_FILES.map((path) => [path, readRequiredFile(path)]))

for (const [readmePath, markdown] of readmes) {
  if (!markdown) continue
  verifyLocalTargets(readmePath, markdown)
  verifySharedContract(readmePath, markdown)
  verifyCompactLanding(readmePath, markdown)
}

const english = readmes.get('README.md') ?? ''
const chinese = readmes.get('README.zh-CN.md') ?? ''

if (english && !english.includes('](README.zh-CN.md)')) {
  errors.push('README.md: missing Chinese language link to README.zh-CN.md')
}
if (chinese && !chinese.includes('](README.md)')) {
  errors.push('README.zh-CN.md: missing English language link to README.md')
}
for (const phrase of REQUIRED_ENGLISH_INTENT) {
  if (english && !english.toLocaleLowerCase('en-US').includes(phrase.toLocaleLowerCase('en-US'))) {
    errors.push(`README.md: missing search-intent phrase "${phrase}"`)
  }
}
for (const phrase of ['local-first', 'certain', 'inferred', 'Commercial use requires']) {
  if (english && !english.includes(phrase)) {
    errors.push(`README.md: missing trust phrase "${phrase}"`)
  }
}
for (const phrase of ['本地', 'certain', 'inferred', '商业用途需要']) {
  if (chinese && !chinese.includes(phrase)) {
    errors.push(`README.zh-CN.md: missing trust phrase "${phrase}"`)
  }
}
if (existsSync(resolve(repoRoot, 'README.en.md'))) {
  errors.push('README.en.md: obsolete English mirror must be removed')
}

if (errors.length > 0) {
  console.error(`README verification failed with ${errors.length} issue(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('README verification passed')
}
