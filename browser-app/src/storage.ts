import type { StoredWatchlist } from "./types";

const KEY = "imdb-watchlist-picker-v1";

export function loadWatchlist(): StoredWatchlist | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWatchlist;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWatchlist(data: StoredWatchlist): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearWatchlist(): void {
  localStorage.removeItem(KEY);
}
