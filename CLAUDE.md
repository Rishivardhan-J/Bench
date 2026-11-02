# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bench is a two-sided freelancer marketplace: clients describe a job in plain language and get a ranked list; freelancers build moderated profiles. `Bench-PRD.pdf` at the repo root is the product spec. v1 and v1.1 are implemented: separate client/freelancer/admin roles, moderation, connect requests, realtime messaging, hires and reviews, notifications, projects and proposals, saved searches, analytics and resume parsing.

Stack: React 18, TypeScript, Vite, Tailwind 3, TanStack Query, React Router 7; a Fastify 5 + TypeScript API in `server/` on PostgreSQL (`pg`, hand-written SQL migrations, zod); Gemini. Nothing is deployed from this repo by default.

## Commands

```bash
npm install && npm --prefix server install --legacy-peer-deps   # two separate packages

npm run migrate    # apply server/migrations (also runs on server start)
npm run seed       # demo accounts and data (password: password123)
npm run server     # API on :8787 (tsx watch)
npm run dev        # Vite on :5173, proxies /api and the WebSocket
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run typecheck  # frontend and server
npm test           # vitest, frontend only
npm run test:api   # server integration tests against TEST_DATABASE_URL (real PostgreSQL)
npm run audit:ui   # fails on off-scale spacing, shadows, gradients, default palette colours
npm run e2e        # Playwright (needs the API running and a seeded DB)
```

Single test: `npx vitest run src/lib/search/search.test.ts` or `npx vitest run -t "name"`; for the API, run `npx vitest run <file>` inside `server/`.

### Local backend

The server needs `server/.env` (gitignored; copy `server/.env.example`) with `DATABASE_URL` and, for API tests, `TEST_DATABASE_URL` pointing at an empty throwaway database. `VITE_USE_LIVE_DATA=false` switches search and profiles to the bundled demo data with no backend at all; marketplace features need the server.

AI endpoints need `GEMINI_API_KEY` in `server/.env`. Without it they return `failed-precondition` and the client falls back to local behaviour. Without `SMTP_URL`, email is printed to the console (reset links appear there). Never stage `.env` files or go looking for credentials. What a deployer must supply is in `docs/launch-checklist.md`.

## Architecture

### Server-authoritative

Anything that matters is a route in `server/src/modules/` (`auth`, `freelancers`, `connections`, `messaging`, `hires`, `projects`, `shortlists`, `moderation`, `files`, `ai`), validated with zod. Ratings, unread counts and notifications are updated in the same transaction as the write that causes them.

- Auth is an opaque session token (sha256 stored in `sessions`) in an httpOnly `bench_session` cookie; passwords use scrypt. State-changing requests must come from an origin in `APP_ORIGINS` (CSRF defence). Roles live in `users.role`, admin is `users.is_admin` (`npm run admin:grant`).
- Moderation: `reviewStatus` is draft | pending | changes_requested | approved. `saveProfile` decides: editing a core field of a live profile returns it to pending; availability and paused stay live. Server-owned fields (`verified`, ratings, response time, completeness) are never client-writable.
- Errors are `{error:{code,message,details}}` with Firebase-style codes (`unauthenticated`, `permission-denied`, `failed-precondition`, ...); the client wraps them in `ApiRequestError`.
- Realtime: events are `pg_notify('bench_events', ...)` inside transactions, fanned out over `/api/ws`; the client invalidates TanStack queries by scope (`src/lib/data/live.ts`).
- Email goes to the `mail_outbox` table and is sent by an in-process job. Jobs live in `server/src/lib/jobs.ts` (mail flush, request expiry after 5 days, housekeeping).
- The server imports pure frontend code through the `@/` alias (`computeCompleteness`, `filterFreelancers`, `detectOffPlatform`).
- Ids are `text`, not uuid (seed ids like `f1`, `client1`).

### Search

`src/lib/search/` is one pure module (`filterFreelancers`, `scoreFreelancer`, `parseBrief`, `buildMatchLine`) shared by the demo and Firestore providers. `SearchPage` fetches the catalogue once (`['catalogue', isDemoMode()]`) and filters/ranks in memory. The brief is parsed locally on every keystroke; Gemini refines it after ~1.2s and its failure is silent. Filter state lives in the URL (`features/search/searchState.ts`). Extracted criteria show as removable chips, never as an AI label.

### Data layer

`FreelancerProvider` (`src/lib/providers/`) serves profile reads. Everything else is a small module in `src/lib/data/` (`messaging`, `profile`, `projects`, `notifications`) using `useLive` (`live.ts`) or the `api` fetch wrapper (`api.ts`). Auth is `AuthContext` (`role`, `isAdmin`, `openSignInModal({onSuccess})`; user is `{uid,email,name}`); shortlists are multi-list in `ShortlistContext`.

### Navigation and page loading

All routed pages are lazy chunks declared once in `src/components/layout/routes.ts` (`pages`, `pageForPath`, `prefetchRoute`); `App.tsx` and the nav both use it. A new page is added there and in the route table, and `routes.test.ts` fails if a nav target has no page. `usePrefetch` warms a destination's chunk and known query data on hover, focus or touch. `NavItems` renders the links with one sliding highlight (desktop and phone). `useRouteScroll` scrolls to top on page changes, restores position on Back, and ignores URL-only changes such as search filters. The header shows the last known role (`lib/roleCache.ts`) while auth resolves so links never swap.

## UI constraints

`tailwind.config.ts` **replaces** the spacing scale and keys are literal pixels: `p-16` is 16px. Valid keys: 0, 2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 44, 48, 56, 64, 80, 96, 120, 128, 160, 200, 256, 320. Anything else generates no CSS; `npm run audit:ui` catches it. Layout widths and grids are named tokens (`max-w-narrow`, `grid-cols-inbox`...); avoid arbitrary values. Use `text-text-dim` for meaningful text; `text-text-mute` (#666) fails contrast.

Design rules from the PRD: dark and monochrome with the palette unchanged; accent at most 2–3 times per screen; status is white, grey or hollow, never green/red/amber; no gradients, emoji or shadows other than the focus ring; sentence case; no visible AI labels; motion limited to a 120ms row hover, 150–200ms chip fade-in and a 0.97 button press; Inter for text, JetBrains Mono with tabular figures for numbers; one primary button per screen; every data view has loading, empty and error states (`components/ui/States.tsx`, `Skeleton.tsx`).

Accessibility patterns in use: native `<dialog>` (`ui/Dialog`), ARIA table roles with `aria-sort`, stretched links on rows, `aria-pressed` toggles, `useToast().announce` for live regions, focus moved to `#main-content` on navigation, Cmd/Ctrl+K command palette.

Feature code lives in `src/features/*`, primitives in `src/components/ui/`. Import through the `@/` alias.

## Commits

Conventional Commits with an optional scope, e.g. `feat(freelancer): ...`, `fix(ui): ...`.
