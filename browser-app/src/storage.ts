import type { Provider, StoredWatchlist, Title } from "./types";

const KEY = "imdb-watchlist-picker-v1";
const providerKey = (provider: Provider) => `${KEY}:${provider}`;

function decode(raw: string | null): StoredWatchlist | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.items)) return null;
  // Saved lists predating providers are IMDb lists. Keep their IDs and metadata.
  const provider: Provider = parsed.provider === "letterboxd" ? "letterboxd" : "imdb";
  if (parsed.provider != null && parsed.provider !== "imdb" && parsed.provider !== "letterboxd") return null;
  if (parsed.items.some((item: Title) => !item || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.url !== "string" || (item.provider != null && item.provider !== provider))) return null;
  return {
    ...parsed,
    provider,
    items: parsed.items.map((item: Title) => ({
      ...item,
      provider,
      ...(provider === "imdb" && /^tt\d+$/i.test(item.id) ? { imdbId: item.imdbId ?? item.id.toLowerCase() } : {}),
      stars: Array.isArray(item.stars) ? item.stars : [],
    })),
    moviesOnly: parsed.moviesOnly === true,
    fileName: typeof parsed.fileName === "string" ? parsed.fileName : "",
  };
}

/** No argument restores the last active list; a provider isolates its saved list/settings. */
export function loadWatchlist(provider?: Provider): StoredWatchlist | null {
  try {
    if (provider) {
      const saved = decode(localStorage.getItem(providerKey(provider)));
      if (saved?.provider === provider) return saved;
    }
    const legacy = decode(localStorage.getItem(KEY));
    return !provider || legacy?.provider === provider ? legacy : null;
  } catch {
    return null;
  }
}

export function saveWatchlist(data: StoredWatchlist): void {
  localStorage.setItem(providerKey(data.provider), JSON.stringify(data));
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearWatchlist(provider?: Provider): void {
  const active = loadWatchlist();
  const target = provider ?? active?.provider;
  if (target) localStorage.removeItem(providerKey(target));
  if (!provider || active?.provider === provider) localStorage.removeItem(KEY);
}
