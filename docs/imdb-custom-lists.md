# IMDb watchlist and custom-list verification

Issue [#2](https://github.com/Synneks/imdb-watchlist-random-movie-picker/issues/2)
uses the existing IMDb CSV parser and extension importer; no second importer was
introduced. The browser provider model and shared picker/static copy are owned
by issues #1/#4 and retain the `parseImdbWatchlistCsv(text): Title[]` interface.

## Implemented extension guarantees

- Supported inputs: canonical IMDb watchlist/user paths, custom-list paths, and
  bare user/list IDs. Query/fragment parameters are discarded. Other hosts,
  credentials, non-HTTP schemes, unrelated paths and trailing edit/ratings paths
  are rejected. IDs are normalized to lowercase.
- Page totals must be explicit nonnegative integers from recognized structured
  data. Unique IMDb IDs, rather than collected row count, determine completion.
- Pages use list order for custom lists and detail view for watchlists. The
  full source is collected before local movie filtering, avoiding ambiguity
  between a filtered response and an unfiltered reported total.
- Missing/failed/repeated pages, unknown/changing totals, and the 100-page cap
  are recoverable errors. DOM-only extraction is rejected because it cannot
  establish the intended total. No incomplete result replaces a cache.
- A recognized empty list is a successful read. Unknown title types remain in
  the movie pool, matching existing browser semantics.
- Cache version 3 includes `moviesOnly`, `complete: true`, and `sourceCount` in
  addition to `source`, `items`, and `fetchedAt`. Cache reuse requires source,
  filter, version and freshness to match; sparse metadata is accepted. The
  hour TTL remains. Old caches require reimport; sync settings are unchanged.
- Settings are checked again before saving an acquisition. A changed source or
  filter discards that result. Refresh bypasses cache and reports failures while
  retaining a prior compatible result. Status only counts compatible caches.

## Automated evidence

Run from the repository root after installing browser dependencies:

```sh
(cd browser-app && npm ci)
node --test tests/imdb-custom-lists.test.mjs
(cd browser-app && npm run build && npm run lint)
node --check chrome-extension/lib/watchlist.js
node --check chrome-extension/lib/injected-scrape.js
node --check chrome-extension/background/service-worker.js
node --check chrome-extension/popup/popup.js
```

The focused Node tests cover custom-list columns, metadata, duplicate identities,
BOM/CRLF, quoted commas/newlines, fallback title URLs, movie filtering, random
pool membership, storage restore/replace/clear, failed parsing without storage
replacement, URL normalization/rejection, multi-page custom lists and watchlists,
overlapping/repeated/failed pages, access/unknown-total failures, empty lists,
the page cap, cache source/filter/TTL/version, sparse titles, forced refresh,
failed-refresh recovery and settings changes during acquisition.

The tests use a synthetic CSV and structured page fixtures, explicitly documented
in `tests/fixtures/imdb/README.md`. They exercise existing supported shapes,
not a captured current IMDb response. The storage checks are module-level;
they do not establish rendered React interaction behavior.

## Remaining manual acceptance checks

An isolated headless Chromium session against local Vite passed browser UI
import of four unique fixture titles, reload/restore, filtering to three, picking
and checking the canonical IMDb result href, failed-import preservation,
replacement, filtering to zero and recovery, and clear. IMDb enrichment and
Google Fonts requests were blocked. This was a one-off CDP check using the
synthetic fixture; it did not open the destination in a logged-in IMDb session.

No authenticated Chrome/IMDb session or real sanitized export was used during
implementation. These acceptance items remain unverified:

1. Capture a sanitized current custom-list export, record its provenance and
   compare parsed unique count and IMDb links with the source.
2. Repeat the headless browser flow with that real export in the interactive UI,
   including opening the picked destination and restoring an actual old saved
   IMDb list. The synthetic UI and module checks above passed; real data and
   opening the external IMDb page remain unverified.
3. Load the unpacked extension in Chrome. Import a real custom list spanning
   multiple pages and compare its unique count to IMDb. Repeat with a watchlist.
4. Exercise public, accessible private, inaccessible private and deleted lists;
   failed later-page requests; import-panel persistence; source/filter changes;
   refresh; cache expiry; retry; and opening picked titles.
5. Confirm IMDb still honors the `page` query parameter and recognized
   `__NEXT_DATA__` shapes. If it repeats a page or uses a new format, the importer
   now fails clearly instead of silently claiming a complete pool.
