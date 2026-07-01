const counters: Record<string, number> = {};

export function generateDisplayId(prefix: string): string {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}-${String(counters[prefix]).padStart(3, "0")}`;
}

export function resetDisplayIdCounters(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
}
