import { createRequire } from 'node:module';
import { computeCompleteness } from '@/lib/completeness';
import { pool, tx } from './client.ts';
import { migrate } from './migrate.ts';
import { hashPassword } from '../lib/passwords.ts';

// Demo data for local development. Usage: `npm run seed` (all accounts use the password below).
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const seed = require('../../../src/lib/providers/seed-freelancers.json') as Record<string, any>[];
const PASSWORD = 'password123';
const emailFor = (name: string) => `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@bench.test`;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

export async function seedDatabase() {
  await migrate();
  const hash = await hashPassword(PASSWORD);
  await tx(async (c) => {
    await c.query('TRUNCATE users, mail_outbox, rate_limits CASCADE');
    const user = (id: string, email: string, role: string, isAdmin = false) =>
      c.query('INSERT INTO users (id, email, password_hash, role, is_admin) VALUES ($1, $2, $3, $4, $5)', [id, email, hash, role, isAdmin]);

    await user('client1', 'client@bench.test', 'client');
    await c.query(`INSERT INTO client_profiles (user_id, name, company) VALUES ('client1', 'Jordan Lee', 'Acme Labs')`);

    for (const f of seed) {
      const { id, reviews = [], ...p } = f;
      await user(id, emailFor(p.name), 'freelancer');
      const profile = { ...p, approved: true, paused: false };
      const ratingAvg = reviews.length ? Math.round((reviews.reduce((n: number, r: any) => n + r.rating, 0) / reviews.length) * 10) / 10 : null;
      await c.query(
        `INSERT INTO freelancer_profiles (user_id, name, headline, bio, skills, rate_min, rate_max, currency, availability, timezone, portfolio_url, avatar_url,
           languages, experience, education, portfolio, approved, verified, paused, review_status, completeness, rating_avg, review_count, avg_response_minutes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,$17,false,'approved',$18,$19,$20,$21)`,
        [
          id, p.name, p.headline, p.bio, p.skills, p.rateMin, p.rateMax, p.currency ?? 'USD', p.availability, p.timezone, p.portfolioUrl ?? null, p.avatarUrl ?? null,
          p.languages ?? [], JSON.stringify(p.experience ?? []), JSON.stringify(p.education ?? []), JSON.stringify(p.portfolio ?? []),
          p.verified === true, computeCompleteness(profile as never), ratingAvg, reviews.length, p.avgResponseMinutes ?? null,
        ],
      );
      for (const [i, r] of reviews.entries()) {
        await c.query(
          `INSERT INTO reviews (id, hire_id, client_id, client_name, freelancer_id, rating, text, created_at) VALUES ($1, $1, 'client1', $2, $3, $4, $5, $6)`,
          [`seed_${id}_${i}`, ['Dana', 'Priya', 'Marcus', 'Chen'][i % 4] + ' (client)', id, r.rating, r.text, daysAgo(10 + i * 20)],
        );
      }
    }

    // A freelancer waiting for review, so the admin queue is not empty.
    await user('pending1', 'pending@bench.test', 'freelancer');
    const pending = {
      name: 'Sam Okafor', headline: 'Backend engineer, Go and Postgres',
      bio: 'Eight years building payment and ledger systems. I like boring technology that stays up, clear APIs and good runbooks.',
      skills: ['Go', 'PostgreSQL', 'AWS'], rateMin: 90, rateMax: 130, timezone: 'Europe/London', languages: ['English'],
      experience: [{ title: 'Staff engineer', company: 'Ledgerly', startYear: 2019 }],
    };
    await c.query(
      `INSERT INTO freelancer_profiles (user_id, name, headline, bio, skills, rate_min, rate_max, availability, timezone, languages, experience, review_status, completeness)
       VALUES ('pending1', $1, $2, $3, $4, $5, $6, 'this_week', $7, $8, $9, 'pending', $10)`,
      [pending.name, pending.headline, pending.bio, pending.skills, pending.rateMin, pending.rateMax, pending.timezone, pending.languages, JSON.stringify(pending.experience), computeCompleteness(pending as never)],
    );

    await user('admin1', 'admin@bench.test', 'admin', true);

    // One accepted conversation (enough to mark a hire and review) and one pending request.
    const first = seed[0];
    await c.query(
      `INSERT INTO connections (id, client_id, freelancer_id, first_message, status, created_at, responded_at)
       VALUES ('c1', 'client1', $1, 'Hi Alex, we need a design system refresh for our dashboard. Are you free in the next few weeks?', 'accepted', $2, $2)`,
      [first.id, daysAgo(2)],
    );
    await c.query(`INSERT INTO threads (id, connection_id, last_message, last_message_at) VALUES ('t1', 'c1', 'Great, I can start Monday.', $1)`, [daysAgo(1)]);
    await c.query(`UPDATE connections SET thread_id = 't1' WHERE id = 'c1'`);
    await c.query(`INSERT INTO thread_participants (thread_id, user_id, unread, last_read) VALUES ('t1', 'client1', 1, NULL), ('t1', $1, 0, now())`, [first.id]);
    const msgs: [string, string, number, boolean][] = [
      ['client1', 'Hi Alex, we need a design system refresh for our dashboard. Are you free in the next few weeks?', 2, true],
      [first.id, 'Thanks for reaching out. Happy to help. What does the current system look like?', 2, false],
      ['client1', 'Mostly ad hoc components in Figma. About 40 screens.', 2, false],
      [first.id, 'Great, I can start Monday.', 1, false],
    ];
    for (const [sender, text, d, system] of msgs) {
      await c.query('INSERT INTO messages (thread_id, sender_id, text, system, created_at) VALUES ($1, $2, $3, $4, $5)', ['t1', sender, text, system, daysAgo(d)]);
    }

    await c.query(
      `INSERT INTO connections (id, client_id, freelancer_id, first_message, status, created_at)
       VALUES ('c2', 'client1', $1, 'Hello, we are looking for help with a short project. Could we talk this week?', 'pending', now())`,
      [seed[1].id],
    );

    await c.query(
      `INSERT INTO projects (id, client_id, title, description, skills, budget_min, budget_max, timeline, created_at)
       VALUES ('p1', 'client1', 'Rebuild our marketing site in React',
         'We have a five page marketing site on a legacy CMS. We want a fast React and TypeScript rebuild with a clean component library and good accessibility.',
         ARRAY['React', 'TypeScript'], 70, 110, '6 weeks', $1)`,
      [daysAgo(1)],
    );
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedDatabase();
  console.log(`Seeded. All accounts use the password: ${PASSWORD}
  client@bench.test   client (has a thread, a pending request and a project)
  admin@bench.test    admin (review queue has one profile)
  pending@bench.test  freelancer waiting for approval
  ${emailFor(seed[0].name)}  freelancer with an accepted conversation`);
  await pool.end();
}
