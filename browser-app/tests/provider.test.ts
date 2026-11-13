import assert from "node:assert/strict";
import { test } from "node:test";
import { applyProviderTheme, PROVIDER_NAMES } from "../src/provider.ts";

test("theme application updates the common React/static-page root without accessing storage", () => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset: {} } } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("denied"); } });
  applyProviderTheme("letterboxd");
  assert.equal(document.documentElement.dataset.provider, "letterboxd");
  applyProviderTheme("imdb");
  assert.equal(document.documentElement.dataset.provider, "imdb");
  assert.equal(PROVIDER_NAMES.letterboxd, "Letterboxd");
});
