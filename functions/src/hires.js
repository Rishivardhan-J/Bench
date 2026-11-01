const { onCall } = require("firebase-functions/v2/https");
const { admin, db, HttpsError, callableOpts, requireRole, cleanText, firstNameInitial } = require("./common");

const FieldValue = admin.firestore.FieldValue;

exports.markHire = onCall(callableOpts, async (request) => {
  const clientUid = await requireRole(request, "client");
  const freelancerUid = cleanText(request.data?.freelancerUid, 128, "Freelancer");
  const projectId = typeof request.data?.projectId === "string" ? request.data.projectId.slice(0, 128) : null;

  const conn = await db.doc(`connections/${clientUid}_${freelancerUid}`).get();
  if (!conn.exists || conn.data().status !== "accepted") {
    throw new HttpsError("failed-precondition", "You can mark a hire once a request has been accepted.");
  }

  const hireId = projectId ? `${clientUid}_${freelancerUid}_${projectId}` : `${clientUid}_${freelancerUid}`;
  const ref = db.doc(`hires/${hireId}`);
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({ clientUid, freelancerUid, projectId, markedAt: FieldValue.serverTimestamp() });
    await db.doc(`threads/${clientUid}_${freelancerUid}`).update({ hireId }).catch(() => undefined);
  }
  return { hireId };
});

async function countMessages(threadId, senderUid) {
  const snap = await db.collection(`threads/${threadId}/messages`).where("senderUid", "==", senderUid).count().get();
  return snap.data().count;
}

exports.createReview = onCall(callableOpts, async (request) => {
  const clientUid = await requireRole(request, "client");
  const hireId = cleanText(request.data?.hireId, 300, "hireId");
  const rating = request.data?.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpsError("invalid-argument", "Rating must be 1 to 5.");
  const text = cleanText(request.data?.text, 1500, "Review");
  if (text.length < 10) throw new HttpsError("invalid-argument", "Please write at least a sentence.");

  const hireRef = db.doc(`hires/${hireId}`);
  const hire = await hireRef.get();
  if (!hire.exists || hire.data().clientUid !== clientUid) throw new HttpsError("not-found", "Hire not found.");
  const { freelancerUid } = hire.data();

  // Only after a hire is marked and a real two-sided conversation exists.
  const threadId = `${clientUid}_${freelancerUid}`;
  const [fromClient, fromFreelancer] = await Promise.all([countMessages(threadId, clientUid), countMessages(threadId, freelancerUid)]);
  if (fromClient < 2 || fromFreelancer < 1) {
    throw new HttpsError("failed-precondition", "Reviews open up after you've had a conversation with this freelancer.");
  }

  const client = await db.doc(`clientProfiles/${clientUid}`).get();
  const reviewRef = db.doc(`reviews/${hireId}`);
  await db.runTransaction(async (t) => {
    if ((await t.get(reviewRef)).exists) throw new HttpsError("already-exists", "You've already reviewed this engagement.");
    t.set(reviewRef, {
      hireId,
      clientUid,
      clientName: firstNameInitial(client.data()?.name),
      freelancerUid,
      rating,
      text,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { reviewId: hireId };
});

exports.replyToReview = onCall(callableOpts, async (request) => {
  const uid = await requireRole(request, "freelancer");
  const reviewId = cleanText(request.data?.reviewId, 300, "reviewId");
  const reply = cleanText(request.data?.text, 800, "Reply");
  const ref = db.doc(`reviews/${reviewId}`);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists || snap.data().freelancerUid !== uid) throw new HttpsError("not-found", "Review not found.");
    if (snap.data().reply) throw new HttpsError("already-exists", "You've already replied to this review.");
    t.update(ref, { reply, repliedAt: FieldValue.serverTimestamp() });
  });
  return { replied: true };
});
