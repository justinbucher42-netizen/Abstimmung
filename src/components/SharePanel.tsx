import { useState } from 'react'
import { Copy, Mail, QrCode, Send, Share2, MessageCircle } from 'lucide-react'
import { pollUrl } from '../lib/utils'
import { useToast } from './Toast'
import QrModal from './QrModal'

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback für ältere Browser / unsichere Kontexte
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export default function SharePanel({ code, question }: { code: string; question: string }) {
  const url = pollUrl(code)
  const toast = useToast()
  const [qr, setQr] = useState(false)
  const text = `Stimm ab: ${question}`
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    const ok = await copyText(url)
    toast(ok ? 'Link kopiert' : 'Kopieren nicht möglich', ok ? 'success' : 'error')
  }
  const nativeShare = async () => {
    try { await navigator.share({ title: 'VoteFlow', text, url }) } catch { /* abgebrochen */ }
  }

  return (
    <section className="card" aria-labelledby="share-title">
      <h2 id="share-title" className="mb-3 text-lg font-extrabold">Teilen</h2>
      <div className="flex items-center gap-2 rounded-2xl border p-1.5 pl-4" style={{ borderColor: 'var(--border)' }}>
        <span className="min-w-0 flex-1 truncate font-mono text-sm" title={url}>{url.replace(/^https?:\/\//, '')}</span>
        <button onClick={copy} className="btn-primary !min-h-9 !rounded-xl !px-3.5"><Copy size={15} /> Kopieren</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {canNativeShare && (
          <button onClick={nativeShare} className="btn-ghost"><Share2 size={16} /> Teilen</button>
        )}
        <a className="btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}>
          <MessageCircle size={16} /> WhatsApp
        </a>
        <a className="btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}>
          <Send size={16} /> Telegram
        </a>
        <a className="btn-ghost" href={`mailto:?subject=${encodeURIComponent(`Abstimmung: ${question}`)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`}>
          <Mail size={16} /> E-Mail
        </a>
        <button onClick={() => setQr(true)} className="btn-ghost"><QrCode size={16} /> QR-Code</button>
      </div>
      {qr && <QrModal code={code} question={question} onClose={() => setQr(false)} />}
    </section>
  )
}
