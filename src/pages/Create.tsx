import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, GripVertical, Globe, ListPlus, Loader2, Rocket, Trash2, UserRound, VenetianMask, X } from 'lucide-react'
import { createPoll } from '../lib/api'
import { errorMessage } from '../lib/utils'
import { addJoined } from '../lib/storage'

const DURATIONS = [
  { v: 'none', label: 'Unbegrenzt', min: 0 },
  { v: '5', label: '5 Minuten', min: 5 },
  { v: '15', label: '15 Minuten', min: 15 },
  { v: '60', label: '1 Stunde', min: 60 },
  { v: '1440', label: '24 Stunden', min: 1440 },
  { v: '10080', label: '7 Tage', min: 10080 },
  { v: 'custom', label: 'Eigenes Datum…', min: 0 },
]

function Toggle({ checked, onChange, title, text, icon }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string; icon: React.ReactNode }) {
  return (
    <label className="glass flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 transition hover:border-brand-400/50">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="muted block text-xs">{text}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-slate-400/40'} peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </label>
  )
}

export default function CreatePage() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [duration, setDuration] = useState('none')
  const [customEnd, setCustomEnd] = useState('')
  const [multiple, setMultiple] = useState(false)
  const [anonymous, setAnonymous] = useState(true)
  const [showResults, setShowResults] = useState(true)
  const [isPublic, setIsPublic] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)))
  const filled = options.map((o) => o.trim()).filter(Boolean)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (question.trim().length < 3) return setError('Bitte gib eine Frage ein (mind. 3 Zeichen).')
    if (filled.length < 2) return setError('Mindestens 2 Antwortmöglichkeiten sind nötig.')
    if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) return setError('Antwortmöglichkeiten dürfen nicht doppelt vorkommen.')

    let expiresAt: string | null = null
    if (duration === 'custom') {
      const d = new Date(customEnd)
      if (!customEnd || isNaN(d.getTime()) || d.getTime() <= Date.now()) return setError('Das Enddatum muss in der Zukunft liegen.')
      expiresAt = d.toISOString()
    } else if (duration !== 'none') {
      expiresAt = new Date(Date.now() + Number(duration) * 60_000).toISOString()
    }

    setBusy(true)
    try {
      const code = await createPoll({
        question: question.trim(), description: description.trim(), options: filled,
        multiple, anonymous, showResults, isPublic, expiresAt,
      })
      addJoined(code)
      navigate(`/vote/${code}`, { state: { created: true } })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl animate-fade-up space-y-5" noValidate>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Neue Abstimmung</h1>
        <p className="muted mt-1">Kein Account nötig – in unter einer Minute online.</p>
      </div>

      <div className="card space-y-4">
        <div>
          <label htmlFor="q" className="label">Frage *</label>
          <input id="q" className="input" maxLength={200} placeholder="Welchen Film schauen wir heute?" value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus required />
        </div>
        <div>
          <label htmlFor="d" className="label">Beschreibung <span className="muted font-normal">(optional)</span></label>
          <textarea id="d" className="input min-h-20 resize-y" maxLength={1000} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <fieldset className="card">
        <legend className="sr-only">Antwortmöglichkeiten</legend>
        <h2 className="label !mb-3">Antwortmöglichkeiten * <span className="muted font-normal">(Emojis erlaubt 🍕)</span></h2>
        <ul className="space-y-2">
          {options.map((o, i) => (
            <li key={i} className="flex items-center gap-2">
              <GripVertical size={16} className="muted shrink-0" aria-hidden />
              <input className="input" aria-label={`Option ${i + 1}`} maxLength={120} placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
              <button type="button" className="btn-ghost !px-3" aria-label={`Option ${i + 1} entfernen`} disabled={options.length <= 2} onClick={() => setOptions((x) => x.filter((_, j) => j !== i))}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-ghost mt-3" disabled={options.length >= 30} onClick={() => setOptions((o) => [...o, ''])}>
          <ListPlus size={16} /> Option hinzufügen
        </button>
      </fieldset>

      <div className="card space-y-4">
        <div>
          <label htmlFor="dur" className="label">Abstimmungsdauer</label>
          <select id="dur" className="input" value={duration} onChange={(e) => setDuration(e.target.value)}>
            {DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
          </select>
          {duration === 'custom' && (
            <input type="datetime-local" aria-label="Enddatum" className="input mt-2" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle checked={multiple} onChange={setMultiple} title="Mehrfachauswahl" text="Mehrere Optionen pro Person" icon={<ListPlus size={18} />} />
          <Toggle checked={anonymous} onChange={setAnonymous} title={anonymous ? 'Anonym' : 'Namen anzeigen'} text={anonymous ? 'Niemand sieht, wer wie stimmt' : 'Teilnehmer geben einen Namen an'} icon={anonymous ? <VenetianMask size={18} /> : <UserRound size={18} />} />
          <Toggle checked={showResults} onChange={setShowResults} title="Live-Ergebnisse" text={showResults ? 'Ergebnisse schon während der Abstimmung' : 'Erst nach Ende sichtbar'} icon={showResults ? <Eye size={18} /> : <EyeOff size={18} />} />
          <Toggle checked={isPublic} onChange={setIsPublic} title="In Übersicht listen" text={isPublic ? 'Auf der Startseite sichtbar' : 'Nur über Link/Code auffindbar'} icon={<Globe size={18} />} />
        </div>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn-primary !min-h-13 flex-1 !text-base">
          {busy ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />} Abstimmung starten
        </button>
        <button type="button" className="btn-ghost !min-h-13" onClick={() => { setQuestion(''); setDescription(''); setOptions(['', '']) }} aria-label="Formular leeren">
          <Trash2 size={18} />
        </button>
      </div>
    </form>
  )
}
