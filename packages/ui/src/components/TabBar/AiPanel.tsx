import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { isJsonObject, type ChatMessage } from '@codeomnivis/shared'
import { getGraph, postAiChat } from '../../services'
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
  // 与 SettingsDrawer 共用同一份全局配置（单一数据源，经 AiConfigForm）。
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
      // 获取当前图数据作为系统上下文（经服务层）
      const graphResponse = await getGraph(controller.signal)
      const meta: unknown = graphResponse.meta
      const nodeCount = readNumber(meta, 'nodeCount') ?? 0
      const edgeCount = readNumber(meta, 'edgeCount') ?? 0
      const nodesByType = isJsonObject(meta) && isJsonObject(meta.nodesByType) ? meta.nodesByType : {}

      const systemContext = `Project has ${nodeCount} nodes and ${edgeCount} edges. Node types: ${JSON.stringify(nodesByType)}`

      const chatMessages: ChatMessage[] = [
        { role: 'system', content: systemContext },
        { role: 'user', content: userMessage },
      ]
      const body = config === null ? { messages: chatMessages } : { messages: chatMessages, config }

      const result = await postAiChat(body, controller.signal)

      if (result.ok) {
        const content = result.content ?? t('ai.noResponse')
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content }])
      } else if (result.status === 429) {
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: 'Rate limit exceeded. Please try again later.' }])
      } else {
        const errorMsg = result.errorMessage ?? t('ai.serviceUnavailable')
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
    <div className="flex h-72 flex-col">
      {/* 头部：配置入口 */}
      <div className="flex items-center justify-between border-b border-border-subtle px-ds-3 py-ds-2">
        <span className="text-ds-xs text-content-muted">
          {config ? `${config.model}` : t('ai.notConfigured')}
        </span>
        <button
          onClick={() => setShowConfig(v => !v)}
          className="text-ds-xs text-content-muted transition-colors hover:text-content-secondary"
        >
          ⚙ {t('ai.configure')}
        </button>
      </div>

      {showConfig && (
        <div className="border-b border-border-subtle bg-surface-hover/40 p-ds-3">
          <AiConfigForm saveLabel={t('ai.saveConfig')} onSaved={() => setShowConfig(false)} />
        </div>
      )}

      {/* 消息区域 */}
      <div className="flex-1 space-y-ds-2 overflow-y-auto p-ds-3">
        {messages.length === 0 && (
          <div className="mt-ds-6 text-center text-ds-sm text-content-muted">
            <p>🤖 {t('ai.assistant')}</p>
            <p className="mt-1 text-ds-xs">{t('ai.askAboutArchitecture')}</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-ds-md p-ds-2 text-ds-sm ${
              msg.role === 'user'
                ? 'ml-8 bg-primary-600/20 text-primary-200'
                : 'mr-8 bg-surface-hover/60 text-content-secondary'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="animate-pulse text-ds-sm text-content-muted">{t('ai.thinking')}</div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="flex gap-ds-2 border-t border-border-subtle p-ds-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={t('ai.placeholder')}
          className="flex-1 rounded-ds-md border border-border-subtle bg-surface px-ds-3 py-1.5 text-ds-sm text-content placeholder:text-content-muted transition-colors focus:border-primary-500 focus:outline-none"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="rounded-ds-md bg-primary-600 px-ds-4 py-1.5 text-ds-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-50"
        >
          {t('ai.send')}
        </button>
      </div>
    </div>
  )
}
