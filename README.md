# Cursus

Rank the Duke courses you've taken, Beli-style, and see what your friends thought.
Next.js (App Router) + Postgres, deployed on [Floo](https://getfloo.com).

## How it works

- **Sign-in**: `@duke.edu` email + 6-digit code (`src/lib/auth.ts`). Sessions are
  random tokens in an httpOnly cookie, hashed in the `sessions` table.
- **Rating**: pick Liked / Fine / Disliked, add optional notes, then answer
  head-to-head comparisons against your other courses in that bucket (binary
  insertion, `src/lib/rating.ts`). Scores are spread evenly across the bucket's
  range — Disliked 0–3.3, Fine 3.4–6.7, Liked 6.8–10 — and recomputed on every
  insert (`rescore_bucket` in `db/migrations/001_init.sql`).
- **Unlocking**: scores are hidden, and excluded from campus averages, until a user
  has rated 4 courses.
- **Privacy**: all access rules live in `src/lib/queries.ts`. Friends always see
  your score; notes are public-anonymous, friends-only, or private per rating.
  Public notes from non-friends are returned with no identity at all.

## Run locally

```bash
npm install
npm run dev:local
```

`dev:local` starts an embedded Postgres (PGlite, stored in `.pglite/`), applies
migrations, and runs `next dev` on http://localhost:3000. Login codes are printed
in the terminal instead of emailed. Delete `.pglite/` to reset the database.

## Deploy to Floo

`floo.app.toml` defines one web service + managed Postgres. Migrations run
automatically on each deploy (`node db/migrate.mjs`), and a nightly cron cleans
up expired sessions.

1. Push this repo to GitHub and connect it: `floo apps github connect`.
2. Set secrets:
   - `AUTH_SECRET` (required): `openssl rand -base64 32 | floo env set AUTH_SECRET --stdin`
   - Email (Floo has no email service): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
     `SMTP_PASS`, optionally `EMAIL_FROM`. Any SMTP provider works, e.g. Gmail with
     an app password. Without SMTP, set `LOG_LOGIN_CODES=1` and read codes from
     `floo logs`.
3. Pushes to `main` deploy to dev; a GitHub release promotes to prod.

## Course catalog

`db/migrations/002_sample_courses.sql` seeds ~65 sample courses. To load the real
catalog, get a token at https://streamer.oit.duke.edu and run:

```bash
DUKE_API_TOKEN=... DATABASE_URL=... npm run import:courses -- ECON   # one subject first
DUKE_API_TOKEN=... DATABASE_URL=... npm run import:courses           # everything
```
