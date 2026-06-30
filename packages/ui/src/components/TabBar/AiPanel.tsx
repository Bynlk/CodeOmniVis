import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isJsonObject, isAiConfig, validateUpstreamBaseUrl, type AiConfig, type ChatMessage } from '@codeomnivis/shared'
import { setAiConfig } from '../../lib/aiConfig'
import { useAiConfig } from '../../hooks/useAiConfig'

function readString(obj: unknown, key: string): string | undefined {
  if (isJsonObject(obj) && typeof obj[key] === 'string') return obj[key]
  return undefined
}

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
  // M3:与 SettingsDrawer 共用同一份全局配置(单一数据源)。
  const { config, rememberKey: storedRemember } = useAiConfig()
  const [draftBaseUrl, setDraftBaseUrl] = useState('')
  const [draftApiKey, setDraftApiKey] = useState('')
  const [draftModel, setDraftModel] = useState('')
  const [rememberKey, setRememberKey] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (config) {
      setDraftBaseUrl(config.baseUrl)
      setDraftApiKey(config.apiKey)
      setDraftModel(config.model)
    }
    setRememberKey(storedRemember)
  }, [config, storedRemember])

  const handleSaveConfig = useCallback(() => {
    const next: AiConfig = { baseUrl: draftBaseUrl.trim(), apiKey: draftApiKey.trim(), model: draftModel.trim() }
    if (!isAiConfig(next)) return
    // M4:保存前用共享 SSRF/https 校验器拦截私网/非 https 的非环回地址。
    const check = validateUpstreamBaseUrl(next.baseUrl)
    if (!check.ok) {
      setConfigError(check.reason ?? t('settings.ai.invalidUrl'))
      return
    }
    setConfigError(null)
    setAiConfig(next, rememberKey)
    setShowConfig(false)
  }, [draftBaseUrl, draftApiKey, draftModel, rememberKey, t])

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
        <div className="p-3 space-y-2 border-b border-slate-700 bg-slate-800/50">
          <input
            type="text"
            value={draftBaseUrl}
            onChange={e => setDraftBaseUrl(e.target.value)}
            placeholder="Base URL (e.g. https://api.openai.com/v1)"
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-400"
          />
          <input
            type="password"
            value={draftApiKey}
            onChange={e => setDraftApiKey(e.target.value)}
            placeholder="API Key"
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-400"
          />
          <input
            type="text"
            value={draftModel}
            onChange={e => setDraftModel(e.target.value)}
            placeholder="Model (e.g. gpt-4o-mini)"
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-400"
          />
          <label className="flex items-center gap-2 text-[11px] text-slate-300 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={rememberKey}
              onChange={e => setRememberKey(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-700 text-primary-600 focus:ring-primary-500"
            />
            {t('settings.ai.rememberKey')}
          </label>
          {configError && (
            <p className="text-[11px] text-red-400 break-all">{configError}</p>
          )}
          <button
            onClick={handleSaveConfig}
            disabled={!draftBaseUrl.trim() || !draftApiKey.trim() || !draftModel.trim()}
            className="w-full px-2 py-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded text-xs"
          >
            {t('ai.saveConfig')}
          </button>
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
