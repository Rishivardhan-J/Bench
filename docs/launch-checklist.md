# Launch checklist

Everything below needs credentials or a real environment that the local build does not have. Local development runs entirely against the Firebase emulators with the `demo-bench` project, so nothing here blocks development.

## Credentials to supply

| Item | Where it goes | Local fallback |
|---|---|---|
| Firebase project | `.firebaserc`, `VITE_FIREBASE_*` in Vercel | `demo-bench` plus emulators |
| Gemini API key | `functions/.env` as `GEMINI_API_KEY` (optionally `GEMINI_MODEL`) | AI callables return `failed-precondition`; the client falls back to local brief parsing, a factual match line and a plain review summary |
| reCAPTCHA v3 site key | `VITE_RECAPTCHA_SITE_KEY`, then enforce App Check on the callables | App Check is off in the emulator |
| Sentry DSN | `VITE_SENTRY_DSN` and `SENTRY_DSN` | Sentry does not start |
| Email provider | Install the Firebase Trigger Email extension; it reads the `mail` collection the functions already write | Mail documents are written but never sent |
| Admin account | `auth.setCustomUserClaims(uid, { admin: true })` for each admin | `admin@bench.test` from `npm run seed` |

## Before going live

- Deploy `firestore.rules`, `firestore.indexes.json`, `storage.rules` and the functions.
- Confirm the Gemini model name is still current for your account.
- Have the privacy policy and terms reviewed by legal. They are drafts.
- Add a scheduled function or alert for saved-search emails if you want them to run on a timer (the current alert fires when a profile goes live).

## Intentionally not built

- Blocking sign-up in a `beforeUserCreated` function. It needs Identity Platform; sign-up is rate limited per IP in `initAccount` instead.
- Link-preview metadata for crawlers via a Vercel function. Profile pages set title and description on the client only, so social previews will not show profile details.

## Not verified locally

Live Gemini output quality, real email delivery, App Check in production and crawler previews. Everything else is exercised against the emulators.
