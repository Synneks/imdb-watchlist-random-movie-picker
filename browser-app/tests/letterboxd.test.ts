import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, beforeEach } from "node:test";
import { parseCsv, parseWatchlistCsv, parseLetterboxdWatchlistCsv, parseImdbWatchlistCsv, normalizeLetterboxdUrl, isMovieType } from "../src/csv.ts";
import { loadWatchlist, saveWatchlist, clearWatchlist } from "../src/storage.ts";
import { enrichTitle } from "../src/enrich.ts";

const fixture = readFileSync(new URL("./fixtures/letterboxd-watchlist.csv", import.meta.url), "utf8");
const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
}, configurable: true });
beforeEach(() => values.clear());

test("public watchlist fixture imports four native identities and safe metadata", () => {
  const { provider, items } = parseWatchlistCsv(fixture);
  assert.equal(provider, "letterboxd");
  assert.equal(items.length, 4);
  assert.equal(items[0].url, "https://boxd.it/5xme");
  assert.equal(items[0].id, "letterboxd:boxd:5xme");
  assert.equal(items[0].year, 2017);
  for (const item of items) {
    assert.equal(item.provider, provider);
    assert.equal(item.rating, null);
    assert.equal(item.voteCount, null);
    assert.deepEqual(item.stars, []);
    assert.equal(item.imdbId, undefined);
    assert.equal(isMovieType(item.type), true);
  }
});

test("BOM, quoting, line endings, duplicates, optional year and malformed rows", () => {
  const items = parseLetterboxdWatchlistCsv('\uFEFFName,Letterboxd URI,Year,Rating\r\n"A, ""film""\nwith newline",http://www.letterboxd.com/film/a-film/?x=1,,5\r\nDuplicate,https://letterboxd.com/film/a-film/,2001,4\rBroken,https://evil.test/film/a/,,\rMissing,,2002,\rShort,https://boxd.it/aB1/,nope,4');
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'A, "film"\nwith newline');
  assert.equal(items[0].url, "https://letterboxd.com/film/a-film/");
  assert.equal(items[0].year, null);
  assert.equal(items[1].year, null);
  assert.equal(items[0].rating, null); // Personal ratings never enter IMDb aggregate data.
  assert.deepEqual(parseCsv('a,b\rc,d\r\n"e,f",g\n'), [["a","b"],["c","d"],["e,f","g"]]);
});

test("strict film links reject unsafe origins, account pages and malformed URLs", () => {
  for (const value of ["javascript:alert(1)", "https://letterboxd.com.evil.test/film/a/", "https://letterboxd.com/user/film/a/", "https://letterboxd.com/list/a/", "https://user@letterboxd.com/film/a/", "https://letterboxd.com:444/film/a/", "bad", "https://boxd.it/a/b"]) {
    assert.equal(normalizeLetterboxdUrl(value), null, value);
  }
  assert.notEqual(normalizeLetterboxdUrl("https://boxd.it/aB")?.id, normalizeLetterboxdUrl("https://boxd.it/ab")?.id);
});

test("empty/unsupported/unclosed CSV and entirely invalid films fail", () => {
  for (const text of ["", "Name,Year\nA,2000", "Name,Letterboxd URI\n", "Name,Letterboxd URI\nA,https://evil.test", 'Name,Letterboxd URI\n"A,https://boxd.it/1']) {
    assert.throws(() => parseWatchlistCsv(text));
  }
});

test("IMDb CSV and legacy saved data preserve identity, details and filters", () => {
  const items = parseImdbWatchlistCsv("Const,Title,URL,IMDb Rating,Title Type\ntt123,Example,https://www.imdb.com/title/tt123/,8.2,Movie");
  assert.equal(items[0].id, "tt123");
  assert.equal(items[0].provider, "imdb");
  assert.equal(items[0].imdbId, "tt123");
  const { provider: _provider, imdbId: _imdbId, ...legacyItem } = items[0];
  values.set("imdb-watchlist-picker-v1", JSON.stringify({ items: [legacyItem], fileName: "old.csv", moviesOnly: true, importedAt: 1 }));
  const restored = loadWatchlist("imdb")!;
  assert.equal(restored.provider, "imdb");
  assert.equal(restored.items[0].rating, 8.2);
  assert.equal(restored.items[0].imdbId, "tt123");
  assert.equal(restored.moviesOnly, true);
  assert.equal(loadWatchlist("letterboxd"), null);
});

test("provider restore, replacement, failure preservation and clear isolation", () => {
  const letterboxd = { ...parseWatchlistCsv(fixture), fileName: "watchlist.csv", importedAt: 1, moviesOnly: false, importWarnings: ["kept"] };
  saveWatchlist(letterboxd);
  assert.deepEqual(loadWatchlist(), letterboxd);
  assert.throws(() => parseWatchlistCsv("bad"));
  assert.deepEqual(loadWatchlist(), letterboxd);
  saveWatchlist({ provider: "imdb", items: [], fileName: "", importedAt: 2, moviesOnly: true });
  assert.equal(loadWatchlist("imdb")?.moviesOnly, true);
  assert.deepEqual(loadWatchlist("letterboxd"), letterboxd);
  clearWatchlist("imdb");
  assert.equal(loadWatchlist("imdb"), null);
  assert.deepEqual(loadWatchlist("letterboxd"), letterboxd);
  saveWatchlist(letterboxd);
  clearWatchlist();
  assert.equal(loadWatchlist(), null);
  assert.equal(loadWatchlist("letterboxd"), null);
});

test("corrupt storage is ignored and provider mixing rejected", () => {
  values.set("imdb-watchlist-picker-v1", "{");
  assert.equal(loadWatchlist(), null);
  values.set("imdb-watchlist-picker-v1", JSON.stringify({ provider: "imdb", items: parseLetterboxdWatchlistCsv(fixture) }));
  assert.equal(loadWatchlist(), null);
});

test("Letterboxd-only identities never touch JSONP/browser APIs", async () => {
  for (const item of parseLetterboxdWatchlistCsv(fixture)) {
    assert.deepEqual(await enrichTitle(item.id), { poster: null, stars: [] });
  }
});


test("first import from another provider preserves legacy-only IMDb data", () => {
  const items = parseImdbWatchlistCsv("Const,Title\ntt123,Legacy");
  values.set("imdb-watchlist-picker-v1", JSON.stringify({ items, fileName: "legacy.csv", importedAt: 1, moviesOnly: true }));
  saveWatchlist({ ...parseWatchlistCsv(fixture), fileName: "watchlist.csv", importedAt: 2, moviesOnly: false });
  assert.equal(loadWatchlist("imdb")?.fileName, "legacy.csv");
  assert.equal(loadWatchlist("imdb")?.items[0].id, "tt123");
  assert.equal(loadWatchlist("letterboxd")?.items.length, 4);
});
