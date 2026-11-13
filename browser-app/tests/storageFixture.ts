import assert from "node:assert/strict";
import { createOptionsStorage } from "../src/storage.ts";
import { decodeWatchlist } from "../src/validation.ts";
import type { Provider } from "../src/types.ts";

// Convenience fixture operations keep existing import/persistence scenarios readable.
export const repository = createOptionsStorage(() => globalThis.localStorage);
export function loadWatchlist(provider?: Provider) {
  const { options } = repository.load();
  return options.lists[provider ?? options.selectedProvider];
}
export function saveWatchlist(value: unknown) {
  const watchlist = decodeWatchlist(value);
  assert.ok(watchlist, "The scenario must provide a valid list");
  const { options } = repository.load();
  assert.deepEqual(repository.save({ ...options, selectedProvider: watchlist.provider, lists: { ...options.lists, [watchlist.provider]: watchlist } }), { ok: true });
}
export function clearWatchlist(provider?: Provider) {
  const { options } = repository.load();
  assert.deepEqual(repository.save({ ...options, lists: { ...options.lists, [provider ?? options.selectedProvider]: null } }), { ok: true });
}
