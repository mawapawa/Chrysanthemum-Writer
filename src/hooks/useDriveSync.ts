import { useState, useEffect, useRef, useCallback } from "react";
import { VNProject } from "../types";
import { SyncStatus, getSyncStatus, onSyncStatusChange, triggerLocalSave, triggerDriveSync } from "../services/sync";

export function useDriveSync(project: VNProject | null, onFileId?: (fileId: string) => void) {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return onSyncStatusChange(setStatus);
  }, []);

  useEffect(() => {
    if (!project) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const fileId = await triggerLocalSave(project);
      if (fileId) onFileId?.(fileId);
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [project, onFileId]);

  const syncNow = useCallback(async () => {
    if (project) {
      const fileId = await triggerDriveSync(project);
      if (fileId) onFileId?.(fileId);
      return fileId;
    }
    return null;
  }, [project, onFileId]);

  return { status, syncNow };
}
