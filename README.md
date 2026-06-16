# Kabinen-Bar · Drink Tracker

Interner Getränke-Tracker für die Kabinen-Bar des TSV Bobingen. Spieler loggen entnommene Getränke aus dem Kühlschrank; die App trackt Schulden pro Abrechnungsperiode. Der Admin verwaltet das Getränkeangebot und schließt Abrechnungen ab.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Chakra UI v3** mit Custom Dark-Theme (style props, kein Tailwind)
- **Supabase** (Auth — Google OAuth)
- **Prisma v7** + **PostgreSQL** (Datenbank, via `@prisma/adapter-pg`)
- **Lucide React** (Icons)
- **Vercel** (Deployment)

## Screens

| Route | Screen | Beschreibung |
|---|---|---|
| `/login` | Login | Google OAuth → Spieler zu `/home`, Admins direkt zu `/admin/dashboard` |
| `/home` | Hauptseite | Getränke buchen, Saldo sehen, Undo-Toast |
| `/profile` | Profil/Verlauf | Kontostand + Abrechnungsperioden |
| `/admin/dashboard` | Admin Dashboard | Getränke CRUD + Abrechnung verwalten |

## Setup

```bash
npm install
```

`.env.local` anlegen:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://...
```

```bash
npm run dev
```

## Datenmodell

```
Player          { id, name }
Drink           { id, name, price_cents, active }
BillingPeriod   { id, start_date, end_date, status, payment_instructions }
Booking         { id, player_id, drink_id, period_id, created_at }
Payment         { id, player_id, period_id, paid, paid_at, confirmed }
```

Geldbeträge werden als **Integer-Cents** gespeichert. Formatierung: `1,50 €` (deutsches Format, via `formatCents()` in `src/types/index.ts`).

## Auth

- Ein einziger Login (`/login`) für Spieler und Admin, Google OAuth via Supabase. `/auth/callback` liest `is_admin` aus der `players`-Tabelle (Prisma) und leitet Admins direkt zu `/admin/dashboard`, alle anderen zu `/home` weiter.
- Route `/admin/*` ist zusätzlich serverseitig via `src/proxy.ts` gegen nicht-eingeloggte Nutzer geschützt; das Admin-Dashboard prüft `isAdmin` zusätzlich selbst via `/api/me` und schickt Nicht-Admins zu `/home`.

## Design

Dark-only. Design-Tokens in [`src/lib/theme.ts`](src/lib/theme.ts). Zwei Farbwelten:
- **Player:** Club-Blau `#0468b3`
- **Admin:** Steel `#6478a0`

Design-Referenz (Hi-Fi Prototypen) im ZIP-Handoff: `design_handoff_drink_tracker/`.
