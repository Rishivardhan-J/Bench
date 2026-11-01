/** Remembers scroll positions per history entry so Back returns to where the person was. */
const MAX_ENTRIES = 50;
const positions = new Map<string, number>();

export function rememberScroll(key: string, y: number): void {
  positions.delete(key);
  positions.set(key, y);
  if (positions.size > MAX_ENTRIES) positions.delete(positions.keys().next().value as string);
}

export function recallScroll(key: string): number | undefined {
  return positions.get(key);
}

export function clearScrollMemory(): void {
  positions.clear();
}
