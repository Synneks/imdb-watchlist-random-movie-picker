import type { PickerOptions } from "./types.ts";
import { decodeWatchlist } from "./validation.ts";

export const OPTIONS_KEY = "watchlist-picker-options";
export const LEGACY_KEYS = ["imdb-watchlist-pickerev1", "imdb-watchlist-picker-v1:imdb", "imdb-watchlist-picker-v1:letterboxd", "watchlist-picker-provider-v1"] as const;

/** Parsing is pure; missing or malformed data never triggers a browser write. */
export function parseJson(raw: string | null): unknown {
  try { return raw === null ? null : JSON.parse(raw); }
  catch { return null; }
}

/** Prefer provider-specific records, using the old active copy only to fill a missing slot. */
export function migrateLegacy(values: readonly (string | null)[]): PickerOptions {
  const [activeRaw, imdbRaw, letterboxdRaw, preference] = values;
  const active = decodeWatchlist(parseJson(activeRaw ?? null));
  return {
    selectedProvider: preference === "letterboxd" || (preference == null && active?.provider === "letterboxd") ? "letterboxd" : "imdb",
    lists: {
      imdb: decodeWatchlist(parseJson(imdbRaw ?? null), "imdb") ?? (active?.provider === "imdb" ? active : null),
      letterboxd: decodeWatchlist(parseJson(letterboxdRaw ?? null), "letterboxd") ?? (active?.provider === "letterboxd" ? active : null),
    },
  };
}

/** Preserve the user's single-key/two-provider disk layout while keeping one selection in memory. */
export function serializeOptions(options: PickerOptions): string {
  return JSON.stringify({
    imdb: { selected: options.selectedProvider === "imdb", watchlist: options.lists.imdb },
    letterboxd: { selected: options.selectedProvider === "letterboxd", watchlist: options.lists.letterboxd },
  });
}
