/** Thin fetch wrapper for the Bench API. Cookies carry the session, so there is nothing to attach. */

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const BASE = '/api';

async function send<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      ...init,
    });
  } catch {
    throw new ApiRequestError('unavailable', 'We could not reach Bench. Check your connection and try again.', 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error;
    throw new ApiRequestError(e?.code ?? 'internal', e?.message ?? 'Something went wrong. Please try again.', res.status, e?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => send<T>('GET', path, undefined, init),
  post: <T>(path: string, body: unknown = {}) => send<T>('POST', path, body),
  put: <T>(path: string, body: unknown = {}) => send<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown = {}) => send<T>('PATCH', path, body),
  del: <T>(path: string) => send<T>('DELETE', path),
  /** Multipart upload of one file in the `file` field. */
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return send<T>('POST', path, form);
  },
};

/** Turns a failure into a sentence worth showing. Messages from the server are written for people. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiRequestError) {
    if (err.code === 'internal' || err.code === 'unavailable') return err.code === 'unavailable' ? err.message : fallback;
    return err.message || fallback;
  }
  return fallback;
}

export function isRateLimited(err: unknown): boolean {
  return err instanceof ApiRequestError && err.code === 'resource-exhausted';
}

export const errorCode = (err: unknown): string | undefined => (err instanceof ApiRequestError ? err.code : undefined);

/** The API already sends epoch milliseconds; this keeps older call sites tolerant of missing values. */
export function toMillis(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
