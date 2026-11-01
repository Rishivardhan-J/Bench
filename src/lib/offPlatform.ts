// T5: warn when an early message carries a phone number or an external payment link.

const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/;
const PAYMENT =
  /\b(?:paypal\.me|paypal\.com|venmo|cash\.app|cashapp|zelle|wise\.com|revolut|upwork\.com|fiverr\.com|payoneer|bitcoin|btc wallet|western union|wire transfer)\b/i;
const MESSENGER = /\b(?:whatsapp|telegram|signal|wechat|skype)\b/i;

export type OffPlatformReason = 'phone' | 'payment' | 'messenger';

export function detectOffPlatform(text: string): OffPlatformReason | null {
  if (PAYMENT.test(text)) return 'payment';
  if (PHONE.test(text)) return 'phone';
  if (MESSENGER.test(text)) return 'messenger';
  return null;
}

export const OFF_PLATFORM_COPY: Record<OffPlatformReason, string> = {
  phone: 'This looks like a phone number. Keep early conversations on Bench so both sides are protected.',
  payment: 'This looks like an outside payment link. Bench does not handle payments in v1, so be careful with anyone asking to pay elsewhere.',
  messenger: 'This mentions another messaging app. Keep early conversations on Bench so both sides are protected.',
};
