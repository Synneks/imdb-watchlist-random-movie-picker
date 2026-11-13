# IMDb Watchlist Random Movie Picker

Pick a random movie or show from your IMDb watchlist.

## Development reference

- [Feature issue index](docs/feature-issues.md): GitHub implementation scopes and dependencies, including provider themes and list transfer.
- [Codebase guide and feature index](docs/codebase-guide.md): architecture, source map, data flows, storage, and validation.
- [Letterboxd support notes](docs/letterboxd-support.md): integration options, affected files, and questions to resolve before implementation.
- [IMDb-to-Letterboxd transfer notes](docs/imdb-to-letterboxd-transfer.md): transfer workflow, export options, and data preservation requirements.
- [Agent entry point](AGENTS.md): context pointers for future coding sessions.

## Projects

| Directory | Description |
|-----------|-------------|
| [`chrome-extension/`](chrome-extension/) | Chrome extension (reads the watchlist page while you are logged in) |
| [`browser-app/`](browser-app/) | Public web app (CSV upload, GitHub Pages, no backend) |

## Chrome extension

See [`chrome-extension/README.md`](chrome-extension/README.md). Load unpacked from `chrome-extension/`.

## Browser app

See [`browser-app/README.md`](browser-app/README.md).

```bash
cd browser-app
npm install
npm run dev
```
