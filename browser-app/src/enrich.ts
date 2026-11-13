import { requestImdbSuggestions } from "./jsonp.ts";
import { isRecord } from "./validation.ts";
import { safeImageUrl } from "./identity.ts";
import type { TitleEnrichment } from "./titles.ts";
export type { TitleEnrichment } from "./titles.ts";

const emptyDetails = (): TitleEnrichment => ({ poster: null, stars: [] });

/** Accept only the requested title so unrelated suggestions never acquire its identity. */
function parsePayload(id: string, payload: unknown): TitleEnrichment {
  if (!isRecord(payload) || !Array.isArray(payload.d)) throw new Error("Invalid IMDb metadata response.");
  const entry = payload.d.find((item: unknown) => isRecord(item) && item.id === id);
  if (!isRecord(entry)) return emptyDetails();
  const image = entry.i;
  const rawPoster = Array.isArray(image) ? image[0] : isRecord(image) ? image.imageUrl : null;
  const poster = safeImageUrl(rawPoster);
  const stars = typeof entry.s === "string" ? entry.s.split(",").map(name => name.trim()).filter(Boolean).slice(0, 3) : [];
  return { poster: poster?.replace(/\._V1_\.jpg$/i, "._V1_UX148_CR0,0,148,219_AL_.jpg") ?? null, stars };
}

/** Deduplicate concurrent lookups and cache valid responses; transient failures remain retryable. */
export function createTitleEnricher(request: (id: string) => Promise<unknown>) {
  const cache = new Map<string, TitleEnrichment>();
  const pending = new Map<string, Promise<TitleEnrichment>>();

  return function enrichTitle(rawId: string): Promise<TitleEnrichment> {
    if (!/^tt\d+$/i.test(rawId)) return Promise.resolve(emptyDetails());
    const id = rawId.toLowerCase();
    const cached = cache.get(id);
    if (cached) return Promise.resolve(cached);
    const active = pending.get(id);
    if (active) return active;
    const response = Promise.resolve().then(() => request(id)).then(payload => {
      const details = parsePayload(id, payload);
      cache.set(id, details);
      return details;
    }).catch(() => emptyDetails()).finally(() => pending.delete(id));
    pending.set(id, response);
    return response;
  };
}

/** A page-scoped client; Letterboxd-only IDs return without touching browser globals. */
export const enrichTitle = createTitleEnricher(requestImdbSuggestions);
