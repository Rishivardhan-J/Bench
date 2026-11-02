import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.ts';

/**
 * File storage seam. Local disk is the only driver today; an S3-compatible driver
 * would implement the same four methods.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
}

function safeKey(key: string): string {
  const normal = path.posix.normalize(key);
  if (normal.startsWith('..') || path.posix.isAbsolute(normal) || normal.includes('\0')) throw new Error('Bad storage key');
  return normal;
}

class LocalStorage implements Storage {
  constructor(private readonly dir: string) {}
  private resolve(key: string) {
    return path.join(this.dir, safeKey(key));
  }
  async put(key: string, data: Buffer) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }
  async get(key: string) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
  async exists(key: string) {
    return fs.stat(this.resolve(key)).then((s) => s.isFile(), () => false);
  }
  async remove(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
  async removePrefix(prefix: string) {
    await fs.rm(this.resolve(prefix), { recursive: true, force: true });
  }
}

export const storage: Storage = new LocalStorage(config.storage.dir);

export type FileKind = 'image' | 'gif' | 'pdf' | 'text';

const SIGNATURES: { kind: FileKind; mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { kind: 'image', mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { kind: 'image', mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { kind: 'image', mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { kind: 'gif', mime: 'image/gif', ext: 'gif', test: (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')) },
  { kind: 'pdf', mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
];

/** Identifies a file from its bytes, never from the name or the browser's claim. */
export function sniff(data: Buffer): { kind: FileKind; mime: string; ext: string } | null {
  const hit = SIGNATURES.find((s) => s.test(data));
  if (hit) return hit;
  // Plain text: valid UTF-8 with no control bytes other than whitespace.
  const head = data.subarray(0, 4096);
  if (head.length > 0 && !head.some((b) => b === 0) && Buffer.from(head.toString('utf8'), 'utf8').length >= head.length - 3) {
    return { kind: 'text', mime: 'text/plain', ext: 'txt' };
  }
  return null;
}

export const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', txt: 'text/plain' };

export const newFileName = (ext: string) => `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
