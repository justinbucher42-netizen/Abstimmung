import type { Poll } from './types'

export const CODE_RE = /^[A-Z2-9]{6}$/

/** Extrahiert einen Code aus Eingabe wie "abcd12", "/vote/ABCD12" oder einer vollen URL */
export function parseCode(input: string): string | null {
  const s = input.trim()
  const m = s.match(/vote\/([A-Za-z0-9]{6})/) ?? s.match(/^([A-Za-z0-9]{6})$/)
  const code = m?.[1]?.toUpperCase()
  return code && /^[A-Z0-9]{6}$/.test(code) ? code : null
}

export function pollUrl(code: string): string {
  return `${window.location.origin}/vote/${code}`
}

export function isExpired(p: Poll, now = Date.now()): boolean {
  return p.expires_at != null && new Date(p.expires_at).getTime() <= now
}

export function isOpen(p: Poll, now = Date.now()): boolean {
  return p.status === 'open' && !isExpired(p, now)
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'beendet'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d} Tg ${h} Std`
  if (h > 0) return `${h} Std ${m} Min`
  if (m > 0) return `${m} Min ${String(sec).padStart(2, '0')} Sek`
  return `${sec} Sek`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

/** Datenbankfehler ("CODE: Text") in lesbare Meldung umwandeln */
export function errorMessage(e: unknown): string {
  const raw =
    typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  const m = raw.match(/^(?:[A-Z_]+):\s*(.+)$/)
  if (m) return m[1]
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) return 'Keine Verbindung zum Server. Bitte Internet prüfen.'
  return raw || 'Unbekannter Fehler'
}

export function errorCode(e: unknown): string | null {
  const raw = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
  return raw.match(/^([A-Z_]+):/)?.[1] ?? null
}
