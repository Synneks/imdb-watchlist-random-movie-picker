import type { Provider, Title } from "./types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      if (char === "\r") i += 1;
      continue;
    }

    if (char === "\r") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (inQuotes) throw new Error("Malformed CSV: an opening quote has no closing quote.");
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function column(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index !== -1) return index;
  }
  return -1;
}

function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return (row[index] ?? "").trim();
}

function parseNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatRuntime(minutesValue: string): string | null {
  const minutes = parseNumber(minutesValue);
  if (minutes == null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function titleUrl(constId: string, url: string): string {
  if (url.startsWith("http")) return url;
  if (/^tt\d+$/i.test(constId)) return `https://www.imdb.com/title/${constId}/`;
  return "";
}

export function parseImdbWatchlistCsv(text: string): Title[] {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("That CSV looks empty. Export your list from IMDb and try again.");
  }

  const headers = rows[0].map(normalizeHeader);
  const constIndex = column(headers, ["const", "imdb id", "tconst"]);
  const titleIndex = column(headers, ["title", "name"]);
  const urlIndex = column(headers, ["url", "title url"]);
  const typeIndex = column(headers, ["title type", "titletype", "type"]);
  const ratingIndex = column(headers, ["imdb rating", "rating"]);
  const runtimeIndex = column(headers, ["runtime (mins)", "runtime"]);
  const yearIndex = column(headers, ["year"]);
  const votesIndex = column(headers, ["num votes", "number of votes"]);
  const directorsIndex = column(headers, ["directors", "director"]);
  const descriptionIndex = column(headers, ["description"]);

  if (constIndex < 0 && titleIndex < 0) {
    throw new Error(
      "This does not look like an IMDb export. Use ⋯ → Export on your IMDb watchlist page."
    );
  }

  const items: Title[] = [];
  const seen = new Set<string>();

  for (const row of rows.slice(1)) {
    const constId = cell(row, constIndex);
    const title = cell(row, titleIndex) || "Unknown title";
    const id = /^tt\d+$/i.test(constId) ? constId : constId || title;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const url = titleUrl(constId, cell(row, urlIndex));
    if (!url) continue;

    items.push({
      provider: "imdb",
      imdbId: /^tt\d+$/i.test(constId) ? constId.toLowerCase() : undefined,
      id,
      title,
      year: parseNumber(cell(row, yearIndex)),
      rating: parseNumber(cell(row, ratingIndex)),
      voteCount: parseNumber(cell(row, votesIndex)),
      type: cell(row, typeIndex) || null,
      runtime: formatRuntime(cell(row, runtimeIndex)),
      director: cell(row, directorsIndex) || null,
      stars: [],
      plot: cell(row, descriptionIndex) || null,
      poster: null,
      metascore: null,
      certificate: null,
      url,
    });
  }

  if (!items.length) {
    throw new Error("No titles found in that CSV.");
  }

  return items;
}

export function isMovieType(type: string | null): boolean {
  if (!type) return true;
  const normalized = type.replace(/\s+/g, "").toLowerCase();
  return normalized === "movie" || normalized === "tvmovie";
}

/** Normalize film links without fetching redirects. Short-link identity is case sensitive. */
export function normalizeLetterboxdUrl(value: string): { id: string; url: string } | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    if (url.hostname === "boxd.it" && /^\/[a-zA-Z0-9]+\/?$/.test(url.pathname)) {
      const code = url.pathname.split("/")[1];
      return { id: `letterboxd:boxd:${code}`, url: `https://boxd.it/${code}` };
    }
    if (!["letterboxd.com", "www.letterboxd.com"].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/film\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/i);
    if (!match) return null;
    const slug = match[1].toLowerCase();
    return { id: `letterboxd:${slug}`, url: `https://letterboxd.com/film/${slug}/` };
  } catch {
    return null;
  }
}

export function parseLetterboxdWatchlistCsv(text: string): Title[] {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map(normalizeHeader);
  const nameIndex = headers.indexOf("name");
  const uriIndex = headers.indexOf("letterboxd uri");
  if (nameIndex < 0 || uriIndex < 0) {
    throw new Error("Unsupported Letterboxd watchlist CSV. Extract watchlist.csv from your account export (Name and Letterboxd URI columns are required).");
  }
  const items: Title[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    const title = cell(row, nameIndex);
    const identity = normalizeLetterboxdUrl(cell(row, uriIndex));
    if (!title || !identity || seen.has(identity.id)) continue;
    seen.add(identity.id);
    const year = parseNumber(cell(row, headers.indexOf("year")));
    items.push({
      ...identity, provider: "letterboxd", title,
      year: year != null && Number.isInteger(year) && year > 0 ? year : null,
      rating: null, voteCount: null, type: null, runtime: null,
      director: null, stars: [], plot: null, poster: null, metascore: null, certificate: null,
    });
  }
  if (!items.length) throw new Error("No valid films found in that Letterboxd watchlist CSV. Rows need a name and a Letterboxd film link.");
  return items;
}

export function parseWatchlistCsv(text: string): { provider: Provider; items: Title[] } {
  const headers = (parseCsv(text)[0] ?? []).map(normalizeHeader);
  if (headers.includes("letterboxd uri")) {
    return { provider: "letterboxd", items: parseLetterboxdWatchlistCsv(text) };
  }
  if (headers.some((header) => ["const", "imdb id", "tconst", "url", "title url"].includes(header))) {
    return { provider: "imdb", items: parseImdbWatchlistCsv(text) };
  }
  throw new Error("Unsupported or empty CSV. Import an IMDb list export or the extracted Letterboxd watchlist.csv; ZIP files and list URLs are not supported.");
}
