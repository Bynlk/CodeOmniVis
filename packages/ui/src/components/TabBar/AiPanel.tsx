import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { isJsonObject, type ChatMessage } from '@codeomnivis/shared'
import { readString } from '../../utils/readString'
import { useAiConfig } from '../../hooks/useAiConfig'
import { AiConfigForm } from '../AiConfigForm'

function readNumber(obj: unknown, key: string): number | undefined {
  if (isJsonObject(obj) && typeof obj[key] === 'number') return obj[key]
  return undefined
}

interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

let messageIdCounter = 0
function generateId(): string {
  return `msg-${++messageIdCounter}-${Date.now()}`
}

export function AiPanel() {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  // M3:与 SettingsDrawer 共用同一份全局配置(单一数据源,经 AiConfigForm)。
  const { config } = useAiConfig()
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { id: generateId(), role: 'user', content: userMessage }])
    setIsLoading(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      // 获取当前图数据作为系统上下文
      const graphRes = await fetch('/api/graph', { signal: controller.signal })
      if (!graphRes.ok) throw new Error(`Failed to fetch graph: ${graphRes.status}`)
      const graphData: unknown = await graphRes.json()
      const meta = isJsonObject(graphData) ? graphData.meta : undefined
      const nodeCount = readNumber(meta, 'nodeCount') ?? 0
      const edgeCount = readNumber(meta, 'edgeCount') ?? 0
      const nodesByType = isJsonObject(meta) && isJsonObject(meta.nodesByType) ? meta.nodesByType : {}

      const systemContext = `Project has ${nodeCount} nodes and ${edgeCount} edges. Node types: ${JSON.stringify(nodesByType)}`

      const chatMessages: ChatMessage[] = [
        { role: 'system', content: systemContext },
        { role: 'user', content: userMessage },
      ]
      const body = config === null ? { messages: chatMessages } : { messages: chatMessages, config }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (res.ok) {
        const payload: unknown = await res.json()
        const data = isJsonObject(payload) ? payload.data : undefined
        const content = readString(data, 'content') ?? t('ai.noResponse')
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content }])
      } else if (res.status === 429) {
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: 'Rate limit exceeded. Please try again later.' }])
      } else {
        // 解析错误响应,显示后端返回的具体信息
        let errorMsg = t('ai.serviceUnavailable')
        try {
          const errData: unknown = await res.json()
          const detail = readString(errData, 'message') ?? readString(errData, 'error')
          if (detail) errorMsg = detail
        } catch { /* 忽略解析错误 */ }
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: errorMsg }])
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: t('ai.serviceUnavailable') }])
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
        setIsLoading(false)
      }
    }
  }, [input, isLoading, config, t])

  return (
    <div className="flex flex-col h-56">
      {/* 头部:配置入口 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700">
        <span className="text-xs text-slate-400">
          {config ? `${config.model}` : t('ai.notConfigured')}
        </span>
        <button
          onClick={() => setShowConfig(v => !v)}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          ⚙ {t('ai.configure')}
        </button>
      </div>

      {showConfig && (
        <div className="p-3 border-b border-slate-700 bg-slate-800/50">
          <AiConfigForm saveLabel={t('ai.saveConfig')} onSaved={() => setShowConfig(false)} />
        </div>
      )}

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm mt-8">
            <p>🤖 {t('ai.assistant')}</p>
            <p className="text-xs mt-1">{t('ai.askAboutArchitecture')}</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm p-2 rounded ${
              msg.role === 'user'
                ? 'bg-primary-600/20 text-primary-200 ml-8'
                : 'bg-slate-700/50 text-slate-300 mr-8'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="text-sm text-slate-500 animate-pulse">{t('ai.thinking')}</div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="border-t border-slate-700 p-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={t('ai.placeholder')}
          className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded text-sm transition-colors"
        >
          {t('ai.send')}
        </button>
      </div>
    </div>
  )
}
