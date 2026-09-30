import type { Poll } from '../lib/types'
import { isOpen } from '../lib/utils'
import { useNow } from '../hooks/useNow'

export default function StatusBadge({ poll }: { poll: Poll }) {
  const open = isOpen(poll, useNow(5000))
  return open ? (
    <span className="badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <span className="pulse-dot size-2 rounded-full bg-emerald-500" aria-hidden /> LIVE
    </span>
  ) : (
    <span className="badge bg-slate-500/10 text-slate-500 dark:text-slate-400">
      <span className="size-2 rounded-full bg-slate-400" aria-hidden /> Beendet
    </span>
  )
}
