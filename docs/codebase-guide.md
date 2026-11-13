# Codebase guide and feature index

Explored on 2026-11-08 against commit `8b3de9897947edcf1af5b8baeca52161a6cee515`. Updated for browser CSV providers and themes (#1/#3/#4) on 2026-11-13. The code remains authoritative as it evolves. [Letterboxd support notes](letterboxd-support.md) distinguish implemented CSV imports from future acquisition options.

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
| [`browser-app/src/Picker.tsx`](../browser-app/src/Picker.tsx) | Main state and UI; `handleFiles`, `handleMoviesOnly`, `handlePick`, `handleClear`, `persist`, enrichment effect, `MovieDetails`. Also owns its own `pickRandom` and display formatters. |
| [`browser-app/src/csv.ts`](../browser-app/src/csv.ts) | Internal `parseCsv` tokenizer; exported `parseImdbWatchlistCsv` normalizer and `isMovieType` filter. Import errors and header aliases live here. |
| [`browser-app/src/types.ts`](../browser-app/src/types.ts) | `Title` and `StoredWatchlist`: the browser app's persisted data contract. |
| [`browser-app/src/storage.ts`](../browser-app/src/storage.ts) | `loadWatchlist`, `saveWatchlist`, `clearWatchlist`; one local storage key. |
| [`browser-app/src/enrich.ts`](../browser-app/src/enrich.ts) | `enrichTitle`, `parsePayload`, `shrinkPoster`; picked-title IMDb JSONP lookup, callback cleanup, timeout, in-memory cache. |
| [`browser-app/src/provider.ts`](../browser-app/src/provider.ts) | Independent provider preference and root theme attribute; `loadSelectedProvider`, `selectProvider`. |
| [`browser-app/src/main.tsx`](../browser-app/src/main.tsx) | Mounts `Picker` under React `StrictMode` into `#picker`; imports the stylesheet. |
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

[`README.md`](../README.md) routes users to each client. [`AGENTS.md`](../AGENTS.md) routes future implementation work to these reference files. [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) installs with `npm ci` on Node 22, builds the browser app, uploads `browser-app/dist`, and deploys Pages. It runs on relevant `main` pushes or manual dispatch; it does not lint or build the extension. Browser Node regression tests live in `browser-app/tests/`; there is no package test script or extension automated suite.

## Browser import-to-pick flow

1. `main.tsx` applies the saved provider to the root theme and mounts the picker. Lazy initial state restores that provider’s list/filter. A native radio group switches providers, restoring ready/empty state and clearing displayed picks/errors without saving or relabeling lists.
2. `handleFiles` reads the first selected file using `FileReader`, calls `parseWatchlistCsv`, rejects files from the other provider, replaces the selected provider’s list, clears the selected result, and persists. Failed parsing leaves the previous list available with an error.
3. `parseCsv` handles BOM, quoted fields, escaped quotes, embedded newlines, CRLF/LF/CR, and blank rows. Headers are trimmed, lowercased, and whitespace-normalized. IMDb/watchlist formats use the first nonempty row as the header; Letterboxd v7 custom lists skip the metadata preamble and locate their film table.
4. `parseImdbWatchlistCsv` maps IMDb header aliases, converts numbers and runtime minutes, deduplicates IDs, and skips rows without a usable URL. It accepts a title/name column or an IMDb ID column, but every retained item needs an HTTP-prefixed URL or a `tt...` ID from which an IMDb URL can be built. Missing metadata becomes `null` or `[]`.
5. The memoized picking pool applies `isMovieType` locally. Unknown types pass; normalized `movie` and `tvmovie` pass; other known types are excluded. Changing the filter preserves the full imported list.
6. `handlePick` selects from that pool and enters `result`. `MovieDetails` renders available metadata. The result link uses `picked.url`, with an action label matching the picked title’s provider.
7. For IMDb results lacking a poster or stars, the effect calls `enrichTitle`. Letterboxd picks skip it. Successful metadata is merged into the selected title and list, then saved. Effect cleanup ignores stale results.
8. Clear removes only the selected provider’s saved list and resets its filter/UI. Import replacement is exposed in both `ready` and `result`; `result` also shows Pick again and the title link.

The JSONP request is `https://sg.media-imdb.com/suggests/t/<id>.json`, using a global callback named `imdb$<id>`. Only IMDb-style IDs qualify. It loads poster and up to three stars, not full title details. Errors/timeouts resolve empty metadata after at most seven seconds; empty results are also cached in memory for that page session. Payload matching prefers the exact ID but falls back to another title entry, then the first entry.

The CSV file is read locally, but picking can contact IMDb and image hosts; the static page also loads Google Fonts. Read privacy copy alongside these network paths when adding providers.

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

The browser’s `Title` additionally requires `provider` and may carry `imdbId`; Letterboxd identities are namespaced film slugs or short links. Browser titles and the extension’s plain title objects carry the same core fields: `id`, `title`, `year`, `rating`, `voteCount`, `type`, `runtime`, `director`, `stars`, `plot`, `poster`, `metascore`, `certificate`, and `url`. The extension additionally produces `displayTitle`. There is no enforced shared schema. IMDb ratings/votes are currently implicit, runtime is formatted text, and `stars` is an array. Browser rendering assumes `stars` exists.

| Location | Stored contract | Compatibility considerations |
| --- | --- | --- |
| Browser `localStorage`, `imdb-watchlist-picker-v1:imdb` and `:letterboxd` | `StoredWatchlist`: `{provider, items, moviesOnly, importedAt, fileName, sourceName?, importWarnings?}` | One isolated list/filter per provider; legacy `imdb-watchlist-picker-v1` remains an active-record fallback. Missing provider means IMDb. A first different-provider save preserves the legacy record in its own slot before replacing the fallback. Writes can throw. |
| Browser `localStorage`, `watchlist-picker-provider-v1` | `imdb` or `letterboxd` | Independent UI preference. Invalid/missing/unavailable storage defaults to IMDb. Switching updates the root theme and preference without writing list records. |
| Extension `chrome.storage.sync` | `watchlistSource` string and `moviesOnly` boolean | Synced settings are separate from the device-local title cache. |
| Extension `chrome.storage.local` | `cachedWatchlist: {source, items, fetchedAt, moviesOnly, complete, sourceCount}`, `cachedAt`, `cacheVersion`; also `importState` and `importWindowId` | `source` is the parsed `{kind, id, url}`. Cache version is 3; TTL is one hour. |
| IMDb page `sessionStorage` | `imdb-scrape-params: {baseUrl, kind, moviesOnly}` | Injection handoff only; separate from extension storage. |

Browser `importedAt` is rewritten on filter changes and enrichment saves as well as imports, so it is not a reliable original-import timestamp. Extension `importState` merges fields such as `status`, `message`, `error`, `count`, and `updatedAt`; statuses are `idle`, `running`, `done`, and `error`.

Extension cache usability requires matching canonical source URL, movie filter, freshness, current cache version and confirmed completeness. Empty and metadata-sparse complete lists are valid. Source/filter settings are rechecked before saving a fetch result. Failed refresh retains the previous compatible cache; partial results are never saved. Version 2 caches require reimport; existing sync settings remain valid. See [IMDb custom-list verification](imdb-custom-lists.md) for tests and remaining live checks.

## Where to start a feature

| Change | Read/change together |
| --- | --- |
| Import another CSV format | `csv.ts`, `types.ts`, `Picker.tsx`, `storage.ts`, static instructions in `index.html`; see the Letterboxd notes. |
| Read another site's lists in the extension | `manifest.json`, `watchlist.js`, a provider scraper, `service-worker.js`, `popup.js`, `popup.html`; see the Letterboxd notes. |
| Transfer IMDb lists to Letterboxd | Browser `csv.ts`, `types.ts`, `Picker.tsx`, storage and a new export boundary if needed; extension acquisition/cache and popup controls if included. Read the transfer notes for the existing Letterboxd import route and preservation requirements. |
| Add filtering or avoid repeat picks | Browser `Picker.tsx` and `isMovieType`; extension `pickRandom`, scraper filtering, cache behavior, and popup settings. Current filtering happens at different stages. |
| Change title details or add metadata | Browser `types.ts`, `csv.ts`, `enrich.ts`, `MovieDetails`; extension `parseTitleNode`, DOM fallback, `showMovie`, popup markup; both persistence contracts. |
| Change source/settings or restore behavior | Browser `storage.ts` and picker effects; extension sync/local helpers, message contract, `saveSettingsIfNeeded`, `applyImportState`. |
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

`provider.ts` persists selection independently; `main.tsx` applies it before mounting.
`Picker` restores provider-keyed lists and filters, including empty-list preferences,
and invalidates pending file reads when switching. Source labels from #3 restore on
reload and switching. A wrong-provider CSV fails without replacing either list.
`index.css` uses `html[data-provider]` tokens for backgrounds, surfaces, controls,
borders, focus and supporting sections. Static `index.html` content uses
`data-provider-content` to show the matching export help/details FAQ. Overall naming
is Watchlist Random Picker, with unchanged repository/package/hosting paths.

Run `node --experimental-strip-types --test browser-app/tests/*.test.ts` from the
root, plus build/lint from `browser-app/`. #4 used headless Chromium with external
requests blocked to exercise both themes in empty/ready/result/error states,
keyboard radio switching/focus, 320px layout, independent filters (also while empty),
reload, replace, failed-import preservation, and clear isolation. Browser checks also
cover the #3 v7 fixture and legacy-only IMDb followed by first Letterboxd import.
These checks do not verify fresh authenticated exports, live JSONP, or extension UI.
