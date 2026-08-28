import { Filters } from '../types'

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  disabled?: boolean
}

const TOPICS = [
  { key: 'human_plus', label: 'Human+ (AI Workforce)' },
  { key: 'clinical_trials_ai', label: 'AI Clinical Trials' },
]

const LOOKBACK_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 0, label: 'Custom range' },
]

const AGENCIES = ['HHS', 'VA', 'DoD']

const SOURCES = [
  { key: 'usa_spending', label: 'USASpending' },
  { key: 'fed_register', label: 'Federal Register' },
  { key: 'nih', label: 'NIH Reporter' },
  { key: 'news', label: 'Google News' },
  { key: 'clinical_trials', label: 'ClinicalTrials.gov' },
]

export function FilterPanel({ filters, onChange, disabled }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  const toggleList = <T extends string>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter(x => x !== item) : [...list, item]

  const useCustomRange = filters.lookback_days === 0

  return (
    <div className="space-y-5">
      {/* Topics */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Topic Focus
        </label>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map(t => (
            <button
              key={t.key}
              disabled={disabled}
              onClick={() => set({ topics: toggleList(filters.topics, t.key) })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.topics.includes(t.key)
                  ? 'bg-[#86BC25] text-white border-[#86BC25]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#86BC25]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time period */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Time Period
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {LOOKBACK_OPTIONS.map(opt => (
            <button
              key={opt.value}
              disabled={disabled}
              onClick={() => set({ lookback_days: opt.value, start_date: undefined, end_date: undefined })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filters.lookback_days === opt.value
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {useCustomRange && (
          <div className="flex gap-2 mt-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start</label>
              <input
                type="date"
                disabled={disabled}
                value={filters.start_date || ''}
                onChange={e => set({ start_date: e.target.value })}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End</label>
              <input
                type="date"
                disabled={disabled}
                value={filters.end_date || ''}
                onChange={e => set({ end_date: e.target.value })}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Agencies */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Agencies
        </label>
        <div className="flex gap-2">
          {AGENCIES.map(a => (
            <button
              key={a}
              disabled={disabled}
              onClick={() => set({ agencies: toggleList(filters.agencies, a) })}
              className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                filters.agencies.includes(a)
                  ? 'bg-[#00A3AD] text-white border-[#00A3AD]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#00A3AD]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Data sources */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Data Sources
        </label>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map(s => (
            <button
              key={s.key}
              disabled={disabled}
              onClick={() => set({ sources: toggleList(filters.sources, s.key) })}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                filters.sources.includes(s.key)
                  ? 'bg-gray-700 text-white border-gray-700'
                  : 'bg-white text-gray-500 border-gray-300 hover:border-gray-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Additional context */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Additional Context <span className="font-normal normal-case">(optional)</span>
        </label>
        <textarea
          disabled={disabled}
          value={filters.user_context}
          onChange={e => set({ user_context: e.target.value })}
          placeholder="Paste in articles, client notes, focus areas, or specific angles for Claude to consider..."
          rows={3}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-y focus:outline-none focus:border-[#86BC25] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  )
}
