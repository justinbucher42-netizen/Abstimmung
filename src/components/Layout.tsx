import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Moon, Plus, Sun } from 'lucide-react'
import Logo from './Logo'
import { useTheme } from '../hooks/useTheme'

export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass sticky top-0 z-30 border-x-0 border-t-0 rounded-none">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="VoteFlow Startseite" className="rounded-xl">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2" aria-label="Hauptnavigation">
            {pathname !== '/create' && (
              <Link to="/create" className="btn-primary !min-h-10 !px-4">
                <Plus size={18} aria-hidden /> <span className="hidden sm:inline">Abstimmung erstellen</span>
                <span className="sm:hidden">Neu</span>
              </Link>
            )}
            <button
              onClick={toggle}
              className="btn-ghost !min-h-10 !px-3"
              aria-label={theme === 'dark' ? 'Hellen Modus aktivieren' : 'Dunklen Modus aktivieren'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">{children}</main>
      <footer className="muted mx-auto w-full max-w-6xl px-4 pb-8 pt-4 text-center text-xs leading-relaxed">
        VoteFlow – einfache Online-Abstimmungen. Keine rechtssichere oder manipulationssichere Wahlsoftware:
        Doppelstimmen werden nur pro Gerät/Browser erschwert.
      </footer>
    </div>
  )
}
