import assert from "node:assert/strict";
import { test } from "node:test";
import { createTitleEnricher } from "../src/enrich.ts";
import { requestImdbSuggestions } from "../src/jsonp.ts";

test("concurrent canonical IMDb IDs share one request and validated result", async () => {
  let resolve!: (value: unknown) => void;
  let calls = 0;
  const enrich = createTitleEnricher(() => { calls++; return new Promise(done => { resolve = done; }); });
  const first = enrich("TT123");
  const second = enrich("tt123");
  assert.equal(first, second);
  await Promise.resolve();
  resolve({ d: [{ id: "tt123", i: { imageUrl: "https://images.example/poster.jpg" }, s: " A, B, C, D " }] });
  assert.deepEqual(await first, { poster: "https://images.example/poster.jpg", stars: ["A", "B", "C"] });
  await enrich("tt123");
  assert.equal(calls, 1);
});

test("network and malformed responses remain retryable; other suggestions never supply details", async () => {
  let calls = 0;
  const enrich = createTitleEnricher(async () => {
    calls++;
    if (calls === 1) throw new Error("offline");
    if (calls === 2) return { d: "invalid" };
    return { d: [{ id: "tt456", s: "Wrong actor" }] };
  });
  for (let i = 0; i < 4; i++) assert.deepEqual(await enrich("tt123"), { poster: null, stars: [] });
  assert.equal(calls, 3);
  assert.deepEqual(await enrich("letterboxd:a"), { poster: null, stars: [] });
  assert.equal(calls, 3);
});

test("malformed artwork and credits never escape the network validation seam", async () => {
  const enrich = createTitleEnricher(async () => ({ d: [null, { id: "tt123", i: { imageUrl: { bad: true } }, s: 42 }] }));
  assert.deepEqual(await enrich("tt123"), { poster: null, stars: [] });
});

test("JSONP success, failure and timeout clean up scripts and restore existing globals", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  let timeout: () => void = () => {};
  let removed = 0;
  let cleared = 0;
  const previousCallback = () => {};
  const fakeWindow: Record<string, unknown> = {
    imdb$tt123: previousCallback,
    setTimeout(callback: () => void) { timeout = callback; return 1; },
    clearTimeout() { cleared++; },
  };
  let script: { src: string; async: boolean; onerror: (() => void) | null; remove: () => void };
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement() { script = { src: "", async: false, onerror: null, remove() { removed++; } }; return script; },
    head: { appendChild() {} },
  } });
  try {
    const success = requestImdbSuggestions("tt123");
    (fakeWindow.imdb$tt123 as (payload: unknown) => void)({ d: [] });
    assert.deepEqual(await success, { d: [] });
    assert.equal(fakeWindow.imdb$tt123, previousCallback);
    const failed = requestImdbSuggestions("tt456");
    script!.onerror!();
    await assert.rejects(failed, /failed/);
    assert.equal(fakeWindow.imdb$tt456, undefined);
    const expired = requestImdbSuggestions("tt789");
    timeout();
    await assert.rejects(expired, /timed out/);
    assert.equal(removed, 3);
    assert.equal(cleared, 3);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else delete (globalThis as Record<string, unknown>).window;
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument); else delete (globalThis as Record<string, unknown>).document;
  }
});
