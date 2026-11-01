const { onCall } = require("firebase-functions/v2/https");
const crypto = require("crypto");
const { admin, db, HttpsError, callableOpts, clientIp, requireAdmin, enforceRateLimit, cleanText, HOUR } = require("./common");

const FieldValue = admin.firestore.FieldValue;

exports.reviewProfile = onCall(callableOpts, async (request) => {
  requireAdmin(request);
  const uid = cleanText(request.data?.uid, 128, "uid");
  const decision = request.data?.decision;
  const ref = db.doc(`freelancerProfiles/${uid}`);
  if (!(await ref.get()).exists) throw new HttpsError("not-found", "Profile not found.");

  if (decision === "approve") {
    await ref.update({ approved: true, reviewStatus: "approved", reviewNote: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
  } else if (decision === "request_changes") {
    const note = cleanText(request.data?.note, 500, "A reason");
    await ref.update({ approved: false, reviewStatus: "changes_requested", reviewNote: note, updatedAt: FieldValue.serverTimestamp() });
  } else {
    throw new HttpsError("invalid-argument", "Unknown decision.");
  }
  return { ok: true };
});

exports.setVerified = onCall(callableOpts, async (request) => {
  requireAdmin(request);
  const uid = cleanText(request.data?.uid, 128, "uid");
  await db.doc(`freelancerProfiles/${uid}`).update({ verified: request.data?.verified === true });
  return { ok: true };
});

exports.resolveReport = onCall(callableOpts, async (request) => {
  requireAdmin(request);
  const reportId = cleanText(request.data?.reportId, 128, "reportId");
  const ref = db.doc(`reports/${reportId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Report not found.");

  if (request.data?.suspend === true && snap.data().targetType === "profile") {
    await db.doc(`freelancerProfiles/${snap.data().targetId}`).update({
      approved: false,
      reviewStatus: "changes_requested",
      reviewNote: "This profile was removed from search after a report. Contact support to discuss.",
    });
  }
  await ref.update({ status: "resolved", resolvedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

exports.lookupUser = onCall(callableOpts, async (request) => {
  requireAdmin(request);
  const email = cleanText(request.data?.email, 200, "Email").toLowerCase();
  const user = await admin.auth().getUserByEmail(email).catch(() => null);
  if (!user) throw new HttpsError("not-found", "No account with that email.");
  const [role, profile] = await Promise.all([db.doc(`users/${user.uid}`).get(), db.doc(`freelancerProfiles/${user.uid}`).get()]);
  return {
    uid: user.uid,
    email: user.email,
    role: role.data()?.role || null,
    disabled: user.disabled,
    createdAt: user.metadata.creationTime,
    profile: profile.exists ? { name: profile.data().name, approved: profile.data().approved, reviewStatus: profile.data().reviewStatus } : null,
  };
});

exports.trackProfileView = onCall(callableOpts, async (request) => {
  const freelancerUid = cleanText(request.data?.freelancerUid, 128, "freelancerUid");
  const viewer = request.auth?.uid || clientIp(request);
  if (viewer === freelancerUid) return { counted: false };
  await enforceRateLimit("view", viewer, 120, HOUR, "Too many views.");

  const day = new Date().toISOString().slice(0, 10);
  const hash = crypto.createHash("sha256").update(String(viewer)).digest("hex").slice(0, 24);
  const seenRef = db.doc(`profileStats/${freelancerUid}/viewers/${day}_${hash}`);
  const statRef = db.doc(`profileStats/${freelancerUid}/days/${day}`);
  const counted = await db.runTransaction(async (t) => {
    if ((await t.get(seenRef)).exists) return false;
    t.set(seenRef, { day, createdAt: FieldValue.serverTimestamp() });
    t.set(statRef, { day, views: FieldValue.increment(1) }, { merge: true });
    return true;
  });
  return { counted };
});
