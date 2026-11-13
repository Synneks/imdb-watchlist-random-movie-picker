# Project context

Random Movie Picker helps users choose a random film from their IMDb or Letterboxd lists. The repository contains an independently deployed browser CSV picker and a Chrome extension for list URL imports. Both preserve source membership and allow repeated random picks.

Before generating or changing code, read [docs/coding-principles.md](docs/coding-principles.md). For browser work, also read [browser-app/AGENTS.md](browser-app/AGENTS.md) for the app's purpose and user workflow.

Read [docs/codebase-guide.md](docs/codebase-guide.md) before implementing a feature. It indexes the source files, traces both app flows, and records storage contracts and validation commands. Use its feature table to select the files to inspect.

For issue-based work, use [docs/feature-issues.md](docs/feature-issues.md) to locate the issue, then fetch its current GitHub description and comments for scope and acceptance criteria. It also maps the branding/provider-toggle work and feature dependencies.

For Letterboxd lists, another import provider, provider-specific metadata, or source identity changes, also read [docs/letterboxd-support.md](docs/letterboxd-support.md). It separates current behavior from proposed integration work and unresolved questions.

For transferring IMDb lists to Letterboxd, CSV export, or writing destination lists, read [docs/imdb-to-letterboxd-transfer.md](docs/imdb-to-letterboxd-transfer.md). It covers the supported import handoff, affected files, data preservation, and transfer scope decisions.

## Working conventions

- Treat `browser-app/` and `chrome-extension/` as independent applications. They share concepts but no runtime code, build, or storage.
- Preserve existing IMDb imports and saved lists when extending source formats or title identity. Review persistence compatibility when changing either data model.
- Keep static instructions and metadata in `browser-app/index.html` consistent with the React picker. The page outside `#picker` is authored separately.
- Use `browser-app/package.json` for available scripts and `.github/workflows/deploy-pages.yml` for the deployment contract. The extension loads unpacked without a build step.
- Update the linked reference documents when changing the flows or contracts they describe. Proposed behavior belongs in the relevant feature notes until implemented.
