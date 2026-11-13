# Codebase guide and feature index

Explored on 2026-11-08 against commit `8b3de9897947edcf1af5b8baeca52161a6cee515`. Updated for the browser architecture refactor on 2026-11-13. Read [coding principles](coding-principles.md) before changing code. The code remains authoritative as it evolves. [Letterboxd support notes](letterboxd-support.md) distinguish implemented CSV imports from future acquisition options.

[IMDb-to-Letterboxd transfer notes](imdb-to-letterboxd-transfer.md) cover the separately requested list-transfer feature, including export and destination import.

Use the [feature issue index](feature-issues.md) for the current GitHub work items, selected delivery scopes, and dependencies. It includes the neutral branding and provider-theme toggle request.

## Application boundaries

The repository contains two independently runnable clients for selecting a random title from a list. Neither has a backend, authentication service, database, shared source package, or root package manifest.

- **Browser app:** React 19, TypeScript, Vite; imports an IMDb or Letterboxd CSV selected by the user and saves the normalized list in `localStorage`. Deployed as static files to GitHub Pages.
- **Chrome extension:** Manifest V3, plain JavaScript modules; uses the user's IMDb browser session to read a watchlist or custom list. Settings and cached titles live in Chrome extension storage.

Both select `items[Math.floor(Math.random() * items.length)]`. Picks are independent: repeats are allowed, and there is no pick history, watched-title exclusion, ranking, or recommendation engine. The browser holds one list per provider and restores the selected provider; the extension holds one IMDb list. Letterboxd watchlist and custom-list CSV imports are implemented in the browser.

## File index

Paths below are relative to the repository root. Function names are navigation anchors; use symbol search rather than relying on line numbers.

### Browser app

| File | Responsibility and useful symbols |
| --- | --- |
| [`browser-app/src/main.tsx`](../browser-app/src/main.tsx) | Explicit storage initialization/migration and initial theme before React mounts. |
| [`browser-app/src/Picker.tsx`](../browser-app/src/Picker.tsx) | Accessible controls and state-driven layout; uses `usePicker`. |
| [`browser-app/src/usePicker.ts`](../browser-app/src/usePicker.ts) | Browser orchestration: files, stale-read guards, persistence feedback, theme, enrichment lifetime. |
| [`browser-app/src/pickerState.ts`](../browser-app/src/pickerState.ts) | Pure reducer actions and derived status/current-list selectors. |
| [`browser-app/src/MovieDetails.tsx`](../browser-app/src/MovieDetails.tsx), [`formatters.ts`](../browser-app/src/formatters.ts) | Sparse-metadata rendering and display formatting. |
| [`browser-app/src/csv.ts`](../browser-app/src/csv.ts), [`csvTable.ts`](../browser-app/src/csvTable.ts) | Provider format detection and shared CSV tokenizer; the dispatcher tokenizes once. Provider normalizers live in [`imdbCsv.ts`](../browser-app/src/imdbCsv.ts) and [`letterboxdCsv.ts`](../browser-app/src/letterboxdCsv.ts). Direct parser entry points remain available. |
| [`browser-app/src/types.ts`](../browser-app/src/types.ts), [`titles.ts`](../browser-app/src/titles.ts) | Domain types, movie filter, random selection, metadata merge. |
| [`browser-app/src/identity.ts`](../browser-app/src/identity.ts) | Canonical native film URLs and namespaced identities. |
| [`browser-app/src/validation.ts`](../browser-app/src/validation.ts) | Runtime validation of unknown saved values and old formatted runtime conversion. |
| [`browser-app/src/storage.ts`](../browser-app/src/storage.ts) | `createOptionsStorage`: injected storage access, read-only `load`, explicit `initialize`, result-returning `save`. |
| [`browser-app/src/storageMigration.ts`](../browser-app/src/storageMigration.ts) | Pure legacy recovery, JSON parsing and compatible single-key serialization. |
| [`browser-app/src/enrich.ts`](../browser-app/src/enrich.ts), [`jsonp.ts`](../browser-app/src/jsonp.ts) | Validated IMDb metadata, in-flight deduplication/cache, and browser script/timer/global cleanup. |
| [`browser-app/src/provider.ts`](../browser-app/src/provider.ts) | Provider labels and root theme application; no persistence. |
| [`browser-app/index.html`](../browser-app/index.html) | Static page shell, export instructions, FAQ, privacy copy, SEO/social tags, JSON-LD, fonts, React entry script. |
| [`browser-app/src/index.css`](../browser-app/src/index.css) | Browser page theme, responsive layout, picker/result styling, animations. |
| [`browser-app/vite.config.ts`](../browser-app/vite.config.ts) | React plugin and GitHub Pages repository subpath (`base`). |
| [`browser-app/package.json`](../browser-app/package.json), [`package-lock.json`](../browser-app/package-lock.json) | Dependency declarations, reproducible install, dev/build/lint/preview scripts. |
| [`browser-app/tsconfig.json`](../browser-app/tsconfig.json), [`tsconfig.app.json`](../browser-app/tsconfig.app.json), [`tsconfig.node.json`](../browser-app/tsconfig.node.json) | TypeScript project references and separate app/config compiler settings. |
| [`browser-app/.oxlintrc.json`](../browser-app/.oxlintrc.json), [`src/vite-env.d.ts`](../browser-app/src/vite-env.d.ts), [`.gitignore`](../browser-app/.gitignore) | Linter configuration, Vite client types, generated-file exclusions. |
| [`browser-app/public/`](../browser-app/public/) | Favicon/app icon, `robots.txt`, `sitemap.xml`, Google verification HTML; copied into the deployed site. |
| [`browser-app/README.md`](../browser-app/README.md) | Local setup, Pages setup, indexing notes. |

