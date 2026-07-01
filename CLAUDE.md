@AGENTS.md

# Kabinen-Bar Drink Tracker

## Project Overview

Next.js 16 App Router app for a sports club's Kabinen-Bar (clubhouse fridge). Two user groups: players (book drinks, see debts) and admin (manages drinks, billing periods, marks payments). The club name is not hardcoded — it comes from `NEXT_PUBLIC_CLUB_NAME` (see `CLUB_NAME` in `src/lib/constants.ts`).

## Key Conventions

- **No Tailwind, no inline `style={}` objects.** Styling exclusively via Chakra UI style props (`<Box bg="#151a21" px={5} borderRadius="12px">`). Only SVG presentation attributes (fill, stroke) may be set as attributes.
- **Dark-only.** No light mode, no `useColorMode`. `config.initialColorMode = 'dark'`, `useSystemColorMode = false`.
- **Money amounts always in cents (integer).** For display, use `formatCents()` from `src/types/index.ts` → `1,50 €`.
- **German throughout for in-app UI.** All labels, error messages, and UI copy shown inside the running app are in German. This applies only to user-facing strings — code, comments, commit messages, and docs (like this file) are in English per the repo-language convention.
- **Chakra UI v3** — API differs from v2. Theme via `createSystem` + `defineConfig`, provider via `<ChakraProvider value={system}>`.

## Structure

```
src/
├── app/
│   ├── login/             # Login (single, players + admin): Google OAuth + email magic link
│   ├── home/              # Drink logging (player) + billing modal when a period is closed
│   ├── bookings/          # Billing history (player; renamed from /profile)
│   ├── account/           # Konto verwalten — edit display name (player)
│   ├── admin/              # Admin area (steel #6478a0)
│   │   └── dashboard/     # Drink CRUD + billing (dedicated /admin/login no longer exists)
│   ├── api/
│   │   ├── me/                    # GET → { id, name, isAdmin } · PATCH { name } → rename player
│   │   ├── home/                  # GET → drinks + balance + closedPeriod (player)
│   │   ├── bookings/              # GET → billing periods (history) · POST/DELETE bookings
│   │   └── admin/                 # drinks, billing-periods, billing-periods/[id]/members, payments
│   ├── auth/callback/     # Next.js auth callback route — checks player.isAdmin, redirects
│   │                       # admins to /admin/dashboard, others to /home (or to `next`)
│   ├── layout.tsx         # Root layout with Inter font + Chakra provider
│   ├── page.tsx           # Redirect → /login
│   └── globals.css
├── components/
│   ├── AppBar.tsx         # Shared top bar: title + logo + account dropdown menu
│   ├── LoadingState.tsx   # Centered spinner for not-yet-loaded data (instead of 0,00 €/empty)
│   └── ui/
│       └── provider.tsx   # Chakra ChakraProvider wrapper
├── lib/
│   ├── theme.ts           # createSystem + design tokens
│   ├── prisma.ts          # Prisma client (singleton)
│   ├── auth.ts             # getCurrentPlayer() / requireAdmin()
│   ├── period.ts           # getActivePeriod() / formatPeriodRange()
│   ├── constants.ts        # PERIOD_STATUS, PROFILE_STATUS, API_ERROR, ROUTES, ...
│   └── supabase/
│       ├── client.ts      # Browser client (createBrowserClient)
│       └── server.ts      # Server client (createServerClient + cookies)
├── types/index.ts         # DB types + formatCents()
└── proxy.ts               # Route guards (active — Next.js 16 proxy convention, replaces middleware.ts)

prisma/
├── schema.prisma          # DB schema (Player, Drink, BillingPeriod, Booking, Payment)
└── migrations/
    └── 20260614144754_init/
```

## Design Tokens (most important)

| Token | Value | Use |
|---|---|---|
| `#0d1014` | App background (player) |
| `#0b0e13` | App background (admin) |
| `#151a21` | Surface / cards |
| `#1b212b` | Surface 2 / inputs |
| `#0468b3` | Brand (player) |
| `#6478a0` | Steel (admin) |
| `#2fa968` | Success / paid |
| `#d6a23a` | Amber / pending |
| `#e0535f` | Danger / logout |

## Current Status

