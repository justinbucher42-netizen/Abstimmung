import { useEffect, useState } from 'react'

/** Liefert die aktuelle Zeit, aktualisiert im gegebenen Intervall (für Countdowns). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
