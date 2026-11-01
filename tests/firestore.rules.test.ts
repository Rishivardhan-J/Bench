import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const profile = {
  name: 'Alex Rivera', headline: 'Product designer', bio: 'A bio', skills: ['Figma'], rateMin: 80, rateMax: 120, currency: 'USD',
  availability: 'now', timezone: 'UTC', languages: [], experience: [], education: [], portfolio: [], paused: false,
  approved: true, reviewStatus: 'approved', verified: false, ratingAvg: 4.5, reviewCount: 2,
};

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/free1'), { role: 'freelancer' });
    await setDoc(doc(db, 'users/client1'), { role: 'client' });
    await setDoc(doc(db, 'users/client2'), { role: 'client' });
    await setDoc(doc(db, 'freelancerProfiles/free1'), profile);
    await setDoc(doc(db, 'freelancerProfiles/draft1'), { ...profile, approved: false, reviewStatus: 'draft' });
    await setDoc(doc(db, 'threads/t1'), { participants: ['client1', 'free1'], names: {}, unread: { client1: 0, free1: 0 }, lastRead: { client1: 0, free1: 0 } });
    await setDoc(doc(db, 'threads/t1/messages/m1'), { senderUid: 'client1', text: 'hi', attachments: [] });
  });
});

const as = (uid: string, claims: Record<string, unknown> = {}) => env.authenticatedContext(uid, claims).firestore();

describe('roles', () => {
  it('nobody can write a role or user document', async () => {
    await assertFails(setDoc(doc(as('client1'), 'users/client1'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as('free1'), 'users/free1'), { role: 'client' }));
  });
});

describe('freelancer profiles', () => {
  it('the public can read only approved, unpaused profiles', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'freelancerProfiles/free1')));
    await assertFails(getDoc(doc(anon, 'freelancerProfiles/draft1')));
  });

  it('a freelancer cannot approve or verify themselves', async () => {
    const db = as('draft1');
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/draft1'), { role: 'freelancer' }));
    await assertFails(updateDoc(doc(db, 'freelancerProfiles/draft1'), { approved: true, reviewStatus: 'approved' }));
    await assertFails(updateDoc(doc(db, 'freelancerProfiles/draft1'), { verified: true }));
    await assertFails(updateDoc(doc(db, 'freelancerProfiles/draft1'), { ratingAvg: 5 }));
  });

  it('a freelancer can submit a draft for review', async () => {
    await assertSucceeds(updateDoc(doc(as('draft1'), 'freelancerProfiles/draft1'), { reviewStatus: 'pending' }));
  });

  it('editing core fields of a live profile requires taking it offline in the same write', async () => {
    const db = as('free1');
    await assertFails(updateDoc(doc(db, 'freelancerProfiles/free1'), { headline: 'Changed while live' }));
    await assertSucceeds(updateDoc(doc(db, 'freelancerProfiles/free1'), { headline: 'Changed', approved: false, reviewStatus: 'pending' }));
  });

  it('availability and pausing do not require review', async () => {
    await assertSucceeds(updateDoc(doc(as('free1'), 'freelancerProfiles/free1'), { availability: 'busy', paused: true }));
  });

  it("nobody else can edit someone's profile", async () => {
    await assertFails(updateDoc(doc(as('client1'), 'freelancerProfiles/free1'), { availability: 'busy' }));
  });
});

describe('reviews', () => {
  it('are public to read but never writable from the client', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'reviews/r1'), { rating: 5 }));
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'reviews/r1')));
    await assertFails(setDoc(doc(as('client1'), 'reviews/r2'), { freelancerUid: 'free1', clientUid: 'client1', rating: 5, text: 'great' }));
    await assertFails(updateDoc(doc(as('free1'), 'reviews/r1'), { rating: 1 }));
    await assertFails(deleteDoc(doc(as('free1'), 'reviews/r1')));
  });
});

describe('threads and messages', () => {
  it('only participants can read a thread or its messages', async () => {
    await assertSucceeds(getDoc(doc(as('client1'), 'threads/t1')));
    await assertSucceeds(getDoc(doc(as('free1'), 'threads/t1/messages/m1')));
    await assertFails(getDoc(doc(as('client2'), 'threads/t1')));
    await assertFails(getDoc(doc(as('client2'), 'threads/t1/messages/m1')));
  });

  it('a participant can send as themselves but not as someone else', async () => {
    await assertSucceeds(addDoc(collection(as('client1'), 'threads/t1/messages'), { senderUid: 'client1', text: 'hello', attachments: [], createdAt: serverTimestamp() }));
    await assertFails(addDoc(collection(as('client1'), 'threads/t1/messages'), { senderUid: 'free1', text: 'spoof', attachments: [], createdAt: serverTimestamp() }));
  });

  it('a non-participant cannot send', async () => {
    await assertFails(addDoc(collection(as('client2'), 'threads/t1/messages'), { senderUid: 'client2', text: 'hi', attachments: [], createdAt: serverTimestamp() }));
  });

  it('messages cannot be edited or deleted', async () => {
    await assertFails(updateDoc(doc(as('client1'), 'threads/t1/messages/m1'), { text: 'edited' }));
    await assertFails(deleteDoc(doc(as('client1'), 'threads/t1/messages/m1')));
  });

  it('a participant can only clear their own unread count', async () => {
    await assertSucceeds(updateDoc(doc(as('client1'), 'threads/t1'), { 'unread.client1': 0, 'lastRead.client1': serverTimestamp() }));
    await assertFails(updateDoc(doc(as('client1'), 'threads/t1'), { 'unread.free1': 5 }));
    await assertFails(updateDoc(doc(as('client1'), 'threads/t1'), { participants: ['client1', 'client2'] }));
  });

  it('clients cannot create threads directly', async () => {
    await assertFails(setDoc(doc(as('client1'), 'threads/t2'), { participants: ['client1', 'free1'] }));
  });
});

describe('connections and hires', () => {
  it('are server-written only', async () => {
    await assertFails(setDoc(doc(as('client1'), 'connections/client1_free1'), { clientUid: 'client1', freelancerUid: 'free1', status: 'accepted' }));
    await assertFails(setDoc(doc(as('client1'), 'hires/h1'), { clientUid: 'client1', freelancerUid: 'free1' }));
  });
});

describe('shortlists', () => {
  it('only clients can write their own lists', async () => {
    const list = { name: 'Design', items: [] };
    await assertSucceeds(setDoc(doc(as('client1'), 'shortlists/client1/lists/l1'), list));
    await assertFails(setDoc(doc(as('free1'), 'shortlists/free1/lists/l1'), list));
    await assertFails(setDoc(doc(as('client2'), 'shortlists/client1/lists/l2'), list));
    await assertFails(getDoc(doc(as('client2'), 'shortlists/client1/lists/l1')));
  });
});

describe('anything else', () => {
  it('is denied', async () => {
    await assertFails(setDoc(doc(as('client1'), 'mystery/doc'), { a: 1 }));
    await assertFails(getDoc(doc(as('client1'), 'rate_limits/anything')));
  });
});
