# Feature issue index

Issues refined on 2026-11-08 using the [codebase guide](codebase-guide.md). GitHub issue descriptions are the implementation scope and acceptance criteria; fetch the current issue and its comments before implementing it. This file routes work rather than duplicating those descriptions.

| Issue | Delivery scope | Reference notes |
| --- | --- | --- |
| [#1 — Letterboxd watchlists](https://github.com/Synneks/imdb-watchlist-random-movie-picker/issues/1) | Browser CSV import, provider-aware identity/persistence, random picking, compatible IMDb restore. | [Letterboxd support](letterboxd-support.md) |
| [#2 — IMDb custom lists](https://github.com/Synneks/imdb-watchlist-random-movie-picker/issues/2) | Existing CSV path regression coverage; extension completeness/cache validation and explicit list copy. Real export/live Chrome verification remains. | [IMDb custom-list verification](imdb-custom-lists.md), [codebase guide](codebase-guide.md) |
| [#3 — Letterboxd custom lists](https://github.com/Synneks/imdb-watchlist-random-movie-picker/issues/3) | Browser CSV import of custom lists, reusing #1's provider foundation and verifying actual export shapes. | [Letterboxd support](letterboxd-support.md) |
| [#4 — Neutral naming and provider themes](https://github.com/Synneks/imdb-watchlist-random-movie-picker/issues/4) | Neutral display name and full-page IMDb/Letterboxd toggle with remembered selection and preserved provider-associated data. | [Codebase guide](codebase-guide.md) |
| [#5 — IMDb-to-Letterboxd transfer](https://github.com/Synneks/imdb-watchlist-random-movie-picker/issues/5) | Preview/export a list and guide the user through Letterboxd's reviewed CSV import. | [Transfer notes](imdb-to-letterboxd-transfer.md) |

## Sequence and boundaries

#1 provides the Letterboxd foundation for #3. Coordinate #4 with their identity/storage changes; visual work can begin separately, but its completed provider-switching flow requires working imports. #2 and #5 can proceed independently of those features.

The working display name in #4 is **Watchlist Random Picker**. The requested web-page toggle switches the entire page between the current IMDb-inspired theme and a Letterboxd-inspired theme. A repository/Pages URL rename and a full extension theme toggle are separate decisions.

CSV import is the initial delivery for #1/#3, and file-based handoff is the initial delivery for #5. Pasted Letterboxd list URLs, ZIP upload, direct authenticated transfer, and ongoing synchronization are future expansions. They are not prerequisites for the scoped issues.

This branch implements browser CSV foundations and themes (#1/#3/#4) and includes local `main` updates for IMDb custom lists (#2) and extension Letterboxd URL imports. GitHub issue status is unchanged; linked notes record verification gaps. The reference notes include broader possibilities and historical questions; follow the current issue's selected delivery scope when starting implementation.
