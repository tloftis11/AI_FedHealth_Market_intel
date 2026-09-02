import { useState } from 'react'
import { Filters } from '../types'
import { CloseIcon } from './Icons'

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
      {selected && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#86BC25', display: 'inline-block', flexShrink: 0 }} />}
      {children}
    </button>
  )
}

export function FilterPanel({ filters, onChange, disabled }: Props) {
  const [draftTopic, setDraftTopic] = useState('')
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const toggleList = <T extends string>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter(x => x !== item) : [...list, item]
  const useCustomRange = filters.lookback_days === 0

  const hasNoTopics = filters.topics.length === 0 && filters.custom_topics.length === 0

  function addCustomTopic() {
    const trimmed = draftTopic.trim()
    if (!trimmed) return
    set({ custom_topics: [...filters.custom_topics, { description: trimmed }] })
    setDraftTopic('')
  }

  function removeCustomTopic(index: number) {
    set({ custom_topics: filters.custom_topics.filter((_, i) => i !== index) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Preset Topics */}
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
        {hasNoTopics && (
          <div style={{ fontSize: '0.72rem', color: '#ff3b30', marginTop: '5px' }}>
            Select a topic or add a custom one below
          </div>
        )}
      </div>

      {/* Custom Topics */}
      <div>
        <Label>Custom Topics</Label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            disabled={disabled}
            value={draftTopic}
            onChange={e => setDraftTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomTopic()}
            placeholder="e.g. AI-assisted radiology in VA"
            style={{
              flex: 1,
              border: '1px solid #e8e8ed',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '0.78rem',
              color: '#1d1d1f',
              background: disabled ? '#f5f5f7' : 'white',
              outline: 'none',
              opacity: disabled ? 0.45 : 1,
            }}
          />
          <button
            disabled={disabled || !draftTopic.trim()}
            onClick={addCustomTopic}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 500,
              border: 'none',
              cursor: disabled || !draftTopic.trim() ? 'not-allowed' : 'pointer',
              background: disabled || !draftTopic.trim() ? '#f0f0f2' : '#1d1d1f',
              color: disabled || !draftTopic.trim() ? '#aeaeb2' : 'white',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
        {filters.custom_topics.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
            {filters.custom_topics.map((ct, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 6px 4px 10px',
                borderRadius: 999,
                background: '#e8f5d0',
                border: '1px solid #c5e09a',
                fontSize: '0.72rem',
                color: '#4a7a0d',
                maxWidth: '230px',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ct.description.length > 32 ? ct.description.slice(0, 32) + '…' : ct.description}
                </span>
                <button
                  disabled={disabled}
                  onClick={() => removeCustomTopic(i)}
                  style={{ background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', padding: '1px', display: 'flex', flexShrink: 0, opacity: disabled ? 0.45 : 1 }}
                >
                  <CloseIcon color="#4a7a0d" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: '0.68rem', color: '#aeaeb2', marginTop: '6px', lineHeight: 1.4 }}>
          Claude generates search terms from your description
        </div>
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
