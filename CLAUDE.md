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
│   ├── login/             # Google OAuth Login (Player)
│   ├── home/              # Drink-Logging (Player)
│   ├── profil/            # Verlauf + Ausloggen (Player)
│   ├── admin/             # Admin-Bereich (Steel #6478a0)
│   │   ├── login/         # Google OAuth Login (Admin)
│   │   └── dashboard/     # Getränke CRUD + Abrechnung
│   ├── api/
│   │   ├── me/            # GET → { id, name, isAdmin }
│   │   └── auth/callback/ # Supabase OAuth Callback
│   ├── auth/callback/     # Next.js Auth Callback Route
│   ├── layout.tsx         # Root Layout mit Inter Font + Chakra Provider
│   ├── page.tsx           # Redirect → /login
│   └── globals.css
├── components/ui/
│   └── provider.tsx       # Chakra ChakraProvider wrapper
├── lib/
│   ├── theme.ts           # createSystem + Design-Tokens
│   ├── prisma.ts          # Prisma Client (singleton)
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

- Alle 5 Screens implementiert — komplett mit Chakra UI style props (kein Tailwind, keine `style={}`-Objekte)
- **Auth läuft:** Supabase Google OAuth für Spieler und Admin. Admin-Redirect via `useEffect` + `/api/me`.
- **Prisma Schema angelegt + Migration angewandt** (`20260614144754_init`). Admin-User "Fabian Hauser" in DB (`is_admin = true`).
- **Backend angebunden:** home/profil/admin-dashboard nutzen jetzt echte Prisma-Queries über API-Routes (`/api/home`, `/api/bookings`, `/api/profil`, `/api/admin/*`) statt Mock-Daten. Alte Mock-Daten liegen als Fixtures in `prisma/fixtures/`.
- `src/proxy.ts` aktiv (Route Guards laufen; Next.js 16 hat `middleware.ts` zu `proxy.ts` umbenannt)
- Noch kein Billing Modal (erscheint wenn Abrechnungsperiode endet)
- TSV Bobingen Logo noch nicht eingebunden (liegt in Design-Assets)

## Backend

### Supabase Auth

Env-Variablen in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Auth-Flow: Google OAuth → `/auth/callback` → Weiterleitung zu `/home` oder `/admin/dashboard`.
Clients: `src/lib/supabase/client.ts` (Browser), `src/lib/supabase/server.ts` (Server/RSC).

### Prisma + PostgreSQL

```
DATABASE_URL=postgresql://...
```

Schema in `prisma/schema.prisma`. Adapter: `@prisma/adapter-pg`.
Tabellen: `players`, `drinks`, `billing_periods`, `bookings`, `payments`.
Migration bereits angewandt. Preise immer als **Integer-Cents**.

API-Route: `GET /api/me` → gibt `{ id, name, isAdmin }` zurück (Supabase User → Prisma Player lookup).
