import { Timer } from 'lucide-react'
import { useNow } from '../hooks/useNow'
import { formatRemaining } from '../lib/utils'

export default function Countdown({ expiresAt }: { expiresAt: string }) {
  const now = useNow(1000)
  const ms = new Date(expiresAt).getTime() - now
  return (
    <span className="badge bg-amber-500/10 text-amber-600 dark:text-amber-400" title={new Date(expiresAt).toLocaleString('de-CH')}>
      <Timer size={13} aria-hidden /> {ms > 0 ? `noch ${formatRemaining(ms)}` : 'Zeit abgelaufen'}
    </span>
  )
}
