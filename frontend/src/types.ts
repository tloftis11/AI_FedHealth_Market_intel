export interface CustomTopic {
  description: string
}

export interface Filters {
  topics: string[]
  custom_topics: CustomTopic[]
  lookback_days: number
  start_date?: string
  end_date?: string
  sources: string[]
  user_context: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SessionInfo {
  session_id: string
  summary: string
  counts: Record<string, number>
  start_date: string
  end_date: string
}

export const DEFAULT_FILTERS: Filters = {
  topics: ['human_plus'],
  custom_topics: [],
  lookback_days: 90,
  sources: ['usa_spending', 'sam_gov', 'fed_register', 'nih', 'news', 'clinical_trials'],
  user_context: '',
}
