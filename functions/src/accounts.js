const { onCall } = require("firebase-functions/v2/https");
const { admin, db, HttpsError, callableOpts, clientIp, requireAuth, enforceRateLimit, cleanText, HOUR, report } = require("./common");

/**
 * Creates the server-owned user record and role profile for a freshly signed-up account.
 * Roles are assigned here (never by the client), so rules can trust users/{uid}.role.
 */
exports.initAccount = onCall(callableOpts, async (request) => {
  const uid = requireAuth(request);
  await enforceRateLimit("signup", clientIp(request), 10, HOUR, "Too many sign-ups from this network. Try again later.");

  const role = request.data?.role;
  if (role !== "client" && role !== "freelancer") throw new HttpsError("invalid-argument", "Choose client or freelancer.");
  const name = request.data?.name ? cleanText(request.data.name, 80, "Name") : "";
  const timezone = typeof request.data?.timezone === "string" ? request.data.timezone.slice(0, 64) : "UTC";

  const userRef = db.doc(`users/${uid}`);
  const existing = await userRef.get();
  if (existing.exists) return { role: existing.data().role };

  const email = request.auth.token.email || "";
  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(userRef, { role, email, createdAt: now });

  if (role === "client") {
    batch.set(db.doc(`clientProfiles/${uid}`), { name, company: "", avatarUrl: null, createdAt: now });
  } else {
    batch.set(db.doc(`freelancerProfiles/${uid}`), {
      name,
      headline: "",
      bio: "",
      skills: [],
      rateMin: 0,
      rateMax: 0,
      currency: "USD",
      availability: "now",
      timezone,
      languages: [],
      experience: [],
      education: [],
      portfolio: [],
      approved: false,
      verified: false,
      paused: false,
      reviewStatus: "draft",
      completeness: 0,
      reviewCount: 0,
      replyCount: 0,
      replyMinutesTotal: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  return { role };
});

/** Self-serve account deletion: profile, messages, shortlists, files and the sign-in itself. */
exports.deleteAccount = onCall(callableOpts, async (request) => {
  const uid = requireAuth(request);
  const bucket = admin.storage().bucket();

  try {
    const threads = await db.collection("threads").where("participants", "array-contains", uid).get();
    for (const t of threads.docs) {
      await bucket.deleteFiles({ prefix: `attachments/${t.id}/` }).catch(() => undefined);
      await db.recursiveDelete(t.ref);
    }

    const owned = [
      db.collection("connections").where("clientUid", "==", uid),
      db.collection("connections").where("freelancerUid", "==", uid),
      db.collection("projects").where("clientUid", "==", uid),
      db.collection("proposals").where("clientUid", "==", uid),
      db.collection("proposals").where("freelancerUid", "==", uid),
      db.collection("savedSearches").where("clientUid", "==", uid),
      db.collection("hires").where("clientUid", "==", uid),
      db.collection("hires").where("freelancerUid", "==", uid),
      db.collection("reviews").where("freelancerUid", "==", uid),
    ];
    for (const q of owned) {
      const snap = await q.get();
      for (const d of snap.docs) await db.recursiveDelete(d.ref);
    }

    for (const path of [
      `users/${uid}`,
      `clientProfiles/${uid}`,
      `freelancerProfiles/${uid}`,
      `shortlists/${uid}`,
      `notifications/${uid}`,
      `profileStats/${uid}`,
    ]) {
      await db.recursiveDelete(db.doc(path));
    }

    for (const prefix of [`avatars/${uid}/`, `resumes/${uid}/`, `portfolio/${uid}/`]) {
      await bucket.deleteFiles({ prefix }).catch(() => undefined);
    }

    await admin.auth().deleteUser(uid);
    return { deleted: true };
  } catch (error) {
    report(error);
    throw new HttpsError("internal", "We couldn't finish deleting your account. Please try again.");
  }
});
