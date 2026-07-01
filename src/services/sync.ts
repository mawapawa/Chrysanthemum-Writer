import { VNProject } from "../types";
import { saveProjectToDrive, createBackup } from "./drive";

export type SyncStatus = "idle" | "saving" | "syncing" | "error";

export type SyncEventListener = (status: SyncStatus, error?: string) => void;

const listeners: SyncEventListener[] = [];

let currentStatus: SyncStatus = "idle";
let lastProject: VNProject | null = null;
let driveSyncTimer: ReturnType<typeof setTimeout> | null = null;

function setStatus(status: SyncStatus, error?: string): void {
  currentStatus = status;
  listeners.forEach((fn) => fn(status, error));
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function onSyncStatusChange(fn: SyncEventListener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function triggerLocalSave(project: VNProject): Promise<string | null> {
  lastProject = project;
  setStatus("saving");

  if (driveSyncTimer) clearTimeout(driveSyncTimer);
  return new Promise<string | null>((resolve) => {
    driveSyncTimer = setTimeout(async () => {
      const fileId = await triggerDriveSync(project);
      resolve(fileId);
    }, 20000);
  });
}

export async function triggerDriveSync(project: VNProject): Promise<string | null> {
  setStatus("syncing");
  try {
    const fileId = await saveProjectToDrive(project);
    if (fileId) {
      await createBackup(project);
    }
    setStatus("idle");
    return fileId;
  } catch {
    setStatus("error", "Drive sync failed");
    return null;
  }
}

export async function triggerFullSync(project: VNProject): Promise<void> {
  if (driveSyncTimer) clearTimeout(driveSyncTimer);
  await triggerDriveSync(project);
}
