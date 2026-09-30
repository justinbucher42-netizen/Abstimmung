import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

export function Spinner({ label = 'Lädt…' }: { label?: string }) {
  return (
    <div role="status" className="muted flex items-center justify-center gap-2 py-16 text-sm">
      <Loader2 className="animate-spin" size={18} aria-hidden /> {label}
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 text-center">
      <AlertTriangle className="text-amber-500" />
      <p className="font-medium">{message}</p>
      {onRetry && <button className="btn-ghost" onClick={onRetry}>Erneut versuchen</button>}
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="muted max-w-sm text-sm">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
