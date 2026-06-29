/**
 * Tree-sitter Kotlin 解析器初始化
 *
 * 使用 web-tree-sitter (WASM) 加载 Kotlin 语法文件。
 * 懒加载单例，只需初始化一次。
 */

import ParserDefault from 'web-tree-sitter'
import * as webTreeSitter from 'web-tree-sitter'
import * as path from 'path'

type ParserConstructor = typeof ParserDefault
type KotlinParser = InstanceType<ParserConstructor>
type KotlinTree = ReturnType<KotlinParser['parse']>

function isParserConstructor(value: unknown): value is ParserConstructor {
  return typeof value === 'function'
    && 'init' in value
    && typeof value.init === 'function'
}

function resolveParser(primary: unknown, namespace: unknown): ParserConstructor {
  if (isParserConstructor(primary)) return primary

  if (typeof namespace === 'object' && namespace !== null && 'default' in namespace) {
    const defaultExport = namespace.default
    if (isParserConstructor(defaultExport)) return defaultExport
  }

  if (isParserConstructor(namespace)) return namespace

  throw new Error('Unable to load web-tree-sitter parser constructor')
}

const Parser = resolveParser(ParserDefault, webTreeSitter)

let parserInstance: KotlinParser | null = null
let initPromise: Promise<KotlinParser> | null = null

/**
 * 获取已初始化的 tree-sitter Kotlin 解析器（单例）
 */
export async function getKotlinParser(): Promise<KotlinParser> {
  if (parserInstance) return parserInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    await Parser.init()
    const parser = new Parser()

    const wasmPath = path.join(__dirname, 'wasm', 'tree-sitter-kotlin.wasm')
    const Language = await Parser.Language.load(wasmPath)
    parser.setLanguage(Language)

    parserInstance = parser
    return parser
  })()

  return initPromise
}

/**
 * 解析 Kotlin 源码，返回语法树
 */
export async function parseKotlinSource(source: string): Promise<KotlinTree> {
  const parser = await getKotlinParser()
  return parser.parse(source)
}
