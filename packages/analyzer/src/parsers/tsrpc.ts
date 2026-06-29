/**
 * TSRPC 服务解析器
 *
 * 使用 ts-morph 解析 TSRPC 协议文件和服务定义。
 * 识别 TSRPC 的 ApiCall<Req, Res> 模式、Msg 消息类型、conf 配置。
 *
 * 遵循"降级而非崩溃"原则。
 *
 * TSRPC 命名约定：
 * - 协议文件：Ptl{Name}.ts → Req{Name} / Res{Name}
 * - 消息文件：Msg{Name}.ts → Msg{Name}
 * - 服务文件：Api{Name}.ts → export async function Api{Name}(call: ApiCall<Req, Res>)
 * - 自动生成：serviceProto.ts（跳过）
 */

import { Project, SyntaxKind, CallExpression, Node, SourceFile } from 'ts-morph'
import * as path from 'path'
import * as fs from 'fs'
import type {
  Parser,
  ParseContext,
  ParseResult,
  ParseError,
  OmniNode,
  OmniEdge,
  ProjectMeta,
} from '@codeomnivis/shared'
import { createNodeId } from '@codeomnivis/shared'

interface ServiceProtoEntry {
  id: number
  name: string
  type: 'api' | 'msg'
}

function isServiceProtoEntry(value: unknown): value is ServiceProtoEntry {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && typeof value.id === 'number'
    && 'name' in value
    && typeof value.name === 'string'
    && 'type' in value
    && (value.type === 'api' || value.type === 'msg')
}

function parseServiceProtoEntries(json: string): ServiceProtoEntry[] {
  const parsed = JSON.parse(json)
  return Array.isArray(parsed) ? parsed.filter(isServiceProtoEntry) : []
}

// ============================================================
// TSRPC 解析器
// ============================================================

export class TsRpcParser implements Parser {
  readonly name = 'tsrpc'
  private project: Project | null = null

  /**
   * 判断是否能处理该文件
   */
  canHandle(filePath: string, projectMeta: ProjectMeta): boolean {
    if (projectMeta.backendFramework !== 'tsrpc') {
      return false
    }

    const normalizedPath = filePath.replace(/\\/g, '/')

    // 跳过自动生成的 serviceProto.ts
    if (/serviceProto\.(ts|js)$/.test(normalizedPath)) {
      return false
    }

    // tsrpc.config.ts 本身也跳过
    if (/tsrpc\.config\.(ts|js)$/.test(normalizedPath)) {
      return false
    }

    // 路径包含 protocols/ 或 api/（TSRPC 协议/服务目录）
    if (/\/protocols?\//.test(normalizedPath) || /\/api\//.test(normalizedPath)) {
      return true
    }

    // 文件名以 Ptl 或 Api 开头（TSRPC 命名约定）
    if (/\/Ptl\w+\.(ts|tsx|js|jsx)$/.test(normalizedPath)) {
      return true
    }
    if (/\/Api\w+\.(ts|tsx|js|jsx)$/.test(normalizedPath)) {
      return true
    }

    // Msg 开头的消息定义文件
    if (/\/Msg\w+\.(ts|tsx|js|jsx)$/.test(normalizedPath)) {
      return true
    }

    return false
  }

