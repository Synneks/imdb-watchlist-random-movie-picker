import type { Title } from "./types.ts";
import { normalizeHeader, column, cell, parseNumber } from "./csvTable.ts";
import { normalizeImdbUrl } from "./identity.ts";
import { uniqueTitles } from "./titles.ts";

/** Resolve historical export aliases once per table. */
function imdbColumns(headers: string[]) {
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

  return { constIndex, titleIndex, urlIndex, typeIndex, ratingIndex, runtimeIndex, yearIndex, votesIndex, directorsIndex, descriptionIndex };
}

/** Normalize one row; unsupported URLs and conflicting IDs are not imported. */
function parseImdbRow(row: string[], columns: ReturnType<typeof imdbColumns>): Title | null {
  const { constIndex, titleIndex, urlIndex, typeIndex, ratingIndex, runtimeIndex, yearIndex, votesIndex, directorsIndex, descriptionIndex } = columns;
  const constId = cell(row, constIndex);
  const rawUrl = cell(row, urlIndex);
  const identity = normalizeImdbUrl(rawUrl || `https://www.imdb.com/title/${constId}/`);
  if (!identity || (/^tt\d+$/i.test(constId) && identity.id !== constId.toLowerCase())) return null;
  const minutes = parseNumber(cell(row, runtimeIndex));
  return {
    provider: "imdb", ...identity, imdbId: identity.id,
    title: cell(row, titleIndex) || "Unknown title",
    year: parseNumber(cell(row, yearIndex)), rating: parseNumber(cell(row, ratingIndex)),
    voteCount: parseNumber(cell(row, votesIndex)), type: cell(row, typeIndex) || null,
    runtimeMinutes: minutes !== null && minutes > 0 ? minutes : null,
    director: cell(row, directorsIndex) || null, stars: [],
    plot: cell(row, descriptionIndex) || null, poster: null, metascore: null, certificate: null,
  };
}

/** Normalize an IMDb table, preserving the first valid row for each canonical identity. */
export function parseImdbRows(rows: string[][]): Title[] {
  if (rows.length < 2) throw new Error("That CSV looks empty. Export your list from IMDb and try again.");
  const columns = imdbColumns(rows[0].map(normalizeHeader));
  if (columns.constIndex < 0 && columns.titleIndex < 0) throw new Error("This does not look like an IMDb export. Use ⋯ → Export on your IMDb watchlist page.");
  const items = uniqueTitles(rows.slice(1).map(row => parseImdbRow(row, columns)).filter((item): item is Title => item !== null));
  if (!items.length) throw new Error("No titles found in that CSV.");
  return items;
}