### Chrome extension

| File | Responsibility and useful symbols |
| --- | --- |
| [`chrome-extension/manifest.json`](../chrome-extension/manifest.json) | Permissions, allowed IMDb host, popup entry, module service worker, icons. |
| [`chrome-extension/background/service-worker.js`](../chrome-extension/background/service-worker.js) | Message dispatcher; `runImport`, `loadWatchlist`, `cacheIsUsable`, cache/settings helpers, persisted import progress, persistent panel window. |
| [`chrome-extension/lib/watchlist.js`](../chrome-extension/lib/watchlist.js) | `parseWatchlistUrl`, `fetchWatchlist`, `waitForTabComplete`, tab selection/navigation, scraper injection, `pickRandom`. `extractWatchlistFromTabUrl` is exported but has no caller in this repo. |
| [`chrome-extension/lib/injected-scrape.js`](../chrome-extension/lib/injected-scrape.js) | Standalone injected script; `parseTitleNode`, `collectTitleSearch`, structured-data and DOM extraction, paginated fetches, deduplication, movies filter. Executes an async IIFE rather than exporting a module API. |
| [`chrome-extension/popup/popup.js`](../chrome-extension/popup/popup.js) | UI state, settings validation/saving, runtime messages, `showMovie`, `applyImportState`, storage change subscription. |
| [`chrome-extension/popup/popup.html`](../chrome-extension/popup/popup.html) | DOM IDs consumed by `popup.js`, source input, progress area, buttons, result markup. |
| [`chrome-extension/popup/popup.css`](../chrome-extension/popup/popup.css) | Popup/panel styling, 360px layout, light/dark themes, progress spinner. |
| [`chrome-extension/icons/`](../chrome-extension/icons/) | Packaged extension icons at the manifest's declared sizes. |
| [`chrome-extension/README.md`](../chrome-extension/README.md) | Load-unpacked setup and user workflow. |

### Repository and deployment

[`README.md`](../README.md) routes users to each client. [`AGENTS.md`](../AGENTS.md) routes future implementation work to these reference files. [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) installs with `npm ci` on Node 22, builds the browser app, uploads `browser-app/dist`, and deploys Pages. It runs on relevant `main` pushes or manual dispatch; it does not lint or build the extension. Browser Node regression tests live in `browser-app/tests/`; there is no package test script. The root `tests/imdb-custom-lists.test.mjs` covers browser IMDb imports and extension acquisition/cache contracts.