  /**
   * 执行解析
   */
  async parse(filePath: string, context: ParseContext): Promise<ParseResult> {
    const nodes: OmniNode[] = []
    const edges: OmniEdge[] = []
    const errors: ParseError[] = []

    try {
      if (!this.project) {
          const configFilePath = context.tsConfig?.options?.configFilePath
        this.project = new Project({
            tsConfigFilePath: typeof configFilePath === 'string' ? configFilePath : undefined,
          skipAddingFilesFromTsConfig: true,
        })
      }

      const fullPath = path.resolve(context.projectRoot, filePath)
      const sourceFile = this.project.addSourceFileAtPath(fullPath)

      const fileName = path.basename(filePath, path.extname(filePath))

      // 判断文件类型
      if (fileName.startsWith('Api')) {
        // API 服务实现文件
        const apiNodes = this.parseApiImplementations(sourceFile, filePath, context.projectRoot)
        nodes.push(...apiNodes)
      } else if (fileName.startsWith('Ptl')) {
        // 协议定义文件（Req/Res）
        const protocolNodes = this.parseProtocolDefinitions(sourceFile, filePath)
        nodes.push(...protocolNodes)
      } else if (fileName.startsWith('Msg')) {
        // 消息定义文件
        const msgNodes = this.parseMessageDefinitions(sourceFile, filePath)
        nodes.push(...msgNodes)
      } else {
        // 通用：尝试识别所有模式
        const apiNodes = this.parseApiImplementations(sourceFile, filePath, context.projectRoot)
        const protocolNodes = this.parseProtocolDefinitions(sourceFile, filePath)
        const msgNodes = this.parseMessageDefinitions(sourceFile, filePath)
        nodes.push(...apiNodes, ...protocolNodes, ...msgNodes)
      }

      this.project.removeSourceFile(sourceFile)

      // 如果有 serviceProto.ts，用它补全可能漏掉的接口
      const serviceProtoPath = context.projectMeta.tsrpcServiceProto
      if (serviceProtoPath && fs.existsSync(serviceProtoPath)) {
        const protoResult = TsRpcParser.parseServiceProto(serviceProtoPath)
        const existingNames = new Set(nodes.map(n => n.name))

        // 补全 API 节点
        for (const api of protoResult.apis) {
          if (!existingNames.has(`Api${api.name}`)) {
            nodes.push({
              id: createNodeId('tsrpc_api', serviceProtoPath, `Api${api.name}`),
              type: 'tsrpc_api',
              name: `Api${api.name}`,
              filePath: serviceProtoPath,
              line: 0,
              column: 0,
              metadata: {
                apiPath: api.path.toLowerCase(),
                transport: 'http',
                reqTypeName: `Req${api.name}`,
                resTypeName: `Res${api.name}`,
                hasCustomError: false,
              },
            })
          }
        }

        // 补全 Msg 节点
        for (const msg of protoResult.msgs) {
          if (!existingNames.has(`Msg${msg.name}`)) {
            nodes.push({
              id: createNodeId('tsrpc_msg', serviceProtoPath, `Msg${msg.name}`),
              type: 'tsrpc_msg',
              name: `Msg${msg.name}`,
              filePath: serviceProtoPath,
              line: 0,
              column: 0,
              metadata: {
                msgName: msg.name,
                msgTypeName: `Msg${msg.name}`,
                transport: 'ws',
                hasImplementation: false,
              },
            })
          }
        }
      }
    } catch (err) {
      errors.push({
        file: filePath,
        message: `TSRPC parser failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
        originalError: err instanceof Error ? err : undefined,
      })
    }

    return { nodes, edges, errors }
  }

  /**
   * 解析 API 服务实现文件（Api{Name}.ts）
   *
   * 识别模式：
   * - export async function ApiXxx(call: ApiCall<ReqXxx, ResXxx>) { ... }
   * - export default async function (call: ApiCall<ReqXxx, ResXxx>) { ... }
   */
  private parseApiImplementations(sourceFile: SourceFile, filePath: string, projectRoot: string): OmniNode[] {
    const nodes: OmniNode[] = []
    const fileName = path.basename(filePath, path.extname(filePath))
    const inferredName = fileName.startsWith('Api') ? fileName : `Api${fileName}`

    // 查找对应的协议文件
    const protocolFilePath = this.findProtocolFile(filePath, inferredName, projectRoot)
    const conf = protocolFilePath ? this.extractConf(protocolFilePath) : undefined

    sourceFile.forEachDescendant((node: Node) => {
        if (Node.isFunctionDeclaration(node)) {
          const funcDecl = node
        let funcName = funcDecl.getName() || ''

        // 匿名默认导出：从文件名推导
        const isDefaultExport = funcDecl.hasModifier?.(SyntaxKind.DefaultKeyword) ||
          funcDecl.getText().startsWith('export default')
        if (!funcName && isDefaultExport) {
          funcName = inferredName
        }

        if (!funcName.startsWith('Api') && !funcName.startsWith('api')) return

        const { hasApiCall, reqTypeName, resTypeName } = this.extractApiCallTypes(funcDecl.getParameters())

        if (hasApiCall) {
          const serviceName = funcName.replace(/^Api/i, '')
          const apiPath = this.inferApiPath(filePath, serviceName)
          const transport = this.inferTransport(filePath)

          nodes.push({
            id: createNodeId('tsrpc_api', filePath, funcName),
            type: 'tsrpc_api',
            name: funcName,
            filePath,
            line: funcDecl.getStartLineNumber(),
            column: 1,
            metadata: {
              apiPath,
              transport,
              reqTypeName,
              resTypeName,
              hasCustomError: this.hasCustomError(funcDecl),
              conf,
              protocolFilePath: protocolFilePath ? path.relative(projectRoot, protocolFilePath) : undefined,
            },
          })
        }
      }

      // 箭头函数形式
        if (Node.isVariableStatement(node)) {
          const varStmt = node
        for (const decl of varStmt.getDeclarations()) {
          const varName = decl.getName()
          if (!varName.startsWith('Api') && !varName.startsWith('api')) continue

          const initializer = decl.getInitializer()
          if (!initializer || !Node.isArrowFunction(initializer)) continue

            const { hasApiCall, reqTypeName, resTypeName } = this.extractApiCallTypes(initializer.getParameters())

          if (hasApiCall) {
            const serviceName = varName.replace(/^Api/i, '')
            const apiPath = this.inferApiPath(filePath, serviceName)

            nodes.push({
              id: createNodeId('tsrpc_api', filePath, varName),
              type: 'tsrpc_api',
              name: varName,
              filePath,
              line: decl.getStartLineNumber(),
              column: 1,
              metadata: {
                apiPath,
                transport: this.inferTransport(filePath),
                reqTypeName,
                resTypeName,
                hasCustomError: false,
                conf,
                protocolFilePath: protocolFilePath ? path.relative(projectRoot, protocolFilePath) : undefined,
              },
            })
          }
        }
      }
    })

    return nodes
  }

  /**
   * 解析协议定义文件（Ptl{Name}.ts）
   *
   * 提取 Req{Name}、Res{Name} 接口和 conf 配置
   */
  private parseProtocolDefinitions(sourceFile: SourceFile, filePath: string): OmniNode[] {
    const nodes: OmniNode[] = []
    const conf = this.extractConfFromSource(sourceFile)

    sourceFile.forEachDescendant((node: Node) => {
        if (Node.isInterfaceDeclaration(node)) {
          const iface = node
        const name = iface.getName()

        if (!name.startsWith('Req') && !name.startsWith('Res')) return

        const serviceName = name.replace(/^(Req|Res)/, '')
        const apiPath = this.inferApiPath(filePath, serviceName)

        nodes.push({
          id: createNodeId('tsrpc_api', filePath, name),
          type: 'tsrpc_api',
          name,
          filePath,
          line: iface.getStartLineNumber(),
          column: 1,
          metadata: {
            apiPath,
            transport: this.inferTransport(filePath),
            reqTypeName: name.startsWith('Req') ? name : null,
            resTypeName: name.startsWith('Res') ? name : null,
            hasCustomError: false,
            conf,
          },
        })
      }

        if (Node.isTypeAliasDeclaration(node)) {
          const typeAlias = node
        const name = typeAlias.getName()

        if (!name.startsWith('Req') && !name.startsWith('Res')) return

        const serviceName = name.replace(/^(Req|Res)/, '')
        const apiPath = this.inferApiPath(filePath, serviceName)

        nodes.push({
          id: createNodeId('tsrpc_api', filePath, name),
          type: 'tsrpc_api',
          name,
          filePath,
          line: typeAlias.getStartLineNumber(),
          column: 1,
          metadata: {
            apiPath,
            transport: this.inferTransport(filePath),
            reqTypeName: name.startsWith('Req') ? name : null,
            resTypeName: name.startsWith('Res') ? name : null,
            hasCustomError: false,
            conf,
          },
        })
      }
    })

    return nodes
  }

  /**
   * 解析消息定义文件（Msg{Name}.ts）
   *
   * MsgService 走发布/订阅模式，没有对应的实现文件
   */
  private parseMessageDefinitions(sourceFile: SourceFile, filePath: string): OmniNode[] {
    const nodes: OmniNode[] = []

    sourceFile.forEachDescendant((node: Node) => {
        if (Node.isInterfaceDeclaration(node)) {
          const iface = node
        const name = iface.getName()

        if (!name.startsWith('Msg')) return

        const msgName = name.replace(/^Msg/, '')

        nodes.push({
          id: createNodeId('tsrpc_msg', filePath, name),
          type: 'tsrpc_msg',
          name,
          filePath,
          line: iface.getStartLineNumber(),
          column: 1,
          metadata: {
            msgName,
            msgTypeName: name,
            transport: 'ws',
            hasImplementation: false,
          },
        })
      }

        if (Node.isTypeAliasDeclaration(node)) {
          const typeAlias = node
        const name = typeAlias.getName()

        if (!name.startsWith('Msg')) return

        const msgName = name.replace(/^Msg/, '')

        nodes.push({
          id: createNodeId('tsrpc_msg', filePath, name),
          type: 'tsrpc_msg',
          name,
          filePath,
          line: typeAlias.getStartLineNumber(),
          column: 1,
          metadata: {
            msgName,
            msgTypeName: name,
            transport: 'ws',
            hasImplementation: false,
          },
        })
      }
    })

    return nodes
  }

  /**
   * 从参数中提取 ApiCall 类型信息
   *
   * 优先从类型解析，降级到源码文本匹配
   */
  private extractApiCallTypes(params: import('ts-morph').ParameterDeclaration[]): {
    hasApiCall: boolean
    reqTypeName: string | null
    resTypeName: string | null
  } {
    let reqTypeName: string | null = null
    let resTypeName: string | null = null
    let hasApiCall = false

    for (const param of params) {
      // 方式 1：从类型系统解析
      const paramTypeText = param.getType().getText()
      if (paramTypeText.includes('ApiCall') && !paramTypeText.includes('__type')) {
        hasApiCall = true
        const match = paramTypeText.match(/ApiCall<\s*(\w+)\s*,\s*(\w+)/)
        if (match) {
          reqTypeName = match[1]
          resTypeName = match[2]
          return { hasApiCall, reqTypeName, resTypeName }
        }
      }

      // 方式 2：降级到源码文本匹配（当 tsrpc 类型不可用时）
      const paramSourceText = param.getText()
      const apiCallMatch = paramSourceText.match(/ApiCall<\s*(\w+)\s*,\s*(\w+)/)
      if (apiCallMatch) {
        hasApiCall = true
        reqTypeName = apiCallMatch[1]
        resTypeName = apiCallMatch[2]
        return { hasApiCall, reqTypeName, resTypeName }
      }
    }

    return { hasApiCall, reqTypeName, resTypeName }
  }

  /**
   * 查找对应的协议文件
   *
   * Api{Name}.ts → 查找 Ptl{Name}.ts
   */
  private findProtocolFile(apiFilePath: string, apiName: string, projectRoot: string): string | null {
    const apiDir = path.dirname(apiFilePath)
    const serviceName = apiName.replace(/^Api/i, '')

    // 搜索路径列表
    const searchPaths = [
      // 同目录下
      path.join(apiDir, `Ptl${serviceName}.ts`),
      // 父目录的 protocols 子目录
      path.join(apiDir, '..', 'shared', 'protocols', `Ptl${serviceName}.ts`),
      path.join(apiDir, '..', 'protocols', `Ptl${serviceName}.ts`),
      // 项目根目录的 protocols
      path.join(projectRoot, 'src', 'shared', 'protocols', `Ptl${serviceName}.ts`),
      path.join(projectRoot, 'protocols', `Ptl${serviceName}.ts`),
    ]

    // 也搜索子目录中的 Ptl 文件（如 api/todo/ApiCreateTodo → protocols/todo/PtlCreateTodo）
    const apiRelativeDir = apiDir.replace(/.*\/api\//, '')
    if (apiRelativeDir !== apiDir) {
      searchPaths.push(
        path.join(projectRoot, 'src', 'shared', 'protocols', apiRelativeDir, `Ptl${serviceName}.ts`),
        path.join(projectRoot, 'protocols', apiRelativeDir, `Ptl${serviceName}.ts`),
      )
    }

    for (const p of searchPaths) {
      const fullPath = path.resolve(p)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }

    return null
  }

  /**
   * 从协议文件中提取 conf 配置
   *
   * 识别模式：
   * - export const conf = { needLogin: true }
   */
  private extractConf(protocolFilePath: string): Record<string, unknown> | undefined {
    try {
      const content = fs.readFileSync(protocolFilePath, 'utf-8')
      return this.parseConfFromContent(content)
    } catch {
      return undefined
    }
  }

  /**
   * 从 SourceFile 中提取 conf 配置
   */
  private extractConfFromSource(sourceFile: SourceFile): Record<string, unknown> | undefined {
    const confExport = sourceFile.getVariableDeclaration('conf')
    if (!confExport) return undefined

    const initializer = confExport.getInitializer()
    if (!initializer || !Node.isObjectLiteralExpression(initializer)) return undefined

    const conf: Record<string, unknown> = {}
    for (const prop of initializer.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const key = prop.getName()
        const val = prop.getInitializer()
        if (val) {
          // 简单值提取
          const text = val.getText()
          if (text === 'true') conf[key] = true
          else if (text === 'false') conf[key] = false
          else if (/^\d+$/.test(text)) conf[key] = parseInt(text, 10)
          else conf[key] = text.replace(/^['"]|['"]$/g, '')
        }
      }
    }

    return Object.keys(conf).length > 0 ? conf : undefined
  }

  /**
   * 从文件内容中解析 conf（降级方案，不依赖 ts-morph）
   */
  private parseConfFromContent(content: string): Record<string, unknown> | undefined {
    const confMatch = content.match(/export\s+const\s+conf\s*=\s*(\{[^}]*\})/)
    if (!confMatch) return undefined

    try {
      // 简单的 JSON 解析（处理 { needLogin: true } 格式）
      const confStr = confMatch[1]
        .replace(/(\w+)\s*:/g, '"$1":')  // key: → "key":
        .replace(/'/g, '"')                // 单引号 → 双引号
      return JSON.parse(confStr)
    } catch {
      return undefined
    }
  }

  /**
   * 从文件路径推导 API 路径
   */
  private inferApiPath(filePath: string, serviceName: string): string {
    const normalized = filePath.replace(/\\/g, '/')
    const parts = normalized.split('/')

    let baseDirIndex = -1
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i] === 'api' || parts[i] === 'protocols' || parts[i] === 'protocol') {
        baseDirIndex = i
        break
      }
    }

    if (baseDirIndex >= 0 && baseDirIndex < parts.length - 1) {
      const subDirs = parts.slice(baseDirIndex + 1, parts.length - 1)
      if (subDirs.length > 0) {
        return subDirs.join('/') + '/' + serviceName.toLowerCase()
      }
    }

    return serviceName.toLowerCase()
  }

  /**
   * 推断传输协议
   */
  private inferTransport(filePath: string): 'http' | 'ws' {
    const normalized = filePath.toLowerCase()
    if (normalized.includes('ws') || normalized.includes('websocket')) {
      return 'ws'
    }
    return 'http'
  }

  /**
   * 检查是否有自定义错误处理
   */
  private hasCustomError(funcDecl: import('ts-morph').FunctionDeclaration): boolean {
    const body = funcDecl.getBody()
    if (!body) return false
    const text = body.getText()
    return text.includes('call.error') || text.includes('ApiError')
  }

  /**
   * 解析 serviceProto.ts（自动生成的运行时类型定义）
   *
   * 从中提取所有 API 和 Msg 的完整列表，用于补全 Api*.ts 扫描可能漏掉的接口。
   *
   * serviceProto.ts 中的 services 数组格式：
   * [{ "id": 0, "name": "todo/GetTodos", "type": "api" }, ...]
   */
  static parseServiceProto(protoFilePath: string): {
    apis: Array<{ id: number; name: string; path: string }>
    msgs: Array<{ id: number; name: string; path: string }>
  } {
    try {
      const content = fs.readFileSync(protoFilePath, 'utf-8')

      // 提取 services 数组
      const match = content.match(/"services"\s*:\s*(\[[\s\S]*?\])/m)
      if (!match) return { apis: [], msgs: [] }

      const services = parseServiceProtoEntries(match[1])

      const apis = services
        .filter(s => s.type === 'api')
        .map(s => ({
          id: s.id,
          name: s.name.split('/').pop() ?? s.name,   // 'todo/GetTodos' → 'GetTodos'
          path: s.name,                      // 完整路径用于匹配
        }))

      const msgs = services
        .filter(s => s.type === 'msg')
        .map(s => ({ id: s.id, name: s.name, path: s.name }))

      return { apis, msgs }
    } catch {
      return { apis: [], msgs: [] }
    }
  }
}
