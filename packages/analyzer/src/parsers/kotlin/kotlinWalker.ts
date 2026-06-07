/**
 * Kotlin CST 遍历器
 *
 * 遍历 tree-sitter 生成的 Kotlin 语法树，提取类、接口、函数、注解等声明。
 */

import type Parser from 'web-tree-sitter'

// ============================================================
// 分析结果类型
// ============================================================

export interface KotlinClassInfo {
  name: string
  kind: 'data' | 'sealed' | 'abstract' | 'open' | 'value' | 'inner' | 'regular'
  packageName: string
  annotations: string[]
  superClass?: string
  interfaces: string[]
  line: number
  column: number
}

export interface KotlinInterfaceInfo {
  name: string
  packageName: string
  annotations: string[]
  superInterfaces: string[]
  line: number
  column: number
}

export interface KotlinObjectInfo {
  name: string
  packageName: string
  isCompanion: boolean
  annotations: string[]
  line: number
  column: number
}

export interface KotlinFunctionInfo {
  name: string
  packageName: string
  isTopLevel: boolean
  isExtension: boolean
  receiverType?: string
  returnType?: string
  annotations: string[]
  line: number
  column: number
}

export interface KotlinRouteInfo {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  framework: 'ktor' | 'spring'
  annotations: string[]
  handlerFunction?: string
  line: number
  column: number
}

export interface KotlinImportInfo {
  name: string
  line: number
}

export interface KotlinFileAnalysis {
  packageName: string
  classes: KotlinClassInfo[]
  interfaces: KotlinInterfaceInfo[]
  objects: KotlinObjectInfo[]
  functions: KotlinFunctionInfo[]
  routes: KotlinRouteInfo[]
  imports: KotlinImportInfo[]
  annotations: string[]
}

// ============================================================
// Walker 实现
// ============================================================

/**
 * 遍历 Kotlin CST，提取所有声明
 */
export function walkKotlinTree(tree: Parser.Tree): KotlinFileAnalysis {
  const result: KotlinFileAnalysis = {
    packageName: '',
    classes: [],
    interfaces: [],
    objects: [],
    functions: [],
    routes: [],
    imports: [],
    annotations: [],
  }

  walkNode(tree.rootNode, result, [])
  return result
}

function walkNode(
  node: Parser.SyntaxNode,
  result: KotlinFileAnalysis,
  annotations: string[],
): void {
  switch (node.type) {
    case 'package_header':
      result.packageName = extractPackageName(node)
      break

    case 'import_header':
      result.imports.push(extractImport(node))
      break

    case 'class_declaration': {
      // tree-sitter-kotlin may parse `interface Foo` as class_declaration;
      // detect by checking if the node text contains the 'interface' keyword
      if (/\binterface\b/.test(node.text.split('{')[0])) {
        result.interfaces.push(extractInterface(node, result.packageName, []))
      } else {
        result.classes.push(extractClass(node, result.packageName, []))
      }
      break
    }

    case 'interface_declaration':
      result.interfaces.push(extractInterface(node, result.packageName, []))
      break

    case 'object_declaration':
      result.objects.push(extractObject(node, result.packageName, []))
      break

    case 'function_declaration':
      result.functions.push(extractFunction(node, result.packageName, false, []))
      break

    case 'annotation':
    case 'single_annotation':
    case 'multi_annotation': {
      // Annotations are handled by extractAnnotationsFromModifiers within each declaration;
      // no need to accumulate them in a shared array.
      break
    }
  }

  // 递归遍历子节点
  for (const child of node.namedChildren) {
    walkNode(child, result, annotations)
  }
}

// ============================================================
// 提取函数
// ============================================================

function extractPackageName(node: Parser.SyntaxNode): string {
  return node.text.replace(/^package\s+/, '').trim()
}

function extractImport(node: Parser.SyntaxNode): KotlinImportInfo {
  const identifier = node.namedChildren.find(
    c => c.type === 'identifier' || c.type === 'user_type' || c.type === 'wildcard_import',
  )
  return {
    name: identifier?.text ?? node.text.replace(/^import\s+/, '').trim(),
    line: node.startPosition.row + 1,
  }
}

function extractClass(
  node: Parser.SyntaxNode,
  packageName: string,
  parentAnnotations: string[],
): KotlinClassInfo {
  const modifiers = extractModifiers(node)
  const kind = classifyClassKind(modifiers)
  const name = findChildText(node, 'type_identifier') ?? findChildText(node, 'simple_identifier') ?? 'Anonymous'
  const annotations = [...parentAnnotations, ...extractAnnotationsFromModifiers(node)]
  const superTypes = extractSuperTypes(node)

  return {
    name,
    kind,
    packageName,
    annotations,
    superClass: superTypes.find(t => !t.isInterface)?.name,
    interfaces: superTypes.filter(t => t.isInterface).map(t => t.name),
    line: node.startPosition.row + 1,
    column: node.startPosition.column + 1,
  }
}

