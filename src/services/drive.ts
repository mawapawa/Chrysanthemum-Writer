import { VNProject } from "../types";
import { getAccessToken } from "./auth";

const DRIVE_FOLDER_ID = "1TPuiVoT45CqMCzomIKg94bXkRzMT5EhV";
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

async function ensureProjectFolder(projectName: string): Promise<string> {
  const folderName = encodeURIComponent(projectName);
  const resp = await apiFetch(
    `/files?q=name='${folderName}' and '${DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
  );
  if (resp.files?.length > 0) return resp.files[0].id;

  const created = await apiFetch("/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: projectName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [DRIVE_FOLDER_ID],
    }),
  });
  return created.id;
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
  try {
    const folderId = await ensureProjectFolder(project.name);
    const fileContent = JSON.stringify(project, null, 2);

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
      JSON.stringify({ name: "story-project.json", parents: [folderId] }),
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

export async function listProjectsInDrive(): Promise<Array<{ id: string; name: string; modified: number }>> {
  try {
    const folderName = encodeURIComponent(DRIVE_FOLDER_ID);
    const resp = await apiFetch(
      `/files?q='${folderName}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,modifiedTime)`
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

export async function deleteProjectFromDrive(fileId: string): Promise<void> {
  await apiFetch(`/files/${fileId}`, { method: "DELETE" });
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
    const folderId = encodeURIComponent(driveFolderId);
    const resp = await apiFetch(
      `/files?q='${folderId}' in parents and name contains 'backup-' and trashed=false&fields=files(id,name,modifiedTime)&orderBy=createdTime`
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

export { DRIVE_FOLDER_ID };
