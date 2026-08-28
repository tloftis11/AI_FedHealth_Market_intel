import { useState } from 'react'
import { FilterPanel } from '../components/FilterPanel'
import { Filters, DEFAULT_FILTERS } from '../types'

interface ProgressEvent {
  type: 'progress' | 'result' | 'error' | 'done'
  message?: string
  html?: string
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
        try {
          yield JSON.parse(line.slice(6)) as ProgressEvent
        } catch {}
      }
    }
  }
}

export function BriefingTab() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [briefingHtml, setBriefingHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    if (filters.topics.length === 0) {
      setError('Select at least one topic.')
      return
    }
    setRunning(true)
    setProgress([])
    setBriefingHtml(null)
    setError(null)

    try {
      for await (const event of streamSSE('/api/generate', filters)) {
        if (event.type === 'progress' && event.message) {
          setProgress(p => [...p, event.message!])
        } else if (event.type === 'result' && event.html) {
          setBriefingHtml(event.html)
        } else if (event.type === 'error' && event.message) {
          setError(event.message)
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  function printBriefing() {
    const win = window.open('', '_blank')
    if (!win || !briefingHtml) return
    win.document.write(`<!doctype html><html><head><title>FH AI Market Brief</title>
<style>
body{font-family:'Calibri','Segoe UI',sans-serif;max-width:860px;margin:2rem auto;padding:1rem;color:#1a1a1a;line-height:1.6}
h1{font-size:1.5rem;font-weight:700;margin:0 0 .5rem}
h2{font-size:1.2rem;font-weight:700;margin:0 0 1rem}
h3{font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#444;margin:1.5rem 0 .5rem;border-bottom:1px solid #e0e0e0;padding-bottom:.25rem}
ul{margin:.5rem 0;padding-left:1.25rem} li{margin-bottom:.4rem;font-size:.9rem}
table{width:100%;border-collapse:collapse;font-size:.82rem;margin:.5rem 0}
th{background:#333;color:#fff;padding:.45rem .6rem;text-align:left;font-weight:600}
td{padding:.4rem .6rem;border-bottom:1px solid #e8e8e8;vertical-align:top}
.briefing-footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #ddd;font-size:.78rem;color:#777}
@media print{body{margin:0}}
</style></head><body>${briefingHtml}</body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar */}
      <div className="w-80 shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 p-5 overflow-y-auto">
        <h2 className="text-base font-bold text-gray-800 mb-4">Briefing Filters</h2>
        <FilterPanel filters={filters} onChange={setFilters} disabled={running} />

        {/* Timing warning */}
        <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <span className="text-amber-500 text-sm mt-0.5">⏱</span>
          <p className="text-xs text-amber-700 leading-snug">
            Generating a briefing typically takes <strong>2–5 minutes</strong> — Claude is collecting from multiple federal APIs and synthesizing the results.
          </p>
        </div>

        <button
          onClick={generate}
          disabled={running || filters.topics.length === 0}
          className="mt-4 w-full py-2.5 rounded-lg font-semibold text-white transition-colors
            bg-[#86BC25] hover:bg-[#75a820] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Generating...' : 'Generate Briefing'}
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!briefingHtml && !running && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm gap-2">
            <div className="text-3xl">📄</div>
            <p>Configure filters and click <strong className="text-gray-500">Generate Briefing</strong> to begin.</p>
            <p className="text-xs text-gray-300">Allow 2–5 minutes for collection and synthesis.</p>
          </div>
        )}

        {running && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#86BC25] border-t-transparent" />
              <span className="font-semibold text-gray-700">Collecting &amp; synthesizing...</span>
            </div>
            <p className="text-xs text-gray-400 mb-4 ml-8">This takes 2–5 minutes. Please keep this tab open.</p>
            <ul className="space-y-1.5">
              {progress.map((msg, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-[#86BC25] mt-0.5 shrink-0">✓</span>
                  {msg}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {briefingHtml && !running && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Briefing Preview</h2>
              <div className="flex gap-2">
                <button
                  onClick={printBriefing}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  Print / Save PDF
                </button>
                <button
                  onClick={generate}
                  className="px-3 py-1.5 text-sm bg-[#86BC25] text-white rounded-lg hover:bg-[#75a820]"
                >
                  Regenerate
                </button>
              </div>
            </div>
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"
              dangerouslySetInnerHTML={{ __html: briefingHtml }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
