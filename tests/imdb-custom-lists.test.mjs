import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const fixture = (name) => read(`tests/fixtures/imdb/${name}`);
const require = createRequire(new URL('../browser-app/package.json', import.meta.url));
const ts = require('typescript');
// Resolve relative TS dependencies too, so provider-model refactors can retain
// the public IMDb parser/storage interfaces without breaking this harness.
function tsModuleUrl(file) {
  let js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  js = js.replace(/(from\s+|import\s*)(["'])(\.[^"']+)\2/g, (_match, prefix, quote, specifier) => {
    const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    return `${prefix}${quote}${tsModuleUrl(dependency.endsWith('.ts') ? dependency : `${dependency}.ts`)}${quote}`;
  });
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
async function tsModule(file) {
  return import(tsModuleUrl(file));
}
const { parseImdbWatchlistCsv, isMovieType } = await tsModule('browser-app/src/csv.ts');
const watchlistCode = read('chrome-extension/lib/watchlist.js');
const { parseWatchlistUrl, pickRandom } = await import(`data:text/javascript;base64,${Buffer.from(watchlistCode).toString('base64')}`);

test('IMDb custom-list CSV: unique identities, links, quotes, BOM/CRLF and local movie filtering', () => {
  for (const text of [fixture('custom-list.csv'), '\uFEFF' + fixture('custom-list.csv').replaceAll('\n', '\r\n')]) {
    const items = parseImdbWatchlistCsv(text);
    assert.equal(items.length, 4);
    assert.equal(items[0].plot, 'A note, with commas');
    assert.match(items[1].plot, /embedded newline/);
    assert.equal(items[0].runtime, '2h 22m');
    assert.equal(items[2].url, 'https://www.imdb.com/title/tt0050083/');
    assert.equal(items.filter((item) => isMovieType(item.type)).length, 3);
    assert.ok(items.includes(pickRandom(items)));
    for (const item of items) assert.equal(item.url, `https://www.imdb.com/title/${item.id}/`);
  }
});

test('IMDb saved custom lists restore, replace and clear; failed parse leaves storage intact', async () => {
  const data = new Map();
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  try {
    const storage = await tsModule('browser-app/src/storage.ts');
    const saved = { items: parseImdbWatchlistCsv(fixture('custom-list.csv')), moviesOnly: false, importedAt: 1, fileName: 'custom-list.csv' };
    storage.saveWatchlist(saved);
    assert.deepEqual(storage.loadWatchlist(), { ...saved, provider: "imdb" });
    assert.throws(() => parseImdbWatchlistCsv('not an export'));
    assert.deepEqual(storage.loadWatchlist(), { ...saved, provider: "imdb" });
    storage.saveWatchlist({ ...saved, items: [saved.items[0]], moviesOnly: true });
    assert.equal(storage.loadWatchlist().items.length, 1);
    storage.clearWatchlist();
    assert.equal(storage.loadWatchlist(), null);
  } finally { delete globalThis.localStorage; }
});

test('IMDb source parsing canonicalizes list/watchlist IDs and rejects unrelated paths and hosts', () => {
  for (const input of ['ls123456789', 'LS123456789', 'imdb.com/list/ls123456789', 'https://www.imdb.com/list/ls123456789/?sort=alpha#top']) {
    assert.equal(parseWatchlistUrl(input)?.url, 'https://www.imdb.com/list/ls123456789/');
  }
  for (const input of ['ur12345678', 'https://imdb.com/user/ur12345678/', 'https://imdb.com/user/ur12345678/watchlist?x=1']) {
    assert.equal(parseWatchlistUrl(input)?.kind, 'watchlist');
  }
  for (const input of [null, '', 'https://imdb.com.evil.test/list/ls123456789/', 'https://imdb.com/name/nm123/', 'ftp://imdb.com/list/ls123456789/', 'https://user@imdb.com/list/ls123456789/', 'https://imdb.com/list/ls1234567890123/', 'https://imdb.com/list/ls123456789/edit', 'https://imdb.com/user/ur12345678/ratings', 'https://imdb.com/x/list/ls123456789/']) {
    assert.equal(parseWatchlistUrl(input), null, String(input));
  }
});

const first = JSON.parse(fixture('custom-list-page-1.json'));
const second = JSON.parse(fixture('custom-list-page-2.json'));
const html = (data) => `<script nonce="test" type="application/json" id="__NEXT_DATA__">${JSON.stringify(data)}</script>`;
async function scrape({ initial = first, later = [second], moviesOnly = false, kind = 'list', fetchError = false } = {}) {
  const calls = [];
  const context = vm.createContext({
    URLSearchParams, Date,
    sessionStorage: { getItem: () => JSON.stringify({ baseUrl: 'https://www.imdb.com/list/ls123456789', kind, moviesOnly }) },
    document: { getElementById: () => initial ? { textContent: JSON.stringify(initial) } : null, querySelectorAll: () => [] },
    fetch: async (url, options) => {
      calls.push(url);
      assert.equal(options.credentials, 'include');
      if (fetchError) return { ok: false, status: 403 };
      const page = later.shift();
      assert.ok(page, 'unexpected extra page request');
      return { ok: true, text: async () => typeof page === 'string' ? page : html(page) };
    },
  });
  const result = await vm.runInContext(read('chrome-extension/lib/injected-scrape.js'), context);
  return { result, calls };
}

test('custom list pagination counts unique titles, filters locally and returns complete pool', async () => {
  const { result, calls } = await scrape({ moviesOnly: true });
  assert.equal(result.complete, true);
  assert.equal(result.sourceCount, 3);
  assert.deepEqual(Array.from(result.items, (item) => item.id), ['tt0111161', 'tt0050083']);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /page=2/);
  assert.match(calls[0], /sort=list_order/);
  assert.doesNotMatch(calls[0], /title_type/);
});

test('watchlists retain their structured extraction and detail-view pagination', async () => {
  const initial = structuredClone(first);
  initial.props.pageProps.mainColumnData.predefinedList = initial.props.pageProps.mainColumnData.list;
  delete initial.props.pageProps.mainColumnData.list;
  const { result, calls } = await scrape({ initial, kind: 'watchlist' });
  assert.equal(result.items.length, 3);
  assert.match(calls[0], /view=detail/);
});

test('repeated pages, missing pages, private/blocked pages, changed totals and unknown totals never return partial success', async () => {
  const changed = structuredClone(second);
  changed.props.pageProps.totalItems = 4;
  const unknown = structuredClone(first);
  delete unknown.props.pageProps.totalItems;
  delete unknown.props.pageProps.mainColumnData.list.titleListItemSearch.total;
  for (const options of [{ later: [first] }, { later: ['<html>Sign in</html>'] }, { fetchError: true }, { later: [changed] }, { initial: unknown }, { initial: null }]) {
    const { result } = await scrape(options);
    assert.ok(result.error);
    assert.equal(result.items, undefined);
    assert.match(result.error, /incomplete|private|changed|complete/);
  }
});

test('recognized empty list and filtered-to-zero list are complete, not access failures', async () => {
  const empty = structuredClone(second);
  empty.props.pageProps.totalItems = 0;
  empty.props.pageProps.mainColumnData.list.titleListItemSearch = { total: 0, edges: [] };
  const { result } = await scrape({ initial: empty });
  assert.equal(result.complete, true);
  assert.equal(result.items.length, 0);
  const series = structuredClone(empty);
  series.props.pageProps.totalItems = 1;
  series.props.pageProps.mainColumnData.list.titleListItemSearch = {
    total: 1, edges: [first.props.pageProps.mainColumnData.list.titleListItemSearch.edges[1]],
  };
  const filtered = await scrape({ initial: series, moviesOnly: true });
  assert.equal(filtered.result.complete, true);
  assert.equal(filtered.result.sourceCount, 1);
  assert.equal(filtered.result.items.length, 0);
});

function workerHarness() {
  let listener;
  let fetches = 0;
  let fail = false;
  let fetchHook = async () => {};
  const sync = { watchlistSource: 'ls123456789', moviesOnly: false };
  const local = {};
  const storageArea = (data) => ({
    get: async (defaults) => ({ ...defaults, ...data }),
    set: async (values) => Object.assign(data, values),
    remove: async (keys) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; },
  });
  const context = vm.createContext({
    Date, parseWatchlistUrl, pickRandom,
    fetchWatchlist: async (source, options) => {
      fetches += 1;
      await fetchHook();
      if (fail) throw new Error('Import incomplete: HTTP 403. Retry Import or Refresh.');
      return { source: parseWatchlistUrl(source), items: [{ id: 'tt0111161', title: 'Sparse valid title', stars: [], url: 'https://www.imdb.com/title/tt0111161/' }], moviesOnly: Boolean(options.moviesOnly), complete: true, sourceCount: 1, fetchedAt: Date.now() };
    },
    chrome: {
      storage: { sync: storageArea(sync), local: storageArea(local) },
      windows: { onRemoved: { addListener() {} } },
      runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    },
  });
  vm.runInContext(read('chrome-extension/background/service-worker.js').replace(/^import .*;\n/, ''), context);
  return {
    sync, local,
    get fetches() { return fetches; },
    set fail(value) { fail = value; },
    set fetchHook(value) { fetchHook = value; },
    message: (message) => new Promise((resolve) => listener(message, {}, resolve)),
  };
}

