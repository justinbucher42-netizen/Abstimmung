import { useMemo } from 'react'
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Check, Clock, Crown, EyeOff, Users } from 'lucide-react'
import type { PollData, Voter } from '../lib/types'
import StatTile from './StatTile'
import { formatDateTime, formatTime, pct } from '../lib/utils'

import { COLORS } from '../lib/colors'
const color = (i: number) => COLORS[i % COLORS.length]

interface Props {
  data: PollData
  mine: string[]
  voters: Voter[]
  timeline: string[]
}

export default function Results({ data, mine, voters, timeline }: Props) {
  const { poll, options, counts, voters: total } = data

  const rows = useMemo(() => {
    const c = counts ?? {}
    return options.map((o, i) => ({ ...o, count: c[o.id] ?? 0, color: color(i) }))
  }, [options, counts])

  if (!counts) {
    return (
      <section className="card flex flex-col items-center gap-2 py-10 text-center" aria-live="polite">
        <div className="grid size-12 place-items-center rounded-2xl bg-slate-500/10 text-slate-500"><EyeOff /></div>
        <h2 className="text-lg font-extrabold">Ergebnisse sind verborgen</h2>
        <p className="muted max-w-sm text-sm">Die Ergebnisse werden sichtbar, sobald die Abstimmung beendet ist.</p>
      </section>
    )
  }

  const participants = total ?? 0
  const max = Math.max(0, ...rows.map((r) => r.count))
  const leaders = max > 0 ? rows.filter((r) => r.count === max) : []
  const pieData = rows.filter((r) => r.count > 0)

  return (
    <section aria-labelledby="results-title" className="space-y-4">
      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="results-title" className="text-lg font-extrabold tracking-tight">LIVE-ERGEBNISSE</h2>
          <span className="muted text-sm font-medium tabular-nums" aria-live="polite">
            {participants} {participants === 1 ? 'Stimme' : 'Stimmen'}
          </span>
        </div>

        {participants === 0 && <p className="muted mb-4 text-sm">Noch keine Stimmen – sei der Erste!</p>}

        <ul className="space-y-4">
          {rows.map((r) => {
            const p = pct(r.count, participants)
            const names = voters.filter((v) => v.option_id === r.id && v.voter_name)
            return (
              <li key={r.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm sm:text-base">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <span className="break-words">{r.text}</span>
                    {mine.includes(r.id) && (
                      <span title="Deine Stimme" className="badge shrink-0 bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <Check size={12} aria-hidden /> Du
                      </span>
                    )}
                    {leaders.some((l) => l.id === r.id) && <Crown size={15} className="shrink-0 text-amber-500" aria-label="Führend" />}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <b>{p}%</b> <span className="muted text-xs">({r.count})</span>
                  </span>
                </div>
                <div
                  className="track h-3.5 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-valuenow={p}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${r.text}: ${p} Prozent`}
                >
                  <div className="bar-fill h-full rounded-full" style={{ width: `${p}%`, background: `linear-gradient(90deg, ${r.color}, ${r.color}cc)` }} />
                </div>
                {!poll.anonymous && names.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {names.map((v, i) => (
                      <span key={i} className="badge track">{v.voter_name}</span>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={<Users size={20} />} label="Teilnehmer" value={participants} />
        <StatTile
          icon={<Crown size={20} />}
          label="Meistgewählt"
          value={leaders.length ? leaders.map((l) => l.text).join(', ') : '–'}
        />
        <StatTile icon={<Clock size={20} />} label="Erstellt" value={<span className="text-sm">{formatDateTime(poll.created_at)}</span>} />
      </div>

      {pieData.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-2 font-bold">Verteilung</h3>
            <div className="h-56" role="img" aria-label="Kreisdiagramm der Stimmenverteilung">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="count" nameKey="text" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none" isAnimationActive>
                    {pieData.map((r) => <Cell key={r.id} fill={r.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <Timeline timeline={timeline} createdAt={poll.created_at} />
        </div>
      )}
    </section>
  )
}

function Timeline({ timeline, createdAt }: { timeline: string[]; createdAt: string }) {
  const points = useMemo(() => {
    const uniq = [...new Set(timeline)].sort()
    const pts = [{ t: new Date(createdAt).getTime(), n: 0 }]
    uniq.forEach((ts, i) => pts.push({ t: new Date(ts).getTime(), n: i + 1 }))
    if (uniq.length) pts.push({ t: Math.max(Date.now(), pts[pts.length - 1].t), n: uniq.length })
    return pts
  }, [timeline, createdAt])

  return (
    <div className="card">
      <h3 className="mb-2 font-bold">Abstimmungsverlauf</h3>
      <div className="h-56" role="img" aria-label="Verlauf der abgegebenen Stimmen über die Zeit">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="tl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(v) => new Date(v).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} tick={{ fontSize: 11, fill: 'var(--muted)' }} stroke="var(--border)" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} stroke="var(--border)" />
            <Tooltip
              labelFormatter={(v) => formatTime(new Date(Number(v)).toISOString())}
              formatter={(v) => [String(v), 'Stimmen']}
              contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-solid)', color: 'var(--text)' }}
            />
            <Area type="stepAfter" dataKey="n" stroke="#6366f1" strokeWidth={2.5} fill="url(#tl)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
