# Browser app

Random Movie Picker helps someone choose a film from an IMDb or Letterboxd list. It runs entirely in the browser, imports local CSV files, and keeps one list and movie-filter preference per provider. Random picks are independent and may repeat. IMDb poster/credit enrichment is optional.

## User workflow

1. Select IMDb or Letterboxd; the page theme and export instructions follow that choice.
2. Export a watchlist/custom list from that site and select its extracted CSV in the app.
3. Optionally enable the movie filter, then pick a random title and open its native film link.
4. Replace or clear the selected provider's list as needed. Switching providers and reloading restore saved preferences and lists.

This is a static app with no account login, backend, or direct list-URL acquisition. The separately packaged Chrome extension handles its own URL-import workflow.

## Future changes

Before generating or changing code, read [the coding principles](../docs/coding-principles.md) and [the codebase guide](../docs/codebase-guide.md). Follow the root AGENTS.md pointers for issue scope, Letterboxd identity, and deferred transfer work.

Use the guide's source index to choose affected modules. Keep the user workflow, persistence compatibility, separately authored `index.html`, and reference documentation aligned with the implementation. Validate the affected contracts and report remaining manual or live-provider gaps.
