# Sesh 🍺

Drinks leaderboard for you and your mates. Log drinks in one tap, climb the board.

- **Groups** — private, join with a 6-character code or invite link
- **Leaderboard** — tonight / week / month / year / all time, ranked by drinks then units. "Tonight" rolls over at 6am in the group's timezone
- **Feed** — live-ish (refreshes every 20s) list of what everyone's having
- **Profiles** — totals, units, nights out, best night, drink-of-choice breakdown, history
- Drinks belong to the person, not the group — one night counts on every board you're in
- Installable to the home screen (PWA manifest)

## Stack

Next.js 16 (App Router, server actions) · Postgres (Neon on Vercel) · Drizzle ORM · Tailwind v4.
Auth is username + password (bcrypt) with DB-backed sessions in an httpOnly cookie.

## Local dev

```bash
cp .env.example .env.local   # point DATABASE_URL at a Postgres 14+
npm install
npm run db:migrate
npm run dev
```

## Schema changes

Edit `src/db/schema.ts`, then `npm run db:generate` and commit the new file in `drizzle/`.
`npm run build` runs pending migrations before `next build`, so every Vercel deploy migrates the DB first.

## Deploy (Vercel)

1. Import the repo in Vercel.
2. Project → **Storage** → **Create Database** → **Neon** → connect to the project (sets `DATABASE_URL`).
3. Deploy.

Drink responsibly.
