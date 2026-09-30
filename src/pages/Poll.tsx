import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, Lock, PartyPopper, Radio, WifiOff } from 'lucide-react'
import { usePoll } from '../hooks/usePoll'
import { castVote, getMyVotes, getTimeline, getVoters, verifyAdmin } from '../lib/api'
import { addJoined, getAdminToken, hasVotedLocally, markVotedLocally, saveAdminToken } from '../lib/storage'
import { CODE_RE, errorCode, errorMessage, isOpen } from '../lib/utils'
import type { Voter } from '../lib/types'
import { useNow } from '../hooks/useNow'
import { ErrorBox, Spinner } from '../components/Feedback'
import StatusBadge from '../components/StatusBadge'
import Countdown from '../components/Countdown'
import VoteForm from '../components/VoteForm'
import SharePanel from '../components/SharePanel'
import AdminPanel from '../components/AdminPanel'
import { useToast } from '../components/Toast'
import NotFound from './NotFound'

const Results = lazy(() => import('../components/Results'))

export default function PollPage() {
  const params = useParams()
  const code = (params.code ?? '').toUpperCase()
  if (!CODE_RE.test(code) && !/^[A-Z0-9]{6}$/.test(code)) return <NotFound what="Abstimmung" />
  return <PollView key={code} code={code} />
}

function PollView({ code }: { code: string }) {
  const { data, loading, error, notFound, live, reload } = usePoll(code)
  const location = useLocation()
  const toast = useToast()
  useNow(1000) // Status wechselt automatisch, wenn die Zeit abläuft

  const [mine, setMine] = useState<string[]>([])
  const [voted, setVoted] = useState(() => hasVotedLocally(code))
  const [justVoted, setJustVoted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [voters, setVoters] = useState<Voter[]>([])
  const [timeline, setTimeline] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const created = Boolean((location.state as { created?: boolean } | null)?.created)

  // Admin-Link (#admin=TOKEN) übernehmen -> ermöglicht Verwaltung von einem anderen Gerät
  useEffect(() => {
    const m = window.location.hash.match(/admin=([a-f0-9]{16,128})/)
    if (m) {
      saveAdminToken(code, m[1])
      history.replaceState(history.state, '', window.location.pathname)
    }
    if (getAdminToken(code)) verifyAdmin(code).then(setIsAdmin).catch(() => setIsAdmin(false))
  }, [code])

  useEffect(() => { addJoined(code) }, [code])

  const loadMine = useCallback(async () => {
    try {
      const ids = await getMyVotes(code)
      setMine(ids)
      if (ids.length) { setVoted(true); markVotedLocally(code) }
      else if (hasVotedLocally(code)) setVoted(false) // z. B. nach Zurücksetzen durch den Creator
    } catch { /* nicht kritisch */ }
  }, [code])
  useEffect(() => { void loadMine() }, [loadMine, data?.voters])

  // Namen + Verlauf nachladen, sobald sich die Stimmenzahl ändert
  const voterCount = data?.voters ?? null
  const resultsVisible = data?.counts != null
  const anonymous = data?.poll.anonymous ?? true
  useEffect(() => {
    if (!resultsVisible) { setVoters([]); setTimeline([]); return }
    let cancelled = false
    ;(async () => {
      try {
        const [t, v] = await Promise.all([getTimeline(code), anonymous ? Promise.resolve([]) : getVoters(code)])
        if (!cancelled) { setTimeline(t); setVoters(v) }
      } catch { /* nicht kritisch */ }
    })()
    return () => { cancelled = true }
  }, [code, voterCount, resultsVisible, anonymous])

  const submit = async (ids: string[], name: string) => {
    setSubmitting(true)
    setVoteError(null)
    try {
      await castVote(code, ids, name)
      markVotedLocally(code)
      setVoted(true)
      setJustVoted(true)
      setMine(ids)
      toast('Stimme erfolgreich abgegeben')
      void reload()
    } catch (e) {
      if (errorCode(e) === 'ALREADY_VOTED') { markVotedLocally(code); setVoted(true); void loadMine() }
      setVoteError(errorMessage(e))
      void reload()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner label="Abstimmung wird geladen…" />
  if (notFound) return <NotFound what="Abstimmung" />
  if (error || !data) return <ErrorBox message={error ?? 'Fehler beim Laden'} onRetry={reload} />

  const { poll, options } = data
  const open = isOpen(poll)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {created && (
        <div className="card animate-pop flex items-center gap-3 border-emerald-500/40 !p-4 text-sm font-semibold">
          <PartyPopper className="shrink-0 text-emerald-500" /> Abstimmung erstellt! Teile den Link oder QR-Code unten – neue Stimmen erscheinen hier automatisch.
        </div>
      )}

      <header className="card animate-fade-up">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge poll={poll} />
          {open && poll.expires_at && <Countdown expiresAt={poll.expires_at} />}
          <span className="badge track font-mono tracking-widest">{poll.code}</span>
          <span
            className={`badge ml-auto ${live ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
            title={live ? 'Echtzeit-Verbindung aktiv' : 'Verbindung wird hergestellt – Daten werden regelmässig aktualisiert'}
          >
            {live ? <Radio size={13} /> : <WifiOff size={13} />} {live ? 'Live verbunden' : 'Verbinde…'}
          </span>
        </div>
        <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{poll.question}</h1>
        {poll.description && <p className="muted mt-2 whitespace-pre-line break-words">{poll.description}</p>}
        <div className="muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
          <span>{poll.multiple_choice ? 'Mehrfachauswahl' : 'Eine Stimme'}</span>
          <span>{poll.anonymous ? 'Anonym' : 'Namen sichtbar'}</span>
          <span>{poll.show_results ? 'Live-Ergebnisse' : 'Ergebnisse nach Ende'}</span>
        </div>
      </header>

      {open && !voted && (
        <VoteForm poll={poll} options={options} submitting={submitting} error={voteError} onSubmit={submit} />
      )}

      {voted && (
        <div role="status" className={`card flex items-center gap-3 border-emerald-500/40 !p-4 ${justVoted ? 'animate-pop' : ''}`}>
          <CheckCircle2 className="shrink-0 text-emerald-500" size={26} />
          <div>
            <p className="font-extrabold">{justVoted ? '✅ Stimme erfolgreich abgegeben' : 'Du hast bereits abgestimmt'}</p>
            <p className="muted text-sm">
              {poll.show_results || !open ? 'Die Ergebnisse aktualisieren sich automatisch.' : 'Die Ergebnisse werden nach Ende der Abstimmung sichtbar.'}
            </p>
          </div>
        </div>
      )}

      {!open && (
        <div role="status" className="card flex items-center gap-3 !p-4">
          <Lock className="muted shrink-0" size={22} />
          <p className="font-semibold">Diese Abstimmung ist beendet. Es können keine Stimmen mehr abgegeben werden.</p>
        </div>
      )}

      <Suspense fallback={<Spinner label="Ergebnisse werden geladen…" />}>
        <Results data={data} mine={mine} voters={voters} timeline={timeline} />
      </Suspense>

      <SharePanel code={poll.code} question={poll.question} />

      {isAdmin && <AdminPanel data={data} onChanged={reload} />}
    </div>
  )
}