## Browser import-to-pick flow

1. `main.tsx` creates the storage adapter and explicitly initializes migration before rendering. The loaded snapshot and storage interface are passed to the picker; React initialization performs no storage writes.
2. `Picker` renders controls and delegates intentions to `usePicker`. A pure reducer holds provider options, a picked ID, feedback and a source revision. List presence, selected details, eligible pool and status text are derived.
3. File imports use `File.text()`. A request counter ignores reads superseded by another import, provider switch, clear, or unmount. `parseWatchlistCsv` tokenizes once and dispatches IMDb, Letterboxd watchlist or v7/table custom-list normalization. Wrong-provider and malformed imports retain the previous list.
4. Import normalization canonicalizes native film URLs/IDs, deduplicates first valid rows, and keeps missing metadata safe. Letterboxd personal ratings are ignored. Runtime remains numeric until display. Custom-list preambles supply an optional source label.
5. Reducer actions calculate a complete new snapshot. The hook saves changed options outside React state updaters. Save failures retain usable session state and show a visible unsaved warning. A successful later save persists the whole current snapshot.
6. The movie filter derives eligible titles without deleting source rows. Known movie/TV-movie types and unknown types pass. Selecting a pick stores only its ID; rendered details always come from the current full list.
7. IMDb picks missing poster/credits request optional JSONP enrichment. The client validates the exact requested ID, shares in-flight requests, caches valid responses and permits retry after transport/invalid-payload failures. Effect cleanup ignores stale source/pick responses. Letterboxd picks skip IMDb requests even if an external IMDb ID exists.
8. Source replacement/clear resets the pick and increments source revision. Switching providers restores its existing list/filter/label. Filter and enrichment updates retain `importedAt` and set `updatedAt`.

The JSONP endpoint remains `https://sg.media-imdb.com/suggests/t/<id>.json`, with a seven-second timeout. Cleanup restores previous callbacks and removes scripts/timers. Failure leaves the basic pick usable. Google Fonts, IMDb metadata and poster image hosts can receive network requests; the CSV itself is read locally.

For a manual reading path, start with `main.tsx`, then `Picker`, `usePicker`, and `pickerState`. Follow imports into the CSV, storage and enrichment modules for each data flow.

## Extension import-to-pick flow

1. `popup.js` gets status from the service worker. UI modes are `empty`, `importing`, `ready`, and `result`; progress persists independently in storage.
2. `parseWatchlistUrl` accepts IMDb watchlist/user URLs, custom list URLs, and bare `ur...`, `p....`, or `ls...` identifiers. It returns `{kind, id, url}` with a canonical `www.imdb.com` URL. Inputs are canonicalized; unrelated IMDb paths, credentials, and unsupported schemes are rejected. Popup copy explicitly supports watchlists and custom lists.
3. Settings are saved to sync storage. Normal source/filter changes clear the local title cache and require import again. Starting an import from the toolbar requests a separate `popup.html?window=1` window so progress remains visible when IMDb takes focus.
4. `runImport` shares one in-flight import promise within the current worker instance. It calls `fetchWatchlist` with `activateTab: true, keepTab: true`. Explicit imports focus and retain the IMDb tab. Ordinary pick/refresh fetches use the defaults and close a newly created temporary tab in `finally`; an existing tab can be navigated and is retained.
5. `fetchWatchlist` finds/creates a matching tab, navigates to the canonical URL with detail/order/page parameters, waits for completion (45-second timeout), then waits 800ms. The source is read without a server-side movie filter; filtering follows complete acquisition. It injects parameters into the page origin's `sessionStorage` under `imdb-scrape-params`, followed by `lib/injected-scrape.js`.
6. The injected script reads `__NEXT_DATA__` first. It recognizes several `mainColumnData` list/search shapes and title-edge variants. Every page requires recognizable structured data and an explicit total. Later pages use credentialed, same-origin HTML fetches. DOM-only pages fail clearly instead of supplying a partial pool.
7. Pagination completes only when the unique IMDb ID count equals the explicit reported total. Repeated/empty/failed pages, changing/unknown totals and reaching the 100-page cap report an incomplete import without saving a partial pool. The full source is then filtered to movies if requested.
8. The worker saves the list and progress. The popup observes local-storage changes, including from the separate panel window. Picking loads a usable cache or fetches again, then returns a random item for `showMovie`.

