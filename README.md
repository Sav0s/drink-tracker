# Kabinen-Bar · Drink Tracker

A small web app for a sports club's **Kabinen-Bar** (the clubhouse fridge). Players tap to log the drinks they take, the app keeps a running tab per billing period, and the treasurer settles up. Two roles: **players** (book drinks, see what they owe, mark themselves as paid) and **admin** (manage the drink catalog and billing periods).

The club/organization name is configurable via the `NEXT_PUBLIC_CLUB_NAME` environment variable, so it isn't baked into the source.

Built as a mobile-first, dark-only web app.

---

## Features

**For players**
- Tap a drink to book it, with an undo toast
- See the current open balance and a per-drink tally for the running period
- Billing history with an expandable breakdown per period
- Self-service payment: mark a closed period as paid (or reset it)
- Edit your display name; a one-time welcome asks for it on first visit

**For admins**
- Manage the drink catalog: add, rename, re-price, activate/deactivate
- Open a new billing period (which automatically closes the previous one)
- Per-member overview per period: totals, paid/open status, mark paid / reset
- Payment instructions (PayPal / IBAN) carried over from the last period

**Auth**
- Single login for players and admins: **Google OAuth** or **email magic link** (Supabase Auth)
- Admins are detected from the database and routed to the admin dashboard automatically

---

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Chakra UI v3** — custom dark theme, styled entirely via style props (no Tailwind)
- **Supabase** — Auth (Google OAuth + email magic link) and hosted PostgreSQL
- **Prisma v7** + **PostgreSQL** via `@prisma/adapter-pg`
- **lucide-react** icons
- **Vercel** for hosting; **Vercel Analytics** for page views

---

## Screens

| Route | Description |
|---|---|
| `/login` | Login — Google OAuth or email magic link |
| `/home` | Book drinks, see balance; first-visit welcome; payment reminder when a period closes |
| `/bookings` | Billing history; mark closed periods as paid |
| `/account` | Manage your display name |
| `/admin/dashboard` | Drink catalog CRUD + billing management (admins only) |

---

## Getting Started

**Prerequisites:** Node.js 20+, a Supabase project (Postgres + Auth).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` (never commit this — it is gitignored):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key

   # Club/organization name shown in the UI (optional)
   NEXT_PUBLIC_CLUB_NAME=Your Club

   # Runtime: Supabase connection pooler (Supavisor, port 6543)
   DATABASE_URL=postgresql://...:6543/postgres?pgbouncer=true
   # Migrations only: direct connection (port 5432)
   DIRECT_URL=postgresql://...:5432/postgres
   ```

3. Apply the database schema:

   ```bash
   npx prisma migrate deploy      # or `npx prisma migrate dev` for local development
   ```

4. In Supabase → **Authentication → URL Configuration**, set the **Site URL** and add
   `http://localhost:3000/**` (and later your production domain) to **Redirect URLs**.

5. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

> **Tip:** use a separate Supabase project for local development so you never run against
> production data. Point `.env.local` at the dev project and keep production values only in Vercel.

---

## Data Model

```
Player          { id, name, is_admin, created_at, onboarded_at }
Drink           { id, name, price_cents, active, created_at }
BillingPeriod   { id, start_date, end_date, status, payment_instructions, created_at }
Booking         { id, player_id, drink_id, period_id, created_at }
Payment         { id, player_id, period_id, paid, paid_at, created_at }
```

- Money is stored as **integer cents**; display formatting (`1,50 €`) lives in `formatCents()` (`src/types/index.ts`).
- `Player.id` equals the Supabase auth user id — the real identity. Display names are not unique.
- At most one `BillingPeriod` is `active` at a time (enforced when a new period is opened).

---

## Project Structure

```
src/
├── app/
│   ├── login/            # Google OAuth + email magic link
│   ├── home/             # Drink logging + balance
│   ├── bookings/         # Billing history + self-pay
│   ├── account/          # Manage display name
│   ├── admin/dashboard/  # Drink CRUD + billing
│   ├── auth/callback/    # OAuth/magic-link callback, upserts the player row
│   └── api/              # me, home, bookings, payments, admin/*
├── components/           # AppBar, LoadingState, Chakra provider
├── lib/                  # prisma, supabase clients, auth, theme, constants
└── proxy.ts              # Route guards (Next.js 16 proxy convention)

prisma/                   # schema + migrations
```

---

## Deployment

Deployed on **Vercel**. Set the four environment variables above in Vercel
(Production/Preview/Development) and redeploy.

- `prisma generate` runs in the `build` script and `postinstall`, so the client exists at build time.
- Database migrations are **not** run by the Vercel build — apply them separately with
  `npx prisma migrate deploy`.
- In Supabase, point the **Site URL** and **Redirect URLs** at your Vercel domain so Google OAuth
  and the magic link redirect back to `/auth/callback`.

---

## Conventions

- **Dark-only.** No light mode. Design tokens live in `src/lib/theme.ts` (player blue `#0468b3`, admin steel `#6478a0`).
- **No Tailwind, no inline `style={}`** — styling exclusively via Chakra UI style props.
- **German** for all in-app UI copy; **English** for code, comments, and docs.
- All data access goes through **Prisma** (server-side); Row Level Security is enabled on every
  table, so the public REST API is locked down by default.

---

## License

Private project for a sports club. Not affiliated with or endorsed by any drink manufacturer.
