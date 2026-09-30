// Lokale Präferenzen des Browsers. Wichtig: Abstimmungen und Stimmen liegen in Supabase,
// hier stehen nur Schlüssel/Merker für dieses Gerät.
const PREFIX = 'voteflow:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* Storage blockiert (z. B. privater Modus) – App funktioniert weiter */
  }
}

export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Anonyme, pro Gerät stabile ID zur Verhinderung einfacher Doppelstimmen */
export function getVoterId(): string {
  let id = read<string | null>('voterId', null)
  if (!id || id.length < 16) {
    id = randomToken(16)
    write('voterId', id)
  }
  return id
}

export function getVoterName(): string {
  return read<string>('voterName', '')
}
export function setVoterName(name: string) {
  write('voterName', name)
}

// Admin-Tokens (Creator): code -> token
export function getAdminTokens(): Record<string, string> {
  return read<Record<string, string>>('admin', {})
}
export function getAdminToken(code: string): string | null {
  return getAdminTokens()[code.toUpperCase()] ?? null
}
export function saveAdminToken(code: string, token: string) {
  write('admin', { ...getAdminTokens(), [code.toUpperCase()]: token })
}
export function removeAdminToken(code: string) {
  const all = getAdminTokens()
  delete all[code.toUpperCase()]
  write('admin', all)
}

// Beigetretene / besuchte Abstimmungen
export function getJoined(): string[] {
  return read<string[]>('joined', [])
}
export function addJoined(code: string) {
  const c = code.toUpperCase()
  const list = getJoined().filter((x) => x !== c)
  write('joined', [c, ...list].slice(0, 30))
}

// Merker, dass auf diesem Gerät bereits abgestimmt wurde
export function hasVotedLocally(code: string): boolean {
  return Boolean(read<Record<string, boolean>>('voted', {})[code.toUpperCase()])
}
export function markVotedLocally(code: string) {
  write('voted', { ...read<Record<string, boolean>>('voted', {}), [code.toUpperCase()]: true })
}
export function clearVotedLocally(code: string) {
  const v = read<Record<string, boolean>>('voted', {})
  delete v[code.toUpperCase()]
  write('voted', v)
}