- All screens implemented — fully with Chakra UI style props (no Tailwind, no `style={}` objects)
- **Single login:** `/admin/login` has been removed. Players and admins both sign in via `/login` with Google OAuth; `auth/callback` checks `player.isAdmin` from the DB and redirects to `/home` or `/admin/dashboard` accordingly. The admin dashboard page also checks `isAdmin` itself against `/api/me` and redirects non-admins to `/home`.
- **Prisma schema created + migration applied** (`20260614144754_init`). Admin user "Fabian Hauser" in DB (`is_admin = true`).
- **Backend connected:** home/bookings/admin-dashboard use real Prisma queries via API routes (`/api/home`, `/api/bookings`, `/api/admin/*`) instead of mock data. Old mock data lives as fixtures in `prisma/fixtures/`.
- `src/proxy.ts` active (route guards run; Next.js 16 renamed `middleware.ts` to `proxy.ts`). Also redirects the old `/profile` path to `/bookings`.
- **Billing modal:** appears on `/home` when the player's most recently closed billing period still has an open payment (amount + payment instructions, or fallback text). Two actions: "Später" (dismiss) and "Ich hab bezahlt" (marks paid). Players self-mark payments via `POST /api/payments { periodId, paid }`; on `/bookings` each closed period has a toolbar with "Ich hab bezahlt" / "Zurücksetzen".
- **Loading states:** `home`, `bookings`, and `admin/dashboard` (drinks and billing tabs, including the member list) show a spinner (`LoadingState`) during the initial fetch instead of `0,00 €`/empty lists.
- **Shared `AppBar`** (`src/components/AppBar.tsx`): top bar with title + club logo on the left (the logo/title is clickable and routes to `/home`) and an account avatar with a dropdown menu on the right: Buchungen → `/bookings`, **Admin Console → `/admin/dashboard` (only shown when `/api/me` reports `isAdmin`)**, Konto verwalten → `/account`, Ausloggen. Used on `/home` (title "Kabinen-Bar"), `/bookings` (title "Buchungen", with back chevron), and the admin dashboard (`subtitle="Admin Console"`, so it reads "Kabinen-Bar · Admin Console" — the old admin badge + standalone logout button were removed in favour of this shared bar). The logo only shows on bars with the app name / no back arrow. Logout lives only in this menu now.
- **Player profile route renamed** `/profile` → `/bookings` (and API `/api/profile` folded into `GET /api/bookings`; POST on the same route still creates a booking).
- **First-visit welcome** (`/home`): on a player's very first visit a non-dismissable bottom sheet asks for their display name ("Damit ich weiß, wer du bist …"). Tracked via a nullable `players.onboarded_at` column — `GET /api/home` returns `firstVisit` (read-only), and submitting calls `PATCH /api/me { name, onboarded: true }` which sets `onboarded_at` once. New migration `20260624203129_add_onboarded_at` must be applied (`prisma migrate deploy`). The new column is read/written via raw SQL so it compiles before `prisma generate` runs.
- **Konto verwalten screen** (`/account`): bookings-style top bar (back chevron via `AppBar` `onBack`), edits the player display name. Verwerfen/Speichern are inert + greyed until the name differs from the saved value, then colour up; Speichern persists via `PATCH /api/me`. Hitting back with unsaved changes opens a confirm modal (Hier bleiben / Verlassen).
- **Club logo embedded** (`public/tsv-bobingen-logo.png`): shown in the `AppBar`, on the login screen, and as favicon/PWA icons (`favicon.ico`, `logo192.png`, `logo512.png`).
- TypeScript is clean (`npx tsc --noEmit`). The previously-known Chakra polymorphic-typing errors in `admin/dashboard/page.tsx` are fixed by using Chakra's typed `Input`/`Textarea`/`Image` components instead of `Box as="input"/"textarea"/"img"`.

## Backend

### Supabase Auth

Env variables in `.env.local` (and in Vercel → Settings → Environment Variables for deploys). **Names must match exactly** — the client/server/proxy read `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not `…_ANON_KEY`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   # Supabase → Project Settings → API (publishable/anon key)
```

Auth flow: from `/login` either Google OAuth or an email magic link (`signInWithOtp`, `emailRedirectTo` → `/auth/callback`). Both land on `/auth/callback`, which exchanges the code, upserts the `player` row (seeding the name from Google metadata or the email prefix on first login), reads `player.isAdmin`, then redirects to `/admin/dashboard` (admin) or `/home` (player). There is no separate admin login anymore.
Clients: `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (server/RSC).

### Prisma + PostgreSQL

```
DATABASE_URL=postgresql://...   # runtime: use the Supabase pooler URL (Supavisor, port 6543, ?pgbouncer=true) on serverless/Vercel
DIRECT_URL=postgresql://...     # direct connection (port 5432); used by prisma.config.ts for migrations only
```

Schema in `prisma/schema.prisma`. Adapter: `@prisma/adapter-pg`.
Tables: `players`, `drinks`, `billing_periods`, `bookings`, `payments`.
Migration already applied. Prices always as **integer cents**.
`prisma generate` runs in the `build` script + `postinstall` so the client exists at build time on Vercel.

### Deploying on Vercel

Set the four env vars above in Vercel (Production/Preview/Development), then redeploy. In Supabase → Authentication → URL Configuration, set the **Site URL** to the Vercel domain and add it to **Redirect URLs** (e.g. `https://<app>.vercel.app/**`) so Google OAuth + the email magic link redirect back to `/auth/callback`.

API route: `GET /api/me` → returns `{ id, name, isAdmin }` (Supabase user → Prisma player lookup). `PATCH /api/me { name }` renames the player. The app shows the **DB `player.name`** everywhere (AppBar avatar, bookings header, account screen) — the Google `user_metadata` name is only used by `auth/callback` to seed the player record on first login.
