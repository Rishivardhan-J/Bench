import { z } from 'zod';
import { ApiError } from './errors.ts';

/** Trimmed, NUL-free, non-empty string with a max length. */
export const text = (max: number, field = 'Text') =>
  z
    .string({ error: `${field} is required.` })
    .transform((s) => s.replaceAll('\0', '').trim())
    .pipe(z.string().min(1, `${field} is required.`).max(max, `${field} must be ${max} characters or fewer.`));

/** Same as `text` but missing, null or empty becomes undefined. */
export const optText = (max: number, field = 'Text') =>
  z.preprocess((v) => (v === null || v === '' ? undefined : v), text(max, field).optional());

export const id = (field = 'id') => text(128, field);

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw new ApiError('invalid-argument', result.error.issues[0]?.message ?? 'Invalid request.');
  return result.data;
}

/** The old Firebase guard: rejects "aaaa" and single-word messages. */
export function contentGuard(value: string): void {
  if (/^(.)\1+$/.test(value.trim())) throw new ApiError('invalid-argument', "That text doesn't look valid.");
  if (!/\s/.test(value.trim())) throw new ApiError('invalid-argument', 'Please write a sentence or two.');
}

export function firstNameInitial(name: string | null | undefined): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Client';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
