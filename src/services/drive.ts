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

function cleanName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 40);
}

function dateCode(): string {
  const d = new Date();
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}${d.getFullYear().toString().slice(-2)}`;
}

export async function saveProjectToDrive(project: VNProject): Promise<string | null> {
  if (!project.driveFolderId) return null;
  const folderId = project.driveFolderId;
  const fileContent = JSON.stringify(project, null, 2);

  const fileName = `${cleanName(project.name)}-${dateCode()}.json`;

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

  // Search for existing file by project name (any date) in the target folder
  try {
    const namePrefix = cleanName(project.name);
    const searchParams = new URLSearchParams({
      q: `name contains '${namePrefix}-' and '${folderId}' in parents and trashed=false`,
      fields: "files(id,name)",
      pageSize: "1",
    });
    const search = await apiFetch(`/files?${searchParams}`);
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

export async function scanDriveForProjects(folderId?: string): Promise<Array<{ fileId: string; name: string; modifiedTime?: string }>> {
  try {
    let q = `(name contains '.chrysanthemum' or name contains '.json') and trashed=false`;
    if (folderId) {
      q += ` and '${folderId.replace(/'/g, "\\'")}' in parents`;
    }
    const params = new URLSearchParams({ q, fields: "files(id,name,modifiedTime)", orderBy: "modifiedTime desc", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
    const resp = await apiFetch(`/files?${params}`);
    return (resp.files || []).map((f: any) => ({ fileId: f.id, name: f.name, modifiedTime: f.modifiedTime }));
  } catch (e) {
    console.error("[DRIVE] scanDriveForProjects failed", e);
    return [];
  }
}

export async function listUserFolders(): Promise<Array<{ id: string; name: string }>> {
  try {
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id,name)",
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    const resp = await apiFetch(`/files?${params}`);
    if (!resp.files || resp.files.length === 0) {
      console.warn("[DRIVE] listUserFolders returned 0 folders — token may have wrong scope. Try signing out and back in.");
    }
    return resp.files || [];
  } catch (e) {
    console.error("[DRIVE] listUserFolders failed", e);
    return [];
  }
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function parseFileIdFromUrl(url: string): string | null {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Also accept bare file ID (no URL)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(url.trim())) return url.trim();
  return null;
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


