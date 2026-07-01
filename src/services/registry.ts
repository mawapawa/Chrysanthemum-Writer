import { VNProject, VNEntity, VNTracker, VNFlag, VNItem } from "../types";

type RegistryKey = "entities" | "trackers" | "flags" | "inventory";

export interface RegistryActions<T> {
  create(fields: Partial<T> & { name: string }): T;
  update(id: string, fields: Partial<T>): void;
  delete(id: string): void;
  getById(id: string): T | undefined;
  getAll(): T[];
}

type IdGenerator = () => string;

function makeActions<T extends { id: string }>(
  project: VNProject,
  update: (p: VNProject) => void,
  key: RegistryKey,
  genId: IdGenerator,
  build: (fields: Partial<T> & { name: string }) => T,
): RegistryActions<T> {
  const arr = () => project[key] as unknown as T[];

  return {
    create: (fields) => {
      const item = build(fields);
      update({
        ...project,
        [key]: [...arr(), item] as unknown as VNProject[RegistryKey],
        lastModified: Date.now(),
      });
      return item;
    },
    update: (id, fields) => {
      update({
        ...project,
        [key]: arr().map((item) =>
          item.id === id ? { ...item, ...fields } : item,
        ) as unknown as VNProject[RegistryKey],
        lastModified: Date.now(),
      });
    },
    delete: (id) => {
      update({
        ...project,
        [key]: arr().filter((item) => item.id !== id) as unknown as VNProject[RegistryKey],
        lastModified: Date.now(),
      });
    },
    getById: (id) => arr().find((item) => item.id === id),
    getAll: () => [...arr()],
  };
}

export function createEntityActions(
  project: VNProject,
  update: (p: VNProject) => void,
): RegistryActions<VNEntity> {
  return makeActions<VNEntity>(
    project, update, "entities", crypto.randomUUID,
    (f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      color: f.color || "#64748b",
      description: f.description,
      displayId: f.displayId,
    }),
  );
}

export function createTrackerActions(
  project: VNProject,
  update: (p: VNProject) => void,
): RegistryActions<VNTracker> {
  return makeActions<VNTracker>(
    project, update, "trackers", crypto.randomUUID,
    (f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      defaultValue: f.defaultValue ?? 0,
      description: f.description,
      displayId: f.displayId,
    }),
  );
}

export function createFlagActions(
  project: VNProject,
  update: (p: VNProject) => void,
): RegistryActions<VNFlag> {
  return makeActions<VNFlag>(
    project, update, "flags", crypto.randomUUID,
    (f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      defaultValue: f.defaultValue ?? false,
      description: f.description,
      displayId: f.displayId,
    }),
  );
}

export function createItemActions(
  project: VNProject,
  update: (p: VNProject) => void,
): RegistryActions<VNItem> {
  return makeActions<VNItem>(
    project, update, "inventory", crypto.randomUUID,
    (f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      description: f.description,
      displayId: f.displayId,
    }),
  );
}
