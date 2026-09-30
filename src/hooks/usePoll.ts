import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPollData } from '../lib/api'
import { errorMessage } from '../lib/utils'
import type { PollData } from '../lib/types'

interface State {
  data: PollData | null
  loading: boolean
  error: string | null
  notFound: boolean
  live: boolean
}

/**
 * Lädt eine Abstimmung und hält sie per Supabase Realtime live aktuell.
 * Zusätzlich gibt es einen Polling-Fallback, falls der WebSocket ausfällt.
 */
export function usePoll(code: string) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null, notFound: false, live: false })
  const pollId = state.data?.poll.id
  const reloadTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const liveRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const data = await fetchPollData(code)
      setState((s) => ({ ...s, data, loading: false, error: null, notFound: data === null }))
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: s.data ? null : errorMessage(e) }))
    }
  }, [code])

  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(load, 250)
  }, [load])

  // Initial laden
  useEffect(() => {
    setState({ data: null, loading: true, error: null, notFound: false, live: false })
    void load()
    return () => clearTimeout(reloadTimer.current)
  }, [load])

  // Realtime
  useEffect(() => {
    if (!pollId) return
    const channel = supabase
      .channel(`poll-${pollId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_results', filter: `poll_id=eq.${pollId}` },
        (payload) => {
          const row = payload.new as { option_id?: string; vote_count?: number }
          if (payload.eventType !== 'DELETE' && row.option_id != null && row.vote_count != null) {
            // Sofort-Update ohne Roundtrip
            setState((s) =>
              s.data
                ? { ...s, data: { ...s.data, counts: { ...(s.data.counts ?? {}), [row.option_id!]: row.vote_count! } } }
                : s,
            )
          } else scheduleReload()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_stats', filter: `poll_id=eq.${pollId}` },
        (payload) => {
          const row = payload.new as { voter_count?: number }
          if (payload.eventType !== 'DELETE' && row.voter_count != null) {
            setState((s) => (s.data ? { ...s, data: { ...s.data, voters: row.voter_count! } } : s))
          } else scheduleReload()
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `id=eq.${pollId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options', filter: `poll_id=eq.${pollId}` }, scheduleReload)
      .subscribe((status) => {
        const live = status === 'SUBSCRIBED'
        liveRef.current = live
        setState((s) => (s.live === live ? s : { ...s, live }))
        // Nach (Wieder-)Verbindung sicherheitshalber neu laden, um verpasste Events nachzuholen
        if (live) scheduleReload()
      })
    return () => {
      liveRef.current = false
      void supabase.removeChannel(channel)
    }
  }, [pollId, scheduleReload])

  // Polling-Fallback + Aktualisierung beim Zurückkehren in den Tab
  useEffect(() => {
    const id = setInterval(() => void load(), 8000)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return { ...state, reload: load }
}
