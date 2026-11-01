<div align="center">

# Bench

**Describe the job. Get the shortlist.**

A two-sided freelancer marketplace where clients write a brief in plain language and get a ranked, filterable list of vetted people, and freelancers keep control over who can contact them.

![React](https://img.shields.io/badge/React-18-111?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-111?logo=typescript&logoColor=3178C6)
![Vite](https://img.shields.io/badge/Vite-8-111?logo=vite&logoColor=FFD62E)
![Tailwind](https://img.shields.io/badge/Tailwind-3-111?logo=tailwindcss&logoColor=38BDF8)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Functions-111?logo=firebase&logoColor=FFCA28)
![Tests](https://img.shields.io/badge/tests-unit%20%7C%20rules%20%7C%20e2e-111)

</div>

---

## Why Bench

Hiring a freelancer usually means scrolling through hundreds of profiles and filtering by hand. Bench turns that around:

- **Clients** type a sentence such as *"Senior React developer under $100/hr who can start in two weeks"*. Skills, budget and seniority become filters they can see and remove. No chatbot, no mystery scores.
- **Freelancers** build a profile once, get it reviewed by a human, and decide which requests to accept. Nobody can message them until they say yes.
- **Everyone** gets a quiet, fast, keyboard-friendly interface designed to stay out of the way.

## Highlights

| Area | What you get |
|---|---|
| **Search** | Sentence search parsed locally as you type, optionally refined by Gemini. Filters live in the URL, so any search can be shared or bookmarked. Ranking blends skill overlap, rate fit, availability, profile completeness and rating. |
| **Profiles** | Multi-step builder with autosaved drafts, resume upload that suggests (never auto-applies) fields, portfolio gallery, experience, education, and a completeness meter. |
| **Moderation** | Every profile is reviewed by an admin before it is public. Editing core details of a live profile returns it to review automatically, enforced by Firestore rules rather than the UI. |
| **Connect and chat** | Rate-limited connect requests, accept / decline / block, realtime messaging with attachments and read state, and a gentle warning when someone tries to move the conversation off the platform. |
| **Trust** | Verified badges, one review per hire, a single freelancer reply, ratings and response time computed server-side. |
| **Hiring tools** | Multiple named shortlists with private notes, side-by-side compare, projects with proposals, saved searches with alerts. |
| **Accessibility** | Native dialogs, real table semantics, visible focus, labelled controls, reduced-motion and forced-colours support, a command palette on Cmd/Ctrl + K, and an automated axe check. |

## Design principles

Bench is deliberately restrained: dark and monochrome, one accent colour used sparingly, no gradients, shadows or emoji, sentence case everywhere, and motion limited to three small interactions. AI is never labelled or surfaced as a feature; extracted criteria appear only as editable chips. A build-time audit (`npm run audit:ui`) fails on spacing, colour and effect rules that Tailwind would otherwise ignore silently.

## Architecture

```
 Browser (React, TanStack Query)
   |  realtime listeners          |  callable functions
   v                              v
 Firestore  <--- rules --->  Cloud Functions (Node 22)
 (owner-safe writes only)     accounts, connections, hires,
                              moderation, AI, triggers
   ^                              |
   +-- Auth custom claims (admin) +-- Gemini (optional, with local fallbacks)
```

- **Server-authoritative.** Roles, connect requests, hires, reviews, moderation decisions and account deletion all go through callables. Firestore rules permit only owner-safe writes.
- **Graceful AI.** With no Gemini key the app still works: briefs are parsed locally, match lines are factual sentences, and review summaries fall back to plain text.
- **One search module.** `src/lib/search/` holds filtering, scoring and brief parsing as pure functions shared by every data provider and covered by unit tests.
- **Emulator-first.** Development runs against the Firebase emulators with a `demo-` project, so no real service is ever touched.

## Quick start

Requirements: Node 22+, Java 21+ (for the Firestore emulator).

```bash
npm install
npm --prefix functions install

npm run emulators        # terminal 1: Auth, Firestore, Functions, Storage, UI
npm run seed             # terminal 2: demo accounts and data
npm run dev              # terminal 2: http://localhost:5173
```

Seeded accounts share the password `password123`:

| Account | Role |
|---|---|
| `client@bench.test` | Client with a conversation, a pending request and a project |
| `alex.rivera@bench.test` | Freelancer with an accepted conversation |
| `pending@bench.test` | Freelancer waiting for review |
| `admin@bench.test` | Admin |

No backend at all? Set `VITE_USE_LIVE_DATA=false` to browse bundled demo profiles.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm test` | Unit tests (search, parsing, completeness parity, formatting) |
| `npm run test:rules` | Firestore rules tests inside the emulator |
| `npm run e2e` | Playwright with axe accessibility checks (needs emulators and seed; set `PW_CHANNEL=chrome` to use installed Chrome) |
| `npm run audit:ui` | Design-rule audit |

## Project layout

```
src/
  components/      ui primitives, layout shell, auth form
  features/        search, profile, shortlist, messaging, projects, admin, ...
  lib/             search engine, data modules, providers, formatting
functions/src/     callables and triggers by domain
tests/             Firestore rules tests
e2e/               Playwright specs
docs/              launch checklist
```

## Going to production

Bench ships with everything needed to run locally, and nothing is deployed from this repository. Credentials you supply for a real launch (Firebase project, Gemini key, App Check key, Sentry DSN, email provider) are listed with their local fallbacks in [`docs/launch-checklist.md`](docs/launch-checklist.md). The privacy policy and terms are drafts and need legal review before launch.

## Status

Product requirements v1 and v1.1 are implemented. Live Gemini output quality, real email delivery and App Check enforcement are the parts that cannot be exercised without real credentials.

---

<div align="center">Built by <a href="https://github.com/Rishivardhan-J">Rishivardhan</a></div>
