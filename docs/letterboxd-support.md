# Letterboxd list support: implementation notes

Status: browser CSV watchlist/custom-list import and provider selection/themes are implemented (#1/#3/#4). The extension remains IMDb-only. These notes accompany the [codebase guide](codebase-guide.md), based on exploration dated 2026-11-08. Recommendations below are starting points, not an approved feature specification.

The [feature issue index](feature-issues.md) links the implementation scopes: #1 selects browser CSV watchlist import, #3 adds custom-list CSVs, and #4 owns the provider/theme toggle. The broader access options below are future extensions rather than blockers for those deliveries.

For the separately requested feature of moving IMDb lists into Letterboxd, read [IMDb-to-Letterboxd transfer notes](imdb-to-letterboxd-transfer.md).

## Historical exploration and future scope questions

The requested future capability is selecting a random movie from a Letterboxd list. The random selection itself already works on an array of normalized titles in both clients. The work is acquiring the list, preserving its identity, and rendering its titles without IMDb assumptions.

The initial issues select the browser app and extracted CSV input. A later pasted-URL importer must separately define access to other members' public lists versus the user's own lists/watchlist. CSV import alone does not satisfy a requirement to paste any public list URL. #4 defines preservation of provider-associated lists when toggling; merging multiple lists remains a separate identity and duplicate-policy decision.

## Verified external facts

Official sources checked on 2026-11-08:

- Letterboxd offers an account export in Settings containing a ZIP of CSV files. This establishes an offline input route but does not establish an endpoint to export arbitrary public lists. [Account export help](https://support.letterboxd.com/hc/en-us/articles/15179196880911-Can-I-get-a-copy-of-my-account-data).
- Letterboxd describes its API as private and selectively available to partners through a beta application. API credentials/access cannot be assumed. [API access help](https://support.letterboxd.com/hc/en-us/articles/15269070369551-Do-you-have-mobile-apps-or-an-API).

No real Letterboxd export, list HTML, endpoint response, or cross-origin browser request was tested. Exact CSV headers, list-file preambles, ZIP layout, available metadata, public-list pagination, and CORS behavior remain unverified. Recheck these with representative inputs before coding against them.

## Suggested first implementation path

If offline import meets the agreed scope, implement Letterboxd CSV support in the browser app first. It fits the existing local-file architecture and avoids introducing a server or API credentials. Initially accept an extracted list CSV; ZIP handling is a separate feature unless explicitly included in scope. Make the export/extraction instructions match a real account export.

If pasted list URLs are required, investigate the extension path separately: it already navigates to the source site and runs a same-origin scraper. It would need Letterboxd host permissions, source parsing, its own scraper, cache changes, and UI updates. The current IMDb selectors and URL builder cannot be reused for Letterboxd. Verify access and pagination against real pages before committing to this route.

For a web-app URL importer, establish a supported data-access route first. Static GitHub Pages provides no server-side fetch/proxy. A browser fetch from Pages to Letterboxd depends on the target's CORS policy; adding a client-side `fetch` alone does not establish that access. An approved API or backend would be a separate architectural change. Keep any required client secret out of shipped browser/extension assets.

## Baseline assumptions (before #1/#3/#4)

### CSV parsing and format detection

Read [`browser-app/src/csv.ts`](../browser-app/src/csv.ts) and [`Picker.tsx`](../browser-app/src/Picker.tsx).

- The existing tokenizer is useful for comma/quote/newline handling, but it is private to the IMDb parser. Extract a small reusable tokenizer only when adding a second parser.
- Use provider-specific normalization and an explicit format detector or provider choice. A `Name` header alone is not sufficient detection: the IMDb parser already accepts it.
- The IMDb parser recognizes `url`/`title url`, not a Letterboxd-specific link header. A file with only `Name`, `Year`, and `Letterboxd URI` would currently produce no retained titles. Those names are a candidate fixture shape, not a verified export contract.
- Obtain actual watchlist and custom-list exports before defining header aliases. Check for metadata/preamble rows instead of assuming row one always contains film columns. Define clear errors for unsupported files and malformed rows.

### Title identity and metadata

Read [`browser-app/src/types.ts`](../browser-app/src/types.ts), [`enrich.ts`](../browser-app/src/enrich.ts), and both result renderers.

- Represent provider and provider-native identity explicitly. A possible model is an item ID scoped by provider, separate source/list provenance, and optional external IDs such as `imdbId`. This is proposed; the current schema has only a generic `id` and `url`.
- Deduplicate within a provider using a verified native identifier or normalized film URL. Film name/year is insufficient to guarantee identity. Cross-provider equivalence needs an actual mapping and a defined merge policy.
- Keep the canonical film URL for opening a picked result. Make the action label provider-aware in browser `MovieDetails`' surrounding actions and extension `showMovie`/popup markup.
- Treat missing year, poster, rating, runtime, credits, plot, certificate, and type as valid. Initialize array fields consistently. A basic pick should succeed without enrichment or IMDb mapping.
- `enrichTitle` accepts only IMDb-style `tt...` IDs. Route enrichment by provider or an explicit external IMDb ID; do not pass Letterboxd IDs into that lookup.
- The current `rating`/`voteCount` implicitly mean IMDb aggregate data. Preserve rating source, meaning, and scale before displaying another provider's data. A personal rating is not an aggregate rating.
- Decide how unknown title types interact with the movies filter. Both current clients include unknown types; keep or intentionally revise that policy with visible behavior and validation.

### Persistence and source changes

Read [`storage.ts`](../browser-app/src/storage.ts) and extension [`service-worker.js`](../chrome-extension/background/service-worker.js).

- Browser storage currently records a filename, not source/provider metadata. Add enough provenance to restore the provider and link labels after reload.
- Existing browser lists use `imdb-watchlist-picker-v1`, without schema migration or per-item validation. Define a compatible loader/migration before requiring new fields; keep existing imported IMDb lists usable.
- The extension source parser returns `{kind, id, url}` for IMDb only. Add provider identity and dispatch at the source-loading boundary rather than branching throughout the IMDb scraper.
- Revisit extension cache identity/version and the metadata-richness gate. Sparse but valid Letterboxd titles should not cause a refetch on every pick. Filter state and provider identity must be accounted for when deciding whether cached data can be reused.

### User interface and static content

Update the browser's picker controls, status/errors, source hint, result link label, and the separately authored `index.html` export instructions/FAQ/metadata. Extension changes also touch popup labels, input validation, manifest description/permissions, and its README. Keep privacy/network descriptions aligned with any new fetches or metadata services.

## Implementation sequence and completion evidence

1. **Confirm input contract:** retain representative exports or sanitized page fixtures. Establish exact headers/preamble rules or URL forms/pagination. Record supported list types and unavailable/private/deleted-list behavior.
2. **Define identity and restore behavior:** choose the smallest provider-aware data change and compatible persistence handling. An existing IMDb saved list and a new Letterboxd list must both reload correctly.
3. **Add provider normalization:** produce the existing picker fields with safe empty metadata and a valid source link. Keep the original IMDb parser behavior covered.
4. **Wire the selected client:** reuse picking/filtering, add provider-aware labels and errors, and route or skip enrichment explicitly. For a URL importer, prove complete multi-page acquisition and clear partial-import handling.
5. **Validate and document:** run the existing build/lint or extension syntax checks and exercise the user workflow. Update the codebase guide and client README to describe implemented behavior.

Useful regression cases when implementing the parser/model changes: IMDb CSV remains supported; a real Letterboxd watchlist and custom list import; BOM, quoted commas/newlines, optional fields, duplicate film rows, any observed preamble, malformed URLs, empty/unsupported files, missing metadata, reload/replace/clear, and a failed import preserving the previous list. Test URL normalization with actual supported URL variants. Enrichment must not request IMDb data for a Letterboxd-only identity, and unavailable metadata must not prevent random selection.

For extension URL support, additionally verify all pages are collected, repeat page content cannot silently bias the pool, blocked or login pages report an error, source/filter changes invalidate the right cache, valid sparse lists remain cacheable, and progress recovers after a failed import. These are future acceptance checks, not tests already present in the repository.

## Implemented custom-list CSV path (#3)

The browser importer now extends #1's provider-aware normalizer/storage with
`parseLetterboxdCustomListCsv`. It recognizes the public v7 marker (including
comma-padded variants), skips the list metadata table, then normalizes films from
`Position,Name,Year,URL,Description`. A table-only form is also accepted. Rows keep
file order; duplicate normalized identities collapse. `StoredWatchlist.sourceName`
is optional and restored/displayed with filename fallback. Unknown export versions
fail explicitly; invalid film rows are skipped and no-valid-film imports fail.
List descriptions and item notes are not film plots or ratings.

The v7 shape was independently checked against two public CSVs; the committed
fixtures reconstruct/sanitize those shapes and add edge cases. See
[provenance](../browser-app/tests/fixtures/CUSTOM-LISTS.md) for fixed source revisions.
This is not a fresh authenticated account-export verification. Official account
export help confirms the ZIP-of-CSVs route, not the exact list schema. Live account
export and browser workflow checks must be reported separately from parser tests.

Picking and IMDb-enrichment guards are reused from #1. Short boxd.it identities and
long film slugs are each normalized offline; alias equivalence requires a redirect
lookup and is not inferred from a title/year pair. ZIP upload, list-URL fetching,
provider-toggle UX (#4), and the extension remain outside #3.

## Implemented provider selection (#4)

The neutral Watchlist Random Picker UI offers IMDb/Letterboxd radios and themes the
whole page via a root attribute. Import requires the selected provider to match the
detected CSV. Selected provider uses `watchlist-picker-provider-v1`; saved data uses
isolated `imdb-watchlist-picker-v1:imdb` and `:letterboxd` slots. The old active key
remains a compatible fallback, with legacy IMDb data preserved on first Letterboxd
save. Switching restores list, source label and movie filter without combining data.
Only IMDb picks request IMDb enrichment. Static instructions/FAQ change with provider.
The historical baseline assumptions above are retained for context; current contracts
are recorded in the codebase guide. ZIP/pasted URL/extension import remain future work.