### Runtime message contract

The worker replies asynchronously and converts thrown errors into `{ok: false, error}`.

| Request `type` | Additional input | Successful reply |
| --- | --- | --- |
| `getStatus` | None | `ok`, `configured`, `watchlistSource`, `moviesOnly`, `cachedCount`, `cachedAt`, `importState` |
| `importWatchlist` | `openPanel` | `ok`, `count` |
| `pickRandom` | `forceRefresh` | `ok`, `movie`, `total`, `cached` |
| `refreshWatchlist` | None | `ok`, `total` |

The `cached` reply flag reflects an actual cache hit. `getStatus` reports counts only for a compatible, fresh cache.

## Data and persistence contracts

The browser’s `Title` additionally requires `provider` and may carry `imdbId`; browser runtime uses `runtimeMinutes`, while Letterboxd identities are namespaced film slugs or short links. Browser titles and the extension’s plain title objects carry the same core fields: `id`, `title`, `year`, `rating`, `voteCount`, `type`, `director`, `stars`, `plot`, `poster`, `metascore`, `certificate`, and `url`. The extension additionally produces `displayTitle`. There is no enforced shared schema. IMDb ratings/votes are currently implicit, browser runtime is numeric minutes (the extension retains formatted text), and `stars` is an array. Browser rendering assumes `stars` exists.

| Location | Stored contract | Compatibility considerations |
| --- | --- | --- |
| Browser `localStorage`, `watchlist-picker-options` | Two entries, `imdb` and `letterboxd`, each `{selected: boolean, watchlist: StoredWatchlist \| null}`. A watchlist contains `{provider, items, moviesOnly, importedAt, updatedAt?, fileName, sourceName?, importWarnings?}`. | One copy of each provider's list/filter and the selected theme in one unversioned key. Clearing one list keeps the other provider and selected theme. Writes return explicit success/failure results. |
| Extension `chrome.storage.sync` | `watchlistSource` string and `moviesOnly` boolean | Synced settings are separate from the device-local title cache. |
| Extension `chrome.storage.local` | `cachedWatchlist: {source, items, fetchedAt, moviesOnly, complete, sourceCount}`, `cachedAt`, `cacheVersion`; also `importState` and `importWindowId` | `source` is the parsed `{kind, id, url}`. Cache version is 3; TTL is one hour. |
| IMDb page `sessionStorage` | `imdb-scrape-params: {baseUrl, kind, moviesOnly}` | Injection handoff only; separate from extension storage. |

Browser `importedAt` is now set only at import; filter/enrichment writes set `updatedAt`. Older records keep their existing timestamp because an earlier original import time cannot be reconstructed. Extension `importState` merges fields such as `status`, `message`, `error`, `count`, and `updatedAt`; statuses are `idle`, `running`, `done`, and `error`.

Browser storage migrates `imdb-watchlist-picker-v1`, its `:imdb`/`:letterboxd` copies,
and `watchlist-picker-provider-v1` during explicit startup initialization. Plain reads recover legacy data without writing. Provider copies take precedence
over the duplicated active record; that record fills a missing provider's list.
Missing legacy list provider means IMDb. A valid old provider preference is kept;
a missing preference uses the old active provider, or IMDb if no list exists.
An invalid preference defaults to IMDb. All old
keys are removed only after successfully writing the unified record. A failed
migration can still restore the old data without deleting it. Once a unified
record exists it is authoritative, so stale legacy data cannot restore a cleared
list. Old runtime text such as `2h 22m` becomes `runtimeMinutes: 142` during decoding. In-memory options hold one `selectedProvider`; serialization retains the requested two provider flags. `browser-app/tests/storage.test.ts` covers migration, failure safety, and
provider isolation alongside the existing importer/preference tests.

