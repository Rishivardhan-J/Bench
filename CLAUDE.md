# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bench is a two-sided freelancer marketplace: clients describe a job in plain language and get a ranked shortlist; freelancers build moderated profiles. `Bench-PRD.pdf` at the repo root is the product spec (features by priority, Firestore data model, security rules, design system, v1 acceptance criteria). The app implements only part of it. Connect requests, messaging, notifications, hires and reviews, resume upload, and client/freelancer role separation are not built yet.

Stack: React 18, TypeScript, Vite, Tailwind 3, TanStack Query, React Router 7, Firebase (Auth, Firestore, Storage, Functions), Gemini. Frontend deploys to Vercel, backend to Firebase.

## Commands

```bash
npm install && npm --prefix functions install   # two separate packages

npm run dev        # Vite on :5173
npm run build      # tsc -b && vite build
npm run lint       # oxlint

npx vitest                                         # unit tests, watch mode
npx vitest run                                     # unit tests, once
npx vitest run src/lib/providers/demo-data.test.ts # single file
npx vitest run -t "test name"                      # single test by name

npx playwright test                                # e2e; starts the dev server itself
npx playwright test e2e/shortlist.spec.ts          # single spec
```

There is no `npm test` script, despite what the README says; call Vitest directly. Unit tests sit next to their source as `*.test.ts(x)`. Vitest uses jsdom and globals, and excludes `e2e/` and `functions/`. The Cloud Functions have no tests.

### Local backend

`import.meta.env.DEV` unconditionally connects the client to the Firebase emulators, with ports hardcoded in `src/lib/firebase.ts`: Functions 5001, Auth 9099, Firestore 8080, Storage 9199. Without emulators, `npm run dev` still renders search from demo data, but auth, shortlists, and AI calls fail. The Playwright spec's final assertion needs the Auth emulator.

Start the emulators with `firebase emulators:start` (requires a global `firebase-tools`). `firebase.json` has no `emulators` block and references a `firestore.indexes.json` that does not exist, so startup may need those fixed first.

AI functions need `GEMINI_API_KEY` in `functions/.env`. **`.gitignore` does not cover `.env` or `functions/.env`** (only `*.local`), so never stage them.

## Architecture

### Data access: the provider seam

Freelancer reads go through the `FreelancerProvider` interface (`src/lib/providers/freelancer-provider.ts`), selected by `getProvider()` in `src/lib/providers/index.ts`:

- `DemoFreelancerProvider` is the default: in-memory data with a simulated 500ms delay.
- `FirestoreFreelancerProvider` is used when `VITE_USE_LIVE_DATA=true` (not listed in `.env.example`). It only returns `approved` profiles.

Consumers call `getProvider()` once at module scope, and server state goes through TanStack Query. Both providers contain the same filter logic in `search()`, so a filter change must be made in both. Filtering and sorting are in-memory: Firestore fetches all approved profiles, and `SearchPage` does the sorting.

Everything else talks to Firestore directly and bypasses the provider: shortlists (`ShortlistContext`, a realtime `onSnapshot` on `users/{uid}/shortlists/{freelancerId}` with optimistic toggles) and profile writes (`FreelancerProfilePage`, plus the initial doc in `FreelancerLandingPage` on sign-up). Saving a profile always resets `approved: false`; nothing in the codebase ever sets it to `true`, so approval currently happens by hand in the Firebase console.

### AI flow

The browser never touches Gemini. All three calls are `onCall` functions in `functions/index.js` (CommonJS, Node 18), wrapped by `src/lib/services/ai-service.ts`, with shared types in `src/types/index.ts`. A new AI call touches all three.

- `extractBrief` runs in `SearchPage.handleGenerateShortlist`: brief → skills and budget band → filter state.
- `generateMatchReasoning` then runs on the filtered candidates, and its result drives the relevance sort.
- `summarizeReviews` runs on the freelancer detail page.

Budget bands are defined twice and must stay in sync: in the `extractBrief` prompt and in the rate mapping in `SearchPage`.

Only `extractBrief` has the 2000-character cap, content guard, untrusted-input prompt preamble, and rate limit (10/hour, Firestore `rate_limits` collection, server-only). Despite the README, the other two callables are not rate limited. All three set `enforceAppCheck: true`.

### Auth

`AuthContext` wraps Firebase email/password auth. `openSignInModal(pendingAction)` queues an action that runs after sign-in, which is how signed-out users shortlisting someone get interrupted and resumed. Sign-up lives in two places: `SignInModal` (clients) and `FreelancerLandingPage` (freelancers, also creates the profile doc). Map auth errors through `getAuthErrorMessage` in `src/lib/utils/error.ts`.

### Differences from the PRD

Check these before relying on the PRD's data model:

- `firestore.rules` lets owners write their whole profile, including `approved` and `verified`, which the PRD forbids. A client-side `approved: false` is not a security control.
- Shortlists are `users/{uid}/shortlists/{freelancerId}`, one flat list per user. The PRD specifies named lists.
- The profile field is `role`, where the PRD says `headline`. "Role" in the PRD means client/freelancer, which isn't stored anywhere yet.

### Placeholders

These must be replaced for production: the Sentry DSN (`src/main.tsx`, `functions/index.js`), the reCAPTCHA site key (`src/lib/firebase.ts`), and the project ID (`.firebaserc`). With App Check enforced, the dummy site key will block callables in production.

## UI constraints

`tailwind.config.ts` **replaces** the spacing scale rather than extending it, and keys are literal pixels: `p-16` is 16px and `w-32` is 32px. Only 0, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 128, and 256 exist. Anything else, including stock Tailwind values like `p-6`, silently generates no CSS. Default Tailwind class sizes from memory will be wrong.

From the PRD's design system, which says new screens add no new tokens:

- Dark and monochrome. Use theme tokens (`bg`, `surface-*`, `border*`, `text*`, `accent*`) and type tokens (`text-body`, `text-meta`, `text-micro-label`, `text-section-heading`, `text-hero`). Prefer tokens over arbitrary values, though some exist in current code.
- The accent colour appears at most three times per screen. Status is white, grey, or hollow, never green, red, or amber.
- No gradients, emoji, or shadows other than the neutral focus ring. Sentence case everywhere. One primary button per screen.
- Inter for interface text, JetBrains Mono with tabular figures for numbers.
- Motion is limited to a 120ms row hover, a 150–200ms chip fade-in, and a 0.97 button press.
- Every data view needs loading, empty, and error states (`src/components/ui/States.tsx`, `Skeleton.tsx`), plus visible focus and labelled icon buttons.

AI must stay invisible to users: no AI badges, confidence scores, or chat interfaces. Extracted criteria appear only as editable filter chips.

`src/components/ui/` holds presentational primitives with no business logic. Feature code lives in `src/features/{search,shortlist,freelancer}/`. Import through the `@/` alias for `src/`.

## Commits

Conventional Commits with an optional scope, e.g. `feat(freelancer): ...`, `fix(ui): ...`.
