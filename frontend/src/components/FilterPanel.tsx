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
  { key: 'news', label: 'Google News' },
  { key: 'clinical_trials', label: 'ClinicalTrials' },
]

function Chip({
  selected, onClick, disabled, children, color = 'green',
}: {
  selected: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  color?: 'green' | 'teal' | 'gray'
}) {
  const colors = {
    green: selected
      ? 'bg-[#86BC25] text-white border-[#86BC25] shadow-sm ring-2 ring-[#86BC25]/30'
      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600',
    teal: selected
      ? 'bg-[#00A3AD] text-white border-[#00A3AD] shadow-sm ring-2 ring-[#00A3AD]/30'
      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600',
    gray: selected
      ? 'bg-gray-700 text-white border-gray-700 shadow-sm ring-2 ring-gray-400/30'
      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600',
  }
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${colors[color]} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {selected && <span className="text-xs leading-none">✓</span>}
      {children}
    </button>
  )
}

function SquareChip({
  selected, onClick, disabled, children, color = 'gray',
}: {
  selected: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  color?: 'green' | 'teal' | 'gray'
}) {
  const colors = {
    green: selected
      ? 'bg-[#86BC25] text-white border-[#86BC25]'
      : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-400',
    teal: selected
      ? 'bg-[#00A3AD] text-white border-[#00A3AD]'
      : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-400',
    gray: selected
      ? 'bg-gray-700 text-white border-gray-700'
      : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:border-gray-400',
  }
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium border transition-all flex items-center gap-1 ${colors[color]} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <span className={`w-3 h-3 rounded-sm border flex items-center justify-center text-[9px] shrink-0 ${
        selected ? 'bg-white/30 border-white/50' : 'border-gray-300'
      }`}>
        {selected && '✓'}
      </span>
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
    <div className="space-y-5">
      {/* Topics */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Topic Focus
        </label>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map(t => (
            <Chip
              key={t.key}
              selected={filters.topics.includes(t.key)}
              onClick={() => set({ topics: toggleList(filters.topics, t.key) })}
              disabled={disabled}
              color="green"
            >
              {t.label}
            </Chip>
          ))}
        </div>
        {filters.topics.length === 0 && (
          <p className="text-xs text-red-400 mt-1">Select at least one topic</p>
        )}
      </div>

      {/* Time period */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Time Period
        </label>
        <div className="flex flex-wrap gap-1.5">
          {LOOKBACK_OPTIONS.map(opt => (
            <button
              key={opt.value}
              disabled={disabled}
              onClick={() => set({ lookback_days: opt.value, start_date: undefined, end_date: undefined })}
              className={`px-3 py-1.5 rounded text-sm font-medium border transition-all ${
                filters.lookback_days === opt.value
                  ? 'bg-gray-800 text-white border-gray-800 shadow-sm ring-2 ring-gray-400/30'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-700'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {useCustomRange && (
          <div className="flex gap-3 mt-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start date</label>
              <input
                type="date"
                disabled={disabled}
                value={filters.start_date || ''}
                onChange={e => set({ start_date: e.target.value })}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End date</label>
              <input
                type="date"
                disabled={disabled}
                value={filters.end_date || ''}
                onChange={e => set({ end_date: e.target.value })}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-gray-500"
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
            <Chip
              key={a}
              selected={filters.agencies.includes(a)}
              onClick={() => set({ agencies: toggleList(filters.agencies, a) })}
              disabled={disabled}
              color="teal"
            >
              {a}
            </Chip>
          ))}
        </div>
      </div>

      {/* Data sources */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Data Sources
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SOURCES.map(s => (
            <SquareChip
              key={s.key}
              selected={filters.sources.includes(s.key)}
              onClick={() => set({ sources: toggleList(filters.sources, s.key) })}
              disabled={disabled}
              color="gray"
            >
              {s.label}
            </SquareChip>
          ))}
        </div>
      </div>

      {/* Additional context */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
          Additional Context
        </label>
        <p className="text-xs text-gray-400 mb-1.5">Paste in articles, client notes, or focus areas</p>
        <textarea
          disabled={disabled}
          value={filters.user_context}
          onChange={e => set({ user_context: e.target.value })}
          placeholder="Optional — Claude will incorporate this into the analysis..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed bg-gray-50 placeholder:text-gray-300"
        />
      </div>
    </div>
  )
}