Extension cache usability requires matching canonical source URL, movie filter, freshness, current cache version and confirmed completeness. Empty and metadata-sparse complete lists are valid. Source/filter settings are rechecked before saving a fetch result. Failed refresh retains the previous compatible cache; partial results are never saved. Version 2 caches require reimport; existing sync settings remain valid. See [IMDb custom-list verification](imdb-custom-lists.md) for tests and remaining live checks.

## Where to start a feature

| Change | Read/change together |
| --- | --- |
| Import another CSV format | `csv.ts`, the provider parser, `identity.ts`, `types.ts`, `validation.ts`, `usePicker.ts`, static instructions in `index.html`; see the Letterboxd notes. |
| Read another site's lists in the extension | `manifest.json`, `watchlist.js`, a provider scraper, `service-worker.js`, `popup.js`, `popup.html`; see the Letterboxd notes. |
| Transfer IMDb lists to Letterboxd | Browser `csv.ts`, `types.ts`, `Picker.tsx`, storage and a new export boundary if needed; extension acquisition/cache and popup controls if included. Read the transfer notes for the existing Letterboxd import route and preservation requirements. |
| Add filtering or avoid repeat picks | Browser `pickerState.ts`, `usePicker.ts`, and `titles.ts`; extension `pickRandom`, scraper filtering, cache behavior, and popup settings. Current filtering happens at different stages. |
| Change title details or add metadata | Browser `types.ts`, `csv.ts`, `enrich.ts`, `MovieDetails`; extension `parseTitleNode`, DOM fallback, `showMovie`, popup markup; both persistence contracts. |
| Change source/settings or restore behavior | Browser `storage.ts`, `validation.ts`, `storageMigration.ts`, `usePicker.ts`, and reducer actions; extension sync/local helpers, message contract, `saveSettingsIfNeeded`, `applyImportState`. |
| Change appearance or copy | Browser `Picker.tsx`, `index.css`, `index.html`; extension popup HTML/JS/CSS. Branding and link labels are duplicated. |
| Change hosting or site URL | Vite `base`, canonical/social/JSON-LD URLs, `public/sitemap.xml`, `public/robots.txt`, README links, Pages workflow. |

## Validation and observed baseline

From `browser-app/`:

```sh
npm ci
npm run build
npm run lint
```

For extension syntax, from the repository root:

```sh
node --check chrome-extension/lib/watchlist.js
node --check chrome-extension/lib/injected-scrape.js
node --check chrome-extension/background/service-worker.js
node --check chrome-extension/popup/popup.js
```

Baseline on 2026-11-08 using local Node 26.13.0/npm 11.20.0: clean install and build passed; lint exited successfully with one `react(set-state-in-effect)` warning for restoration in `Picker.tsx`. All four extension syntax checks passed. CI uses Node 22; the local run did not reproduce that exact environment.

One-off source checks also passed for CSV BOM/quoted fields/embedded newlines, ID deduplication, runtime formatting, unknown/movie/series filtering, extension list/watchlist parsing, and rejection of candidate Letterboxd inputs. These checks were run directly against the modules; no test files or test runner were added.

`npm audit --json` reported two high-severity dependency entries (`vite` and transitive `source-map-js`), with fixes available. This records the installed baseline, not a runtime exploit assessment; rerun the audit when doing dependency maintenance. No dependency changes were made during exploration.

