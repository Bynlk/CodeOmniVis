/**
 * WebSocket 生命周期控制器(LEAK-04)
 *
 * 把"连接 / 重连 / 关闭"的状态机从 React Hook 中剥离,使其可在无 DOM 的
 * node 环境下被注入式测试。控制器自身持有:
 *   - disposed:本控制器是否已销毁(组件卸载)。销毁后任何回调都不再产生副作用。
 *   - shouldReconnect:是否允许自动重连。dispose() 会先关闭它再 close,
 *     从而避免"卸载后 onclose 触发重连 → 创建新 socket → 卸载后 setState"。
 *
 * 关键不变量:
 *   1. dispose() 后 connect() 直接 no-op,不再创建 socket。
 *   2. 仅在"非主动关闭"(shouldReconnect 仍为 true 且未 disposed)时才重连。
 *   3. dispose() 取消挂起的重连定时器并关闭当前 socket。
 */

/** 控制器只依赖 socket 的这几个回调与 close(),便于在测试中以假对象替换。 */
export interface MinimalSocket {
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: ((event: unknown) => void) | null
  close: () => void
}

/**
 * 安排一次重连。返回一个"取消函数",调用即可撤销这次重连。
 * 用取消函数而非平台相关的定时器句柄,既避免 number/NodeJS.Timeout 跨平台分歧,
 * 也让测试无需构造定时器句柄即可注入。
 */
export type ScheduleReconnect = (callback: () => void, delayMs: number) => () => void

export interface WebSocketControllerOptions {
  /** 创建底层 socket(生产环境为包装后的 new WebSocket(url))。 */
  createSocket: () => MinimalSocket
  /** 收到一条已 JSON.parse 的消息(解析失败的消息不会回调)。 */
  onMessage: (data: unknown) => void
  /** 连接状态变化(open=true / close=false)。disposed 后不再回调。 */
  onConnectedChange?: (connected: boolean) => void
  /** 自动重连延迟(毫秒),默认 3000。 */
  reconnectDelayMs?: number
  /** 注入式重连调度,默认基于 setTimeout/clearTimeout。 */
  scheduleReconnect?: ScheduleReconnect
}

const defaultScheduleReconnect: ScheduleReconnect = (callback, delayMs) => {
  const id = setTimeout(callback, delayMs)
  return () => clearTimeout(id)
}

export class WebSocketController {
  private readonly options: WebSocketControllerOptions
  private socket: MinimalSocket | null = null
  private cancelReconnect: (() => void) | null = null
  private disposed = false
  private shouldReconnect = true

  constructor(options: WebSocketControllerOptions) {
    this.options = options
  }

  connect(): void {
    // 已销毁或已禁用重连 → 不再创建 socket(避免卸载后重连)。
    if (this.disposed || !this.shouldReconnect) return
    // 已有活动 socket 时不重复创建。
    if (this.socket) return

    let socket: MinimalSocket
    try {
      socket = this.options.createSocket()
    } catch {
      // 连接创建失败,静默处理(与原 Hook 行为一致)。
      return
    }
    this.socket = socket

    socket.onopen = () => {
      if (this.disposed) return
      this.options.onConnectedChange?.(true)
    }

    socket.onmessage = (event) => {
      if (this.disposed) return
      const raw: string = typeof event.data === 'string' ? event.data : ''
      let data: unknown
      try {
        data = JSON.parse(raw)
      } catch {
        return
      }
      this.options.onMessage(data)
    }

    socket.onclose = () => {
      this.socket = null
      if (this.disposed) return
      this.options.onConnectedChange?.(false)
      // 仅在非主动关闭时重连。
      if (this.shouldReconnect) {
        const delay = this.options.reconnectDelayMs ?? 3000
        const schedule = this.options.scheduleReconnect ?? defaultScheduleReconnect
        this.cancelReconnect = schedule(() => {
          this.cancelReconnect = null
          this.connect()
        }, delay)
      }
    }

    socket.onerror = () => {
      socket.close()
    }
  }

  /** 组件卸载:先禁重连,取消挂起定时器,再关闭 socket,最后置连接态为 false。 */
  dispose(): void {
    this.disposed = true
    this.shouldReconnect = false

    if (this.cancelReconnect !== null) {
      this.cancelReconnect()
      this.cancelReconnect = null
    }

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.options.onConnectedChange?.(false)
  }
}
