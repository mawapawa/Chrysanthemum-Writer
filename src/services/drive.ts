import { VNProject } from "../types";
import { getAccessToken } from "./auth";

const API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token");
  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "(no body)");
    throw new Error(`Drive API error ${resp.status}: ${errBody}`);
  }
  return resp.status === 204 ? null : resp.json();
}

async function uploadFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token");
  const resp = await fetch(`${UPLOAD_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "(no body)");
    throw new Error(`Drive API error ${resp.status}: ${errBody}`);
  }
  return resp.status === 204 ? null : resp.json();
}

export async function loadProjectFromDrive(fileId: string): Promise<VNProject | null> {
  try {
    const resp = await apiFetch(`/files/${fileId}?alt=media`);
    return resp as VNProject;
  } catch {
    return null;
  }
}

export async function saveProjectToDrive(project: VNProject): Promise<string | null> {
  if (!project.driveFolderId) return null;
  const folderId = project.driveFolderId;
  const fileContent = JSON.stringify(project, null, 2);

  const sanitizedName = project.name.replace(/[<>:"/\\|?*]/g, "_").substring(0, 100);
  const fileName = `${sanitizedName}.json`;

  if (project.driveFileId) {
    const blob = new Blob([fileContent], { type: "application/json" });
    await uploadFetch(`/files/${project.driveFileId}?uploadType=media`, {
      method: "PATCH",
      body: blob,
    });
    return project.driveFileId;
  }

  // Step 1: Create file metadata in the target folder (uses API_BASE — no upload)
  const meta = await apiFetch("/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: fileName, parents: [folderId] }),
  });

  // Step 2: Upload content via simple media upload (uses UPLOAD_BASE)
  const uploadBlob = new Blob([fileContent], { type: "application/json" });
  await uploadFetch(`/files/${meta.id}?uploadType=media`, {
    method: "PATCH",
    body: uploadBlob,
  });
  return meta.id;
}

export async function createBackup(project: VNProject): Promise<void> {
  if (!project.driveFolderId) return;
  try {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const backupName = `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
    const fileContent = JSON.stringify(project, null, 2);

    const meta = await apiFetch("/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName, parents: [project.driveFolderId] }),
    });
    const uploadBlob = new Blob([fileContent], { type: "application/json" });
    await uploadFetch(`/files/${meta.id}?uploadType=media`, {
      method: "PATCH",
      body: uploadBlob,
    });
  } catch {
    // Backup failures are non-critical
  }
}

export async function listUserFolders(): Promise<Array<{ id: string; name: string }>> {
  try {
    const resp = await apiFetch(
      `/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)&orderBy=name`
    );
    return resp.files || [];
  } catch {
    return [];
  }
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function parseFolderIdFromUrl(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}


