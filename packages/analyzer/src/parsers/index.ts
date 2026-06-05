/**
 * @omnivis/analyzer/parsers — 解析器注册中心
 *
 * 所有解析器必须实现 Parser 接口。
 * 解析器之间互相独立，通过 pipeline 统一编排。
 */

export { PrismaParser } from './prisma'
// TODO: 后续添加其他解析器
// export { NextjsAppParser } from './nextjsApp'
// export { NextjsPagesParser } from './nextjsPages'
// export { TrpcParser } from './trpc'
// export { ExpressParser } from './express'
