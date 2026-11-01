import type { Availability, Freelancer } from '@/types';

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function money(amount: number, currency: string): string {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });
    currencyFormatters.set(currency, fmt);
  }
  return fmt.format(amount);
}

export function formatMoney(amount: number, currency = 'USD'): string {
  return money(amount, currency);
}

export function formatRate(f: Pick<Freelancer, 'rateMin' | 'rateMax' | 'currency'>): string {
  const lo = money(f.rateMin, f.currency);
  if (f.rateMin === f.rateMax) return `${lo}/hr`;
  return `${lo}–${money(f.rateMax, f.currency)}/hr`;
}

export function formatResponseTime(minutes?: number): string | null {
  if (minutes === undefined) return null;
  if (minutes >= 60 * 24) return `~${Math.round(minutes / (60 * 24))}d`;
  if (minutes >= 60) return `~${Math.round(minutes / 60)}h`;
  return `~${Math.max(1, Math.round(minutes))}m`;
}

export function formatRating(rating?: number): string | null {
  return rating === undefined ? null : rating.toFixed(1);
}

const AVAILABILITY_LABELS: Record<Availability, string> = {
  now: 'Available now',
  this_week: 'This week',
  busy: 'Busy',
  offline: 'Offline',
};

export function availabilityLabel(a: Availability): string {
  return AVAILABILITY_LABELS[a] ?? a;
}

export const AVAILABILITY_OPTIONS = (Object.keys(AVAILABILITY_LABELS) as Availability[]).map((id) => ({
  id,
  label: AVAILABILITY_LABELS[id],
}));

export function localTime(timezone: string, now: Date = new Date()): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(now);
  } catch {
    return null;
  }
}

export function formatRelative(ms?: number, now: number = Date.now()): string {
  if (!ms) return '';
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatClock(ms?: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
