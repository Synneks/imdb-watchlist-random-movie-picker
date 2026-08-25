# IMDb Watchlist Random Picker

A Chrome extension that picks a random movie or show from your IMDb watchlist.

## Install (developer mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder

## Setup

1. Log into [IMDb](https://www.imdb.com) in Chrome (required for private watchlists)
2. Click the extension icon
3. Paste your watchlist URL
4. Click **Import watchlist** — a progress window stays open while IMDb loads and titles are imported

## Use

1. Click the extension icon
2. Click **Pick random** (available after import)
3. Open the title on IMDb or click **Pick again**

Use **Refresh watchlist** to re-fetch titles after your list changes.

Optional: enable **Movies & TV movies only** to exclude TV series and other non-movie titles.

## How it works

The extension loads your watchlist in a background IMDb tab (using your Chrome login) and reads title data embedded in the page. No third-party API is used.

## Troubleshooting

- **Import watchlist** — Paste your URL, then click Import (shown when nothing is cached yet)
- **Could not load watchlist** — Confirm you are logged into IMDb and the list URL is correct
- **Empty watchlist** — Add titles to your IMDb watchlist first
