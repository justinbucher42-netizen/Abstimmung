import { supabase } from './supabase'
import type {
  CreatePollInput, GlobalStats, Poll, PollData, PollOption, PollSummary, Voter,
} from './types'
import { getAdminToken, getVoterId, randomToken, saveAdminToken } from './storage'

/** Wirft bei Fehlern; PostgREST-Fehler haben ein message-Feld. */
function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export async function createPoll(input: CreatePollInput): Promise<string> {
  const token = randomToken(24)
  const code = check(
    await supabase.rpc('create_poll', {
      p_question: input.question,
      p_description: input.description || null,
      p_options: input.options,
      p_multiple: input.multiple,
      p_anonymous: input.anonymous,
      p_show_results: input.showResults,
      p_is_public: input.isPublic,
      p_expires_at: input.expiresAt,
      p_admin_token: token,
    }),
  ) as string
  saveAdminToken(code, token)
  return code
}

export async function fetchPollData(code: string): Promise<PollData | null> {
  const poll = check(
    await supabase.from('polls').select('*').eq('code', code.toUpperCase()).maybeSingle(),
  ) as Poll | null
  if (!poll) return null

  const [options, results, stats] = await Promise.all([
    supabase.from('poll_options').select('*').eq('poll_id', poll.id).order('position'),
    supabase.from('poll_results').select('option_id, vote_count').eq('poll_id', poll.id),
    supabase.from('poll_stats').select('voter_count').eq('poll_id', poll.id).maybeSingle(),
  ])
  const opts = check(options) as PollOption[]
  const res = check(results) as { option_id: string; vote_count: number }[]
  const st = check(stats) as { voter_count: number } | null

  // Ohne Ergebnis-Rechte liefert RLS keine Zeilen zurück.
  const visible = res.length > 0 || opts.length === 0
  const counts: Record<string, number> | null = visible
    ? Object.fromEntries(opts.map((o) => [o.id, res.find((r) => r.option_id === o.id)?.vote_count ?? 0]))
    : null
  return { poll, options: opts, counts, voters: st ? st.voter_count : null }
}

export async function castVote(code: string, optionIds: string[], name: string): Promise<void> {
  check(
    await supabase.rpc('cast_vote', {
      p_code: code,
      p_option_ids: optionIds,
      p_voter_id: getVoterId(),
      p_voter_name: name || null,
    }),
  )
}

export async function getMyVotes(code: string): Promise<string[]> {
  return (check(await supabase.rpc('get_my_votes', { p_code: code, p_voter_id: getVoterId() })) ?? []) as string[]
}

export async function getVoters(code: string): Promise<Voter[]> {
  return (check(await supabase.rpc('get_voters', { p_code: code })) ?? []) as Voter[]
}

export async function getTimeline(code: string): Promise<string[]> {
  const rows = (check(await supabase.rpc('get_timeline', { p_code: code })) ?? []) as { ts: string }[]
  return rows.map((r) => r.ts)
}

export async function getStats(): Promise<GlobalStats> {
  return check(await supabase.rpc('get_stats')) as GlobalStats
}

/** Öffentliche Abstimmungen + eigene/beigetretene Codes */
export async function listPolls(extraCodes: string[]): Promise<PollSummary[]> {
  const cols = '*, poll_options(count)'
  const pub = supabase.from('polls').select(cols).eq('is_public', true).order('created_at', { ascending: false }).limit(60)
  const mine = extraCodes.length
    ? supabase.from('polls').select(cols).in('code', extraCodes)
    : Promise.resolve({ data: [] as unknown[], error: null })
  const [a, b] = await Promise.all([pub, mine])
  type Row = Poll & { poll_options: { count: number }[] }
  const rows = new Map<string, Row>()
  for (const r of [...(check(a) as Row[]), ...(check(b) as Row[])]) rows.set(r.id, r)
  const polls = [...rows.values()].sort((x, y) => y.created_at.localeCompare(x.created_at))
  if (polls.length === 0) return []

  const stats = check(
    await supabase.from('poll_stats').select('poll_id, voter_count').in('poll_id', polls.map((p) => p.id)),
  ) as { poll_id: string; voter_count: number }[]
  const byPoll = new Map(stats.map((s) => [s.poll_id, s.voter_count]))
  return polls.map(({ poll_options, ...poll }) => ({
    poll: poll as Poll,
    optionCount: poll_options?.[0]?.count ?? 0,
    voters: byPoll.has(poll.id) ? byPoll.get(poll.id)! : null,
  }))
}

// ---------- Admin ----------
function adminArgs(code: string) {
  const token = getAdminToken(code)
  if (!token) throw new Error('FORBIDDEN: Kein Admin-Zugriff auf diesem Gerät.')
  return { p_code: code, p_token: token }
}

export async function verifyAdmin(code: string): Promise<boolean> {
  const token = getAdminToken(code)
  if (!token) return false
  return Boolean(check(await supabase.rpc('verify_admin', { p_code: code, p_token: token })))
}
export async function adminSetStatus(code: string, status: 'open' | 'closed') {
  check(await supabase.rpc('admin_set_status', { ...adminArgs(code), p_status: status }))
}
export async function adminUpdateOptions(code: string, options: string[]) {
  check(await supabase.rpc('admin_update_options', { ...adminArgs(code), p_options: options }))
}
export async function adminReset(code: string) {
  check(await supabase.rpc('admin_reset', adminArgs(code)))
}
export async function adminDelete(code: string) {
  check(await supabase.rpc('admin_delete', adminArgs(code)))
}
