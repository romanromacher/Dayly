# dayly.

Persönliche Aufgaben-App für das iPhone: **Heute**, **Woche** (Tagesaufgaben + getrennte Wochenziele), **Erfolge** (automatische Wochenrückblicke), Glocke für Aufgaben, die seit mindestens 21 Tagen offen sind. Next.js 16 · React 19 · Tailwind · Supabase (Postgres).

Stand: Oberfläche, dauerhafte Speicherung und KI-Assistent (Text und Sprache) sind gebaut. Ohne `OPENAI_API_KEY` ist der Assistent klar als „noch nicht verbunden“ markiert (keine Fake-KI).

## 1. Lokal starten (ohne Supabase, zum Ausprobieren)

```bash
npm install
cp .env.local.example .env.local
```

In `.env.local` setzen: `APP_PASSCODE` (dein Passcode), `SESSION_SECRET` (mind. 32 Zeichen, z. B. `openssl rand -hex 32`), `CRON_SECRET` (beliebig lang) und die Zeile `DATA_BACKEND=file` aktivieren. Dann:

```bash
npm run dev      # http://localhost:3000
```

Die Daten liegen dann in `.data/dayly.json` (nur für Entwicklung; auf Vercel ist dieser Modus gesperrt).

## 2. Supabase einrichten (dauerhafte Speicherung)

1. Auf https://supabase.com ein Projekt anlegen.
2. **Dashboard → SQL Editor → New query**: den Inhalt von `supabase/migrations/0001_init.sql` einfügen und **Run** klicken.
3. **Dashboard → Project Settings → API**: `Project URL` kopieren (→ `SUPABASE_URL`) und den **service_role**-Key (→ `SUPABASE_SERVICE_ROLE_KEY`).
   Der Key bleibt geheim und wird nur auf dem Server verwendet. Row Level Security ist aktiv, ohne öffentliche Policies: der Zugriff geht ausschließlich über die App-API.

## 3. Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `APP_PASSCODE` | Dein Passcode für den Login |
| `SESSION_SECRET` | Signiert das Login-Cookie (mind. 32 Zeichen) |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Nur serverseitig |
| `CRON_SECRET` | Schützt den täglichen Job `/api/cron/daily` |
| `OPENAI_API_KEY` | Schaltet den KI-Assistenten frei (nur serverseitig) |
| `OPENAI_MODEL` / `OPENAI_TRANSCRIBE_MODEL` | Optional: Modelle ändern (Standard `gpt-4.1-mini` und `gpt-4o-mini-transcribe`) |
| `DATA_BACKEND=file` | Nur lokal: JSON-Datei statt Supabase |

## 4. Auf Vercel veröffentlichen

1. Projekt in ein GitHub-Repository hochladen (`.env.local` und `.data` sind per `.gitignore` ausgeschlossen).
2. **https://vercel.com → Add New → Project** → Repository wählen → Framework „Next.js“.
3. **Project → Settings → Environment Variables**: die Variablen aus Abschnitt 3 eintragen (ohne `DATA_BACKEND`) → **Deploy**.
4. Der tägliche Job (`vercel.json`, 23:10 UTC, also kurz nach Mitternacht Berlin) wird automatisch unter **Project → Settings → Cron Jobs** angelegt. Vercel sendet `CRON_SECRET` selbst als Bearer-Token mit.

## 5. Auf dem iPhone installieren

Seite in **Safari** öffnen → Teilen-Symbol → **Zum Home-Bildschirm** → Hinzufügen. Der Login bleibt 90 Tage bestehen.

## Befehle

```bash
npm run dev        # Entwicklung
npm run build      # Produktions-Build
npm start          # Produktion starten
npm run typecheck  # Typprüfung
npm test           # Tests (32)
npm run icons      # App-Icons neu erzeugen
```



## Sicherheit

- Alle Seiten und API-Routen außer Login/Cron/Manifest/Icons verlangen ein signiertes httpOnly-Cookie.
- Login: Hash-Vergleich in konstanter Zeit, Verzögerung und Sperre nach mehreren Fehlversuchen.
- Keine Schlüssel im Browser; Supabase-Zugriff nur serverseitig.
- Alle Eingaben werden mit Zod geprüft; Schreibzugriffe sind versioniert (kein stilles Überschreiben) und werden als Änderungsprotokoll mit „Rückgängig“ gespeichert.

## Fachregeln

- Tage sind Kalendertage in Europe/Berlin; Wochen sind ISO-Kalenderwochen (Mo–So).
- Verschiebt man eine Aufgabe, bleibt der ursprüngliche Tag / die ursprüngliche Woche gespeichert. Die 21 Tage zählen ab diesem Ursprung; die Glocke zeigt die ursprüngliche KW.
- Wochenrückblicke werden beim Wochenwechsel einmalig gespeichert und danach nicht mehr verändert (außer auf ausdrücklichen Wunsch: „Rückblick neu berechnen“). Die Zählregeln stehen in der App unter „So wird gezählt“.

## KI-Assistent

1. Key erzeugen: https://platform.openai.com → Settings → Billing (Guthaben) und Dashboard → API keys → Create new secret key.
2. Bei Vercel unter Project → Settings → Environment Variables `OPENAI_API_KEY` eintragen, dann Deployments → ⋯ → Redeploy.
3. In der App auf den Mikrofon-Button tippen: sprechen (Mikrofon-Symbol im Fenster) oder tippen.

So arbeitet er:
- Der Server schickt der KI deinen Plan (Tage, Wochenziele, offene Altlasten, Kalender der nächsten 15 Tage) und nur vier feste Werkzeuge: Aufgabe anlegen, ändern/verschieben, abhaken, nachfragen. Freie Datenbankbefehle gibt es nicht.
- Die KI führt nichts selbst aus. Du bekommst eine Liste von Vorschlägen, kannst einzelne abwählen und bestätigst. Erst dann wird gespeichert, über dieselben Prüfungen wie bei Handeingaben.
- Dubletten werden serverseitig blockiert (gleicher Tag bzw. gleiche Woche, fast gleicher Titel), erfundene Aufgaben-IDs, unbekannte Aktionen und ungültige Daten ebenfalls.
- Bei Unklarheit stellt die KI eine Rückfrage. „Rückgängig“ macht den ganzen Stapel zurück; Änderungen sind im Protokoll mit Quelle „ai“ markiert.
- Sprachaufnahmen werden nur zur Texterkennung an OpenAI geschickt und nicht gespeichert. Eine Aufnahme darf bis ca. 4 MB groß sein (etwa eine Minute).
- Der Assistent kann aktuell nichts löschen. Das ist Absicht.

## Offen / nächste Schritte

- Das echte Zusammenspiel mit OpenAI und dem iPhone-Mikrofon kann erst mit deinem Schlüssel auf dem Gerät geprüft werden. Getestet ist alles gegen einen nachgebauten OpenAI-Server.
- Kein Offline-Betrieb: Die App braucht eine Internetverbindung.
