const counters: Record<string, number> = {};

export function generateDisplayId(prefix: string): string {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}-${String(counters[prefix]).padStart(3, "0")}`;
}


