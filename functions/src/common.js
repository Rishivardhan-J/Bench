const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { HttpsError } = require("firebase-functions/v2/https");

if (getApps().length === 0) {
  const projectId = process.env.GCLOUD_PROJECT || "demo-bench";
  initializeApp({ storageBucket: process.env.STORAGE_BUCKET || `${projectId}.appspot.com` });
}

// firebase-admin v14 is modular-only; this keeps call sites terse.
const admin = {
  auth: () => getAuth(),
  storage: () => getStorage(),
  firestore: Object.assign(() => getFirestore(), { FieldValue }),
};

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

// Sentry is optional: it only starts when a DSN is configured.
let Sentry = null;
if (process.env.SENTRY_DSN) {
  Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.2,
    beforeSend(event) {
      // PII scrub: never ship brief, message or resume text.
      for (const key of ["rawBrief", "brief", "text", "message", "resumeText"]) {
        if (event.extra && event.extra[key]) event.extra[key] = "[SCRUBBED]";
      }
      if (event.request) delete event.request.data;
      return event;
    },
  });
}

function report(error, extra) {
  console.error(error);
  if (Sentry) Sentry.captureException(error, extra ? { extra } : undefined);
}

// App Check is enforced everywhere except the local emulator.
const callableOpts = {
  maxInstances: 10,
  enforceAppCheck: !isEmulator && process.env.ENFORCE_APP_CHECK !== "false",
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function clientIp(request) {
  return request.rawRequest?.ip || request.rawRequest?.headers?.["x-forwarded-for"] || "unknown";
}

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Please sign in to continue.");
  return request.auth.uid;
}

async function getRole(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? snap.data().role : null;
}

async function requireRole(request, role) {
  const uid = requireAuth(request);
  const actual = await getRole(uid);
  if (actual !== role) throw new HttpsError("permission-denied", `This action is only available to ${role} accounts.`);
  return uid;
}

function requireAdmin(request) {
  const uid = requireAuth(request);
  if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "Admin access required.");
  return uid;
}

/**
 * Fixed-window rate limit stored in Firestore (server-only collection).
 * Fails open on storage errors so a database blip does not take the product down.
 */
async function enforceRateLimit(bucket, identifier, max, windowMs, message) {
  const safe = String(identifier || "unknown").replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 100);
  const ref = db.collection("rate_limits").doc(`${bucket}:${safe}`);
  let allowed = true;
  try {
    allowed = await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      const now = Date.now();
      if (!doc.exists || now > doc.data().resetAt) {
        t.set(ref, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (doc.data().count >= max) return false;
      t.update(ref, { count: admin.firestore.FieldValue.increment(1) });
      return true;
    });
  } catch (error) {
    report(error);
    return;
  }
  if (!allowed) {
    throw new HttpsError("resource-exhausted", message || "You've hit the limit for now. Try again in a bit.");
  }
}

function cleanText(value, max, field = "Text") {
  if (typeof value !== "string") throw new HttpsError("invalid-argument", `${field} is required.`);
  const trimmed = value.replace(/\u0000/g, "").trim();
  if (!trimmed) throw new HttpsError("invalid-argument", `${field} is required.`);
  if (trimmed.length > max) throw new HttpsError("invalid-argument", `${field} must be ${max} characters or fewer.`);
  return trimmed;
}

function contentGuard(text) {
  if (/^(.)\1+$/.test(text.trim())) throw new HttpsError("invalid-argument", "That text doesn't look valid.");
  if (!/\s/.test(text.trim())) throw new HttpsError("invalid-argument", "Please write a sentence or two.");
}

function firstNameInitial(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Client";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

module.exports = {
  admin,
  db,
  HttpsError,
  isEmulator,
  report,
  callableOpts,
  HOUR,
  DAY,
  clientIp,
  requireAuth,
  requireRole,
  requireAdmin,
  getRole,
  enforceRateLimit,
  cleanText,
  contentGuard,
  firstNameInitial,
};
