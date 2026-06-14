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
| `/login` | Player Login | Google OAuth → Weiterleitung zu `/home` |
| `/home` | Hauptseite | Getränke buchen, Saldo sehen, Undo-Toast |
| `/profil` | Profil/Verlauf | Kontostand + Abrechnungsperioden |
| `/admin/login` | Admin Login | Google OAuth (Steel-Theme) |
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

- **Spieler:** Google OAuth via Supabase. Nach Login Weiterleitung zu `/home`.
- **Admin:** Google OAuth via Supabase. `is_admin = true` in der `players` Tabelle (Prisma). Route `/admin/*` geschützt via `/api/me`-Check im `useEffect`.

## Design

Dark-only. Design-Tokens in [`src/lib/theme.ts`](src/lib/theme.ts). Zwei Farbwelten:
- **Player:** Club-Blau `#0468b3`
- **Admin:** Steel `#6478a0`

Design-Referenz (Hi-Fi Prototypen) im ZIP-Handoff: `design_handoff_drink_tracker/`.
