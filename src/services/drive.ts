import { VNProject } from "../types";
import { getAccessToken } from "./auth";

const BACKUP_MAX = 50;
const API_BASE = "https://www.googleapis.com/drive/v3";

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
    const err = await resp.text();
    throw new Error(`Drive API error: ${resp.status} ${err}`);
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
  try {
    const folderId = project.driveFolderId;
    const fileContent = JSON.stringify(project, null, 2);

    const sanitizedName = project.name.replace(/[<>:"/\\|?*]/g, "_").substring(0, 100);
    const fileName = `${sanitizedName}.json`;

    if (project.driveFileId) {
      const blob = new Blob([fileContent], { type: "application/json" });
      await apiFetch(
        `/files/${project.driveFileId}?uploadType=media`,
        {
          method: "PATCH",
          body: blob,
        }
      );
      return project.driveFileId;
    }

    const boundary = `boundary_${Date.now()}`;
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: fileName, parents: [folderId] }),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      fileContent,
      `--${boundary}--`,
    ].join("\r\n");

    const token = await getAccessToken();
    if (!token) throw new Error("No access token");
    const resp = await fetch(`${API_BASE}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
    const data = await resp.json();
    return data.id;
  } catch {
    return null;
  }
}

export async function createBackup(project: VNProject): Promise<void> {
  if (!project.driveFolderId) return;
  try {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const backupName = `backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
    const fileContent = JSON.stringify(project, null, 2);

    const existing = await apiFetch(
      `/files?q='${project.driveFolderId}' in parents and name contains 'backup-' and trashed=false&fields=files(id,name)&orderBy=createdTime`
    );

    const files: Array<{ id: string; name: string }> = existing.files || [];
    if (files.length >= BACKUP_MAX) {
      const toDelete = files.slice(0, files.length - BACKUP_MAX + 1);
      for (const file of toDelete) {
        await apiFetch(`/files/${file.id}`, { method: "DELETE" });
      }
    }

    const boundary = `backup_${Date.now()}`;
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: backupName, parents: [project.driveFolderId] }),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      fileContent,
      `--${boundary}--`,
    ].join("\r\n");

    const token = await getAccessToken();
    if (!token) return;
    await fetch(`${API_BASE}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
  } catch {
    // Backup failures are non-critical
  }
}

export async function listBackups(driveFolderId: string): Promise<Array<{ id: string; name: string; modified: number }>> {
  try {
    const resp = await apiFetch(
      `/files?q='${driveFolderId}' in parents and name contains 'backup-' and trashed=false&fields=files(id,name,modifiedTime)&orderBy=createdTime`
    );
    return (resp.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      modified: new Date(f.modifiedTime).getTime(),
    }));
  } catch {
    return [];
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


