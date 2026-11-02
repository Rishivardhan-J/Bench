# Launch checklist

Everything below needs credentials or a real environment that the local build does not have. Local development needs only a PostgreSQL database (see the README), so nothing here blocks development.

## Credentials to supply

| Item | Where it goes | Local fallback |
|---|---|---|
| PostgreSQL role and databases | `DATABASE_URL` (and `TEST_DATABASE_URL` for `npm run test:api`) in `server/.env` | None: the server will not start without a database |
| Gemini API key | `server/.env` as `GEMINI_API_KEY` (optionally `GEMINI_MODEL`) | AI endpoints return `failed-precondition`; the client falls back to local brief parsing, a factual match line and a plain review summary |
| SMTP account | `SMTP_URL` and `MAIL_FROM` in `server/.env` | Emails are written to `mail_outbox` and printed to the server console. Password reset links appear there |
| Public URL and origins | `APP_URL`, `APP_ORIGINS` (comma separated), `TRUST_PROXY=true` behind a proxy, `COOKIE_SECURE=true` | localhost values |
| First admin | `npm run admin:grant -- <email> <password>` (use a separate email from any client or freelancer account) | `admin@bench.test` from `npm run seed` |
| Sentry DSN | `SENTRY_DSN` (server), `VITE_SENTRY_DSN` (client) | Sentry does not start |

## Hosting

- The API needs a host that runs a long-lived Node process (WebSockets and in-process jobs): a VPS, Fly.io, Railway, Render and so on. Vercel serverless cannot hold the realtime socket.
- Simplest layout: build the frontend (`npm run build`) and let the server serve `dist/` itself (it does this automatically when `dist/` exists), so cookies, the API and the socket share one origin over HTTPS.
- If the frontend is hosted separately, `/api` must still be proxied to the server on the same origin, or cookies and CSRF checks will not line up.
- Uploaded files live on local disk (`STORAGE_DIR`, default `server/.data/files`). Use a persistent volume and back it up. An S3-compatible driver is not implemented; the `Storage` interface in `server/src/lib/storage.ts` is where it would go.
- Run exactly one server instance for now. The jobs (mail flush, request expiry) are safe to repeat, but file storage is local.

## Before going live

- Use a managed PostgreSQL with backups; the server applies `server/migrations` on start.
- Confirm the Gemini model name is still current for your account.
- Have the privacy policy and terms reviewed by legal. They are drafts.
- Passwords use scrypt (Node built-in). Switch to argon2id if you prefer; the hash format is versioned in `server/src/lib/passwords.ts`.

## Intentionally not built

- Server-side search. The catalogue is ranked in the browser, as the PRD allows until the pool passes a few thousand profiles.
- Link-preview metadata for crawlers. Profile pages set title and description on the client only.
- CAPTCHA / App Check. Sign-up and sign-in are rate limited per IP and per email instead.

## Not verified locally

Live Gemini output quality, real SMTP delivery and production hosting. Everything else is exercised by `npm run test:api` and `npm run e2e` against a real PostgreSQL.
