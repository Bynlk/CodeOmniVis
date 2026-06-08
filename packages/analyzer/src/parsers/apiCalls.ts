/**
 * 前端 API 调用识别解析器
 *
 * 识别 fetch()、axios、tRPC hooks 等 API 调用模式。
 * 标记 confidence（certain/inferred）。
 *
 * 遵循"降级而非崩溃"原则。
 */

import { Project, SyntaxKind, CallExpression, Node, StringLiteral, SourceFile } from 'ts-morph'
import * as path from 'path'
import type {
  Parser,
  ParseContext,
  ParseResult,
  ParseError,
  OmniEdge,
  ProjectMeta,
  CallsApiMetadata,
} from '@codeomnivis/shared'
import { createEdgeId } from '@codeomnivis/shared'

// ============================================================
// API 调用类型
// ============================================================

type CallType = 'fetch' | 'axios' | 'trpc_hook' | 'tsrpc_call_api' | 'tsrpc_listen_msg'

interface DetectedCall {
  type: CallType
  url: string
  method: string
  line: number
  confidence: 'certain' | 'inferred'
}

// ============================================================
// API 调用解析器
// ============================================================

export class ApiCallsParser implements Parser {
  readonly name = 'api-calls'
  private project: Project | null = null

  /**
   * 判断是否能处理该文件
   */
  canHandle(filePath: string, _projectMeta: ProjectMeta): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/')

    // 只处理前端文件（.tsx, .ts, .jsx, .js）
    if (!/\.(tsx|ts|jsx|js)$/.test(normalizedPath)) {
      return false
    }

    // 排除测试文件
    if (/__tests__|\.test\.|\.spec\./.test(normalizedPath)) {
      return false
    }

    // 排除 node_modules
    if (/node_modules/.test(normalizedPath)) {
      return false
    }

