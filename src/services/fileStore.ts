import { appDataDir, documentDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, exists, mkdir, readDir, remove } from "@tauri-apps/plugin-fs";
import { VNProject } from "../types";
import { migrateProject } from "../utils/schemaMigration";

const DATA_DIR = "Data";

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").substring(0, 100);
}

async function ensureDataDir(): Promise<string | null> {
  try {
    const base = await documentDir();
    const dir = `${base}\\Chrysanthemum\\${DATA_DIR}`;
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
    return dir;
  } catch {
    return null;
  }
}

export async function saveProject(project: VNProject, fileName?: string): Promise<string | null> {
  const dir = await ensureDataDir();
  if (!dir) return null;
  const name = fileName || `${sanitize(project.name)}.chrysanthemum`;
  await writeTextFile(`${dir}\\${name}`, JSON.stringify(project, null, 2));
  return name;
}

export async function loadProject(fileName: string): Promise<VNProject | null> {
  const dir = await ensureDataDir();
  if (!dir) return null;
  const raw = await readTextFile(`${dir}\\${fileName}`);
  return migrateProject(JSON.parse(raw));
}

export async function listProjectFiles(): Promise<string[]> {
  const dir = await ensureDataDir();
  if (!dir) return [];
  const entries = await readDir(dir);
  return entries
    .filter(e => e.name?.endsWith(".chrysanthemum"))
    .map(e => e.name!);
}

export async function deleteProjectFile(fileName: string): Promise<void> {
  const dir = await ensureDataDir();
  if (!dir) return;
  await remove(`${dir}\\${fileName}`);
}

export function migrateLocalStorageKeys(): void {
  const oldVal = localStorage.getItem("storyweaver_vn_project");
  if (oldVal) {
    if (!localStorage.getItem("chrysanthemum_project")) {
      localStorage.setItem("chrysanthemum_project", oldVal);
    }
    localStorage.removeItem("storyweaver_vn_project");
    localStorage.removeItem("storyweaver_all_projects");
  }
}

export async function migrateFromLocalStorage(): Promise<string | null> {
  migrateLocalStorageKeys();
  const saved = localStorage.getItem("chrysanthemum_project");
  if (!saved) return null;
  try {
    const project = migrateProject(JSON.parse(saved));
    const name = await saveProject(project);
    localStorage.removeItem("chrysanthemum_project");
    return name;
  } catch {
    return null;
  }
}

export function fileNameForProject(project: VNProject): string {
  return `${sanitize(project.name)}.chrysanthemum`;
}

export async function migrateFromOldPath(): Promise<void> {
  try {
    const oldBase = await appDataDir();
    const oldDir = `${oldBase}\\${DATA_DIR}`;
    const newBase = await documentDir();
    const newDir = `${newBase}\\Chrysanthemum\\${DATA_DIR}`;
    if (!(await exists(oldDir))) return;
    if (await exists(newDir)) return;
    const entries = await readDir(oldDir);
    const chrysanthemumFiles = entries.filter(e => e.name?.endsWith(".chrysanthemum"));
    if (chrysanthemumFiles.length === 0) return;
    await mkdir(newDir, { recursive: true });
    for (const entry of chrysanthemumFiles) {
      try {
        const content = await readTextFile(`${oldDir}\\${entry.name}`);
        await writeTextFile(`${newDir}\\${entry.name}`, content);
      } catch { /* skip individual file errors */ }
    }
  } catch { /* migration is best-effort */ }
}
