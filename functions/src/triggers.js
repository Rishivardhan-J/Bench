const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { admin, db, report } = require("./common");
const { notify } = require("./notify");
const { computeCompleteness } = require("./completeness");

const FieldValue = admin.firestore.FieldValue;
const day = () => new Date().toISOString().slice(0, 10);

/** Keeps thread preview, unread counters and response-time stats current. */
exports.onMessageCreated = onDocumentCreated("threads/{threadId}/messages/{messageId}", async (event) => {
  const msg = event.data?.data();
  if (!msg || msg.system) return;
  const threadRef = db.doc(`threads/${event.params.threadId}`);
  try {
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) return;
    const thread = threadSnap.data();
    const other = thread.participants.find((p) => p !== msg.senderUid);
    const previouslyUnread = (thread.unread || {})[other] || 0;

    await threadRef.update({
      lastMessageAt: msg.createdAt || FieldValue.serverTimestamp(),
      lastMessage: (msg.text || (msg.attachments?.length ? "Sent an attachment" : "")).slice(0, 140),
      [`unread.${other}`]: FieldValue.increment(1),
    });

    // Response time comes from real replies: the freelancer's first message in each thread.
    const sender = await db.doc(`users/${msg.senderUid}`).get();
    if (sender.data()?.role === "freelancer") {
      const earlier = await db
        .collection(`threads/${event.params.threadId}/messages`)
        .where("senderUid", "==", msg.senderUid)
        .limit(2)
        .get();
      const conn = await db.doc(`connections/${thread.connectionId}`).get();
      const started = conn.data()?.createdAt?.toMillis?.();
      const sent = msg.createdAt?.toMillis?.() ?? Date.now();
      if (earlier.size === 1 && started) {
        const minutes = Math.max(1, Math.round((sent - started) / 60000));
        const ref = db.doc(`freelancerProfiles/${msg.senderUid}`);
        await db.runTransaction(async (t) => {
          const p = await t.get(ref);
          if (!p.exists) return;
          const count = (p.data().replyCount || 0) + 1;
          const total = (p.data().replyMinutesTotal || 0) + minutes;
          const update = { replyCount: count, replyMinutesTotal: total };
          // Hidden, not zero, until there are a few real replies.
          if (count >= 3) update.avgResponseMinutes = Math.round(total / count);
          t.update(ref, update);
        });
      }
    }

    if (previouslyUnread === 0) {
      await notify(other, {
        type: "new_message",
        title: `New message from ${thread.names?.[msg.senderUid] || "someone"}`,
        body: (msg.text || "Sent an attachment").slice(0, 160),
        link: `/messages/${event.params.threadId}`,
        refId: event.params.threadId,
      });
    }
  } catch (error) {
    report(error);
  }
});

async function recomputeRating(freelancerUid) {
  const snap = await db.collection("reviews").where("freelancerUid", "==", freelancerUid).get();
  const count = snap.size;
  const ref = db.doc(`freelancerProfiles/${freelancerUid}`);
  if (!(await ref.get()).exists) return;
  if (count === 0) {
    await ref.update({ ratingAvg: FieldValue.delete(), reviewCount: 0 });
    return;
  }
  const avg = snap.docs.reduce((n, d) => n + d.data().rating, 0) / count;
  await ref.update({ ratingAvg: Math.round(avg * 10) / 10, reviewCount: count });
}

exports.onReviewWritten = onDocumentWritten("reviews/{reviewId}", async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  const uid = (after || before)?.freelancerUid;
  if (!uid) return;
  try {
    await recomputeRating(uid);
    if (after && !before) {
      await notify(uid, {
        type: "new_review",
        title: "You received a new review",
        body: `${after.rating} out of 5 from ${after.clientName}`,
        link: "/freelancer/status",
      });
    }
  } catch (error) {
    report(error);
  }
});

