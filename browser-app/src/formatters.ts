/** Turn known provider type codes into labels suitable for the result card. */
export function formatType(type: string | null): string | null {
  if (!type) return null;
  const map: Record<string, string> = {
    movie: "Movie",
    tvmovie: "TV Movie",
    tvseries: "TV Series",
    tvminiseries: "Mini Series",
    tvspecial: "TV Special",
    short: "Short",
    video: "Video",
    videogame: "Game",
  };
  return map[type.replace(/\s+/g, "").toLowerCase()] ?? type;
}

/** Keep vote counts compact in the result details. */
export function formatVotes(count: number | null): string {
  if (count == null) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}K`;
  return String(count);
}

/** Shorten long credits so they fit beside the poster without widening the card. */
export function truncateText(text: string, maxLength = 40): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, Math.max(0, maxLength));
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}


/** Format minutes only at the view; persisted data remains numeric. */
export function formatRuntime(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}
