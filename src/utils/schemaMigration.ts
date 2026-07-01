import { VNProject, VNEntity, VNTracker, VNFlag, VNItem } from "../types";

export function migrateProject(project: VNProject & Record<string, unknown>): VNProject {
  if (project.schemaVersion >= 2) return project as VNProject;

  const entities: VNEntity[] = (project.characters as VNProject["characters"] || []).map(c => ({
    id: c.id,
    name: c.name,
    color: c.color || "#64748b",
    description: c.description,
    displayId: c.displayId,
  }));

  const allVars = (project.variables || []) as VNProject["variables"];
  const trackers: VNTracker[] = allVars
    .filter(v => v.type === "number")
    .map(v => ({
      id: v.id || crypto.randomUUID(),
      name: v.name,
      defaultValue: v.defaultValue as number,
      description: v.description,
      displayId: v.displayId,
    }));

  const flags: VNFlag[] = allVars
    .filter(v => v.type === "boolean")
    .map(v => ({
      id: v.id || crypto.randomUUID(),
      name: v.name,
      defaultValue: v.defaultValue as boolean,
      description: v.description,
      displayId: v.displayId,
    }));

  const inventory: VNItem[] = ((project as Record<string, unknown>).items as VNItem[] || []).map(i => ({
    id: i.id,
    name: i.name,
    description: i.description,
    displayId: i.displayId,
  }));

  const result: VNProject & Record<string, unknown> = {
    ...project,
    entities,
    trackers,
    flags,
    inventory,
    schemaVersion: 2,
  };
  delete result.variables;
  delete result.characters;
  delete (result as Record<string, unknown>).items;
  return result as VNProject;
}
