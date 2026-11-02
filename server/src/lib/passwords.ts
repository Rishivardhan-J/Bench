import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.ts';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;

// scrypt is memory-hard and ships with Node, so there is no native module to build.
const N = config.isTest ? 2 ** 10 : 2 ** 15;
const R = 8;
const P = 1;
const OPTS = (n: number): crypto.ScryptOptions => ({ N: n, r: R, p: P, maxmem: 256 * 1024 * 1024 });

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 32, OPTS(N));
  return `scrypt$${N}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, OPTS(Number(n)));
  return crypto.timingSafeEqual(actual, expected);
}

/** A hash to compare against when the email is unknown, so sign-in timing doesn't reveal accounts. */
export const DUMMY_HASH = await hashPassword('not-a-real-password');
