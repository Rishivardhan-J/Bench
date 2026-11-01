const { onCall } = require("firebase-functions/v2/https");
const {
  admin,
  db,
  HttpsError,
  callableOpts,
  requireAuth,
  requireRole,
  enforceRateLimit,
  cleanText,
  contentGuard,
  DAY,
} = require("./common");
const { notify } = require("./notify");

const FieldValue = admin.firestore.FieldValue;

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function bumpStat(freelancerUid, field) {
  await db.doc(`profileStats/${freelancerUid}/days/${dayKey()}`).set({ day: dayKey(), [field]: FieldValue.increment(1) }, { merge: true });
}

// Open decision 2: three requests a day for new clients, raised after a first accepted request.
const NEW_CLIENT_DAILY = 3;
const TRUSTED_CLIENT_DAILY = 10;

exports.sendConnectRequest = onCall(callableOpts, async (request) => {
  const clientUid = await requireRole(request, "client");
  const freelancerUid = cleanText(request.data?.freelancerUid, 128, "Freelancer");
  const message = cleanText(request.data?.message, 1000, "Message");
  contentGuard(message);
  const projectId = typeof request.data?.projectId === "string" ? request.data.projectId.slice(0, 128) : null;
  const brief = request.data?.brief ? cleanText(request.data.brief, 2000, "Brief") : null;

  if (freelancerUid === clientUid) throw new HttpsError("invalid-argument", "You can't connect with yourself.");

  const [profileSnap, blockedSnap, clientSnap] = await Promise.all([
    db.doc(`freelancerProfiles/${freelancerUid}`).get(),
    db.doc(`users/${freelancerUid}/blocked/${clientUid}`).get(),
    db.doc(`clientProfiles/${clientUid}`).get(),
  ]);
  const profile = profileSnap.data();
  if (!profileSnap.exists || profile.approved !== true || profile.paused === true || blockedSnap.exists) {
    throw new HttpsError("failed-precondition", "This freelancer isn't accepting requests right now.");
  }

  const connectionId = `${clientUid}_${freelancerUid}`;
  const ref = db.doc(`connections/${connectionId}`);
  const existing = await ref.get();
  if (existing.exists) {
    const { status, threadId, createdAt } = existing.data();
    if (status === "pending") throw new HttpsError("already-exists", "You already have a request waiting with this freelancer.");
    if (status === "accepted") throw new HttpsError("already-exists", "You're already connected. Open your messages to continue.", { threadId });
    if (status === "blocked") throw new HttpsError("failed-precondition", "This freelancer isn't accepting requests right now.");
    if (status === "declined" && Date.now() - (createdAt?.toMillis?.() ?? 0) < 7 * DAY) {
      throw new HttpsError("failed-precondition", "This freelancer declined recently. Try again in a few days.");
    }
  }

  const accepted = await db.collection("connections").where("clientUid", "==", clientUid).where("status", "==", "accepted").limit(1).get();
  const max = accepted.empty ? NEW_CLIENT_DAILY : TRUSTED_CLIENT_DAILY;
  await enforceRateLimit(
    "connect",
    clientUid,
    max,
    DAY,
    accepted.empty
      ? `You can send ${NEW_CLIENT_DAILY} requests a day until your first one is accepted. Try again tomorrow.`
      : "You've reached today's request limit. Try again tomorrow.",
  );

  let projectTitle = null;
  if (projectId) {
    const project = await db.doc(`projects/${projectId}`).get();
    if (project.exists && project.data().clientUid === clientUid) projectTitle = project.data().title;
  }

  await ref.set({
    clientUid,
    freelancerUid,
    clientName: clientSnap.data()?.name || "A client",
    freelancerName: profile.name,
    projectId: projectTitle ? projectId : null,
    projectTitle,
    briefText: brief,
    firstMessage: message,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  await bumpStat(freelancerUid, "requests");
  await notify(freelancerUid, {
    type: "new_request",
    title: `${clientSnap.data()?.name || "A client"} wants to connect`,
    body: message.slice(0, 160),
    link: "/freelancer/requests",
    refId: connectionId,
  });
  return { connectionId };
});

async function closeThreadsAndBlock(blocker, target) {
  await db.doc(`users/${blocker}/blocked/${target}`).set({ createdAt: FieldValue.serverTimestamp() });
  const threads = await db.collection("threads").where("participants", "array-contains", blocker).get();
  const batch = db.batch();
  for (const t of threads.docs) {
    if (t.data().participants.includes(target)) batch.update(t.ref, { closed: true });
  }
  const conns = await db.collection("connections").where("freelancerUid", "==", blocker).where("clientUid", "==", target).get();
  conns.docs.forEach((c) => batch.update(c.ref, { status: "blocked" }));
  await batch.commit();
}

exports.respondToConnection = onCall(callableOpts, async (request) => {
  const uid = await requireRole(request, "freelancer");
  const connectionId = cleanText(request.data?.connectionId, 300, "connectionId");
  const action = request.data?.action;
  if (!["accept", "decline", "block"].includes(action)) throw new HttpsError("invalid-argument", "Unknown action.");

  const ref = db.doc(`connections/${connectionId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data().freelancerUid !== uid) throw new HttpsError("not-found", "Request not found.");
  const conn = snap.data();

  if (action === "block") {
    await closeThreadsAndBlock(uid, conn.clientUid);
    return { status: "blocked" };
  }
  if (conn.status !== "pending") throw new HttpsError("failed-precondition", "That request was already answered.");

  if (action === "decline") {
    await ref.update({ status: "declined" });
    return { status: "declined" };
  }

  const threadRef = db.doc(`threads/${connectionId}`);
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(threadRef, {
    participants: [conn.clientUid, uid],
    names: { [conn.clientUid]: conn.clientName || "Client", [uid]: conn.freelancerName || "Freelancer" },
    connectionId,
    lastMessageAt: now,
    lastMessage: conn.firstMessage.slice(0, 140),
    unread: { [conn.clientUid]: 0, [uid]: 1 },
    lastRead: {},
    closed: false,
  });
  // The connect message becomes the first message in the thread.
  batch.set(threadRef.collection("messages").doc(), {
    senderUid: conn.clientUid,
    text: conn.firstMessage,
    attachments: [],
    system: true,
    createdAt: conn.createdAt || now,
  });
  batch.update(ref, { status: "accepted", threadId: connectionId });
  await batch.commit();

  await notify(conn.clientUid, {
    type: "request_accepted",
    title: `${conn.freelancerName || "A freelancer"} accepted your request`,
    body: "You can now message each other.",
    link: `/messages/${connectionId}`,
    refId: connectionId,
  });
  return { status: "accepted", threadId: connectionId };
});

exports.blockUser = onCall(callableOpts, async (request) => {
  const uid = requireAuth(request);
  const target = cleanText(request.data?.targetUid, 128, "targetUid");
  if (target === uid) throw new HttpsError("invalid-argument", "You can't block yourself.");
  await closeThreadsAndBlock(uid, target);
  return { blocked: true };
});

exports.openProposalThread = onCall(callableOpts, async (request) => {
  const clientUid = await requireRole(request, "client");
  const proposalId = cleanText(request.data?.proposalId, 300, "proposalId");
  const ref = db.doc(`proposals/${proposalId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data().clientUid !== clientUid) throw new HttpsError("not-found", "Proposal not found.");
  const p = snap.data();

  const connectionId = `${clientUid}_${p.freelancerUid}`;
  const connRef = db.doc(`connections/${connectionId}`);
  const threadRef = db.doc(`threads/${connectionId}`);
  const [conn, thread, project, client] = await Promise.all([
    connRef.get(),
    threadRef.get(),
    db.doc(`projects/${p.projectId}`).get(),
    db.doc(`clientProfiles/${clientUid}`).get(),
  ]);
  if (conn.exists && conn.data().status === "blocked") throw new HttpsError("failed-precondition", "This freelancer isn't available.");

  if (!thread.exists) {
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(connRef, {
      clientUid,
      freelancerUid: p.freelancerUid,
      clientName: client.data()?.name || "Client",
      freelancerName: p.freelancerName,
      projectId: p.projectId,
      projectTitle: project.data()?.title || null,
      firstMessage: p.message,
      status: "accepted",
      threadId: connectionId,
      createdAt: now,
    });
    batch.set(threadRef, {
      participants: [clientUid, p.freelancerUid],
      names: { [clientUid]: client.data()?.name || "Client", [p.freelancerUid]: p.freelancerName || "Freelancer" },
      connectionId,
      lastMessageAt: now,
      lastMessage: p.message.slice(0, 140),
      unread: { [clientUid]: 1, [p.freelancerUid]: 0 },
      lastRead: {},
      closed: false,
    });
    batch.set(threadRef.collection("messages").doc(), {
      senderUid: p.freelancerUid,
      text: p.message,
      attachments: [],
      system: true,
      createdAt: now,
    });
    await batch.commit();
  }
  await ref.update({ status: "chosen", threadId: connectionId });
  await notify(p.freelancerUid, {
    type: "request_accepted",
    title: "A client opened a conversation about your proposal",
    body: project.data()?.title || "Open project",
    link: `/messages/${connectionId}`,
    refId: connectionId,
  });
  return { threadId: connectionId };
});
