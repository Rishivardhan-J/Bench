# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bench is a two-sided freelancer marketplace: clients describe a job in plain language and get a ranked list; freelancers build moderated profiles. `Bench-PRD.pdf` at the repo root is the product spec. v1 and v1.1 are implemented: separate client/freelancer/admin roles, moderation, connect requests, realtime messaging, hires and reviews, notifications, projects and proposals, saved searches, analytics and resume parsing.

Stack: React 18, TypeScript, Vite, Tailwind 3, TanStack Query, React Router 7, Firebase (Auth, Firestore, Storage, Functions), Gemini. Frontend deploys to Vercel, backend to Firebase. Nothing is deployed from this repo by default.

## Commands

```bash
npm install && npm --prefix functions install   # two separate packages

npm run emulators  # Auth 9099, Firestore 8080, Functions 5001, Storage 9199, UI 4000 (needs Java)
npm run seed       # demo accounts and data into the running emulators (password: password123)
npm run dev        # Vite on :5173
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run typecheck
npm test           # vitest, once
npm run test:rules # Firestore/Storage rules tests inside the emulators
npm run audit:ui   # fails on off-scale spacing, shadows, gradients, default palette colours
npm run e2e        # Playwright
```

Single test: `npx vitest run src/lib/search/search.test.ts` or `npx vitest run -t "name"`.

### Local backend

In dev the client connects to the emulators (hosts/ports in `src/lib/firebase.ts`) with the `demo-bench` project, so no real service is touched and no `.env` is needed. Set `VITE_USE_EMULATORS=false` to opt out. `VITE_USE_LIVE_DATA=false` switches search and profiles to the bundled demo data with no backend at all; marketplace features need the emulators.

AI callables need `GEMINI_API_KEY` in `functions/.env` (gitignored). Without it they throw `failed-precondition` and the client falls back to local behaviour. Never stage `.env` files. Credentials a deployer must supply are listed in `docs/launch-checklist.md`.

## Architecture

### Server-authoritative

Anything that matters goes through callables in `functions/src/` (`accounts`, `connections`, `hires`, `moderation`, `ai-callables`) re-exported by `functions/index.js`; Firestore rules (`firestore.rules`) only allow owner-safe writes.

- `users/{uid}.role` is written only by `initAccount`. Admin is the custom claim `admin: true`.
- Moderation: `reviewStatus` is draft | pending | changes_requested | approved. An owner may edit core fields only while `approved == false` and may only set `reviewStatus` to draft or pending. Server-owned fields (`verified`, ratings, response time, completeness) are never client-writable.
- Triggers in `functions/src/triggers.js` maintain unread counts, ratings, response-time stats, completeness, notifications and saved-search alerts.
- `functions/src/common.js` is the shared base: modular `firebase-admin` v14 (no namespaced default export), `enforceRateLimit`, `requireAuth/Role/Admin`, `contentGuard`. Email is written to a `mail` collection in the Trigger Email extension format.

### Search

`src/lib/search/` is one pure module (`filterFreelancers`, `scoreFreelancer`, `parseBrief`, `buildMatchLine`) shared by the demo and Firestore providers. `SearchPage` fetches the catalogue once (`['catalogue', isDemoMode()]`) and filters/ranks in memory. The brief is parsed locally on every keystroke; Gemini refines it after ~1.2s and its failure is silent. Filter state lives in the URL (`features/search/searchState.ts`). Extracted criteria show as removable chips, never as an AI label.

### Data layer

`FreelancerProvider` (`src/lib/providers/`) serves profile reads. Everything else is a small module in `src/lib/data/` (`messaging`, `profile`, `projects`, `notifications`) using realtime listeners (`live.ts`) or callables (`api.ts`). Auth is `AuthContext` (`role`, `isAdmin`, `openSignInModal({onSuccess})`); shortlists are multi-list in `ShortlistContext`.

## UI constraints

`tailwind.config.ts` **replaces** the spacing scale and keys are literal pixels: `p-16` is 16px. Valid keys: 0, 2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 44, 48, 56, 64, 80, 96, 120, 128, 160, 200, 256, 320. Anything else generates no CSS; `npm run audit:ui` catches it. Layout widths and grids are named tokens (`max-w-narrow`, `grid-cols-inbox`...); avoid arbitrary values. Use `text-text-dim` for meaningful text; `text-text-mute` (#666) fails contrast.

Design rules from the PRD: dark and monochrome with the palette unchanged; accent at most 2–3 times per screen; status is white, grey or hollow, never green/red/amber; no gradients, emoji or shadows other than the focus ring; sentence case; no visible AI labels; motion limited to a 120ms row hover, 150–200ms chip fade-in and a 0.97 button press; Inter for text, JetBrains Mono with tabular figures for numbers; one primary button per screen; every data view has loading, empty and error states (`components/ui/States.tsx`, `Skeleton.tsx`).

Accessibility patterns in use: native `<dialog>` (`ui/Dialog`), ARIA table roles with `aria-sort`, stretched links on rows, `aria-pressed` toggles, `useToast().announce` for live regions, focus moved to `#main-content` on navigation, Cmd/Ctrl+K command palette.

Feature code lives in `src/features/*`, primitives in `src/components/ui/`. Import through the `@/` alias.

## Commits

Conventional Commits with an optional scope, e.g. `feat(freelancer): ...`, `fix(ui): ...`.