test('worker caches sparse complete results by canonical source AND filter; refresh forces acquisition', async () => {
  const worker = workerHarness();
  assert.equal((await worker.message({ type: 'pickRandom' })).cached, false);
  assert.equal((await worker.message({ type: 'pickRandom' })).cached, true);
  assert.equal(worker.fetches, 1);
  worker.sync.watchlistSource = 'https://imdb.com/list/ls123456789/?x=1';
  assert.equal((await worker.message({ type: 'pickRandom' })).cached, true);
  worker.sync.moviesOnly = true;
  assert.equal((await worker.message({ type: 'getStatus' })).cachedCount, 0);
  assert.equal((await worker.message({ type: 'pickRandom' })).cached, false);
  assert.equal(worker.fetches, 2);
  worker.sync.watchlistSource = 'ls987654321';
  assert.equal((await worker.message({ type: 'getStatus' })).cachedCount, 0);
  await worker.message({ type: 'pickRandom' });
  assert.equal(worker.fetches, 3);
  await worker.message({ type: 'refreshWatchlist' });
  assert.equal(worker.fetches, 4);
  worker.local.cachedAt = Date.now() - 2 * 60 * 60 * 1000;
  assert.equal((await worker.message({ type: 'getStatus' })).cachedCount, 0);
  await worker.message({ type: 'pickRandom' });
  worker.local.cacheVersion = 2;
  await worker.message({ type: 'pickRandom' });
  assert.equal(worker.fetches, 6);
});

