import { useState } from 'react'
import { FilterPanel } from '../components/FilterPanel'
import { CheckIcon, SendIcon } from '../components/Icons'
import { Filters, DEFAULT_FILTERS } from '../types'

interface ProgressEvent {
  type: 'progress' | 'result' | 'error' | 'done'
  message?: string
  html?: string
  session_id?: string
}

async function* streamSSE(url: string, body: unknown): AsyncGenerator<ProgressEvent> {
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
        try { yield JSON.parse(line.slice(6)) as ProgressEvent } catch {}
      }
    }
  }
}

export function BriefingTab() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [running, setRunning] = useState(false)
  const [refining, setRefining] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [briefingHtml, setBriefingHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [refineInput, setRefineInput] = useState('')
  const [appliedFeedback, setAppliedFeedback] = useState<string[]>([])

  const noTopics = filters.topics.length === 0 && filters.custom_topics.length === 0

  async function generate() {
    if (noTopics) { setError('Select at least one topic.'); return }
    setRunning(true); setProgress([]); setBriefingHtml(null); setError(null)
    setSessionId(null); setAppliedFeedback([])
    try {
      for await (const event of streamSSE('/api/generate', filters)) {
        if (event.type === 'progress' && event.message) setProgress(p => [...p, event.message!])
        else if (event.type === 'result' && event.html) {
          setBriefingHtml(event.html)
          if (event.session_id) setSessionId(event.session_id)
        }
        else if (event.type === 'error' && event.message) setError(event.message)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  async function refine() {
    if (!sessionId || !refineInput.trim() || refining) return
    const feedback = refineInput.trim()
    setRefineInput('')
    setRefining(true)
    setProgress([])
    setError(null)
    try {
      for await (const event of streamSSE('/api/refine', { session_id: sessionId, feedback })) {
        if (event.type === 'progress' && event.message) setProgress(p => [...p, event.message!])
        else if (event.type === 'result' && event.html) {
          setBriefingHtml(event.html)
          setAppliedFeedback(p => [...p, feedback])
        }
        else if (event.type === 'error' && event.message) setError(event.message)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRefining(false)
    }
  }

  function printBriefing() {
    const win = window.open('', '_blank')
    if (!win || !briefingHtml) return
    win.document.write(`<!doctype html><html><head><title>FH AI Market Brief</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:1rem;color:#1d1d1f;line-height:1.65;-webkit-font-smoothing:antialiased}
h1{font-size:1.4rem;font-weight:700;margin:0 0 .4rem;letter-spacing:-.01em}
h2{font-size:1.15rem;font-weight:700;margin:0 0 1rem;letter-spacing:-.01em}
h3{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#aeaeb2;margin:1.75rem 0 .6rem;border-bottom:1px solid #f0f0f0;padding-bottom:.3rem}
ul{margin:.5rem 0;padding-left:1.25rem}li{margin-bottom:.45rem;font-size:.88rem}
table{width:100%;border-collapse:collapse;font-size:.8rem;margin:.5rem 0}
th{background:#1d1d1f;color:#fff;padding:.5rem .7rem;text-align:left;font-weight:600;font-size:.75rem;letter-spacing:.04em}
td{padding:.45rem .7rem;border-bottom:1px solid #f5f5f7;vertical-align:top}
.briefing-footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid #f0f0f0;font-size:.75rem;color:#aeaeb2}
@media print{body{margin:0}}
</style></head><body>${briefingHtml}</body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100%', width: '100%' }}>
      {/* Sidebar */}
      <div style={{
        width: '300px', flexShrink: 0, background: 'white', borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        border: '1px solid rgba(0,0,0,0.06)', padding: '20px', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
          Configure Briefing
        </div>

        <FilterPanel filters={filters} onChange={setFilters} disabled={running || refining} />

        {/* Timing note */}
        <div style={{
          borderLeft: '3px solid #f0b429', background: '#fff9e6',
          borderRadius: '0 8px 8px 0', padding: '10px 12px',
        }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#8a6800', lineHeight: 1.5 }}>
            Typically takes <strong>2–5 minutes</strong> — Claude collects from multiple federal APIs in parallel, then synthesizes.
          </p>
        </div>

        <button
          onClick={generate}
          disabled={running || refining || noTopics}
          style={{
            padding: '10px', borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem',
            border: 'none', cursor: running || refining || noTopics ? 'not-allowed' : 'pointer',
            background: running || refining || noTopics ? '#d1d1d6' : '#86BC25',
            color: 'white', transition: 'all 0.2s ease', letterSpacing: '-0.01em',
          }}
        >
          {running ? 'Generating…' : 'Generate Briefing'}
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {!briefingHtml && !running && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '6px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#6e6e73' }}>Ready to generate</div>
            <div style={{ fontSize: '0.8rem', color: '#aeaeb2' }}>Configure filters on the left and click Generate Briefing</div>
          </div>
        )}

        {running && (
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%',
                border: '2.5px solid #86BC25', borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1d1d1f' }}>Collecting &amp; synthesizing</span>
            </div>
            <p style={{ margin: '0 0 16px 28px', fontSize: '0.75rem', color: '#aeaeb2' }}>
              Please keep this tab open — this takes 2–5 minutes.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {progress.map((msg, i) => (
                <div key={i} className="fade-in-up" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.82rem', color: '#6e6e73' }}>
                  <span style={{ flexShrink: 0, marginTop: '2px' }}><CheckIcon /></span>
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fff2f2', border: '1px solid rgba(255,59,48,0.2)', borderRadius: '12px', padding: '14px 16px', fontSize: '0.83rem', color: '#c0392b', marginBottom: '12px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {briefingHtml && !running && (
          <div>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aeaeb2' }}>
                Briefing Preview
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={printBriefing} style={{ padding: '6px 14px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 500, border: '1px solid rgba(0,0,0,0.1)', background: 'white', color: '#6e6e73', cursor: 'pointer' }}>
                  Print / PDF
                </button>
                <button onClick={generate} disabled={refining} style={{ padding: '6px 14px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 500, border: 'none', background: refining ? '#d1d1d6' : '#86BC25', color: 'white', cursor: refining ? 'not-allowed' : 'pointer' }}>
                  Regenerate
                </button>
              </div>
            </div>

            {/* Refinement bar */}
            <div style={{
              background: 'white', borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.07)',
              padding: '12px 14px', marginBottom: '12px',
            }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#aeaeb2', marginBottom: '8px' }}>
                Refine this briefing
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={refineInput}
                  onChange={e => setRefineInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && refine()}
                  disabled={refining}
                  placeholder="Provide feedback or additional context to redraft…"
                  style={{
                    flex: 1, border: 'none', outline: 'none', borderRadius: '8px',
                    padding: '7px 10px', fontSize: '0.83rem', color: '#1d1d1f',
                    background: '#f5f5f7', opacity: refining ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={refine}
                  disabled={refining || !refineInput.trim()}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: refining || !refineInput.trim() ? '#f0f0f2' : '#1d1d1f',
                    cursor: refining || !refineInput.trim() ? 'not-allowed' : 'pointer',
                    flexShrink: 0, transition: 'all 0.15s ease',
                  }}
                >
                  {refining
                    ? <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #aeaeb2', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                    : <SendIcon color={refineInput.trim() ? '#ffffff' : '#aeaeb2'} />
                  }
                </button>
              </div>

              {/* Refinement progress */}
              {refining && progress.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {progress.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.78rem', color: '#6e6e73' }}>
                      <span style={{ flexShrink: 0, marginTop: '2px' }}><CheckIcon /></span>
                      {msg}
                    </div>
                  ))}
                </div>
              )}

              {/* Applied feedback tags */}
              {appliedFeedback.length > 0 && !refining && (
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', color: '#aeaeb2' }}>Applied:</span>
                  {appliedFeedback.map((f, i) => (
                    <span key={i} style={{
                      fontSize: '0.68rem', color: '#6e6e73', background: '#f0f0f2',
                      borderRadius: '4px', padding: '2px 7px',
                    }}>
                      {f.length > 48 ? f.slice(0, 48) + '…' : f}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Briefing content */}
            <div
              style={{
                background: 'white', borderRadius: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)',
                overflow: 'hidden', opacity: refining ? 0.45 : 1,
                transition: 'opacity 0.2s ease',
              }}
              dangerouslySetInnerHTML={{ __html: briefingHtml }}
            />
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
