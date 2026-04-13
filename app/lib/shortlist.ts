import type { ShortlistItem } from "./types";

const KEY = "nameaura.shortlist.v1";

export function readShortlist(): ShortlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ShortlistItem[];
  } catch {
    return [];
  }
}

export function writeShortlist(items: ShortlistItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full / blocked, silently ignore
  }
}
