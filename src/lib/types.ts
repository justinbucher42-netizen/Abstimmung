export type PollStatus = 'open' | 'closed'

export interface Poll {
  id: string
  code: string
  question: string
  description: string | null
  multiple_choice: boolean
  anonymous: boolean
  show_results: boolean
  is_public: boolean
  status: PollStatus
  created_at: string
  updated_at: string
  expires_at: string | null
}

export interface PollOption {
  id: string
  poll_id: string
  text: string
  position: number
}

export interface PollData {
  poll: Poll
  options: PollOption[]
  /** null = Ergebnisse (noch) nicht sichtbar */
  counts: Record<string, number> | null
  voters: number | null
}

export interface Voter {
  option_id: string
  voter_name: string | null
  created_at: string
}

export interface GlobalStats {
  total_polls: number
  active_polls: number
  closed_polls: number
  total_votes: number
}

export interface PollSummary {
  poll: Poll
  optionCount: number
  voters: number | null
}

export interface CreatePollInput {
  question: string
  description: string
  options: string[]
  multiple: boolean
  anonymous: boolean
  showResults: boolean
  isPublic: boolean
  expiresAt: string | null
}
