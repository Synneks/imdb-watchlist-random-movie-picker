import type { ParsedList, Title } from "./types.ts";
import { normalizeHeader, cell, parseNumber } from "./csvTable.ts";
import { normalizeLetterboxdUrl } from "./identity.ts";
import { uniqueTitles } from "./titles.ts";

/** Parse the watchlist CSV from a Letterboxd account data export. */
export function parseLetterboxdWatchlistRows(rows: string[][]): Title[] {
  const headers = (rows[0] ?? []).map(normalizeHeader);
  const nameIndex = headers.indexOf("name");
  const uriIndex = headers.indexOf("letterboxd uri");
  if (nameIndex < 0 || uriIndex < 0) {
    throw new Error("Unsupported Letterboxd watchlist CSV. Extract watchlist.csv from your account export (Name and Letterboxd URI columns are required).");
  }
  return normalizeLetterboxdFilms(rows.slice(1), headers, uriIndex);
}

/** Build common Title records from Letterboxd's name/URL/year table columns. */
function normalizeLetterboxdFilms(rows: string[][], headers: string[], uriIndex: number): Title[] {
  const nameIndex = headers.indexOf("name");
  const items: Title[] = [];
  // Keep original order and the first valid row for each normalized Letterboxd identity.
  for (const row of rows) {
    const title = cell(row, nameIndex);
    const identity = normalizeLetterboxdUrl(cell(row, uriIndex));
    if (!title || !identity) continue;
    const year = parseNumber(cell(row, headers.indexOf("year")));
    items.push({
      ...identity, provider: "letterboxd", title,
      year: year != null && Number.isInteger(year) && year > 0 ? year : null,
      rating: null, voteCount: null, type: null, runtimeMinutes: null,
      director: null, stars: [], plot: null, poster: null, metascore: null, certificate: null,
    });
  }
  if (!items.length) throw new Error("No valid films found in that Letterboxd CSV. Rows need a name and a Letterboxd film link.");
  return uniqueTitles(items);
}

/** Distinguish a Letterboxd custom-list film table from its metadata preamble. */
export function isCustomFilmHeader(row: string[]): boolean {
  const headers = row.map(normalizeHeader);
  return ["position", "name", "url"].every(header => headers.includes(header));
}

/** v7 account-list exports contain a metadata table before the film table. */
export function parseLetterboxdCustomListRows(rows: string[][]): ParsedList {
  const marker = normalizeHeader(rows[0]?.[0] ?? "");
  const hasPreamble = marker === "letterboxd list export v7";
  const filmIndex = hasPreamble ? rows.findIndex(isCustomFilmHeader) : 0;
  if (filmIndex < 0 || !isCustomFilmHeader(rows[filmIndex] ?? [])) {
    throw new Error("Unsupported Letterboxd custom-list CSV. Expected a Position, Name and URL film table, optionally after a v7 list preamble.");
  }
  // In v7 files, the list name is in the metadata table before the film rows.
  let sourceName: string | undefined;
  if (hasPreamble) {
    const metadataHeaders = (rows[1] ?? []).map(normalizeHeader);
    if (["date", "name", "tags", "url", "description"].every(header => metadataHeaders.includes(header)) && filmIndex > 2) {
      sourceName = cell(rows[2], metadataHeaders.indexOf("name")) || undefined;
    }
  }
  const headers = rows[filmIndex].map(normalizeHeader);
  return {
    provider: "letterboxd",
    sourceName,
    items: normalizeLetterboxdFilms(rows.slice(filmIndex + 1), headers, headers.indexOf("url")),
  };
}

