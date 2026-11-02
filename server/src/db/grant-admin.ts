import { pool } from './client.ts';
import { hashPassword } from '../lib/passwords.ts';

// Usage: npm run admin:grant -- someone@example.com [password-for-new-account]
const [email, password] = process.argv.slice(2);
if (!email) {
  console.error('Usage: npm run admin:grant -- <email> [password]');
  process.exit(1);
}

const existing = (await pool.query('SELECT id, role FROM users WHERE email = $1', [email.toLowerCase()])).rows[0];
if (existing) {
  if (existing.role !== 'admin') {
    console.error(`${email} is a ${existing.role} account. Admins are their own account type; use a separate email.`);
    process.exit(1);
  }
  await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [existing.id]);
  console.log(`${email} is an admin.`);
} else {
  if (!password || password.length < 8) {
    console.error('No such account. Pass a password of at least 8 characters to create one.');
    process.exit(1);
  }
  await pool.query(`INSERT INTO users (email, password_hash, role, is_admin) VALUES ($1, $2, 'admin', true)`, [email.toLowerCase(), await hashPassword(password)]);
  console.log(`Created admin ${email}.`);
}
await pool.end();
