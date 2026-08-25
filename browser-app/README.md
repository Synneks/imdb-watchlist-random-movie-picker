# IMDb Watchlist Random Picker — Browser app

Pick a random title from an IMDb watchlist CSV. No login, no server — the file stays in your browser (`localStorage`).

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
