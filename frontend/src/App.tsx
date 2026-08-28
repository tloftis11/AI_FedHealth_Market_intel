import { useState } from 'react'
import { BriefingTab } from './tabs/BriefingTab'
import { ChatTab } from './tabs/ChatTab'

type Tab = 'briefing' | 'chat'

export default function App() {
  const [tab, setTab] = useState<Tab>('briefing')

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-0 flex items-center justify-between">
          <div className="flex items-center gap-3 py-3">
            <div className="w-1 h-8 rounded-full" style={{ background: 'linear-gradient(180deg, #86BC25, #00A3AD)' }} />
            <div>
              <div className="text-sm font-bold text-gray-800 leading-tight">Federal Health</div>
              <div className="text-xs text-gray-500 leading-tight">AI Market Intelligence</div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex">
            {(['briefing', 'chat'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-4 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t
                    ? t === 'briefing'
                      ? 'border-[#86BC25] text-[#86BC25]'
                      : 'border-[#00A3AD] text-[#00A3AD]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {t === 'briefing' ? '📄 Generate Briefing' : '💬 Research Chat'}
              </button>
            ))}
          </nav>

          <div className="text-xs text-gray-400 py-3">Federal Health AI</div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-5 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {tab === 'briefing' ? <BriefingTab /> : <ChatTab />}
      </main>
    </div>
  )
}
