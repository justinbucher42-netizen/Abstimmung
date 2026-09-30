import { Database } from 'lucide-react'

export default function SetupNotice() {
  return (
    <div className="card mx-auto max-w-2xl">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-500"><Database /></div>
      <h1 className="text-2xl font-extrabold">Supabase ist noch nicht verbunden</h1>
      <p className="muted mt-2">
        VoteFlow speichert alle Abstimmungen in Supabase, damit alle Teilnehmer dieselben Daten sehen. Es fehlen die
        Umgebungsvariablen:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-sm text-slate-100">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key`}
      </pre>
      <p className="muted mt-4 text-sm">
        Lokal: <code>.env</code> anlegen (Vorlage: <code>.env.example</code>) und neu starten. Auf Netlify:
        Site configuration → Environment variables, danach neu deployen. Details stehen in der <code>README.md</code>.
      </p>
    </div>
  )
}
