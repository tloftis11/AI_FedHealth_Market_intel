import { Filters } from '../types'

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  disabled?: boolean
}

const TOPICS = [
  { key: 'human_plus', label: 'Human+ · AI Workforce' },
  { key: 'clinical_trials_ai', label: 'AI Clinical Trials' },
]

const LOOKBACK_OPTIONS = [
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
  { value: 180, label: '180d' },
  { value: 0, label: 'Custom' },
]

const AGENCIES = ['HHS', 'VA', 'DoD']

const SOURCES = [
  { key: 'usa_spending', label: 'USASpending' },
  { key: 'fed_register', label: 'Fed Register' },
  { key: 'nih', label: 'NIH Reporter' },
  { key: 'news', label: 'News' },
  { key: 'clinical_trials', label: 'ClinicalTrials' },
]

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#aeaeb2', marginBottom: '8px' }}>
      {children}
    </div>
  )
}

function Toggle({ selected, onClick, disabled, children }: {
  selected: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        fontSize: '0.8rem',
        fontWeight: selected ? 600 : 400,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        background: selected ? '#1d1d1f' : '#f0f0f2',
        color: selected ? '#ffffff' : '#6e6e73',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}

function SourceToggle({ selected, onClick, disabled, children }: {
  selected: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: '0.72rem',
        fontWeight: selected ? 500 : 400,
        border: selected ? 'none' : '1px solid #e8e8ed',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        background: selected ? '#e8f5d0' : '#ffffff',
        color: selected ? '#4a7a0d' : '#aeaeb2',
        opacity: disabled ? 0.45 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {selected && <span style={{ fontSize: '0.6rem', color: '#86BC25' }}>●</span>}
      {children}
    </button>
  )
}

export function FilterPanel({ filters, onChange, disabled }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const toggleList = <T extends string>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter(x => x !== item) : [...list, item]
  const useCustomRange = filters.lookback_days === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Topics */}
      <div>
        <Label>Topic Focus</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {TOPICS.map(t => (
            <Toggle
              key={t.key}
              selected={filters.topics.includes(t.key)}
              onClick={() => set({ topics: toggleList(filters.topics, t.key) })}
              disabled={disabled}
            >
              {t.label}
            </Toggle>
          ))}
        </div>
        {filters.topics.length === 0 && (
          <div style={{ fontSize: '0.72rem', color: '#ff3b30', marginTop: '5px' }}>
            Select at least one topic
          </div>
        )}
      </div>

      {/* Time period */}
      <div>
        <Label>Lookback Period</Label>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {LOOKBACK_OPTIONS.map(opt => (
            <Toggle
              key={opt.value}
              selected={filters.lookback_days === opt.value}
              onClick={() => set({ lookback_days: opt.value, start_date: undefined, end_date: undefined })}
              disabled={disabled}
            >
              {opt.label}
            </Toggle>
          ))}
        </div>
        {useCustomRange && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            {[
              { label: 'From', key: 'start_date' as const },
              { label: 'To', key: 'end_date' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <div style={{ fontSize: '0.68rem', color: '#aeaeb2', marginBottom: '4px' }}>{label}</div>
                <input
                  type="date"
                  disabled={disabled}
                  value={filters[key] || ''}
                  onChange={e => set({ [key]: e.target.value })}
                  style={{
                    border: '1px solid #e8e8ed', borderRadius: '8px',
                    padding: '5px 8px', fontSize: '0.78rem', color: '#1d1d1f',
                    background: disabled ? '#f5f5f7' : 'white', outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agencies */}
      <div>
        <Label>Agencies</Label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {AGENCIES.map(a => (
            <Toggle
              key={a}
              selected={filters.agencies.includes(a)}
              onClick={() => set({ agencies: toggleList(filters.agencies, a) })}
              disabled={disabled}
            >
              {a}
            </Toggle>
          ))}
        </div>
      </div>

      {/* Data sources */}
      <div>
        <Label>Data Sources</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {SOURCES.map(s => (
            <SourceToggle
              key={s.key}
              selected={filters.sources.includes(s.key)}
              onClick={() => set({ sources: toggleList(filters.sources, s.key) })}
              disabled={disabled}
            >
              {s.label}
            </SourceToggle>
          ))}
        </div>
      </div>

      {/* Additional context */}
      <div>
        <Label>Additional Context</Label>
        <textarea
          disabled={disabled}
          value={filters.user_context}
          onChange={e => set({ user_context: e.target.value })}
          placeholder="Paste articles, notes, or focus areas for Claude to consider..."
          rows={3}
          style={{
            width: '100%', border: 'none', borderRadius: '10px',
            padding: '10px 12px', fontSize: '0.8rem', resize: 'vertical',
            outline: 'none', background: '#f5f5f7', color: '#1d1d1f',
            lineHeight: 1.5, opacity: disabled ? 0.45 : 1,
          }}
        />
      </div>
    </div>
  )
}
