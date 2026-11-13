/** Parse a public HTTP URL without embedded credentials or custom ports. */
function publicUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.port ? url : null;
  } catch {
    return null;
  }
}

export type FilmIdentity = { id: string; url: string };

/** Canonicalize IMDb title links and reject unrelated hosts and paths. */
export function normalizeImdbUrl(value: string): FilmIdentity | null {
  const url = publicUrl(value);
  if (!url || !["imdb.com", "www.imdb.com"].includes(url.hostname)) return null;
  const match = url.pathname.match(/^\/title\/(tt\d+)\/?$/i);
  if (!match) return null;
  const id = match[1].toLowerCase();
  return { id, url: `https://www.imdb.com/title/${id}/` };
}

/** Normalize film links offline. Short-link codes remain case sensitive. */
export function normalizeLetterboxdUrl(value: string): FilmIdentity | null {
  const url = publicUrl(value);
  if (!url) return null;
  if (url.hostname === "boxd.it" && /^\/[a-zA-Z0-9]+\/?$/.test(url.pathname)) {
    const code = url.pathname.split("/")[1];
    return { id: `letterboxd:boxd:${code}`, url: `https://boxd.it/${code}` };
  }
  if (!["letterboxd.com", "www.letterboxd.com"].includes(url.hostname)) return null;
  const match = url.pathname.match(/^\/film\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i);
  if (!match) return null;
  const slug = match[1].toLowerCase();
  return { id: `letterboxd:${slug}`, url: `https://letterboxd.com/film/${slug}/` };
}

/** Metadata may reference external image hosts, but must use an HTTP scheme. */
export function safeImageUrl(value: unknown): string | null {
  return typeof value === "string" ? publicUrl(value)?.href ?? null : null;
}