function matchesSavedSearch(profile, s) {
  const f = s.filters || {};
  const skills = f.skills || [];
  const lower = (profile.skills || []).map((x) => x.toLowerCase());
  if (skills.length && !skills.some((k) => lower.includes(String(k).toLowerCase()))) return false;
  if (f.rateMin !== undefined && profile.rateMax < f.rateMin) return false;
  if (f.rateMax !== undefined && profile.rateMin > f.rateMax) return false;
  if (f.availability?.length && !f.availability.includes(profile.availability)) return false;
  if (f.minRating !== undefined && !(profile.ratingAvg >= f.minRating)) return false;
  if (s.query) {
    const hay = `${profile.name} ${profile.headline} ${profile.bio} ${(profile.skills || []).join(" ")}`.toLowerCase();
    if (!String(s.query).toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t))) return false;
  }
  return skills.length > 0 || Boolean(s.query) || f.rateMin !== undefined || f.rateMax !== undefined;
}

exports.onProfileWritten = onDocumentWritten("freelancerProfiles/{uid}", async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  if (!after) return;
  const uid = event.params.uid;
  try {
    const completeness = computeCompleteness(after);
    if (completeness !== after.completeness) {
      await event.data.after.ref.update({ completeness });
      return; // the follow-up write re-enters this trigger with completeness set
    }

    if (before && before.approved !== true && after.approved === true) {
      await notify(uid, {
        type: "profile_status",
        title: "Your profile is live",
        body: "Clients can now find you in search.",
        link: "/freelancer/status",
      });
      const searches = await db.collection("savedSearches").where("alertEnabled", "==", true).get();
      for (const doc of searches.docs) {
        const s = doc.data();
        if (matchesSavedSearch(after, s)) {
          await notify(s.clientUid, {
            type: "search_alert",
            title: `New match for "${s.label}"`,
            body: `${after.name} just went live.`,
            link: `/freelancer/${uid}`,
          });
        }
      }
    }

    if (before && before.reviewStatus !== "changes_requested" && after.reviewStatus === "changes_requested") {
      await notify(uid, {
        type: "profile_status",
        title: "Changes requested on your profile",
        body: after.reviewNote || "Open your status page to see what to update.",
        link: "/freelancer/status",
      });
    }
  } catch (error) {
    report(error);
  }
});

exports.onProjectCreated = onDocumentCreated("projects/{projectId}", async (event) => {
  const p = event.data?.data();
  if (!p || p.status !== "open" || !Array.isArray(p.skills) || p.skills.length === 0) return;
  try {
    const wanted = p.skills.slice(0, 10);
    const snap = await db
      .collection("freelancerProfiles")
      .where("approved", "==", true)
      .where("skills", "array-contains-any", wanted)
      .limit(50)
      .get();
    await Promise.all(
      snap.docs
        .filter((d) => d.data().paused !== true)
        .map((d) =>
          notify(d.id, {
            type: "project_match",
            title: "A new project matches your skills",
            body: p.title,
            link: `/freelancer/board`,
            refId: event.params.projectId,
          }),
        ),
    );
  } catch (error) {
    report(error);
  }
});

exports.onProposalCreated = onDocumentCreated("proposals/{proposalId}", async (event) => {
  const p = event.data?.data();
  if (!p) return;
  await notify(p.clientUid, {
    type: "proposal_received",
    title: `${p.freelancerName || "A freelancer"} sent a proposal`,
    body: p.projectTitle || "Your project",
    link: `/projects/${p.projectId}`,
    refId: event.params.proposalId,
  });
});

/** Counts newly added freelancers on a client's lists for the freelancer's weekly trend. */
exports.onShortlistWritten = onDocumentWritten("shortlists/{clientUid}/lists/{listId}", async (event) => {
  const before = new Set((event.data?.before?.data()?.items || []).map((i) => i.freelancerId));
  const after = (event.data?.after?.data()?.items || []).map((i) => i.freelancerId);
  const added = after.filter((id) => !before.has(id));
  await Promise.all(
    added.map((id) =>
      db.doc(`profileStats/${id}/days/${day()}`).set({ day: day(), shortlistAdds: FieldValue.increment(1) }, { merge: true }),
    ),
  );
});
