/**
 * Tree-sitter Kotlin 解析器初始化
 *
 * 使用 web-tree-sitter (WASM) 加载 Kotlin 语法文件。
 * 懒加载单例，只需初始化一次。
 */

import Parser from 'web-tree-sitter'
import * as path from 'path'

let parserInstance: Parser | null = null
let initPromise: Promise<Parser> | null = null

/**
 * 获取已初始化的 tree-sitter Kotlin 解析器（单例）
 */
export async function getKotlinParser(): Promise<Parser> {
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
export async function parseKotlinSource(source: string): Promise<Parser.Tree> {
  const parser = await getKotlinParser()
  return parser.parse(source)
}
