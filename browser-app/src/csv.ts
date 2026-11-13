import type { ParsedList, Title } from "./types.ts";
import { parseCsv, normalizeHeader } from "./csvTable.ts";
import { parseImdbRows } from "./imdbCsv.ts";
import { isCustomFilmHeader, parseLetterboxdCustomListRows, parseLetterboxdWatchlistRows } from "./letterboxdCsv.ts";

export { parseCsv, normalizeHeader } from "./csvTable.ts";
export { normalizeLetterboxdUrl } from "./identity.ts";
export { isMovieType } from "./titles.ts";
export type { ParsedList } from "./types.ts";

/** Detect the CSV's provider/format from its headers, then delegate to that parser. */
export function parseWatchlistCsv(text: string): ParsedList {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map(normalizeHeader);
  // Check custom-list markers first because those exports use a different table layout.
  if (headers[0]?.startsWith("letterboxd list export") || isCustomFilmHeader(rows[0] ?? [])) {
    return parseLetterboxdCustomListRows(rows);
  }
  // A normal Letterboxd watchlist is recognized by its URI column; remaining IMDb exports
  // are recognized by one of their stable ID/URL headers.
  if (headers.includes("letterboxd uri")) {
    return { provider: "letterboxd", items: parseLetterboxdWatchlistRows(rows) };
  }
  if (headers.some((header) => ["const", "imdb id", "tconst", "url", "title url"].includes(header))) {
    return { provider: "imdb", items: parseImdbRows(rows) };
  }
  throw new Error("Unsupported or empty CSV. Import an IMDb list export or an extracted Letterboxd watchlist/custom-list CSV; ZIP files and list URLs are not supported.");
}

/** Direct parser entry points share the row normalizers used by format detection. */
export function parseImdbWatchlistCsv(text: string): Title[] {
  return parseImdbRows(parseCsv(text));
}

/** Read a Letterboxd account watchlist CSV. */
export function parseLetterboxdWatchlistCsv(text: string): Title[] {
  return parseLetterboxdWatchlistRows(parseCsv(text));
}

/** Read either a v7 preamble or a table-only custom-list CSV. */
export function parseLetterboxdCustomListCsv(text: string): ParsedList {
  return parseLetterboxdCustomListRows(parseCsv(text));
}
