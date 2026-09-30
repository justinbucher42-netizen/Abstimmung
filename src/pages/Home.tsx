import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, BarChart3, CheckCircle2, Inbox, KeyRound, LogIn, Plus, Vote } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { getAdminToken } from '../lib/storage'
import { isOpen, parseCode } from '../lib/utils'
import PollCard from '../components/PollCard'
import { EmptyState, ErrorBox, Spinner } from '../components/Feedback'
import StatTile from '../components/StatTile'

export default function Home() {
  const { stats, polls, error, reload } = useDashboard()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')

  const join = (e: FormEvent) => {
    e.preventDefault()
    const c = parseCode(code)
    if (!c) return setCodeError('Bitte einen 6-stelligen Code oder Link eingeben, z. B. ABCD12.')
    navigate(`/vote/${c}`)
  }

  const mine = polls?.filter((p) => getAdminToken(p.poll.code)) ?? []
  const rest = polls?.filter((p) => !getAdminToken(p.poll.code)) ?? []
  const active = rest.filter((p) => isOpen(p.poll))
  const past = rest.filter((p) => !isOpen(p.poll))

  return (
    <div className="space-y-10">
      <section className="grid items-stretch gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card animate-fade-up !p-6 sm:!p-9">
          <span className="badge bg-brand-500/10 text-brand-600 dark:text-brand-400"><span className="pulse-dot size-2 rounded-full bg-emerald-500" /> Echtzeit-Abstimmungen</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Fragen stellen.<br />
            <span className="bg-gradient-to-r from-brand-500 to-accent bg-clip-text text-transparent">Live abstimmen.</span>
          </h1>
          <p className="muted mt-3 max-w-lg text-base sm:text-lg">
            Erstelle in Sekunden eine Abstimmung, teile sie per Link oder QR-Code und sieh Ergebnisse in Echtzeit – ganz ohne Account.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/create" className="btn-primary !min-h-12 !px-6 !text-base"><Plus size={20} /> Abstimmung erstellen</Link>
          </div>
        </div>

        <form onSubmit={join} className="card animate-fade-up flex flex-col justify-center" style={{ animationDelay: '80ms' }}>
          <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-accent/10 text-accent"><LogIn /></div>
          <h2 className="text-xl font-extrabold">Abstimmung beitreten</h2>
          <p className="muted mb-4 text-sm">Code oder Link einfügen</p>
          <label htmlFor="join-code" className="sr-only">Abstimmungs-Code</label>
          <input
            id="join-code"
            className="input text-center font-mono text-xl font-bold uppercase tracking-[0.25em]"
            placeholder="ABCD12"
            value={code}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => { setCode(e.target.value); setCodeError('') }}
            aria-invalid={Boolean(codeError)}
            aria-describedby={codeError ? 'join-err' : undefined}
          />
          {codeError && <p id="join-err" role="alert" className="mt-2 text-sm text-red-500">{codeError}</p>}
          <button className="btn-ghost mt-3 w-full" type="submit">Beitreten <ArrowRight size={16} /></button>
        </form>
      </section>

      <section aria-label="Statistiken">
        <div className="mb-3 flex items-center gap-2 text-sm font-extrabold tracking-widest">
          <span className="pulse-dot size-2.5 rounded-full bg-emerald-500" aria-hidden /> LIVE VOTE
          <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Activity size={20} />} label="Aktive Abstimmungen" value={stats?.active_polls ?? '–'} />
          <StatTile icon={<Vote size={20} />} label="Abgegebene Stimmen" value={stats?.total_votes ?? '–'} />
          <StatTile icon={<CheckCircle2 size={20} />} label="Abgeschlossen" value={stats?.closed_polls ?? '–'} />
          <StatTile icon={<BarChart3 size={20} />} label="Abstimmungen gesamt" value={stats?.total_polls ?? '–'} />
        </div>
      </section>

      {error && !polls && <ErrorBox message={error} onRetry={reload} />}
      {!polls && !error && <Spinner label="Abstimmungen werden geladen…" />}

      {polls && (
        <>
          {mine.length > 0 && <Grid title="Meine Abstimmungen" icon={<KeyRound size={18} />} items={mine} />}
          <Grid
            title="Aktive Abstimmungen"
            items={active}
            empty={
              <EmptyState
                icon={<Inbox />}
                title="Gerade läuft keine öffentliche Abstimmung"
                text="Starte die erste – sie erscheint sofort für alle."
                action={<Link to="/create" className="btn-primary"><Plus size={18} /> Abstimmung erstellen</Link>}
              />
            }
          />
          {past.length > 0 && <Grid title="Vergangene Abstimmungen" items={past} />}
        </>
      )}
    </div>
  )
}

function Grid({ title, items, icon, empty }: { title: string; items: Parameters<typeof PollCard>[0]['item'][]; icon?: React.ReactNode; empty?: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold tracking-tight">{icon}{title} <span className="muted text-sm font-semibold">({items.length})</span></h2>
      {items.length === 0 ? empty : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => <PollCard key={it.poll.id} item={it} index={i} />)}
        </div>
      )}
    </section>
  )
}
