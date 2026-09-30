# VoteFlow – Live-Abstimmungen

Moderne Web-App zum Erstellen und Teilen von Abstimmungen mit **Echtzeit-Ergebnissen**.
Person A erstellt eine Abstimmung am Laptop, Person B stimmt per Link/QR-Code am Handy ab – Person A sieht die Stimme automatisch, ohne Neuladen.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · Supabase (Postgres + Realtime) · Recharts · qrcode.react · Netlify

## Funktionen

- Dashboard mit Live-Zahlen (aktiv / abgeschlossen / Stimmen), Karten, QR-Code je Abstimmung
- Abstimmung erstellen: Frage, Beschreibung, beliebig viele Optionen, Dauer, Mehrfachauswahl, anonym/Namen, Live-Ergebnisse an/aus, öffentlich listen
- Beitreten per Code (`ABCD12`), Link (`/vote/ABCD12`) oder QR-Code
- Grosse Touch-Karten zum Abstimmen, Bestätigung, Schutz vor Doppelstimmen pro Gerät
- Live-Ergebnisse (Balken, Kreisdiagramm, Verlaufsdiagramm, Prozent, Meistgewählt, Countdown)
- Teilen: Link kopieren, native Web-Share, WhatsApp, Telegram, E-Mail, QR (PNG-Download)
- Creator: schliessen/öffnen, Optionen bearbeiten (nur ohne Stimmen), Ergebnisse zurücksetzen, löschen, Admin-Link für andere Geräte
- Dark/Light Mode, mobile-first, Barrierefreiheit (Labels, ARIA, Tastatur, reduced motion)

## Architektur & Sicherheit

Kein eigener Server nötig: Browser ⇄ Supabase (PostgREST + Realtime). Netlify liefert nur die statische App.

- **Tabellen lesen** dürfen alle (`polls`, `poll_options`, `poll_results`, `poll_stats`); **schreiben nur über SQL-Funktionen (RPC)**, die alles validieren.
- `votes` (Voter-ID, Namen) und `poll_secrets` sind über die API **nicht lesbar** → echte Anonymität.
- `poll_results`/`poll_stats` sind per RLS nur sichtbar, wenn Live-Ergebnisse erlaubt sind oder die Abstimmung beendet ist.
- Creator-Rechte über ein zufälliges **Admin-Token** (im Browser gespeichert, in der DB nur als SHA-256-Hash). Wer den Admin-Link hat, kann verwalten. Geht das Token verloren (Browserdaten gelöscht), ist die Abstimmung nicht mehr verwaltbar.
- Doppelstimmen: `UNIQUE(poll_id, voter_identifier, option_id)` + Prüfung in `cast_vote`. Die Voter-ID liegt im Browser (localStorage) – wer Browserdaten löscht, kann erneut abstimmen. **Keine Hochsicherheits-/Wahlsoftware.**
- Poll-Codes: 6 Zeichen aus 32er-Alphabet, per CSPRNG (`gen_random_uuid`) erzeugt.
- Rate-Limiting pro Client-IP in der DB (20 Abstimmungen/Std., 60 Stimmen/Min.).
- Im Frontend liegt nur der öffentliche `anon`-Key. **Nie den `service_role`-Key verwenden.**
- Hinweis: Abstimmungen sind lesbar für jeden, der die API abfragt; „nicht gelistet“ bedeutet nur „nicht in der Übersicht“, nicht „geheim“.

## Projektstruktur

```
├── index.html, vite.config.ts, tsconfig.json, netlify.toml, .env.example
├── public/favicon.svg
├── supabase/
│   ├── migrations/001_init.sql   # Schema, RLS, RPC-Funktionen, Realtime
│   └── tests/rls_test.sql        # SQL-Testskript (lokal gegen Postgres)
└── src/
    ├── main.tsx, App.tsx, index.css
    ├── lib/         supabase.ts, api.ts, storage.ts, utils.ts, types.ts, colors.ts
    ├── hooks/       usePoll.ts (Realtime), useDashboard.ts, useTheme.ts, useNow.ts
    ├── components/  Layout, Logo, PollCard, VoteForm, Results, SharePanel, QrModal, AdminPanel, …
    └── pages/       Home, Create, Poll, JoinRedirect, NotFound
```

