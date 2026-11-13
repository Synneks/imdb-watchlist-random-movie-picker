import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createOptionsStorage } from "../src/storage.ts";
import { emptyOptions } from "../src/validation.ts";
import { parseWatchlistCsv } from "../src/csv.ts";
import type { Provider, StoredWatchlist } from "../src/types.ts";

const KEY = "watchlist-picker-options";
const LEGACY = "imdb-watchlist-picker-v1";
const values = new Map<string, string>();
let failWrites = false;
const repository = createOptionsStorage(() => ({
  getItem: key => values.get(key) ?? null,
  setItem(key, value) { if (failWrites) throw new Error("quota"); values.set(key, value); },
  removeItem(key) { values.delete(key); },
}));
beforeEach(() => { values.clear(); failWrites = false; });

function list(provider: Provider): StoredWatchlist {
  const text = provider === "imdb" ? "Const,Title\ntt123,Original" : "Name,Letterboxd URI\nOriginal,https://letterboxd.com/film/original/";
  return { ...parseWatchlistCsv(text), fileName: `${provider}.csv`, sourceName: "Original list", importedAt: 123, moviesOnly: true, importWarnings: ["Source diagnostic"] };
}

test("one unversioned key stores two provider slots with exactly one selected flag", () => {
  const options = { selectedProvider: "letterboxd" as const, lists: { imdb: list("imdb"), letterboxd: list("letterboxd") } };
  assert.deepEqual(repository.save(options), { ok: true });
  assert.deepEqual([...values.keys()], [KEY]);
  assert.deepEqual(JSON.parse(values.get(KEY)!), {
    imdb: { selected: false, watchlist: options.lists.imdb },
    letterboxd: { selected: true, watchlist: options.lists.letterboxd },
  });
  assert.deepEqual(repository.load().options, options);
});

test("read-only legacy recovery and explicit startup migration preserve both slots and preference", () => {
  const imdb = list("imdb");
  const letterboxd = list("letterboxd");
  values.set(LEGACY, JSON.stringify({ ...imdb, fileName: "Stale duplicate" }));
  values.set(`${LEGACY}:imdb`, JSON.stringify(imdb));
  values.set(`${LEGACY}:letterboxd`, JSON.stringify(letterboxd));
  values.set("watchlist-picker-provider-v1", "letterboxd");
  const before = new Map(values);
  const loaded = repository.load();
  assert.equal(loaded.needsMigration, true);
  assert.deepEqual(values, before);
  assert.deepEqual(loaded.options.lists, { imdb, letterboxd });
  assert.equal(loaded.options.selectedProvider, "letterboxd");
  assert.equal(repository.initialize().needsMigration, false);
  assert.deepEqual([...values.keys()], [KEY]);
});

test("active-only legacy data recovers despite a corrupt sibling; old runtime text migrates", () => {
  const old = list("imdb");
  const { runtimeMinutes: _, ...title } = old.items[0];
  values.set(LEGACY, JSON.stringify({ ...old, items: [{ ...title, runtime: "2h 22m" }] }));
  values.set(`${LEGACY}:letterboxd`, "{");
  const restored = repository.initialize().options;
  assert.equal(restored.lists.imdb?.items[0].runtimeMinutes, 142);
  assert.equal(restored.lists.imdb?.importedAt, 123);
  assert.equal(restored.lists.letterboxd, null);
});

test("failed migration retains originals and a failed write reports an explicit error", () => {
  values.set(LEGACY, JSON.stringify(list("imdb")));
  failWrites = true;
  const before = new Map(values);
  const result = repository.initialize();
  assert.equal(result.options.lists.imdb?.items.length, 1);
  assert.match(result.warning!, /Could not save/);
  assert.deepEqual(values, before);
  assert.equal(repository.save(emptyOptions()).ok, false);
  assert.deepEqual(values, before);
});

test("cleared unified slots are authoritative over stale legacy data", () => {
  repository.save({ selectedProvider: "letterboxd", lists: { imdb: null, letterboxd: list("letterboxd") } });
  values.set(LEGACY, JSON.stringify(list("imdb")));
  assert.equal(repository.load().options.lists.imdb, null);
  assert.equal(repository.load().options.lists.letterboxd?.sourceName, "Original list");
});

test("untrusted metadata is normalized and provider corruption stays isolated", () => {
  const imdb = list("imdb");
  values.set(KEY, JSON.stringify({
    imdb: { selected: true, watchlist: { ...imdb, items: [{ ...imdb.items[0], rating: "8.2", stars: ["Valid", 42], poster: "javascript:alert(1)" }] } },
    letterboxd: { selected: true, watchlist: imdb },
  }));
  const { options, warning } = repository.load();
  assert.equal(options.lists.imdb?.items[0].rating, null);
  assert.equal(options.lists.imdb?.items[0].poster, null);
  assert.deepEqual(options.lists.imdb?.items[0].stars, ["Valid"]);
  assert.equal(options.lists.letterboxd, null);
  assert.equal(options.selectedProvider, "letterboxd");
  assert.match(warning!, /could not be restored/);
});

test("missing, corrupt and inaccessible storage produce distinct feedback", () => {
  assert.equal(repository.load().warning, null);
  values.set(KEY, "{");
  assert.match(repository.load().warning!, /could not be restored/);
  const blocked = createOptionsStorage(() => { throw new Error("denied"); });
  assert.match(blocked.load().warning!, /unavailable/);
  assert.equal(blocked.save(emptyOptions()).ok, false);
});

test("successful save survives cleanup failure after the unified record is committed", () => {
  const cleanupFails = createOptionsStorage(() => ({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem() { throw new Error("denied"); },
  }));
  assert.deepEqual(cleanupFails.save(emptyOptions()), { ok: true });
  assert.deepEqual(cleanupFails.load().options, emptyOptions());
});
