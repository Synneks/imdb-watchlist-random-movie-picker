# IMDb-to-Letterboxd list transfer

Status: requested future feature; no transfer implementation exists. Recorded on 2026-11-08. This feature moves list contents to Letterboxd and is separate from [picking random movies from Letterboxd lists](letterboxd-support.md). Read the [codebase guide](codebase-guide.md) for the existing clients and storage contracts.

Implementation is tracked in [issue #5](https://github.com/Synneks/imdb-watchlist-random-movie-picker/issues/5), which selects a browser CSV/saved-list preview, downloadable transfer file, and guided destination import as the first delivery. See the [feature issue index](feature-issues.md) for related work; broader alternatives below are future expansion options.

## Intended outcome

A user can take an IMDb custom list or watchlist and add its titles to a Letterboxd list or watchlist. Treat this as a one-time copy initially; preserving the IMDb source, repeat transfers, and ongoing synchronization are distinct behaviors to define. The current app only imports and picks titles; it cannot export a transfer file or write to a Letterboxd account.

## Existing platform support

Official documentation checked on 2026-11-08:

- Letterboxd accepts IMDb CSV exports directly into new/existing lists and watchlists, with title-match review before confirmation. [Import help](https://support.letterboxd.com/hc/en-us/articles/15268993752719-Can-I-import-films-ratings-or-lists-from-other-services).
- Its IMDb migration guide describes naming a destination list, uploading the CSV, reviewing matches, and optionally importing watched status or ratings. Leaving both options unselected transfers list membership without changing watched films or ratings. [Migration guide](https://embed.letterboxd.com/about/migrating-from-imdb/).
- Its custom UTF-8 CSV format supports `imdbID`, `Title`, and `Year`. The importer documents a 1MB file limit. List imports append new films in file order and retain existing films' positions; replacement is a separate confirmation option. [Import format and list behavior](https://embed.letterboxd.com/about/importing-data/).

These facts support a file-based handoff without Letterboxd API access. No real transfer or destination-account change was performed during exploration. Validate the actual import workflow with representative files before claiming end-to-end compatibility.

## Suggested first version

Start with a guided transfer using the original IMDb CSV when possible: identify the intended destination (custom list or watchlist), explain how to import there, and have the user review matches and confirm in Letterboxd. Conversion is optional because the original export is already supported. This can add value through a list preview, explicit exclusions, and clear destination instructions.

If transferring the app's saved/imported titles or an extension-scraped list, add a downloadable Letterboxd-compatible CSV, using explicit IMDb IDs where available. Proposed output columns are `imdbID,Title,Year`; validate their exact serialization against the real importer. Preserve list order and make exported scope explicit: the full list or a selected subset. A temporary picker filter must not silently remove titles from a transfer.

Keep download/preparation distinct from completed import in product status text. The app cannot know that a user finished Letterboxd's confirmation unless a future integration provides that evidence.

Direct authenticated transfer would require a separately designed integration. Letterboxd API access is selective; consult the [API access documentation](https://support.letterboxd.com/hc/en-us/articles/15269070369551-Do-you-have-mobile-apps-or-an-API). Decide API access, authentication, destination selection, partial-failure recovery, and repeated-operation behavior before promising automatic transfer. A CSV handoff does not require the app to hold Letterboxd credentials.

## Files and implementation boundaries

| Area | Existing files to inspect | Change to consider |
| --- | --- | --- |
| Browser source normalization | [`csv.ts`](../browser-app/src/csv.ts), [`types.ts`](../browser-app/src/types.ts) | Preserve/derive a validated IMDb ID. `Title.id` may currently fall back to arbitrary text, so it cannot always be serialized as `imdbID`. |
| Export serialization | No export module exists | Add a focused CSV serializer/download boundary if normalized-title export is included. Keep serialization separate from UI and input parsing. |
| Browser transfer controls | [`Picker.tsx`](../browser-app/src/Picker.tsx) | Add preview, destination guidance, and any download action accessible independently of a picked result. Distinguish the full `items` array from the filtered picking `pool`. |
| Source retention and restoration | [`storage.ts`](../browser-app/src/storage.ts), [`types.ts`](../browser-app/src/types.ts) | Decide whether to retain the original CSV or only normalized fields. The current import stores normalized titles and a filename, not the original file. Review storage compatibility for any added fields. |
| Extension source acquisition | [`watchlist.js`](../chrome-extension/lib/watchlist.js), [`injected-scrape.js`](../chrome-extension/lib/injected-scrape.js) | Reuse acquisition if extension transfer is in scope. Prove all pages were collected; its cache may already contain a filtered subset. |
| Extension orchestration and controls | [`service-worker.js`](../chrome-extension/background/service-worker.js), [`popup.js`](../chrome-extension/popup/popup.js), [`popup.html`](../chrome-extension/popup/popup.html), [`manifest.json`](../chrome-extension/manifest.json) | Add an explicit export/transfer path and accurate progress. Review permissions only for capabilities actually selected. |
| Instructions and presentation | [`index.html`](../browser-app/index.html), [`index.css`](../browser-app/src/index.css), client READMEs | Explain source export, destination choice, title review, and the final confirmation step. Keep static and interactive copy aligned. |

## Data preservation and edge cases

- The current model's `rating` is an IMDb aggregate rating, not the user's score. Do not map it into Letterboxd personal-rating columns. Personal ratings, diary dates, reviews, and watched status are outside the initial membership-transfer proposal.
- List name, description, original positions, and per-item annotations are not explicitly modeled. The browser parser maps `Description` into `plot`, which is not a reliable transfer field for list notes. Define richer metadata separately if preservation is required.
- Preserve stable film order through serialization and deduplicate by verified identity. Record excluded, invalid, or unresolved rows instead of silently declaring every title transferred.
- IMDb lists may contain TV titles or other entries unavailable at the destination. Report these for review rather than matching only by a similar name. Missing type information is not proof that an entry is a supported movie.
- A list fetched by the extension may be incomplete after DOM fallback, an empty page, or the page cap. A transfer feature needs completeness evidence or a visible partial-result state before export.

## Decisions for later expansion

Issue #5 starts from an IMDb CSV or saved list in the browser, exports the full list unless a subset is explicitly selected, and leaves destination match review and append/replace confirmation to Letterboxd. Later work can add pasted IMDb URLs, extension acquisition, richer metadata preservation, or direct authenticated writing. Multi-list batches, automatic repeat-transfer semantics, and ongoing synchronization need their own requirements.

## Completion evidence

For a file-based first version, validate representative IMDb watchlist and custom-list inputs, missing IDs/years, non-ASCII titles, commas/quotes/newlines, duplicate entries, mixed movie/TV lists, and exports approaching the documented size limit. Verify any generated file in Letterboxd's match preview, including title identity and order. Test that IMDb aggregate ratings are not exported as user ratings, the picker filter cannot silently narrow the export, and preparing a file leaves the original saved list usable.

End-to-end acceptance requires the chosen destination to contain the expected titles after the user's confirmation, with unmatched/excluded items accounted for. Until exercised, describe the capability as prepared for import rather than verified transfer. If direct writing is selected later, add checks for authentication expiry, partial writes, retries without duplicates, and the chosen append/replace semantics.
