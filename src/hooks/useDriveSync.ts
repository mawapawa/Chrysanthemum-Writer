import { useState, useEffect, useRef, useCallback } from "react";
import { VNProject } from "../types";
import { SyncStatus, getSyncStatus, onSyncStatusChange, triggerDriveSync } from "../services/sync";

export function useDriveSync(project: VNProject | null, onFileId?: (fileId: string) => void) {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return onSyncStatusChange((s, err) => {
      setStatus(s);
      if (err) setErrorMsg(err);
      if (s !== "error") setErrorMsg(null);
    });
  }, []);

  useEffect(() => {
    if (!project) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!project.driveFolderId) return;
    debounceRef.current = setTimeout(async () => {
      const fileId = await triggerDriveSync(project);
      if (fileId) onFileId?.(fileId);
    }, 5000);
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

  return { status, errorMsg, syncNow };
}
