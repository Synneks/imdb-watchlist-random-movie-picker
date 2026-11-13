import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWatchlistCsv } from "../src/csv.ts";
import { createPickerState, pickerReducer, pickerStatus, currentList } from "../src/pickerState.ts";
import { emptyOptions } from "../src/validation.ts";
import { formatRuntime, truncateText } from "../src/formatters.ts";
import { pickRandom } from "../src/titles.ts";

const imdb = parseWatchlistCsv("Const,Title,Title Type,Runtime (mins)\ntt123,Film,Movie,142\ntt456,Series,TV Series,60");
const letterboxd = parseWatchlistCsv("Name,Letterboxd URI\nOther film,https://boxd.it/aB1");
const initial = () => createPickerState(emptyOptions());
const imported = () => pickerReducer(initial(), { type: "import", parsed: imdb, fileName: "imdb.csv", now: 100 });

// Freeze recursively to detect accidental mutation of an earlier React state snapshot.
function freeze(value: object) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
}

test("filter and enrichment preserve the complete source and original import timestamp", () => {
  const state = imported();
  freeze(state);
  const filtered = pickerReducer(state, { type: "filter", checked: true, now: 200 });
  assert.equal(currentList(filtered)?.items.length, 2);
  assert.equal(currentList(filtered)?.importedAt, 100);
  assert.equal(currentList(filtered)?.updatedAt, 200);
  assert.equal(currentList(state)?.moviesOnly, false);
  const picked = pickerReducer(filtered, { type: "pick", id: "tt123" });
  const enriched = pickerReducer(picked, { type: "enrich", id: "tt123", details: { poster: "https://images.example/poster.jpg", stars: ["Actor"] }, now: 300 });
  assert.deepEqual(enriched.selection, { kind: "result", id: "tt123" });
  assert.equal(currentList(enriched)?.importedAt, 100);
  assert.equal(currentList(enriched)?.items[0].stars[0], "Actor");
  assert.equal(currentList(state)?.items[0].stars.length, 0);
});

test("filtering hides an ineligible result and empty preferences are provider specific", () => {
  const picked = pickerReducer(imported(), { type: "pick", id: "tt456" });
  const filtered = pickerReducer(picked, { type: "filter", checked: true, now: 200 });
  assert.deepEqual(filtered.selection, { kind: "idle" });
  assert.equal(pickerReducer(filtered, { type: "pick", id: "tt456" }), filtered);
  const other = pickerReducer(filtered, { type: "provider", provider: "letterboxd" });
  const emptyFilter = pickerReducer(other, { type: "filter", checked: true, now: 300 });
  assert.equal(currentList(emptyFilter)?.moviesOnly, true);
  const back = pickerReducer(emptyFilter, { type: "provider", provider: "imdb" });
  assert.equal(currentList(back)?.items.length, 2);
  assert.equal(currentList(back)?.moviesOnly, true);
});

test("wrong-provider replacement leaves source, selection and source revision intact", () => {
  const state = pickerReducer(imported(), { type: "pick", id: "tt123" });
  const failed = pickerReducer(state, { type: "import", parsed: letterboxd, fileName: "imdb.csv", now: 200 });
  assert.equal(failed.options, state.options);
  assert.equal(failed.selection, state.selection);
  assert.equal(failed.revision, state.revision);
  assert.match(failed.error!, /Select Letterboxd/);
  const enriched = pickerReducer(failed, { type: "enrich", id: "tt123", details: { poster: null, stars: ["Actor"] }, now: 300 });
  assert.equal(enriched.error, failed.error);
});

test("same-filename replacement resets result and source metadata; clear isolates providers", () => {
  let state = pickerReducer(imported(), { type: "provider", provider: "letterboxd" });
  state = pickerReducer(state, { type: "import", parsed: { ...letterboxd, sourceName: "Weekend" }, fileName: "same.csv", now: 200 });
  state = pickerReducer(state, { type: "pick", id: letterboxd.items[0].id });
  const replaced = pickerReducer(state, { type: "import", parsed: letterboxd, fileName: "same.csv", now: 300 });
  assert.equal(replaced.revision, state.revision + 1);
  assert.deepEqual(replaced.selection, { kind: "idle" });
  assert.equal(currentList(replaced)?.sourceName, undefined);
  const cleared = pickerReducer(replaced, { type: "clear" });
  assert.equal(currentList(cleared), null);
  assert.equal(cleared.options.lists.imdb?.items.length, 2);
  assert.equal(cleared.options.selectedProvider, "letterboxd");
});

test("status is derived from eligible titles and display helpers honor their inputs", () => {
  const state = imported();
  assert.equal(pickerStatus(state), "Imported 2 titles");
  assert.equal(pickerStatus(pickerReducer(state, { type: "filter", checked: true, now: 1 })), "1 titles in list");
  assert.equal(formatRuntime(imdb.items[0].runtimeMinutes), "2h 22m");
  assert.equal(truncateText("abcdefghijk", 8), "abcde...");
  assert.equal(truncateText("abcdefghijk", 2), "ab");
  assert.equal(pickRandom(imdb.items, () => 0), imdb.items[0]);
  assert.equal(pickRandom(imdb.items, () => 0.99), imdb.items[1]);
});

test("canonical IMDb identity deduplicates casing and invalid URLs cannot claim an ID", () => {
  const parsed = parseWatchlistCsv("Const,Title,URL\nTT123,First,https://imdb.com/title/TT123/?x=1\ntt123,Duplicate,\ntt456,Conflict,https://www.imdb.com/title/tt789/\ntt789,Hostile,https://evil.test/title/tt789/");
  assert.deepEqual(parsed.items.map(item => item.id), ["tt123"]);
  assert.equal(parsed.items[0].url, "https://www.imdb.com/title/tt123/");
});
