# Kabinen-Bar · Drink Tracker

Internal drink tracker for the TSV Bobingen Kabinen-Bar. Players log drinks taken from the fridge; the app tracks debts per billing period. The admin manages the drink catalog and closes out billing periods.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Chakra UI v3** with a custom dark theme (style props, no Tailwind)
- **Supabase** (Auth — Google OAuth)
- **Prisma v7** + **PostgreSQL** (database, via `@prisma/adapter-pg`)
- **Lucide React** (icons)
- **Vercel** (deployment)

## Screens

| Route | Screen | Description |
|---|---|---|
| `/login` | Login | Google OAuth → players go to `/home`, admins go straight to `/admin/dashboard` |
| `/home` | Home | Book drinks, see balance, undo toast |
| `/profile` | Profile/history | Account balance + billing periods |
| `/admin/dashboard` | Admin dashboard | Drink CRUD + manage billing |

## Setup

```bash
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://...
```

```bash
npm run dev
```

## Data Model

```
Player          { id, name }
Drink           { id, name, price_cents, active }
BillingPeriod   { id, start_date, end_date, status, payment_instructions }
Booking         { id, player_id, drink_id, period_id, created_at }
Payment         { id, player_id, period_id, paid, paid_at, confirmed }
```

Money amounts are stored as **integer cents**. Display formatting: `1,50 €` (German format, via `formatCents()` in `src/types/index.ts`).

## Auth

- A single login (`/login`) for both players and admins, Google OAuth via Supabase. `/auth/callback` reads `is_admin` from the `players` table (Prisma) and redirects admins straight to `/admin/dashboard`, everyone else to `/home`.
- The `/admin/*` route is additionally protected server-side via `src/proxy.ts` against unauthenticated users; the admin dashboard also checks `isAdmin` itself via `/api/me` and redirects non-admins to `/home`.

## Design

Dark-only. Design tokens in [`src/lib/theme.ts`](src/lib/theme.ts). Two color worlds:
- **Player:** club blue `#0468b3`
- **Admin:** steel `#6478a0`

Design reference (hi-fi prototypes) in the ZIP handoff: `design_handoff_drink_tracker/`.
