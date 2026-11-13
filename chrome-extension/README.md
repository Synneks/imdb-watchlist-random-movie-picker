# Watchlist Random Picker — Chrome extension

Pick a random movie or show from an IMDb watchlist or custom list.

## Install (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `chrome-extension/` folder.

## Setup and use

1. Log into [IMDb](https://www.imdb.com) in Chrome, particularly for a private list you can access.
2. Click the extension icon and paste an IMDb watchlist or custom-list URL, or a bare user/list ID.
   Examples: `https://www.imdb.com/user/ur12345678/watchlist`,
   `https://www.imdb.com/list/ls123456789/`, `ur12345678`, `ls123456789`.
3. Click **Import list**. A progress window stays open while IMDb loads.
4. Click **Pick random**, then **Open on IMDb** or **Pick again**.

Use **Refresh list** to fetch changes. **Movies & TV movies only** excludes known
non-movie types; unknown types remain eligible. Changing source or filter clears
the local pool and requires another import. Settings are synced by Chrome;
cached titles remain local to this device.

## Complete acquisition and cache

The extension reads structured title data from your IMDb tab using your Chrome
login. It fetches subsequent pages on the IMDb origin, checks the reported total
against unique IMDb IDs, and filters locally after collecting the full list.
No third-party API is used. The IMDb tab remains open after an explicit import.

Repeated/empty/unreadable pages, changing totals, unknown totals, and the
100-page limit fail the import rather than save a partial random pool. A
DOM-only page cannot establish completeness and is rejected. IMDb can change
its page format; an import error may therefore require a scraper update.

Successful complete results are cached for one hour, keyed by canonical source
and movie filter. Sparse metadata is valid. Refresh always fetches again.
A failed refresh preserves an existing compatible cache; changing source/filter
prevents reuse. Existing cached data from older versions requires reimport;
stored source/filter settings remain compatible.

## Troubleshooting

- **Invalid URL**: use a watchlist/user URL, custom-list URL, or bare `ur…`/`ls…`
  identifier. Title, edit, ratings and other IMDb pages are not supported inputs.
- **Private/unavailable list or unsupported format**: open the actual list in
  IMDb while logged in, confirm that you can view it, then retry Import/Refresh.
- **Import incomplete**: no partial pool was saved. Retry after checking access
  and the IMDb list; persistent repetition may indicate changed pagination.
- **No titles match**: disable the movie filter or select a nonempty list.
- **Source/filter changed during import**: repeat import with current settings.

## Verification

From the repository root, run `node --test tests/imdb-custom-lists.test.mjs`
after `npm ci` in `browser-app/`. It uses synthetic CSV/structured-page fixtures
and mocked Chrome storage/messages, not a live browser session. See
[IMDb custom-list verification notes](../docs/imdb-custom-lists.md) for manual gaps.
