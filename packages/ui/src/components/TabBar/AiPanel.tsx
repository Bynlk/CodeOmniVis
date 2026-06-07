import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

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
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { id: generateId(), role: 'user', content: userMessage }])
    setIsLoading(true)

    // 创建新的 AbortController
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      // 获取当前图数据作为上下文
      const graphRes = await fetch('/api/graph', { signal: controller.signal })
      if (!graphRes.ok) {
        throw new Error(`Failed to fetch graph: ${graphRes.status}`)
      }
      const graphData = await graphRes.json()

      // 构建 prompt
      const context = `Project has ${graphData.meta?.nodeCount ?? 0} nodes and ${graphData.meta?.edgeCount ?? 0} edges. Node types: ${JSON.stringify(graphData.meta?.nodesByType ?? {})}`

      // 调用 AI API（如果有的话）
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context,
        }),
        signal: controller.signal,
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: data.response ?? t('ai.noResponse') }])
      } else if (res.status === 429) {
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: 'Rate limit exceeded. Please try again later.' }])
      } else {
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: t('ai.serviceUnavailable') }])
      }
    } catch (err) {
      // 忽略 abort 错误
      if (err instanceof DOMException && err.name === 'AbortError') return
      setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: t('ai.serviceUnavailable') }])
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
        setIsLoading(false)
      }
    }
  }, [input, isLoading])

  return (
    <div className="flex flex-col h-56">
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