Browser CSV fixtures and Node tests are committed. Synthetic IMDb custom-list CSV and structured-page fixtures plus module/mocked-worker regression tests are under `tests/`; they are not real export/live-page evidence. No browser UI suite or live extension integration test is committed. A one-off headless Chromium check passed; see [IMDb custom lists](imdb-custom-lists.md) and the provider-theme checks below. Build/lint/syntax checks do not validate live IMDb behavior. Manual feature checks should cover importing and replacing a list, reload/restore, filtering to zero titles, repeated picks, clear, missing metadata, and enrichment failure. Extension checks additionally need load-unpacked Chrome, public/private sources, multiple pages, refresh/cache expiry, panel persistence when the toolbar closes, and failure recovery. Live scraping and JSONP were not exercised during this exploration.

## Custom-list browser additions (#3)

On top of #1's Letterboxd foundation, `csv.ts` now exports `ParsedList` and
`parseLetterboxdCustomListCsv`; `parseWatchlistCsv` dispatches v7 preambles and
Position/Name/URL film tables through the same normalizer as watchlists. Metadata
never enters the picking pool; retained rows preserve first-seen order. The optional
`sourceName` is stored alongside the existing provider/items/filename fields and
restored by Picker. Legacy lists without it use the filename. No extension changes
are involved. See [Letterboxd notes](letterboxd-support.md#implemented-custom-list-csv-path-3)
and [fixture provenance](../browser-app/tests/fixtures/CUSTOM-LISTS.md).

Focused browser parser/storage regression checks now live in `browser-app/tests/`:
`node --experimental-strip-types --test browser-app/tests/*.test.ts`. These do not
replace manual browser and fresh account-export verification.

## Provider themes and verification (#4)

`provider.ts` applies the theme; selection is persisted through the options adapter. `main.tsx` initializes migration and applies the theme before mounting.
`Picker` restores provider-specific lists and filters, including empty-list preferences,
and invalidates pending file reads when switching. Source labels from #3 restore on
reload and switching. A wrong-provider CSV fails without replacing either list.
`index.css` uses `html[data-provider]` tokens for backgrounds, surfaces, controls,
borders, focus and supporting sections. Static `index.html` content uses
`data-provider-content` to show the matching export help/details FAQ. Overall naming
is Random Movie Picker, with unchanged repository/package/hosting paths.

Run `node --experimental-strip-types --test browser-app/tests/*.test.ts` from the
root, plus build/lint from `browser-app/`. #4 used headless Chromium with external
requests blocked to exercise both themes in empty/ready/result/error states,
keyboard radio switching/focus, 320px layout, independent filters (also while empty),
reload, replace, failed-import preservation, and clear isolation. Browser checks also
cover the #3 v7 fixture and legacy-only IMDb followed by first Letterboxd import.
These checks do not verify fresh authenticated exports, live JSONP, or extension UI.

### Spacing conventions

Browser `index.css` and extension `popup.css` define independent spacing tokens
on a 4px scale. Parents own gaps between child controls/sections. Browser help
cards are identical `info-card` elements with no outer margins inside a
`help-stack` with a 16px gap. Their common 16px page inset and padding apply in
both themes, expanded or collapsed. Extension body inset/section gaps are 16px;
settings/action groups own smaller internal gaps. Both apps use 44px minimum
primary controls and visible focus. Keep component geometry independent of theme.

## Browser refactor verification

The refactor enables TypeScript strict mode and preserves the single-key disk layout. Browser Node tests cover provider imports, pure state transitions, canonical identity, metadata validation/deduplication/retry/JSONP cleanup, read-only recovery, explicit migration, and persistence failures. The root IMDb suite also exercises its unchanged extension scenarios.

A temporary headless Chromium harness exercised real file-input events, legacy IMDb restoration and runtime conversion, import/filter/pick, provider isolation, custom-list labels, failed/wrong-provider replacement, same-filename replacement, reload, clear, stale file reads, quota failure/recovery, inaccessible storage, and 320px overflow. Intercepted JSONP responses verified that enrichment preserves a newer filter and does not update a replacement source. No runtime exceptions occurred. External provider responses were blocked or simulated; these checks do not establish live IMDb endpoint or fresh authenticated export compatibility.
