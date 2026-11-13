# Random Movie Picker — Chrome extension

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


## Letterboxd list URLs

Paste a public list URL such as `https://letterboxd.com/jmis/list/official-top-250-narrative-feature-films/` and choose **Import list**. The extension opens it in a background tab, reads every numbered page, then closes the tab and saves the URL in synced extension settings and titles in local extension storage. Private lists can be read when you are logged in to Letterboxd in Chrome. If a list page is blocked, unavailable, or pagination cannot be verified, the import fails without saving partial results.

Picked Letterboxd titles open on Letterboxd. Their personal ratings are not imported or shown as IMDb aggregate ratings. The movie filter applies to Letterboxd list entries as movies. IMDb watchlist and custom-list URL import continues to use the existing complete-pagination checks and cache safeguards.

To try it, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this `chrome-extension` directory. Click the extension icon, paste a public Letterboxd list URL into the source field, click **Import list**, then **Pick random**. The imported URL stays in extension settings; titles are cached on this device. Use **Refresh list** to fetch an updated list. This extension build has no store package; load the unpacked folder again after changing files.

## Layout conventions

The popup uses a local spacing scale: 4, 8, 12, 16, and 24px. The body owns the
16px outer inset and section gaps; panels do not add their own outer spacing.
Settings and action groups own their internal gaps. Controls are at least 44px
high, with visible keyboard focus. The same layout applies in light and dark mode.