function extractInterface(
  node: Parser.SyntaxNode,
  packageName: string,
  parentAnnotations: string[],
): KotlinInterfaceInfo {
  const name = findChildText(node, 'type_identifier') ?? findChildText(node, 'simple_identifier') ?? 'Anonymous'
  const annotations = [...parentAnnotations, ...extractAnnotationsFromModifiers(node)]
  const superTypes = extractSuperTypes(node)

  return {
    name,
    packageName,
    annotations,
    superInterfaces: superTypes.map(t => t.name),
    line: node.startPosition.row + 1,
    column: node.startPosition.column + 1,
  }
}

function extractObject(
  node: Parser.SyntaxNode,
  packageName: string,
  parentAnnotations: string[],
): KotlinObjectInfo {
  const name = findChildText(node, 'type_identifier') ?? findChildText(node, 'simple_identifier') ?? 'Anonymous'
  const annotations = [...parentAnnotations, ...extractAnnotationsFromModifiers(node)]
  const isCompanion = node.text.startsWith('companion') || node.parent?.type === 'companion_object'

  return {
    name,
    packageName,
    isCompanion,
    annotations,
    line: node.startPosition.row + 1,
    column: node.startPosition.column + 1,
  }
}

function extractFunction(
  node: Parser.SyntaxNode,
  packageName: string,
  isTopLevel: boolean,
  parentAnnotations: string[],
): KotlinFunctionInfo {
  const name = findChildText(node, 'simple_identifier') ?? 'anonymous'
  const annotations = [...parentAnnotations, ...extractAnnotationsFromModifiers(node)]

  // 检测扩展函数
  const receiverType = findChildOfType(node, 'receiver_type')
  const isExtension = !!receiverType

  // 提取返回类型
  const returnTypeNode = findChildOfType(node, 'type_reference')

  return {
    name,
    packageName,
    isTopLevel,
    isExtension,
    receiverType: receiverType?.text,
    returnType: returnTypeNode?.text,
    annotations,
    line: node.startPosition.row + 1,
    column: node.startPosition.column + 1,
  }
}

// ============================================================
// 辅助函数
// ============================================================

function extractModifiers(node: Parser.SyntaxNode): string[] {
  const modifiersNode = findChildOfType(node, 'modifiers')
  if (!modifiersNode) return []

  return modifiersNode.namedChildren
    .map(c => {
      if (c.type === 'modifier') return c.text
      if (c.type === 'visibility_modifier') return c.text
      if (c.type === 'class_modifier') return c.text
      if (c.type === 'inheritance_modifier') return c.text
      return ''
    })
    .filter(Boolean)
}

function classifyClassKind(
  modifiers: string[],
): KotlinClassInfo['kind'] {
  if (modifiers.includes('data')) return 'data'
  if (modifiers.includes('sealed')) return 'sealed'
  if (modifiers.includes('abstract')) return 'abstract'
  if (modifiers.includes('open')) return 'open'
  if (modifiers.includes('value')) return 'value'
  if (modifiers.includes('inner')) return 'inner'
  return 'regular'
}

function extractSuperTypes(
  node: Parser.SyntaxNode,
): Array<{ name: string; isInterface: boolean }> {
  const superTypeList = findChildOfType(node, 'super_type_list')
  if (!superTypeList) return []

  return superTypeList.namedChildren
    .map(c => {
      if (c.type === 'super_type') {
        const userType = findChildOfType(c, 'user_type') ?? findChildOfType(c, 'type_reference')
        // 简单启发式：带构造函数调用的通常是类继承，否则是接口实现
        const hasConstructor = c.text.includes('(')
        return {
          name: userType?.text ?? c.text.split('(')[0].trim(),
          isInterface: !hasConstructor,
        }
      }
      return null
    })
    .filter(Boolean) as Array<{ name: string; isInterface: boolean }>
}

function extractAnnotationName(node: Parser.SyntaxNode): string | null {
  // 提取注解名称，如 @RestController -> RestController
  const text = node.text
  const match = text.match(/@(\w+)/)
  return match ? match[1] : null
}

function extractAnnotationsFromModifiers(node: Parser.SyntaxNode): string[] {
  const annotations: string[] = []
  const modifiersNode = findChildOfType(node, 'modifiers')
  if (!modifiersNode) return []

  for (const child of modifiersNode.namedChildren) {
    if (child.type === 'annotation' || child.type === 'single_annotation' || child.type === 'multi_annotation') {
      const ann = extractAnnotationName(child)
      if (ann) annotations.push(ann)
    }
  }

  return annotations
}

function findChildText(node: Parser.SyntaxNode, type: string): string | null {
  const child = findChildOfType(node, type)
  return child?.text ?? null
}

function findChildOfType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
  for (const child of node.namedChildren) {
    if (child.type === type) return child
    // 递归查找（限制深度避免性能问题）
    for (const grandchild of child.namedChildren) {
      if (grandchild.type === type) return grandchild
    }
  }
  return null
}
