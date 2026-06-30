/**
 * WebSocket Origin 白名单守卫(H4 · S-04)
 *
 * 防止跨站 WebSocket 劫持(CSWSH):浏览器发起的 WS 升级握手会带 Origin 头,
 * 仅放行白名单内的源。无 Origin 的连接来自非浏览器客户端(不受 CSWSH 影响),放行。
 */

/** 将 corsOrigin 配置规整为白名单数组。 */
export function toOriginAllowlist(corsOrigin: string | string[]): readonly string[] {
  return Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin]
}

/**
 * 判断 WS 升级握手的 Origin 是否被允许。
 *
 * @param origin 握手请求的 Origin 头(浏览器必带;非浏览器客户端可能缺省)。
 * @param allowlist 允许的源列表;包含 '*' 时放行任意源。
 */
export function isOriginAllowed(origin: string | undefined, allowlist: readonly string[]): boolean {
  // 非浏览器客户端不发送 Origin,不受 CSWSH 影响,放行。
  if (origin === undefined || origin === '') return true
  if (allowlist.includes('*')) return true
  return allowlist.includes(origin)
}
