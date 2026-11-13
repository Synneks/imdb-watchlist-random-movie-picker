import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { loadSelectedProvider, selectProvider } from "../src/provider.ts";
import { clearWatchlist, loadWatchlist, saveWatchlist } from "../src/storage.ts";
import { parseWatchlistCsv } from "../src/csv.ts";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
Object.defineProperty(globalThis, "document", { value: { documentElement: { dataset: {} } } });
beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
});

test("provider preference survives selection, rejects invalid values and tolerates unavailable storage", () => {
  assert.equal(loadSelectedProvider(), "imdb");
  selectProvider("letterboxd");
  assert.equal(loadSelectedProvider(), "letterboxd");
  assert.equal(document.documentElement.dataset.provider, "letterboxd");
  selectProvider("imdb");
  assert.equal(loadSelectedProvider(), "imdb");
  values.set("watchlist-picker-provider-v1", "other");
  assert.equal(loadSelectedProvider(), "imdb");
  Object.defineProperty(globalThis, "localStorage", { value: {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
  }, configurable: true });
  assert.equal(loadSelectedProvider(), "imdb");
  assert.doesNotThrow(() => selectProvider("letterboxd"));
  assert.equal(document.documentElement.dataset.provider, "letterboxd");
});

test("first Letterboxd import preserves a legacy-only IMDb list and its filter", () => {
  const legacy = {
    items: [{ id: "tt123", title: "Legacy film", url: "https://www.imdb.com/title/tt123/", rating: 8.2, stars: [] }],
    fileName: "old.csv", moviesOnly: true, importedAt: 123,
  };
  values.set("imdb-watchlist-picker-v1", JSON.stringify(legacy));
  const before = new Map(values);
  selectProvider("letterboxd");
  assert.equal(loadWatchlist("letterboxd"), null);
  assert.equal(values.get("imdb-watchlist-picker-v1"), before.get("imdb-watchlist-picker-v1"));
  const imported = parseWatchlistCsv("Name,Year,Letterboxd URI\nNew film,2000,https://letterboxd.com/film/new-film/");
  saveWatchlist({ ...imported, moviesOnly: false, fileName: "new.csv", importedAt: 456 });
  assert.equal(loadWatchlist("imdb")?.items[0].title, "Legacy film");
  assert.equal(loadWatchlist("imdb")?.items[0].rating, 8.2);
  assert.equal(loadWatchlist("imdb")?.moviesOnly, true);
  assert.equal(loadWatchlist("imdb")?.importedAt, 123);
  clearWatchlist("letterboxd");
  assert.equal(loadWatchlist("letterboxd"), null);
  assert.equal(loadWatchlist("imdb")?.items.length, 1);
});
