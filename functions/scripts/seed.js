// Seeds the local emulators with demo accounts and data.
// Usage: start the emulators, then `npm run seed` from the repo root.
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-bench";
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

const path = require("path");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { computeCompleteness } = require("../src/completeness");

initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const auth = getAuth();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const seed = require(path.join(__dirname, "../../src/lib/providers/seed-freelancers.json"));
const PASSWORD = "password123";

async function ensureUser(uid, email, displayName, claims) {
  try {
    await auth.deleteUser(uid);
  } catch {
    /* not there yet */
  }
  await auth.createUser({ uid, email, password: PASSWORD, displayName, emailVerified: true });
  if (claims) await auth.setCustomUserClaims(uid, claims);
}

const emailFor = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@bench.test`;
const daysAgo = (n) => Timestamp.fromMillis(Date.now() - n * 86400000);

async function main() {
  const clientUid = "client1";
  await ensureUser(clientUid, "client@bench.test", "Jordan Lee");
  await db.doc(`users/${clientUid}`).set({ role: "client", email: "client@bench.test", name: "Jordan Lee", createdAt: FieldValue.serverTimestamp() });
  await db.doc(`clientProfiles/${clientUid}`).set({ name: "Jordan Lee", company: "Acme Labs", createdAt: FieldValue.serverTimestamp() });

  for (const f of seed) {
    const { reviews = [], id, ...rest } = f;
    const email = emailFor(f.name);
    await ensureUser(id, email, f.name);
    await db.doc(`users/${id}`).set({ role: "freelancer", email, name: f.name, createdAt: FieldValue.serverTimestamp() });
    const profile = { ...rest, paused: false, approved: true, reviewStatus: "approved", updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() };
    profile.completeness = computeCompleteness(profile);
    await db.doc(`freelancerProfiles/${id}`).set(profile);
    for (const [i, r] of reviews.entries()) {
      await db.doc(`reviews/seed_${id}_${i}`).set({
        hireId: `seed_${id}_${i}`,
        clientUid,
        clientName: ["Dana", "Priya", "Marcus", "Chen"][i % 4] + " (client)",
        freelancerUid: id,
        rating: r.rating,
        text: r.text,
        createdAt: daysAgo(10 + i * 20),
      });
    }
    console.log(`freelancer  ${email}  (${id})`);
  }

  // A freelancer whose profile is waiting for review, so the admin queue is not empty.
  const pendingUid = "pending1";
  await ensureUser(pendingUid, "pending@bench.test", "Sam Okafor");
  await db.doc(`users/${pendingUid}`).set({ role: "freelancer", email: "pending@bench.test", name: "Sam Okafor", createdAt: FieldValue.serverTimestamp() });
  const pending = {
    name: "Sam Okafor", headline: "Backend engineer, Go and Postgres", bio: "Eight years building payment and ledger systems. I like boring technology that stays up, clear APIs and good runbooks.",
    skills: ["Go", "PostgreSQL", "AWS"], rateMin: 90, rateMax: 130, currency: "USD", availability: "this_week", timezone: "Europe/London",
    languages: ["English"], experience: [{ title: "Staff engineer", company: "Ledgerly", startYear: 2019 }], education: [], portfolio: [], verified: false,
    paused: false, approved: false, reviewStatus: "pending", updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
  };
  pending.completeness = computeCompleteness(pending);
  await db.doc(`freelancerProfiles/${pendingUid}`).set(pending);

  // Admin (custom claim).
  await ensureUser("admin1", "admin@bench.test", "Bench Admin", { admin: true });
  await db.doc("users/admin1").set({ role: "admin", email: "admin@bench.test", name: "Bench Admin", createdAt: FieldValue.serverTimestamp() });

  // One accepted conversation and one pending request for the first freelancer.
  const first = seed[0];
  const connId = `${clientUid}_${first.id}`;
  const threadId = `t_${connId}`;
  await db.doc(`connections/${connId}`).set({
    clientUid, freelancerUid: first.id, clientName: "Jordan Lee", freelancerName: first.name, status: "accepted", threadId,
    firstMessage: "Hi Alex, we need a design system refresh for our dashboard. Are you free in the next few weeks?", createdAt: daysAgo(2),
  });
  await db.doc(`threads/${threadId}`).set({
    participants: [clientUid, first.id], names: { [clientUid]: "Jordan Lee", [first.id]: first.name }, connectionId: connId,
    lastMessage: "Great, I can start Monday.", lastMessageAt: daysAgo(1), unread: { [clientUid]: 1, [first.id]: 0 }, lastRead: { [clientUid]: 0, [first.id]: Date.now() },
  });
  const msgs = [
    [clientUid, "Hi Alex, we need a design system refresh for our dashboard. Are you free in the next few weeks?", 2],
    [first.id, "Thanks for reaching out. Happy to help. What does the current system look like?", 2],
    [clientUid, "Mostly ad hoc components in Figma. About 40 screens.", 2],
    [first.id, "Great, I can start Monday.", 1],
  ];
  for (const [i, [senderUid, text, d]] of msgs.entries()) {
    await db.collection(`threads/${threadId}/messages`).doc(`m${i}`).set({ senderUid, text, attachments: [], createdAt: daysAgo(d) });
  }

  const second = seed[1];
  await db.doc(`connections/${clientUid}_${second.id}`).set({
    clientUid, freelancerUid: second.id, clientName: "Jordan Lee", freelancerName: second.name, status: "pending",
    firstMessage: "Hello, we are looking for help with a short project. Could we talk this week?", createdAt: daysAgo(0),
  });

  // An open project for the board.
  await db.collection("projects").doc("p1").set({
    clientUid, clientName: "Jordan Lee", title: "Rebuild our marketing site in React", description: "We have a five page marketing site on a legacy CMS. We want a fast React and TypeScript rebuild with a clean component library and good accessibility.",
    skills: ["React", "TypeScript"], budgetMin: 70, budgetMax: 110, timeline: "6 weeks", status: "open", createdAt: daysAgo(1),
  });

  console.log("\nSeeded. All accounts use the password:", PASSWORD);
  console.log("  client@bench.test   client (has a thread, a pending request and a project)");
  console.log("  admin@bench.test    admin (review queue has one profile)");
  console.log("  pending@bench.test  freelancer waiting for approval");
  console.log(`  ${emailFor(first.name)}  freelancer with an accepted conversation`);
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
