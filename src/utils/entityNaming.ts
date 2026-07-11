export function entityTrackerName(entityName: string, statName: string): string {
  const base = `${entityName}_${statName}`;
  return base.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().replace(/_+/g, "_");
}

export function entityFlagName(entityName: string, flagName: string): string {
  const base = `${entityName}_${flagName}`;
  return base.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().replace(/_+/g, "_");
}

export function parseEntityTrackerName(trackerName: string): { entity: string; stat: string } | null {
  const idx = trackerName.indexOf("_");
  if (idx === -1) return null;
  return { entity: trackerName.slice(0, idx), stat: trackerName.slice(idx + 1) };
}