import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = process.env;
const isTest = env.NODE_ENV === 'test';

function required(name: string, fallback?: string): string {
  const value = env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable ${name}. See server/.env.example.`);
  return value;
}

export const config = {
  root,
  isProd: env.NODE_ENV === 'production',
  isTest,
  port: Number(env.PORT ?? 8787),
  host: env.HOST ?? '127.0.0.1',
  databaseUrl: isTest ? required('TEST_DATABASE_URL') : required('DATABASE_URL'),
  /** Origins allowed to make state-changing requests (CSRF defence for cookie auth). */
  appOrigins: (env.APP_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim()).filter(Boolean),
  appUrl: env.APP_URL ?? 'http://localhost:5173',
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
  sessionDays: 30,
  trustProxy: env.TRUST_PROXY === 'true',
  gemini: { key: env.GEMINI_API_KEY, model: env.GEMINI_MODEL ?? 'gemini-2.5-flash' },
  smtp: {
    url: env.SMTP_URL, // e.g. smtps://user:pass@smtp.example.com
    from: env.MAIL_FROM ?? 'Bench <no-reply@bench.local>',
  },
  storage: {
    dir: env.STORAGE_DIR || path.join(root, '.data', isTest ? 'test-files' : 'files'),
  },
  /** Built frontend to serve (default: ../dist when it exists). Set STATIC_DIR="" to turn off. */
  staticDir: env.STATIC_DIR === undefined ? path.resolve(root, '..', 'dist') : env.STATIC_DIR ? path.resolve(env.STATIC_DIR) : '',
  sentryDsn: env.SENTRY_DSN,
} as const;
