import type { SaveData } from "../types";

const STORAGE_KEY = "chrysanthemum_saves";
const MAX_SLOTS = 8;

function readAll(): (SaveData | null)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(MAX_SLOTS).fill(null);
    const parsed = JSON.parse(raw);
    return Array.from({ length: MAX_SLOTS }, (_, i) => parsed[i] ?? null);
  } catch {
    return Array(MAX_SLOTS).fill(null);
  }
}

function writeAll(slots: (SaveData | null)[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

export function listSlots(): (SaveData | null)[] {
  return readAll();
}

export function saveSlot(slot: number, data: SaveData): boolean {
  if (slot < 0 || slot >= MAX_SLOTS) return false;
  const slots = readAll();
  slots[slot] = { ...data, slot, timestamp: Date.now() };
  writeAll(slots);
  return true;
}

export function loadSlot(slot: number): SaveData | null {
  if (slot < 0 || slot >= MAX_SLOTS) return null;
  const slots = readAll();
  return slots[slot];
}

export function deleteSlot(slot: number): boolean {
  if (slot < 0 || slot >= MAX_SLOTS) return false;
  const slots = readAll();
  slots[slot] = null;
  writeAll(slots);
  return true;
}

export function getMaxSlots(): number {
  return MAX_SLOTS;
}