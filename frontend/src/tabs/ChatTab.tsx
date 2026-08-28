import { useState, useRef, useEffect } from 'react'
import { FilterPanel } from '../components/FilterPanel'
import { Filters, DEFAULT_FILTERS, ChatMessage, SessionInfo } from '../types'

async function* streamSSE(url: string, body: unknown) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          yield JSON.parse(line.slice(6))
        } catch {}
      }
    }
  }
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
}

export function ChatTab() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState<string[]>([])
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function loadContext() {
    if (filters.topics.length === 0) {
      setError('Select at least one topic.')
      return
    }
    setLoading(true)
    setLoadingProgress([])
    setSession(null)
    setMessages([])
    setError(null)

    try {
      for await (const event of streamSSE('/api/collect', filters)) {
        if (event.type === 'progress') {
          setLoadingProgress(p => [...p, event.message])
        } else if (event.type === 'ready') {
          setSession({
            session_id: event.session_id,
            summary: event.summary,
            counts: event.counts,
            start_date: event.start_date,
            end_date: event.end_date,
          })
          setFiltersOpen(false)
        } else if (event.type === 'error') {
          setError(event.message)
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!input.trim() || !session || streaming) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setStreaming(true)
    setError(null)

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    setMessages(m => [...m, assistantMsg])

    try {
      for await (const event of streamSSE('/api/chat', {
        session_id: session.session_id,
        messages: [...messages, userMsg],
        user_context: filters.user_context,
      })) {
        if (event.type === 'chunk') {
          setMessages(m => {
            const updated = [...m]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + event.text,
            }
            return updated
          })
        } else if (event.type === 'error') {
          setError(event.message)
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar */}
      <div className="w-80 shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800">Research Context</h2>
          {session && (
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {filtersOpen ? 'collapse' : 'expand'}
            </button>
          )}
        </div>

        {session && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-xs font-semibold text-green-700 mb-1">Context Loaded</div>
            <div className="text-xs text-green-600">{session.summary}</div>
            <div className="text-xs text-green-500 mt-1">{session.start_date} — {session.end_date}</div>
          </div>
        )}

        {filtersOpen && (
          <>
            <FilterPanel filters={filters} onChange={setFilters} disabled={loading} />
            <button
              onClick={loadContext}
              disabled={loading || filters.topics.length === 0}
              className="mt-5 w-full py-2.5 rounded-lg font-semibold text-white transition-colors
                bg-[#00A3AD] hover:bg-[#008a93] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : session ? 'Reload Context' : 'Load Market Context'}
            </button>
          </>
        )}

        {loading && loadingProgress.length > 0 && (
          <ul className="mt-3 space-y-1">
            {loadingProgress.map((msg, i) => (
              <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                <span className="text-[#00A3AD]">✓</span>{msg}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {!session ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-8 text-center">
            {loading ? (
              <div>
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00A3AD] border-t-transparent mx-auto mb-3" />
                <div>Collecting market data...</div>
              </div>
            ) : (
              <div>
                <div className="text-3xl mb-3">📊</div>
                <div>Load market context to start the research chat.</div>
                <div className="text-xs mt-1 text-gray-300">Configure filters on the left, then click Load Market Context.</div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">
                  <div className="text-2xl mb-2">💬</div>
                  <div>Ask anything about this market space.</div>
                  <div className="text-xs mt-2 text-gray-300">
                    Try: "What are the top 3 signals this week?" or "Generate a briefing focused on VA contracts."
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role}`}>
                  {msg.role === 'user' ? (
                    <div className="ml-auto max-w-[80%] bg-[#86BC25] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="mr-auto max-w-[90%] bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
                      {msg.content ? (
                        <div
                          className="md-content"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                      ) : (
                        <div className="flex gap-1 items-center text-gray-400">
                          <span className="animate-bounce">●</span>
                          <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                          <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {error && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  disabled={streaming}
                  placeholder="Ask a question or say 'generate a briefing'... (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#00A3AD] disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={streaming || !input.trim()}
                  className="px-4 py-2 bg-[#00A3AD] text-white rounded-xl font-semibold text-sm
                    hover:bg-[#008a93] disabled:opacity-50 disabled:cursor-not-allowed self-end"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
