/**
 * @omnivis/analyzer/parsers — 解析器注册中心
 *
 * 所有解析器必须实现 Parser 接口。
 * 解析器之间互相独立，通过 pipeline 统一编排。
 */

export { PrismaParser } from './prisma'
export { NextjsAppParser } from './nextjsApp'
export { NextjsPagesParser } from './nextjsPages'
export { TrpcParser } from './trpc'
export { ExpressParser } from './express'
export { TypeormParser } from './typeorm'
export { ApiCallsParser } from './apiCalls'
export { ReactComponentParser } from './reactComponent'

// Kotlin 解析器
export { KotlinParser } from './kotlin/kotlinParser'
export { SpringKotlinParser } from './kotlin/springKotlinParser'
export { KtorParser } from './kotlin/ktorParser'
export { RoomParser } from './kotlin/roomParser'
export { ExposedParser } from './kotlin/exposedParser'