    return true
  }

  /**
   * 执行解析
   */
  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const edges: OmniEdge[] = []
    const errors: ParseError[] = []

    try {
      // 初始化 ts-morph Project
      if (!this.project) {
        this.project = new Project({
          tsConfigFilePath: context.tsConfig?.options?.configFilePath as string,
          skipAddingFilesFromTsConfig: true,
        })
      }

      const fullPath = path.resolve(context.projectRoot, filePath)
      const sourceFile = this.project.addSourceFileAtPath(fullPath)

      // 检测所有 API 调用
      const calls = this.detectApiCalls(sourceFile)

      // 将调用转换为边
      for (const call of calls) {
        try {
          const edge = this.callToEdge(call, filePath)
          if (edge) {
            edges.push(edge)
          }
        } catch (err) {
          errors.push({
            file: filePath,
            message: `Failed to process API call: ${err instanceof Error ? err.message : String(err)}`,
            severity: 'info',
          })
        }
      }

      // 移除源文件以释放内存
      this.project.removeSourceFile(sourceFile)
    } catch (err) {
      errors.push({
        file: filePath,
        message: `API calls parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes: [], edges, errors }
  }

  /**
   * 检测 API 调用
   */
  private detectApiCalls(sourceFile: SourceFile): DetectedCall[] {
    const calls: DetectedCall[] = []

    sourceFile.forEachDescendant((node: Node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return

      const callExpr = node as CallExpression
      const expression = callExpr.getExpression()

      // 检测 fetch() 调用
      if (this.isFetchCall(expression)) {
        const call = this.parseFetchCall(callExpr)
        if (call) calls.push(call)
      }

      // 检测 axios 调用
      if (this.isAxiosCall(expression)) {
        const call = this.parseAxiosCall(callExpr)
        if (call) calls.push(call)
      }

      // 检测 tRPC hooks
      if (this.isTrpcHook(expression)) {
        const call = this.parseTrpcHook(callExpr)
        if (call) calls.push(call)
      }

      // 检测 TSRPC client.callApi()
      if (this.isTsrpcCallApi(expression)) {
        const call = this.parseTsrpcCallApi(callExpr)
        if (call) calls.push(call)
      }

      // 检测 TSRPC client.listenMsg()
      if (this.isTsrpcListenMsg(expression)) {
        const call = this.parseTsrpcListenMsg(callExpr)
        if (call) calls.push(call)
      }

      // 检测 TSRPC client.sendMsg()
      if (this.isTsrpcSendMsg(expression)) {
        const call = this.parseTsrpcSendMsg(callExpr)
        if (call) calls.push(call)
      }
    })

    return calls
  }

  /**
   * 判断是否是 fetch 调用
   */
  private isFetchCall(expression: Node): boolean {
    if (Node.isIdentifier(expression)) {
      return expression.getText() === 'fetch'
    }
    return false
  }

  /**
   * 解析 fetch 调用
   */
  private parseFetchCall(call: CallExpression): DetectedCall | null {
    const args = call.getArguments()
    if (args.length === 0) return null

    const urlArg = args[0]
    let url: string
    let confidence: 'certain' | 'inferred' = 'certain'

    // 提取 URL
    if (Node.isStringLiteral(urlArg)) {
      url = urlArg.getLiteralValue()
    } else if (Node.isTemplateExpression(urlArg)) {
      // 模板字符串，标记为 inferred
      url = urlArg.getText()
      confidence = 'inferred'
    } else {
      return null
    }

    // 提取 method
    let method = 'GET'
    if (args.length > 1 && Node.isObjectLiteralExpression(args[1])) {
      const methodProp = args[1].getProperty('method')
      if (methodProp && Node.isPropertyAssignment(methodProp)) {
        const initializer = methodProp.getInitializer()
        if (initializer && Node.isStringLiteral(initializer)) {
          method = initializer.getLiteralValue().toUpperCase()
        }
      }
    }

    return {
      type: 'fetch',
      url,
      method,
      line: call.getStartLineNumber(),
      confidence,
    }
  }

  /**
   * 判断是否是 axios 调用
   */
  private isAxiosCall(expression: Node): boolean {
    const text = expression.getText()
    return text.startsWith('axios.') || text === 'axios'
  }

  /**
   * 解析 axios 调用
   */
  private parseAxiosCall(call: CallExpression): DetectedCall | null {
    const expression = call.getExpression()
    const text = expression.getText()

    let method = 'GET'
    let url = ''

    // axios.get/post/put/delete(url)
    if (text.startsWith('axios.')) {
      method = text.replace('axios.', '').toUpperCase()
      const args = call.getArguments()
      if (args.length > 0 && Node.isStringLiteral(args[0])) {
        url = args[0].getLiteralValue()
      }
    }
    // axios({ method, url })
    else if (text === 'axios') {
      const args = call.getArguments()
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        const methodProp = args[0].getProperty('method')
        const urlProp = args[0].getProperty('url')

        if (methodProp && Node.isPropertyAssignment(methodProp)) {
          const initializer = methodProp.getInitializer()
          if (initializer && Node.isStringLiteral(initializer)) {
            method = initializer.getLiteralValue().toUpperCase()
          }
        }

        if (urlProp && Node.isPropertyAssignment(urlProp)) {
          const initializer = urlProp.getInitializer()
          if (initializer && Node.isStringLiteral(initializer)) {
            url = initializer.getLiteralValue()
          }
        }
      }
    }

    if (!url) return null

    return {
      type: 'axios',
      url,
      method,
      line: call.getStartLineNumber(),
      confidence: 'certain',
    }
  }

  /**
   * 判断是否是 tRPC hook
   */
  private isTrpcHook(expression: Node): boolean {
    const text = expression.getText()
    // 匹配 trpc.xxx.xxx.useQuery / useMutation
    return /trpc\..*\.(useQuery|useMutation|useSuspenseQuery)/.test(text)
  }

  /**
   * 解析 tRPC hook
   */
  private parseTrpcHook(call: CallExpression): DetectedCall | null {
    const expression = call.getExpression()
    const text = expression.getText()

    // 提取 procedure 名称
    const match = text.match(/trpc\.(\w+)\.(\w+)\.(useQuery|useMutation)/)
    if (!match) return null

    const [, router, procedure, hookType] = match
    const method = hookType === 'useMutation' ? 'mutation' : 'query'

    return {
      type: 'trpc_hook',
      url: `${router}.${procedure}`,
      method,
      line: call.getStartLineNumber(),
      confidence: 'certain',
    }
  }

  /**
   * 判断是否是 TSRPC client.callApi() 调用
   */
  private isTsrpcCallApi(expression: Node): boolean {
    const text = expression.getText()
    // 匹配 client.callApi / tsClient.callApi / xxx.callApi
    return /\.callApi$/.test(text)
  }

  /**
   * 解析 TSRPC client.callApi() 调用
   *
   * 识别模式：
   * - client.callApi('xxx/login', { username, password })
   * - client.callApi('user/getInfo')
   */
  private parseTsrpcCallApi(call: CallExpression): DetectedCall | null {
    const args = call.getArguments()
    if (args.length === 0) return null

    const servicePathArg = args[0]
    let servicePath: string
    let confidence: 'certain' | 'inferred' = 'certain'

    // 提取 service 路径
    if (Node.isStringLiteral(servicePathArg)) {
      servicePath = servicePathArg.getLiteralValue()
    } else if (Node.isTemplateExpression(servicePathArg)) {
      servicePath = servicePathArg.getText()
      confidence = 'inferred'
    } else {
      return null
    }

    return {
      type: 'tsrpc_call_api',
      url: servicePath,
      method: 'callApi',
      line: call.getStartLineNumber(),
      confidence,
    }
  }

  /**
   * 判断是否是 TSRPC client.listenMsg() 调用
   */
  private isTsrpcListenMsg(expression: Node): boolean {
    const text = expression.getText()
    return /\.listenMsg$/.test(text)
  }

  /**
   * 解析 TSRPC client.listenMsg() 调用
   *
   * 识别模式：
   * - client.listenMsg('Chat', (msg) => { ... })
   * - wsClient.listenMsg('TodoUpdate', (msg) => { ... })
   */
  private parseTsrpcListenMsg(call: CallExpression): DetectedCall | null {
    const args = call.getArguments()
    if (args.length === 0) return null

    const msgNameArg = args[0]
    let msgName: string
    let confidence: 'certain' | 'inferred' = 'certain'

    if (Node.isStringLiteral(msgNameArg)) {
      msgName = msgNameArg.getLiteralValue()
    } else if (Node.isTemplateExpression(msgNameArg)) {
      msgName = msgNameArg.getText()
      confidence = 'inferred'
    } else {
      return null
    }

    return {
      type: 'tsrpc_listen_msg',
      url: msgName,
      method: 'listenMsg',
      line: call.getStartLineNumber(),
      confidence,
    }
  }

  /**
   * 判断是否是 TSRPC client.sendMsg() 调用
   */
  private isTsrpcSendMsg(expression: Node): boolean {
    const text = expression.getText()
    return /\.sendMsg$/.test(text)
  }

  /**
   * 解析 TSRPC client.sendMsg() 调用
   *
   * 识别模式：
   * - client.sendMsg('Chat', { content: 'hello' })
   */
  private parseTsrpcSendMsg(call: CallExpression): DetectedCall | null {
    const args = call.getArguments()
    if (args.length === 0) return null

    const msgNameArg = args[0]
    let msgName: string
    let confidence: 'certain' | 'inferred' = 'certain'

    if (Node.isStringLiteral(msgNameArg)) {
      msgName = msgNameArg.getLiteralValue()
    } else if (Node.isTemplateExpression(msgNameArg)) {
      msgName = msgNameArg.getText()
      confidence = 'inferred'
    } else {
      return null
    }

    return {
      type: 'tsrpc_listen_msg', // 复用类型，实际是 sendMsg
      url: msgName,
      method: 'sendMsg',
      line: call.getStartLineNumber(),
      confidence,
    }
  }

  /**
   * 将调用转换为边
   */
  private callToEdge(call: DetectedCall, filePath: string): OmniEdge | null {
    // 从文件路径推断组件名
    const componentName = this.inferComponentName(filePath)
    const sourceId = `component:${filePath}:${componentName}`

    // 根据 URL 创建 target 节点 ID
    let targetId: string
    if (call.type === 'trpc_hook') {
      targetId = `trpc_procedure:unknown:${call.url}`
    } else if (call.type === 'tsrpc_call_api' || call.type === 'tsrpc_listen_msg') {
      // TSRPC: 使用 service 路径作为 target
      // crossLayer.ts 的 linkCallsApi 会通过路径匹配修复 target
      targetId = `tsrpc_api:unknown:${call.url}`
    } else {
      // 对于 fetch/axios，使用 URL 作为 target
      // crossLayer.ts 的 linkCallsApi 会通过 URL 匹配修复 target
      targetId = `api_route:unknown:${call.url}`
    }

    // 根据调用类型选择边类型
    let edgeType: 'calls_api' | 'sends_msg' | 'listens_msg' = 'calls_api'
    if (call.method === 'listenMsg') {
      edgeType = 'listens_msg'
    } else if (call.method === 'sendMsg') {
      edgeType = 'sends_msg'
    }

    const edgeId = createEdgeId(sourceId, edgeType, targetId)

    const metadata: CallsApiMetadata = {
      method: call.method,
      callType: call.type,
      callLine: call.line,
    }

    return {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type: edgeType,
      confidence: call.confidence,
      metadata,
    }
  }

  /**
   * 从文件路径推断组件名
   *
   * app/booking/page.tsx       → BookingPage
   * components/BookingList.tsx → BookingList
   * app/profile/page.tsx       → ProfilePage
   */
  private inferComponentName(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/')
    const parts = normalized.split('/')

    // page.tsx → 取父目录名 + "Page"
    const fileName = parts[parts.length - 1] || ''
    if (/^page\.(tsx|jsx|ts|js)$/.test(fileName)) {
      const dirName = parts[parts.length - 2] || 'Page'
      return this.toPascalCase(dirName) + 'Page'
    }

    // route.ts → 取父目录名 + "Route"
    if (/^route\.(tsx|ts|jsx|js)$/.test(fileName)) {
      const dirName = parts[parts.length - 2] || 'Route'
      return this.toPascalCase(dirName) + 'Route'
    }

    // 其他文件 → 取文件名（不含扩展名）
    const baseName = fileName.replace(/\.(tsx|jsx|ts|js)$/, '')
    return this.toPascalCase(baseName)
  }

  /**
   * 转 PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
      .replace(/^(\w)/, (_, c) => c.toUpperCase())
  }
}
