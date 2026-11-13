# Letterboxd watchlist fixture

`letterboxd-watchlist.csv` is a sanitized four-film excerpt of the public
[watchlist.csv](https://github.com/inquisitivemoron/letterboxd-taste-matcher/blob/19a9860a47130bf0c93972bb34ce07a5be29a171/watchlist.csv)
from `inquisitivemoron/letterboxd-taste-matcher`, inspected on 2026-11-13.
The source project describes uploading Letterboxd watchlist/ratings exports.
Its MIT license is reproduced in `LETTERBOXD-LICENSE.txt`.

Sanitization removes account activity dates, retains film names/year/links and
header order, and converts the source's literal `\r\n` text to CSV newlines.
The source is a publicly supplied export, not an export from an account we
controlled. The test suite separately supplies synthetic edge cases for BOM,
quoting, malformed rows, direct film links, and duplicates.
