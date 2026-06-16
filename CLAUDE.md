@AGENTS.md

# Kabinen-Bar Drink Tracker

## Projekt-Überblick

Next.js 16 App Router App für die Kabinen-Bar des TSV Bobingen. Zwei Nutzergruppen: Spieler (buchen Getränke, sehen Schulden) und Admin (verwaltet Getränke, Abrechnungsperioden, markiert Zahlungen).

## Wichtige Konventionen

- **Kein Tailwind, keine inline `style={}`-Objekte.** Styling ausschließlich via Chakra UI style props (`<Box bg="#151a21" px={5} borderRadius="12px">`). Nur SVG-Präsentationsattribute (fill, stroke) dürfen als Attribute gesetzt werden.
- **Dark-only.** Kein Light-Mode, kein `useColorMode`. `config.initialColorMode = 'dark'`, `useSystemColorMode = false`.
- **Geldbeträge immer in Cents (Integer).** Für Anzeige `formatCents()` aus `src/types/index.ts` verwenden → `1,50 €`.
- **Deutsch durchgehend.** Alle Labels, Fehlermeldungen, UI-Copy auf Deutsch.
- **Chakra UI v3** — API unterscheidet sich von v2. Theme via `createSystem` + `defineConfig`, Provider via `<ChakraProvider value={system}>`.

## Struktur

```
src/
├── app/
│   ├── login/             # Google OAuth Login (Spieler + Admin — ein einziger Login)
│   ├── home/              # Drink-Logging (Player) + Billing-Modal bei abgeschlossener Abrechnung
│   ├── profile/           # Verlauf + Ausloggen (Player)
│   ├── admin/             # Admin-Bereich (Steel #6478a0)
│   │   └── dashboard/     # Getränke CRUD + Abrechnung (eigener /admin/login existiert nicht mehr)
│   ├── api/
│   │   ├── me/                    # GET → { id, name, isAdmin }
│   │   ├── home/                  # GET → Getränke + Saldo + closedPeriod (Player)
│   │   ├── bookings/              # POST/DELETE Buchungen
│   │   ├── profile/                # GET → Abrechnungsperioden (Player)
│   │   └── admin/                 # drinks, billing-periods, billing-periods/[id]/members, payments
│   ├── auth/callback/     # Next.js Auth Callback Route — prüft player.isAdmin, leitet
│   │                       # Admins zu /admin/dashboard, sonst zu /home (oder zu `next`)
│   ├── layout.tsx         # Root Layout mit Inter Font + Chakra Provider
│   ├── page.tsx           # Redirect → /login
│   └── globals.css
├── components/
│   ├── LoadingState.tsx   # Zentrierter Spinner für noch nicht geladene Daten (statt 0,00 €/leer)
│   └── ui/
│       └── provider.tsx   # Chakra ChakraProvider wrapper
├── lib/
│   ├── theme.ts           # createSystem + Design-Tokens
│   ├── prisma.ts          # Prisma Client (singleton)
│   ├── auth.ts             # getCurrentPlayer() / requireAdmin()
│   ├── period.ts           # getActivePeriod() / formatPeriodRange()
│   ├── constants.ts        # PERIOD_STATUS, PROFILE_STATUS, API_ERROR, ROUTES, ...
│   └── supabase/
│       ├── client.ts      # Browser-Client (createBrowserClient)
│       └── server.ts      # Server-Client (createServerClient + cookies)
├── types/index.ts         # DB-Typen + formatCents()
└── proxy.ts               # Route Guards (aktiv — Next.js 16 Proxy-Convention, ersetzt middleware.ts)

prisma/
├── schema.prisma          # DB-Schema (Player, Drink, BillingPeriod, Booking, Payment)
└── migrations/
    └── 20260614144754_init/
```

## Design-Tokens (wichtigste)

| Token | Wert | Verwendung |
|---|---|---|
| `#0d1014` | App-Background (Player) |
| `#0b0e13` | App-Background (Admin) |
| `#151a21` | Surface / Cards |
| `#1b212b` | Surface 2 / Inputs |
| `#0468b3` | Brand (Player) |
| `#6478a0` | Steel (Admin) |
| `#2fa968` | Success / Bezahlt |
| `#d6a23a` | Amber / Ausstehend |
| `#e0535f` | Danger / Ausloggen |

## Aktueller Stand

- Alle Screens implementiert — komplett mit Chakra UI style props (kein Tailwind, keine `style={}`-Objekte)
- **Ein einziger Login:** `/admin/login` wurde entfernt. Spieler und Admin melden sich beide über `/login` per Google OAuth an; `auth/callback` prüft `player.isAdmin` aus der DB und leitet entsprechend zu `/home` oder `/admin/dashboard` weiter. Die Admin-Dashboard-Seite prüft `isAdmin` zusätzlich selbst gegen `/api/me` und schickt Nicht-Admins zu `/home`.
- **Prisma Schema angelegt + Migration angewandt** (`20260614144754_init`). Admin-User "Fabian Hauser" in DB (`is_admin = true`).
- **Backend angebunden:** home/profile/admin-dashboard nutzen echte Prisma-Queries über API-Routes (`/api/home`, `/api/bookings`, `/api/profile`, `/api/admin/*`) statt Mock-Daten. Alte Mock-Daten liegen als Fixtures in `prisma/fixtures/`.
- `src/proxy.ts` aktiv (Route Guards laufen; Next.js 16 hat `middleware.ts` zu `proxy.ts` umbenannt)
- **Billing-Modal:** erscheint auf `/home`, wenn die zuletzt abgeschlossene Abrechnungsperiode für den Spieler noch eine offene Zahlung hat (Betrag + Zahlungshinweise oder Fallback-Text).
- **Loading-States:** `home`, `profile` und `admin/dashboard` (Getränke- und Abrechnungs-Tab inkl. Mitgliederliste) zeigen während des initialen Fetches einen Spinner (`LoadingState`) statt `0,00 €`/leerer Listen.
- TSV Bobingen Logo noch nicht eingebunden (liegt in Design-Assets)
- 2 bekannte, noch offene TypeScript-Fehler in `admin/dashboard/page.tsx`: `Box as="input" type=...` und `Box as="textarea" onChange=...` (Chakra-Polymorphic-Typing-Problem, betrifft nicht das Laufzeitverhalten)

## Backend

### Supabase Auth

Env-Variablen in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Auth-Flow: Google OAuth (immer über `/login`) → `/auth/callback` → liest `player.isAdmin` aus der DB → Weiterleitung zu `/admin/dashboard` (Admin) oder `/home` (Spieler). Es gibt keinen separaten Admin-Login mehr.
Clients: `src/lib/supabase/client.ts` (Browser), `src/lib/supabase/server.ts` (Server/RSC).

### Prisma + PostgreSQL

```
DATABASE_URL=postgresql://...
```

Schema in `prisma/schema.prisma`. Adapter: `@prisma/adapter-pg`.
Tabellen: `players`, `drinks`, `billing_periods`, `bookings`, `payments`.
Migration bereits angewandt. Preise immer als **Integer-Cents**.

API-Route: `GET /api/me` → gibt `{ id, name, isAdmin }` zurück (Supabase User → Prisma Player lookup).
