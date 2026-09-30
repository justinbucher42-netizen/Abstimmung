import { createClient } from '@supabase/supabase-js'

// Nur Origin verwenden: entfernt versehentliche Pfade wie "/rest/v1" oder "/" am Ende sowie Leerzeichen.
function normalizeUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    return new URL(raw.trim()).origin
  } catch {
    return undefined
  }
}

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isConfigured = Boolean(url && key && url.startsWith('http'))

// Auch ohne Konfiguration erzeugen wir einen Client, damit die App die Setup-Hilfe anzeigen kann.
export const supabase = createClient(
  isConfigured ? url! : 'http://localhost:54321',
  isConfigured ? key! : 'public-anon-key-not-configured',
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  },
)
