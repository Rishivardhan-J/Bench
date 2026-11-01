const { admin, db, report } = require("./common");

const EMAIL_DEFAULT = {
  new_request: true,
  request_accepted: true,
  new_message: true,
  proposal_received: true,
};

const SUBJECTS = {
  new_request: "New connect request on Bench",
  request_accepted: "Your request was accepted on Bench",
  new_message: "New message on Bench",
  proposal_received: "New proposal on Bench",
};

/** Writes the in-app notification and, when the person allows it, queues an email. */
async function notify(uid, { type, title, body, link, refId }) {
  try {
    const prefSnap = await db.doc(`users/${uid}/settings/prefs`).get();
    const prefs = prefSnap.exists ? prefSnap.data() : {};
    const pref = prefs[type] || {};
    const inApp = pref.inApp !== false;
    const email = pref.email !== undefined ? pref.email === true : EMAIL_DEFAULT[type] === true;

    if (inApp) {
      await db.collection(`notifications/${uid}/items`).add({
        type,
        refId: refId || null,
        title,
        body,
        link,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (email && SUBJECTS[type]) {
      const user = await admin.auth().getUser(uid).catch(() => null);
      if (user?.email) {
        // Shape used by the Firebase "Trigger Email" extension.
        await db.collection("mail").add({
          to: [user.email],
          message: { subject: SUBJECTS[type], text: `${title}\n\n${body}\n\n${link}` },
        });
      }
    }
  } catch (error) {
    report(error);
  }
}

module.exports = { notify };
