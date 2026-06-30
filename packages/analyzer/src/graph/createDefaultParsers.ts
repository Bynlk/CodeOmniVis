/**
 * createDefaultParsers — 默认解析器集合工厂(单一来源)
 *
 * 修复 DUP-01:analyze / check / serve 三命令此前各自手工拼解析器列表,
 * 容易漂移(analyze、check 曾漏注册 TsRpcParser)。统一由本工厂提供
 * 同一份完整集合,杜绝再次遗漏。
 */

import type { Parser } from '@codeomnivis/shared'
import { PrismaParser } from '../parsers/prisma'
import { NextjsAppParser } from '../parsers/nextjsApp'
import { NextjsPagesParser } from '../parsers/nextjsPages'
import { TrpcParser } from '../parsers/trpc'
import { TsRpcParser } from '../parsers/tsrpc'
import { ExpressParser } from '../parsers/express'
import { TypeormParser } from '../parsers/typeorm'
import { ApiCallsParser } from '../parsers/apiCalls'
import { ReactComponentParser } from '../parsers/reactComponent'
import { NestjsControllerParser } from '../parsers/nestjs/nestjsControllerParser'
import { NestjsModuleParser } from '../parsers/nestjs/nestjsModuleParser'
import { NestjsServiceParser } from '../parsers/nestjs/nestjsServiceParser'
import { DrizzleParser } from '../parsers/drizzle'
import { KotlinParser } from '../parsers/kotlin/kotlinParser'
import { SpringKotlinParser } from '../parsers/kotlin/springKotlinParser'
import { KtorParser } from '../parsers/kotlin/ktorParser'
import { RoomParser } from '../parsers/kotlin/roomParser'
import { ExposedParser } from '../parsers/kotlin/exposedParser'

/**
 * 返回 TS 全栈分析的默认解析器集合。
 * 每次调用返回全新实例(解析器持有 per-run 状态,不应跨命令复用同一实例)。
 */
export function createDefaultParsers(): Parser[] {
  return [
    new PrismaParser(),
    new NextjsAppParser(),
    new NextjsPagesParser(),
    new TrpcParser(),
    new TsRpcParser(),
    new ExpressParser(),
    new TypeormParser(),
    new ApiCallsParser(),
    new ReactComponentParser(),
    new NestjsControllerParser(),
    new NestjsModuleParser(),
    new NestjsServiceParser(),
    new DrizzleParser(),
    // Kotlin 解析器(E-10/F8):此前从未纳入默认工厂,导致 Kotlin 项目走默认入口时全程不可达。
    new KotlinParser(),
    new SpringKotlinParser(),
    new KtorParser(),
    new RoomParser(),
    new ExposedParser(),
  ]
}