test('worker preserves prior cache after failed refresh and reports recoverable import errors', async () => {
  const worker = workerHarness();
  assert.equal((await worker.message({ type: 'importWatchlist' })).ok, true);
  const previous = worker.local.cachedWatchlist;
  worker.fail = true;
  const response = await worker.message({ type: 'refreshWatchlist' });
  assert.equal(response.ok, false);
  assert.match(response.error, /incomplete/);
  assert.equal(worker.local.cachedWatchlist, previous);
  assert.equal(worker.local.importState.status, 'error');
  worker.fail = false;
  assert.equal((await worker.message({ type: 'importWatchlist' })).ok, true);
  assert.equal(worker.local.importState.status, 'done');
});

test('worker discards results when source or filter changes during acquisition', async () => {
  for (const change of [(s) => { s.moviesOnly = true; }, (s) => { s.watchlistSource = 'ls987654321'; }]) {
    const worker = workerHarness();
    worker.fetchHook = async () => change(worker.sync);
    const response = await worker.message({ type: 'importWatchlist' });
    assert.equal(response.ok, false);
    assert.match(response.error, /changed during import/);
    assert.equal(worker.local.cachedWatchlist, undefined);
  }
});

test('overlapping pages deduplicate before assessing completeness', async () => {
  const overlap = structuredClone(second);
  overlap.props.pageProps.mainColumnData.list.titleListItemSearch.edges.unshift(first.props.pageProps.mainColumnData.list.titleListItemSearch.edges[0]);
  const { result } = await scrape({ later: [overlap] });
  assert.equal(result.complete, true);
  assert.equal(result.items.length, 3);
});

test('100-page limit reports incomplete acquisition instead of a truncated success', async () => {
  const page = (number) => ({ props: { pageProps: { mainColumnData: { titleListItemSearch: { total: 101, edges: [{ node: { id: `tt${number}`, titleText: { text: `Title ${number}` } } }] } } } } });
  const { result, calls } = await scrape({ initial: page(1), later: Array.from({ length: 99 }, (_, i) => page(i + 2)) });
  assert.equal(calls.length, 99);
  assert.match(result.error, /100 unique titles of 101/);
  assert.equal(result.items, undefined);
});

test('worker permits retry after invalid settings fail import validation', async () => {
  const worker = workerHarness();
  worker.sync.watchlistSource = 'invalid';
  assert.equal((await worker.message({ type: 'importWatchlist' })).ok, false);
  worker.sync.watchlistSource = 'ls123456789';
  assert.equal((await worker.message({ type: 'importWatchlist' })).ok, true);
  assert.equal(worker.fetches, 1);
});
