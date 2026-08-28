import { useState } from 'react'
import { BriefingTab } from './tabs/BriefingTab'
import { ChatTab } from './tabs/ChatTab'

type Tab = 'briefing' | 'chat'

export default function App() {
  const [tab, setTab] = useState<Tab>('briefing')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f5f5f7' }}>
      {/* Header */}
      <header style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#1d1d1f"/>
              <path d="M8 14h4l2-5 3 10 2-7 2 2h3" stroke="#86BC25" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                Federal Health
              </div>
              <div style={{ fontSize: '0.68rem', color: '#aeaeb2', lineHeight: 1.2 }}>
                AI Market Intelligence
              </div>
            </div>
          </div>

          {/* Segmented control */}
          <div style={{ background: '#f0f0f2', borderRadius: 999, padding: '3px', display: 'flex', gap: '2px' }}>
            {(['briefing', 'chat'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '5px 16px',
                  borderRadius: 999,
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: tab === t ? '#ffffff' : 'transparent',
                  color: tab === t ? '#1d1d1f' : '#6e6e73',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                {t === 'briefing' ? 'Generate Briefing' : 'Research Chat'}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '0.72rem', color: '#aeaeb2' }}>Federal Health AI</div>
        </div>
      </header>

      {/* Content — both tabs always mounted, shown/hidden to preserve state */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-5" style={{ height: 'calc(100vh - 57px)' }}>
        <div style={{ display: tab === 'briefing' ? 'flex' : 'none', height: '100%' }}>
          <BriefingTab />
        </div>
        <div style={{ display: tab === 'chat' ? 'flex' : 'none', height: '100%', width: '100%' }}>
          <ChatTab />
        </div>
      </main>
    </div>
  )
}
