import type { PickerOptions, Provider, StoredWatchlist, Title } from "./types.ts";
import { uniqueTitles } from "./titles.ts";
import { normalizeImdbUrl, normalizeLetterboxdUrl, safeImageUrl } from "./identity.ts";

/** Narrow unknown JSON/network values before inspecting their properties. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** Recover runtime minutes from earlier records that stored formatted runtime text. */
function runtimeMinutes(value: Record<string, unknown>): number | null {
  const numeric = finiteNumber(value.runtimeMinutes);
  if (numeric !== null) return numeric > 0 ? numeric : null;
  if (typeof value.runtime !== "string") return null;
  const match = value.runtime.match(/^(?:(\d+)h\s*)?(\d+)m$/);
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2]) : null;
}

/** Validate identity and rebuild every field, so unknown JSON cannot masquerade as Title. */
function decodeTitle(value: unknown, provider: Provider): Title | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") return null;
  if (value.provider !== undefined && value.provider !== provider) return null;
  const identity = typeof value.url === "string"
    ? (provider === "imdb" ? normalizeImdbUrl(value.url) : normalizeLetterboxdUrl(value.url)) : null;
  if (!identity) return null;
  return {
    provider,
    ...identity,
    ...(provider === "imdb" ? { imdbId: identity.id }
      : typeof value.imdbId === "string" && /^tt\d+$/i.test(value.imdbId) ? { imdbId: value.imdbId.toLowerCase() } : {}),
    title: value.title,
    year: finiteNumber(value.year),
    rating: finiteNumber(value.rating),
    voteCount: finiteNumber(value.voteCount),
    type: text(value.type),
    runtimeMinutes: runtimeMinutes(value),
    director: text(value.director),
    stars: strings(value.stars),
    plot: text(value.plot),
    poster: safeImageUrl(value.poster),
    metascore: finiteNumber(value.metascore),
    certificate: text(value.certificate),
  };
}

/** Legacy records without a provider are IMDb lists; mixed-provider lists are rejected. */
export function decodeWatchlist(value: unknown, expectedProvider?: Provider): StoredWatchlist | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const provider = value.provider ?? "imdb";
  if (provider !== "imdb" && provider !== "letterboxd") return null;
  if (expectedProvider && provider !== expectedProvider) return null;
  const items: Title[] = [];
  for (const raw of value.items) {
    const item = decodeTitle(raw, provider);
    if (!item) return null;
    items.push(item);
  }
  return {
    provider, items: uniqueTitles(items),
    moviesOnly: value.moviesOnly === true,
    importedAt: finiteNumber(value.importedAt) ?? 0,
    fileName: text(value.fileName) ?? "",
    ...(typeof value.sourceName === "string" ? { sourceName: value.sourceName } : {}),
    ...(Array.isArray(value.importWarnings) ? { importWarnings: strings(value.importWarnings) } : {}),
    ...(finiteNumber(value.updatedAt) !== null ? { updatedAt: Number(value.updatedAt) } : {}),
  };
}

export function emptyOptions(): PickerOptions {
  return { selectedProvider: "imdb", lists: { imdb: null, letterboxd: null } };
}

/** Decode slots independently so corruption in one provider does not hide the other. */
export function decodeOptions(value: unknown): { options: PickerOptions; damaged: boolean } | null {
  if (!isRecord(value) || !("imdb" in value || "letterboxd" in value)) return null;
  const imdb = isRecord(value.imdb) ? value.imdb : {};
  const letterboxd = isRecord(value.letterboxd) ? value.letterboxd : {};
  const options: PickerOptions = {
    selectedProvider: letterboxd.selected === true ? "letterboxd" : "imdb",
    lists: { imdb: decodeWatchlist(imdb.watchlist, "imdb"), letterboxd: decodeWatchlist(letterboxd.watchlist, "letterboxd") },
  };
  const damaged = (value.imdb != null && !isRecord(value.imdb))
    || (value.letterboxd != null && !isRecord(value.letterboxd))
    || (imdb.watchlist != null && !options.lists.imdb)
    || (letterboxd.watchlist != null && !options.lists.letterboxd);
  return { options, damaged };
}
