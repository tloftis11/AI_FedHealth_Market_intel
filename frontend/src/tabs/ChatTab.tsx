import { useState, useRef, useEffect, useCallback } from 'react'
import { FilterPanel } from '../components/FilterPanel'
import { Filters, DEFAULT_FILTERS, ChatMessage, SessionInfo } from '../types'

const EXAMPLE_QUESTIONS = [
  { icon: '📡', text: 'What are the top market signals I should be tracking right now?' },
  { icon: '🏛️', text: 'Summarize the most significant federal contracts awarded this period.' },
  { icon: '🏢', text: 'Which private sector companies are most actively moving into this space?' },
  { icon: '📋', text: 'What policy or regulatory changes should I be aware of?' },
  { icon: '📄', text: 'Generate a leadership-ready briefing based on the current data.' },
  { icon: '🔭', text: "What's the 6-month outlook and where are the biggest opportunities?" },
]

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
        try { yield JSON.parse(line.slice(6)) } catch {}
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState<string[]>([])
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadContext = useCallback(async (f = filters) => {
    if (f.topics.length === 0) return
    setLoading(true)
    setLoadingProgress([])
    setSession(null)
    setMessages([])
    setError(null)
    setSidebarOpen(false)
    try {
      for await (const event of streamSSE('/api/collect', f)) {
        if (event.type === 'progress') setLoadingProgress(p => [...p, event.message])
        else if (event.type === 'ready') {
          setSession({ session_id: event.session_id, summary: event.summary, counts: event.counts, start_date: event.start_date, end_date: event.end_date })
        } else if (event.type === 'error') setError(event.message)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Auto-load on first mount
  useEffect(() => { loadContext() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || !session || streaming) return
    const userMsg: ChatMessage = { role: 'user', content }
    setMessages(m => [...m, userMsg])
    setInput('')
    setStreaming(true)
    setError(null)
    setMessages(m => [...m, { role: 'assistant', content: '' }])
    try {
      for await (const event of streamSSE('/api/chat', {
        session_id: session.session_id,
        messages: [...messages, userMsg],
        user_context: filters.user_context,
      })) {
        if (event.type === 'chunk') {
          setMessages(m => {
            const updated = [...m]
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + event.text }
            return updated
          })
        } else if (event.type === 'error') setError(event.message)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '16px', height: '100%', width: '100%', position: 'relative' }}>

      {/* Filter drawer (slide in from left) */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
          <div className="fade-in-up" style={{
            position: 'fixed', left: '24px', top: '74px', bottom: '24px',
            width: '300px', background: 'white', borderRadius: '16px', zIndex: 50,
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)', padding: '20px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1d1d1f' }}>Filters</div>
              <button onClick={() => setSidebarOpen(false)} style={{ background: '#f0f0f2', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', fontSize: '0.8rem', color: '#6e6e73' }}>✕</button>
            </div>
            <FilterPanel filters={filters} onChange={setFilters} disabled={loading} />
            <button
              onClick={() => { setSidebarOpen(false); loadContext(filters) }}
              disabled={loading || filters.topics.length === 0}
              style={{
                padding: '10px', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem',
                border: 'none', cursor: 'pointer', background: '#00A3AD', color: 'white',
                opacity: loading || filters.topics.length === 0 ? 0.5 : 1,
              }}
            >
              {loading ? 'Loading…' : 'Apply & Reload Context'}
            </button>
          </div>
        </>
      )}

      {/* Main chat area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>

        {/* Chat top bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', background: 'white', cursor: 'pointer', fontSize: '0.75rem', color: '#6e6e73', fontWeight: 500 }}
            >
              <span>⚙</span> Filters
            </button>
            {session && (
              <div style={{ fontSize: '0.72rem', color: '#aeaeb2' }}>
                {session.start_date} – {session.end_date} · {Object.values(session.counts).reduce((a, b) => a + b, 0)} items
              </div>
            )}
          </div>
          {session && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#86BC25', display: 'inline-block' }} />
              <span style={{ fontSize: '0.72rem', color: '#86BC25', fontWeight: 500 }}>Context loaded</span>
            </div>
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #00A3AD', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '0.72rem', color: '#00A3AD', fontWeight: 500 }}>Loading context…</span>
            </div>
          )}
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Loading state */}
          {loading && (
            <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 0' }}>
              {loadingProgress.length === 0 ? (
                <div style={{ color: '#aeaeb2', fontSize: '0.82rem', textAlign: 'center', paddingTop: '40px' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔍</div>
                  Collecting from federal data sources…
                </div>
              ) : loadingProgress.map((msg, i) => (
                <div key={i} className="fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#6e6e73' }}>
                  <span style={{ color: '#86BC25', fontSize: '0.65rem' }}>✓</span>{msg}
                </div>
              ))}
            </div>
          )}

          {/* Empty + example questions */}
          {!loading && session && messages.length === 0 && (
            <div className="fade-in-up">
              <div style={{ textAlign: 'center', padding: '20px 0 16px', color: '#aeaeb2', fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Suggested questions
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {EXAMPLE_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q.text)}
                    disabled={streaming}
                    style={{
                      textAlign: 'left', padding: '12px 14px', borderRadius: '12px',
                      border: '1px solid rgba(0,0,0,0.07)', background: '#fafafa',
                      cursor: 'pointer', fontSize: '0.78rem', color: '#1d1d1f',
                      lineHeight: 1.45, transition: 'all 0.15s ease',
                      display: 'flex', flexDirection: 'column', gap: '4px',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f7e6'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(134,188,37,0.3)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.07)' }}
                  >
                    <span style={{ fontSize: '1rem' }}>{q.icon}</span>
                    <span style={{ color: '#3d3d3f' }}>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No context yet (error or not loaded) */}
          {!loading && !session && !error && (
            <div style={{ textAlign: 'center', paddingTop: '60px', color: '#aeaeb2', fontSize: '0.83rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</div>
              Starting up — loading market context…
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className="fade-in-up" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'user' ? (
                <div style={{
                  maxWidth: '72%', background: '#86BC25', color: 'white',
                  borderRadius: '18px 18px 4px 18px', padding: '10px 14px',
                  fontSize: '0.875rem', lineHeight: 1.5,
                }}>
                  {msg.content}
                </div>
              ) : (
                <div style={{
                  maxWidth: '82%', background: '#f5f5f7',
                  borderRadius: '18px 18px 18px 4px', padding: '12px 16px',
                  fontSize: '0.875rem', lineHeight: 1.6, color: '#1d1d1f',
                }}>
                  {msg.content ? (
                    <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                  ) : (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && (
            <div style={{ background: '#fff2f2', border: '1px solid rgba(255,59,48,0.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '0.8rem', color: '#c0392b' }}>
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {(session || loading) && (
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '12px 16px', background: '#fafafa' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                disabled={streaming || loading}
                placeholder={loading ? 'Loading context, please wait…' : 'Ask anything, or say "generate a briefing"…'}
                rows={2}
                style={{
                  flex: 1, border: 'none', borderRadius: '12px', padding: '10px 14px',
                  fontSize: '0.875rem', resize: 'none', outline: 'none',
                  background: '#f0f0f2', color: '#1d1d1f', lineHeight: 1.5,
                  opacity: loading ? 0.5 : 1,
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={streaming || loading || !input.trim()}
                style={{
                  width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                  background: streaming || loading || !input.trim() ? '#d1d1d6' : '#00A3AD',
                  color: 'white', cursor: streaming || loading || !input.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '1rem', transition: 'background 0.15s ease', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ↑
              </button>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#aeaeb2', marginTop: '6px', paddingLeft: '2px' }}>
              Enter to send · Shift+Enter for newline
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
