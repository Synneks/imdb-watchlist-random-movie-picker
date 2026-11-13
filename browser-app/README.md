# Random Movie Picker — Browser app

Pick a random title from an IMDb or Letterboxd watchlist or custom-list CSV. No login, no server — the file stays in your browser (`localStorage`).

Live (after GitHub Pages is enabled): https://synneks.github.io/imdb-watchlist-random-movie-picker/

## Local development

```bash
cd browser-app
npm install
npm run dev
```

## Deploy to GitHub Pages (free)

1. Push this repo to GitHub (already: `Synneks/imdb-watchlist-random-movie-picker`)
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**
3. Push to `main` (or run the **Deploy browser app** workflow)

The site is static HTML, so Google can index the heading, CSV instructions, and FAQ without executing React.

## SEO notes

GitHub Pages is fine for search. Ranking still needs links and time. A custom domain later helps branding, not crawlability.

To ask Google to index the URL: [Search Console](https://search.google.com/search-console) → add the GitHub Pages property → URL inspection → Request indexing.

## Letterboxd custom lists

Use Letterboxd's account export in **Settings** in a desktop browser, extract the
ZIP, then import the desired CSV from its `lists` folder with Letterboxd selected using **Import Letterboxd CSV**.
Upload one extracted list at a time. The importer accepts the observed v7
metadata preamble and `Position,Name,Year,URL,Description` film table, or that film
table alone. Name and URL are required; year and notes are optional. List notes
are not displayed as film plots. The saved source label uses the metadata name,
falling back to the uploaded filename.

First-seen film order is retained and duplicate normalized links collapse. Each
pick is an independent random draw; positions do not weight it. Films with unknown
types remain eligible under the movie filter. Invalid links/missing names are
skipped; an empty or wholly invalid file fails and preserves the previous list.
Both `https://letterboxd.com/film/.../` and `https://boxd.it/...` links are supported.
The importer does not resolve short-link redirects, so a short link and its long
alias can remain separate entries. Missing film details need no IMDb lookup.

No ZIP upload, pasted-URL acquisition, merging, or extension import is included.
Fixture sources and the fresh-account verification gap are recorded in
[custom-list fixture provenance](tests/fixtures/CUSTOM-LISTS.md).

Run the focused importer/storage checks from the repository root (Node 22.18+
with TypeScript stripping, or the local Node 26 environment):

```sh
node --experimental-strip-types --test browser-app/tests/*.test.ts
```

## Provider selection and themes

Use the IMDb / Letterboxd radio controls above the picker (Tab and arrow keys work).
IMDb keeps its yellow theme; Letterboxd uses slate, green, and blue throughout the
page. Import instructions and title links match the provider. The instructions and FAQ appear in
matching compact cards that start collapsed and toggle by clicking anywhere in the card or by using the keyboard summary. Select the matching
provider before importing; a CSV from the other provider shows an error and keeps
the current list.

Selection is remembered separately from saved lists. Each provider retains one
list, its source label/filename, and its movie filter, including an empty-list
filter preference. Switching clears the displayed pick/error and restores the
selected provider's ready or empty state; it never merges lists. Clear affects only
the selected provider. Existing IMDb local storage is read compatibly and preserved
when the first Letterboxd list is imported. Repository/package/Pages paths stay as
before. The extension has neutral display branding and continues to support IMDb.

Validation for #4: build and lint, Node importer/storage/preference tests, and a
headless Chromium workflow at desktop and 320px widths. Both themes were exercised
in empty, ready, result, and error states with keyboard switching/focus, reload,
independent filters, import replacement/failure, and clear isolation. External
requests were blocked during these UI checks; live IMDb enrichment, fresh signed-in
Letterboxd exports, and unpacked-extension visuals remain manual verification gaps.

## Layout conventions

The stylesheet defines a 4px spacing scale. Page content has a consistent 16px
minimum side inset; the picker uses a vertical stack with 16px internal gaps.
Both help cards use the same `info-card` component rules (16px padding, no outer
margins). Their `help-stack` parent supplies the 16px gap and the separation from
the picker. Themes change colors without changing spacing or component shapes.
The extension follows the same spacing conventions in its independent stylesheet.
