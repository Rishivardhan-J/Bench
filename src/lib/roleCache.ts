import type { Role } from '@/types';

/**
 * The last known role, so the header can show the right links on first paint while auth resolves.
 * A per-viewer convenience only: the real role always replaces it, and nothing is authorised by it.
 */
const KEY = 'bench.role';
const ROLES: Role[] = ['client', 'freelancer', 'admin'];

export function readCachedRole(): Role | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return ROLES.includes(v as Role) ? (v as Role) : null;
  } catch {
    return null;
  }
}

export function writeCachedRole(role: Role | null): void {
  try {
    if (role) window.localStorage.setItem(KEY, role);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the header just shows a skeleton instead */
  }
}
