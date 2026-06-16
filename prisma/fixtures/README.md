# Fixtures

Test/seed data extracted from the mock data previously hardcoded in
`src/app/home/page.tsx`, `src/app/profil/page.tsx`, and
`src/app/admin/dashboard/page.tsx`.

Field names match the Prisma client (camelCase), so a seed script can load
these directly via `prisma.<model>.create(...)`.

- `drinks.json` — `Drink` rows
- `players.json` — `Player` rows (note: `id` here is a placeholder; in
  production `Player.id` must match the Supabase `auth.users.id`)
- `billingPeriods.json` — `BillingPeriod` rows
- `bookings.json` — one row per player/drink/period combo, with a `quantity`
  field describing how many `Booking` rows to create (the real `Booking`
  model has no quantity column — a seed script should expand each entry into
  `quantity` individual rows)
- `payments.json` — `Payment` rows

Not wired into any seed script yet — these exist purely so the previous
mock-data shapes aren't lost once the UI switches to real Prisma queries.
