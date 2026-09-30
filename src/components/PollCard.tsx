import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, KeyRound, ListChecks, QrCode, Users } from 'lucide-react'
import type { PollSummary } from '../lib/types'
import { getAdminToken } from '../lib/storage'
import { formatDateTime } from '../lib/utils'
import StatusBadge from './StatusBadge'
import Countdown from './Countdown'
import QrModal from './QrModal'
import { isOpen } from '../lib/utils'

export default function PollCard({ item, index = 0 }: { item: PollSummary; index?: number }) {
  const { poll, optionCount, voters } = item
  const [qr, setQr] = useState(false)
  const mine = Boolean(getAdminToken(poll.code))
  return (
    <article
      className="card card-hover flex animate-fade-up flex-col"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge poll={poll} />
        {isOpen(poll) && poll.expires_at && <Countdown expiresAt={poll.expires_at} />}
        {mine && <span className="badge bg-brand-500/10 text-brand-600 dark:text-brand-400"><KeyRound size={12} /> Meine</span>}
      </div>
      <h3 className="line-clamp-2 min-h-[3.25rem] text-lg font-extrabold leading-snug">{poll.question}</h3>
      <div className="muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5"><Users size={15} aria-hidden /> {voters == null ? '–' : voters} {voters === 1 ? 'Stimme' : 'Stimmen'}</span>
        <span className="flex items-center gap-1.5"><ListChecks size={15} aria-hidden /> {optionCount} Optionen</span>
      </div>
      <p className="muted mt-1 text-xs">{formatDateTime(poll.created_at)} · <span className="font-mono">{poll.code}</span></p>
      <div className="mt-4 flex gap-2">
        <Link to={`/vote/${poll.code}`} className="btn-primary flex-1">Öffnen <ArrowRight size={16} /></Link>
        <button className="btn-ghost !px-3.5" onClick={() => setQr(true)} aria-label={`QR-Code für ${poll.question}`}><QrCode size={18} /></button>
      </div>
      {qr && <QrModal code={poll.code} question={poll.question} onClose={() => setQr(false)} />}
    </article>
  )
}
