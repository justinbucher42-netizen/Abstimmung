import type { ReactNode } from 'react'

export default function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500">{icon}</div>
      <div className="min-w-0">
        <div className="muted text-xs font-medium">{label}</div>
        <div className="truncate text-lg font-extrabold tabular-nums">{value}</div>
      </div>
    </div>
  )
}
