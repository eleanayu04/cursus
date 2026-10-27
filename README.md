# Cursus

Rank the Duke courses you've taken, Beli-style, and see what your friends thought.
Next.js (App Router) + Postgres, deployed on [Floo](https://getfloo.com).

## How it works

- **Sign-in**: Floo accounts mode. Floo's gateway signs people in (invite-only)
  and passes `X-Floo-User-*` headers; `src/lib/auth.ts` maps them to a Cursus
  user. Only `@duke.edu` accounts get in, plus app admins for testing.
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
migrations, and runs `next dev` on http://localhost:3000. With no Floo gateway
locally, you're signed in as `DEV_USER_EMAIL` (default `dev@duke.edu`); send an
`X-Floo-User-Email` header to act as someone else. Delete `.pglite/` to reset
the database.

## Deploy to Floo

`floo.app.toml` defines one web service + managed Postgres in accounts mode.
Migrations run automatically on each deploy (`node db/migrate.mjs`).

1. Push this repo to GitHub and connect it: `floo apps github connect`.
2. Invite users (accounts mode is invite-only):
   `floo apps invite someone@duke.edu --role member --app cursus`
3. Pushes to `main` deploy to dev; a GitHub release promotes to prod.

## Course catalog

`db/migrations/002_sample_courses.sql` seeds ~65 sample courses. To load the real
catalog, get a token at https://streamer.oit.duke.edu and run:

```bash
DUKE_API_TOKEN=... DATABASE_URL=... npm run import:courses -- ECON   # one subject first
DUKE_API_TOKEN=... DATABASE_URL=... npm run import:courses           # everything
```
