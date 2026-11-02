<div align="center">

# Bench

**Describe the job. Get the shortlist.**

A two-sided freelancer marketplace where clients write a brief in plain language and get a ranked, filterable list of vetted people, and freelancers keep control over who can contact them.

![React](https://img.shields.io/badge/React-18-111?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-111?logo=typescript&logoColor=3178C6)
![Vite](https://img.shields.io/badge/Vite-8-111?logo=vite&logoColor=FFD62E)
![Tailwind](https://img.shields.io/badge/Tailwind-3-111?logo=tailwindcss&logoColor=38BDF8)
![Fastify](https://img.shields.io/badge/Fastify-5-111?logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-111?logo=postgresql&logoColor=4169E1)
![Tests](https://img.shields.io/badge/tests-unit%20%7C%20api%20%7C%20e2e-111)

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
| **Moderation** | Every profile is reviewed by an admin before it is public. Editing core details of a live profile returns it to review automatically, decided by the server rather than the UI. |
| **Connect and chat** | Rate-limited connect requests, accept / decline / block, realtime messaging with attachments and read state, and a gentle warning when someone tries to move the conversation off the platform. |
| **Trust** | Verified badges, one review per hire, a single freelancer reply, ratings and response time computed server-side. |
| **Hiring tools** | Multiple named shortlists with private notes and read-only share links, side-by-side compare, projects with proposals, saved searches with alerts. |
| **Honest signals** | A track record built from real requests and hires, a going-rate summary for what you searched, and a fit note on each request. |
| **No dead ends** | Declining asks for a reason and can recommend someone else. Requests with no reply close after five days and the client is told. |
| **Accessibility** | Native dialogs, real table semantics, visible focus, labelled controls, reduced-motion and forced-colours support, a command palette on Cmd/Ctrl + K, and an automated axe check. |

## Design principles

Bench is deliberately restrained: dark and monochrome, one accent colour used sparingly, no gradients, shadows or emoji, sentence case everywhere, and motion limited to three small interactions. AI is never labelled or surfaced as a feature; extracted criteria appear only as editable chips. A build-time audit (`npm run audit:ui`) fails on spacing, colour and effect rules that Tailwind would otherwise ignore silently.

## Architecture

```
 Browser (React, TanStack Query)
   |  fetch /api (cookie session)     |  WebSocket /api/ws
   v                                  v
 Fastify server (Node 22, TypeScript, zod)
   modules: auth, freelancers, connections, messaging, hires,
            projects, shortlists, moderation, files, ai
   |                         |
   v                         +-- Gemini (optional, with local fallbacks)
 PostgreSQL  <-- LISTEN/NOTIFY drives realtime events
   mail_outbox -> SMTP (console when unset)
```

- **Server-authoritative.** Roles, connect requests, hires, reviews, moderation, rate limits and account deletion are decided in `server/`, inside database transactions. Ratings and unread counts update in the same transaction as the write that changes them.
- **Graceful AI.** With no Gemini key the app still works: briefs are parsed locally, match lines are factual sentences, and review summaries fall back to plain text.
- **One search module.** `src/lib/search/` holds filtering, scoring and brief parsing as pure functions shared by the browser and the server (saved-search alerts), covered by unit tests.

## Quick start

Requirements: Node 22+ and a PostgreSQL 14+ database with the `citext` and `pg_trgm` extensions.

```bash
# once: a role and two databases (the second is only for API tests)
sudo -u postgres psql -c "CREATE ROLE bench LOGIN CREATEDB PASSWORD 'choose-one';"
sudo -u postgres createdb -O bench bench
sudo -u postgres createdb -O bench bench_test

npm install
npm --prefix server install --legacy-peer-deps
cp server/.env.example server/.env   # then put your DATABASE_URL in it

npm run migrate          # also runs automatically when the server starts
npm run seed             # demo accounts and data
npm run server           # terminal 1: API on :8787
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
| `npm test` | Frontend unit tests (search, parsing, completeness, formatting) |
| `npm run test:api` | API integration tests against `TEST_DATABASE_URL` |
| `npm run server` / `npm run server:start` | API with reload / API once |
| `npm run migrate` / `npm run seed` | Apply migrations / load demo data |
| `npm run e2e` | Playwright with axe accessibility checks (needs the API running and a seeded database; set `PW_CHANNEL=chrome` to use installed Chrome) |
| `npm run audit:ui` | Design-rule audit |

## Project layout

```
src/
  components/      ui primitives, layout shell, auth form
  features/        search, profile, shortlist, messaging, projects, admin, ...
  lib/             search engine, data modules, providers, formatting
server/src/       API: modules by domain, db, lib
server/migrations/ SQL migrations
server/tests/     API integration tests
e2e/               Playwright specs
docs/              launch checklist
```

## Going to production

Bench ships with everything needed to run locally, and nothing is deployed from this repository. Credentials you supply for a real launch (PostgreSQL, Gemini key, SMTP account, domain, Sentry DSN) are listed with their local fallbacks in [`docs/launch-checklist.md`](docs/launch-checklist.md). The privacy policy and terms are drafts and need legal review before launch.

## Status

Product requirements v1 and v1.1 are implemented. Live Gemini output quality, real SMTP delivery and production hosting are the parts that cannot be exercised without real credentials.

---

<div align="center">Built by <a href="https://github.com/Rishivardhan-J">Rishivardhan</a></div>