## Setup Schritt für Schritt

### 1–2. Projekt & Dependencies
```bash
git clone <dein-repo> voteflow && cd voteflow
npm install
```
Voraussetzung: Node.js ≥ 20.

### 3. Supabase-Projekt erstellen
1. Kostenlosen Account auf <https://supabase.com> anlegen → **New project** (Name z. B. `voteflow`, Region nahe bei dir, Passwort speichern).
2. Warten, bis das Projekt bereit ist.

### 4–5. Datenbank & SQL-Migration
1. Im Supabase Dashboard: **SQL Editor → New query**.
2. Inhalt von `supabase/migrations/001_init.sql` einfügen → **Run**. (Das Skript ist wiederholbar.)

### 6. Realtime aktivieren
Das Skript fügt `polls`, `poll_options`, `poll_results`, `poll_stats` automatisch zur Publikation `supabase_realtime` hinzu. Kontrolle: **Database → Publications → supabase_realtime** – die vier Tabellen sollten aktiv sein (alternativ **Database → Replication**, Schalter einschalten). Anonyme Logins/Auth sind **nicht** nötig.

### 7. Environment Variables
Unter **Project Settings → API** kopieren: *Project URL* und *anon public key*.
```bash
cp .env.example .env
# .env bearbeiten:
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```
`.env` ist in `.gitignore` und wird nie committet.

### 8. Lokal starten
```bash
npm run dev      # http://localhost:5173
```
Test: zwei Browserfenster (eines als Handy-Ansicht) öffnen, in einem erstellen, im anderen abstimmen.

### 9. GitHub Repository
```bash
git init && git add . && git commit -m "VoteFlow"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

### 10–14. Netlify
1. <https://app.netlify.com> → **Add new site → Import an existing project → GitHub** → Repository wählen.
2. Einstellungen (werden durch `netlify.toml` bereits vorgegeben):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. **Site configuration → Environment variables**: `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen (gleiche Werte wie in `.env`).
4. **Deploy site**. Änderungen an Env-Variablen erfordern ein neues Deploy (*Deploys → Trigger deploy*).
5. Die SPA-Weiterleitung (`/vote/ABCD12` → `index.html`) ist in `netlify.toml` konfiguriert. Optional: eigene Domain unter *Domain management*.

## Tests

- `supabase/tests/rls_test.sql`: prüft Erstellen, Abstimmen, Doppelstimme, gesperrte Tabellen (votes/secrets/Schreibzugriff), Admin-Token, Schliessen, Zurücksetzen, versteckte Ergebnisse.
- Der gesamte Ablauf (Erstellen am Laptop → Abstimmen am Handy → Ergebnis beim Ersteller, Doppelstimme blockiert, Schliessen wird beim Teilnehmer sichtbar) wurde mit Playwright gegen echtes Postgres + PostgREST getestet.
- **Nicht getestet** werden konnte in dieser Entwicklungsumgebung der Supabase-Realtime-WebSocket (kein Supabase-Server verfügbar). Der Client nutzt die offizielle `postgres_changes`-API; zusätzlich aktualisiert ein Polling-Fallback alle 8 s, falls Realtime nicht verbunden ist. Die Statusanzeige „Live verbunden“ auf der Abstimmungsseite zeigt dir nach dem Deployment, ob Realtime funktioniert. Falls dort dauerhaft „Verbinde…“ steht: Realtime-Publikation prüfen (Schritt 6).

## Mögliche Erweiterungen
Supabase Auth (Konten, „Meine Abstimmungen“ geräteübergreifend), CAPTCHA (Turnstile) gegen Bots, Bildoptionen, Ranking-/Bewertungsabstimmungen, CSV-Export, Mehrsprachigkeit, Eigene Ablaufzeit verlängern, Creator sieht Ergebnisse auch bei verborgenen Live-Ergebnissen, PWA.
