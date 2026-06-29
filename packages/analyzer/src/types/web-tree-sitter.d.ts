/**
 * web-tree-sitter 类型声明
 *
 * 该包没有自带 .d.ts，手动声明核心类型。
 */

declare module 'web-tree-sitter' {
  namespace Parser {
    interface Position {
      row: number
      column: number
    }

    interface SyntaxNode {
      type: string
      text: string
      startPosition: Position
      endPosition: Position
      children: SyntaxNode[]
      namedChildren: SyntaxNode[]
      parent: SyntaxNode | null
      childForFieldName(name: string): SyntaxNode | null
      walk(): TreeCursor
    }

    interface TreeCursor {
      nodeType: string
      nodeText: string
      startPosition: Position
      endPosition: Position
      gotoFirstChild(): boolean
      gotoNextSibling(): boolean
      gotoParent(): boolean
      delete(): void
    }

    interface Tree {
      rootNode: SyntaxNode
      delete(): void
    }

    interface Language {
      // 内部类型
    }

    function init(): Promise<void>
  }

  class Parser {
    static init(): Promise<void>
    static Language: {
      load(path: string): Promise<Parser.Language>
    }
    setLanguage(language: Parser.Language): void
    parse(input: string): Parser.Tree
    delete(): void
  }

  export = Parser
}
