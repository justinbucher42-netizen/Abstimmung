import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getStats, listPolls } from '../lib/api'
import { getAdminTokens, getJoined } from '../lib/storage'
import { errorMessage } from '../lib/utils'
import type { GlobalStats, PollSummary } from '../lib/types'

export function useDashboard() {
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [polls, setPolls] = useState<PollSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const load = useCallback(async () => {
    try {
      const codes = [...new Set([...Object.keys(getAdminTokens()), ...getJoined()])]
      const [s, p] = await Promise.all([getStats(), listPolls(codes)])
      setStats(s)
      setPolls(p)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  const schedule = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void load(), 400)
  }, [load])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel(`dashboard-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_stats' }, schedule)
      .subscribe()
    const id = setInterval(() => void load(), 15000)
    return () => {
      clearTimeout(timer.current)
      clearInterval(id)
      void supabase.removeChannel(channel)
    }
  }, [load, schedule])

  return { stats, polls, error, reload: load }
}
