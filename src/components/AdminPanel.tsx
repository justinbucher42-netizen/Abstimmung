import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Lock, Pencil, Plus, RotateCcw, Trash2, Unlock, X } from 'lucide-react'
import type { PollData } from '../lib/types'
import { adminDelete, adminReset, adminSetStatus, adminUpdateOptions } from '../lib/api'
import { getAdminToken, removeAdminToken, clearVotedLocally } from '../lib/storage'
import { errorMessage, isOpen } from '../lib/utils'
import { copyText } from './SharePanel'
import { useToast } from './Toast'

export default function AdminPanel({ data, onChanged }: { data: PollData; onChanged: () => void }) {
  const { poll, options } = data
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const open = isOpen(poll)

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast(ok)
      onChanged()
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = () => { setDraft(options.map((o) => o.text)); setEditing(true) }
  const saveEdit = async () => {
    const clean = draft.map((d) => d.trim()).filter(Boolean)
    if (clean.length < 2) return toast('Mindestens 2 Optionen nötig', 'error')
    await run(async () => { await adminUpdateOptions(poll.code, clean); setEditing(false) }, 'Optionen gespeichert')
  }

  const adminLink = () => {
    const token = getAdminToken(poll.code)
    return token ? `${window.location.origin}/vote/${poll.code}#admin=${token}` : ''
  }

  return (
    <section className="card border-brand-400/30" aria-labelledby="admin-title">
      <h2 id="admin-title" className="mb-1 flex items-center gap-2 text-lg font-extrabold">
        <KeyRound size={18} className="text-brand-500" /> Verwaltung
      </h2>
      <p className="muted mb-4 text-sm">Nur du siehst diese Optionen (Admin-Schlüssel ist auf diesem Gerät gespeichert).</p>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {open ? (
          <button className="btn-ghost" disabled={busy} onClick={() => run(() => adminSetStatus(poll.code, 'closed'), 'Abstimmung geschlossen')}>
            <Lock size={16} /> Schliessen
          </button>
        ) : (
          <button className="btn-ghost" disabled={busy} onClick={() => run(() => adminSetStatus(poll.code, 'open'), 'Abstimmung wieder geöffnet')}>
            <Unlock size={16} /> Wieder öffnen
          </button>
        )}
        <button className="btn-ghost" disabled={busy} onClick={startEdit}><Pencil size={16} /> Optionen bearbeiten</button>
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={async () => toast((await copyText(adminLink())) ? 'Admin-Link kopiert – gut aufbewahren!' : 'Kopieren nicht möglich', 'success')}
        >
          <KeyRound size={16} /> Admin-Link
        </button>
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={() => {
            if (!confirm('Alle Stimmen dieser Abstimmung zurücksetzen?')) return
            void run(async () => { await adminReset(poll.code); clearVotedLocally(poll.code) }, 'Ergebnisse zurückgesetzt')
          }}
        >
          <RotateCcw size={16} /> Zurücksetzen
        </button>
        <button
          className="btn-danger"
          disabled={busy}
          onClick={() => {
            if (!confirm('Abstimmung endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return
            void run(async () => { await adminDelete(poll.code); removeAdminToken(poll.code); navigate('/') }, 'Abstimmung gelöscht')
          }}
        >
          <Trash2 size={16} /> Löschen
        </button>
      </div>

      {editing && (
        <div className="mt-5 space-y-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <p className="muted text-sm">Optionen lassen sich nur ändern, solange noch niemand abgestimmt hat.</p>
          {draft.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" aria-label={`Option ${i + 1}`} maxLength={120} value={d} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="btn-ghost !px-3" aria-label="Option entfernen" disabled={draft.length <= 2} onClick={() => setDraft(draft.filter((_, j) => j !== i))}><X size={16} /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn-ghost" disabled={draft.length >= 30} onClick={() => setDraft([...draft, ''])}><Plus size={16} /> Option</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={saveEdit}>Speichern</button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Abbrechen</button>
          </div>
        </div>
      )}
    </section>
  )
}
