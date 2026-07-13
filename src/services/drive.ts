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

  const fileName = `chrysanthemum-${project.id}.json`;

  const uploadContent = async (fileId: string): Promise<void> => {
    const blob = new Blob([fileContent], { type: "application/json" });
    await uploadFetch(`/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: blob,
    });
  };

  // If we already have a file ID, just update it in place
  if (project.driveFileId) {
    await uploadContent(project.driveFileId);
    return project.driveFileId;
  }

  // Search for existing UUID-based file in the target folder
  try {
    const escapedName = fileName.replace(/'/g, "\\'");
    const search = await apiFetch(
      `/files?q=name='${escapedName}' and '${folderId}' in parents and trashed=false&fields=files(id,name)&pageSize=1`
    );
    if (search.files && search.files.length > 0) {
      const existingId = search.files[0].id;
      await uploadContent(existingId);
      return existingId;
    }
  } catch {
    // Search failed — fall through to create new file
  }

  // Create file metadata in the target folder
  const meta = await apiFetch("/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: fileName, mimeType: "application/json", parents: [folderId] }),
  });

  // Upload content
  try {
    await uploadContent(meta.id);
  } catch {
    return meta.id;
  }
  return meta.id;
}

export async function scanDriveForProjects(folderId?: string): Promise<Array<{ fileId: string; name: string }>> {
  try {
    let query = `name contains 'chrysanthemum-' and trashed=false`;
    if (folderId) {
      query += ` and '${folderId.replace(/'/g, "\\'")}' in parents`;
    }
    const resp = await apiFetch(
      `/files?q=${query}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`
    );
    return (resp.files || []).map((f: any) => ({ fileId: f.id, name: f.name }));
  } catch (e) {
    console.error("[DRIVE] scanDriveForProjects failed", e);
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

const DRIVE_META_KEY = "chrysanthemum_drive_meta";

export interface DriveMeta {
  folderId: string;
  fileId?: string;
}

export function getLinkedDriveMeta(): DriveMeta | null {
  try {
    const raw = localStorage.getItem(DRIVE_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLinkedDriveMeta(meta: DriveMeta): void {
  localStorage.setItem(DRIVE_META_KEY, JSON.stringify(meta));
}

export function clearLinkedDriveMeta(): void {
  localStorage.removeItem(DRIVE_META_KEY);
}


