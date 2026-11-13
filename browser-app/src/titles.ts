import type { Title } from "./types.ts";

export type TitleEnrichment = Pick<Title, "poster" | "stars">;

/** Unknown types remain eligible; known series/shorts are excluded by the movie filter. */
export function isMovieType(type: string | null): boolean {
  if (!type) return true;
  return ["movie", "tvmovie"].includes(type.replace(/\s+/g, "").toLowerCase());
}

/** Derive eligible titles while preserving the complete imported source. */
export function eligibleTitles(items: Title[], moviesOnly: boolean): Title[] {
  return moviesOnly ? items.filter(item => isMovieType(item.type)) : items;
}

/** Independent uniform picks allow repeats. Randomness can be controlled in tests. */
export function pickRandom(items: Title[], random: () => number = Math.random): Title | null {
  return items.length ? items[Math.floor(random() * items.length)] : null;
}

/** Merge optional metadata without erasing details already available in the source. */
export function mergeEnrichment(title: Title, details: TitleEnrichment): Title {
  return { ...title, poster: details.poster ?? title.poster, stars: details.stars.length ? details.stars : title.stars };
}

/** Keep the first valid occurrence of a provider-native identity, preserving source order. */
export function uniqueTitles(items: Title[]): Title[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
