import { VNProject } from "../types";
import { saveProjectToDrive, createBackup } from "./drive";

export type SyncStatus = "idle" | "saving" | "syncing" | "synced" | "error";

const listeners: Array<(status: SyncStatus, error?: string) => void> = [];

let currentStatus: SyncStatus = "idle";

function setStatus(status: SyncStatus, error?: string): void {
  currentStatus = status;
  listeners.forEach((fn) => fn(status, error));
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function onSyncStatusChange(fn: (status: SyncStatus, error?: string) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export async function triggerDriveSync(project: VNProject): Promise<string | null> {
  if (!project.driveFolderId) return null;
  setStatus("syncing");
  try {
    const fileId = await saveProjectToDrive(project);
    if (fileId) {
      await createBackup(project);
      setStatus("synced");
      setTimeout(() => setStatus("idle"), 3000);
      return fileId;
    }
    setStatus("idle");
    return null;
  } catch {
    setStatus("error", "Drive sync failed");
    return null;
  }
}
