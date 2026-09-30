import { useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, X } from 'lucide-react'
import { pollUrl } from '../lib/utils'

export default function QrModal({ code, question, onClose }: { code: string; question: string; onClose: () => void }) {
  const url = pollUrl(code)
  const wrap = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [onClose])

  const download = () => {
    const canvas = wrap.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `voteflow-${code}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="QR-Code"
        onClick={(e) => e.stopPropagation()}
        className="card animate-pop w-full max-w-sm bg-[var(--card-solid)] text-center"
      >
        <button ref={closeRef} onClick={onClose} aria-label="Schliessen" className="btn-ghost absolute right-3 top-3 !min-h-9 !px-2.5">
          <X size={18} />
        </button>
        <h2 className="mb-1 px-6 text-lg font-extrabold leading-snug">{question}</h2>
        <p className="muted mb-4 text-sm">Scannen zum Abstimmen</p>
        <div ref={wrap} className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-inner">
          <QRCodeCanvas value={url} size={256} level="M" marginSize={1} style={{ width: 240, height: 240 }} />
        </div>
        <p className="mt-4 font-mono text-2xl font-extrabold tracking-[0.3em]">{code}</p>
        <p className="muted mt-1 break-all text-xs">{url}</p>
        <button onClick={download} className="btn-ghost mt-4 w-full">
          <Download size={16} /> Als PNG speichern
        </button>
      </div>
    </div>
  )
}
