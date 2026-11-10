# Cursus

Rank the Duke courses you've taken, Beli-style, and see what your friends thought.
Next.js (App Router) + Postgres, deployed on [Floo](https://getfloo.com).

## How it works

- **Sign-in**: [Floo User accounts](https://getfloo.com/docs/guides/user-accounts).
  Floo runs the sign-in service (Better Auth) at `/api/auth` on our own domain and
  stores users in the `floo_auth` schema of our Postgres. Cursus renders its own
  pages (`src/app/auth`) with the `better-auth` client; on the server,
  `src/lib/session.ts` asks Floo for the session and `src/proxy.ts` keeps the app
  behind sign-in. `src/lib/auth.ts` maps a verified email to a Cursus user. Only
  `@duke.edu` addresses can sign up (`allowed_email_domains`), and only they (plus
  `ADMIN_EMAILS`, for testing) get past `/duke-only`.
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
migrations, and runs `next dev` on http://localhost:3000. With no sign-in service
locally, you're signed in as `DEV_USER_EMAIL` (default `dev@duke.edu`); change it
to act as someone else. Delete `.pglite/` to reset the database.

## Deploy to Floo

`floo.app.toml` defines one web service + managed Postgres with User accounts.
Migrations run automatically on each deploy (`node db/migrate.mjs`).

1. Push this repo to GitHub and connect it: `floo apps github connect`.
2. Pushes to `main` deploy to dev; a GitHub release promotes to prod.

Dev and prod have separate users, so an account made on dev won't work on prod.
Sign-in is email and password only. Google sign-in was removed when Floo took
over sign-in; accounts that only used Google set a password with "Forgot
password". Adding a provider back needs our own OAuth client (see the Floo guide).

To try sign-in without a mailbox, use a throwaway Floo app whose
`allowed_email_domains` also lists `test.getfloo.app`: any `@test.getfloo.app`
address verifies there with the code `000000`.

## Course catalog

`db/migrations/002_sample_courses.sql` seeds ~65 sample courses. To load the real
catalog, get a token at https://streamer.oit.duke.edu and run:

```bash
DUKE_API_TOKEN=... DATABASE_URL=... npm run import:courses -- ECON   # one subject first
DUKE_API_TOKEN=... DATABASE_URL=... npm run import:courses           # everything
```
