@AGENTS.md

# Kabinen-Bar Drink Tracker

## Projekt-Überblick

Next.js 16 App Router App für die Kabinen-Bar des TSV Bobingen. Zwei Nutzergruppen: Spieler (buchen Getränke, sehen Schulden) und Admin (verwaltet Getränke, Abrechnungsperioden, markiert Zahlungen).

## Wichtige Konventionen

- **Kein Tailwind.** Styles als `React.CSSProperties`-Objekte (inline styles), benannt als `s` oder `styles` am Ende der Datei.
- **Dark-only.** Kein Light-Mode, kein `useColorMode`. `config.initialColorMode = 'dark'`, `useSystemColorMode = false`.
- **Geldbeträge immer in Cents (Integer).** Für Anzeige `formatCents()` aus `src/types/index.ts` verwenden → `1,50 €`.
- **Deutsch durchgehend.** Alle Labels, Fehlermeldungen, UI-Copy auf Deutsch.
- **Chakra UI v3** — API unterscheidet sich von v2. Theme via `createSystem` + `defineConfig`, Provider via `<ChakraProvider value={system}>`.

## Struktur

```
src/
├── app/
│   ├── login/             # Name-Auswahl (Player)
│   ├── home/              # Drink-Logging (Player)
│   ├── profil/            # Verlauf + Ausloggen (Player)
│   ├── admin/             # Admin-Bereich (Steel #6478a0)
│   │   ├── login/
│   │   └── dashboard/
│   ├── layout.tsx         # Root Layout mit Inter Font + Chakra Provider
│   ├── page.tsx           # Redirect → /login
│   └── globals.css
├── components/ui/
│   └── provider.tsx       # Chakra ChakraProvider wrapper
├── lib/
│   ├── theme.ts           # Design-Tokens (Farben, Radien, Shadows)
│   └── supabase/
│       ├── client.ts      # Browser-Client (createBrowserClient)
│       └── server.ts      # Server-Client (createServerClient + cookies)
└── types/index.ts         # DB-Typen + formatCents()
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

- Alle 5 Screens implementiert mit Mock-Daten
- Noch kein echtes Supabase-Backend angebunden
- Noch kein Billing Modal (erscheint wenn Abrechnungsperiode endet)
- TSV Bobingen Logo noch nicht eingebunden (liegt in Design-Assets)

## Supabase

Env-Variablen in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Noch kein DB-Schema angelegt. Geplante Tabellen: `players`, `drinks`, `billing_periods`, `bookings`, `payments`.
