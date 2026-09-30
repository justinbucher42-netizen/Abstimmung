import { useState } from 'react'
import { Check, Loader2, ShieldAlert } from 'lucide-react'
import type { Poll, PollOption } from '../lib/types'
import { getVoterName, setVoterName } from '../lib/storage'
import { COLORS } from '../lib/colors'

interface Props {
  poll: Poll
  options: PollOption[]
  submitting: boolean
  error: string | null
  onSubmit: (optionIds: string[], name: string) => void
}

export default function VoteForm({ poll, options, submitting, error, onSubmit }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState(getVoterName)
  const multi = poll.multiple_choice

  const toggle = (id: string) =>
    setSelected((s) => (multi ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]))

  const needName = !poll.anonymous
  const canSubmit = selected.length > 0 && (!needName || name.trim().length > 0) && !submitting

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSubmit) return
        if (needName) setVoterName(name.trim())
        onSubmit(selected, name.trim())
      }}
    >
      <fieldset>
        <legend className="mb-3 text-base font-extrabold">
          {multi ? 'Wähle eine oder mehrere Optionen' : 'Wähle eine Option'}
        </legend>
        <div className="grid gap-3">
          {options.map((o, i) => {
            const on = selected.includes(o.id)
            return (
              <label
                key={o.id}
                className={`group relative flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 text-base font-semibold transition duration-150 active:scale-[0.99] ${
                  on ? 'border-brand-500 bg-brand-500/10 shadow-md shadow-brand-500/10' : 'hover:border-brand-400/60'
                }`}
                style={on ? undefined : { borderColor: 'var(--border)', background: 'var(--card-solid)' }}
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name="option"
                  className="peer sr-only"
                  checked={on}
                  onChange={() => toggle(o.id)}
                />
                <span
                  className={`grid size-7 shrink-0 place-items-center border-2 text-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 ${multi ? 'rounded-lg' : 'rounded-full'}`}
                  style={{ borderColor: on ? COLORS[i % COLORS.length] : 'var(--muted)', background: on ? COLORS[i % COLORS.length] : 'transparent' }}
                  aria-hidden
                >
                  {on && <Check size={16} strokeWidth={3} />}
                </span>
                <span className="break-words">{o.text}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {needName && (
        <div>
          <label htmlFor="voter-name" className="label">Dein Name (wird bei den Ergebnissen angezeigt)</label>
          <input id="voter-name" className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Anna" autoComplete="given-name" />
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

      <button type="submit" disabled={!canSubmit} className="btn-primary w-full !min-h-14 !text-base">
        {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />} Abstimmen
      </button>
      <p className="muted flex items-start gap-2 text-xs">
        <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
        Keine Hochsicherheits-Wahl: Mehrfachabstimmung wird nur pro Gerät/Browser erschwert.
      </p>
    </form>
  )
}
