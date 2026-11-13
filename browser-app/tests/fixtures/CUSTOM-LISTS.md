# Letterboxd custom-list fixture provenance

Researched 2026-11-13. These are **reconstructed, sanitized fixtures**, not fresh
exports from a signed-in Letterboxd account. Their table boundaries and headers
were checked against these public CSV files at fixed revisions:

- [letterboxdHueSort sample](https://github.com/josfam/letterboxdHueSort/blob/84672dadfc572df53d05ef76afbcb28800995c85/samples/sample_list.csv):
  `Letterboxd list export v7,,,,`, metadata headers `Date,Name,Tags,URL,Description`,
  comma-only separator, then `Position,Name,Year,URL,Description` and boxd.it film URLs.
- [20s Ranked export](https://github.com/AgosVenezia/Letterboxd-aguitov/blob/be4dfb526a3aa65edc45abf2ecd351c31a0a6239/lists/20s-ranked.csv):
  single-cell v7 marker, same metadata/film headers, blank separator, boxd.it URLs.

The v7 fixture replaces the list owner's metadata and adds BOM, quoted commas,
embedded newlines, Unicode, a missing year, a duplicate and canonical film links
as deliberate regression cases. The table-only fixture removes the preamble and
adds invalid links and out-of-order position numbers to verify row-order retention.
Neither file claims to be an unmodified export. Film facts/links are small examples;
list names and notes are fabricated. No private account data is included.

[Official account export help](https://support.letterboxd.com/hc/en-us/articles/15179196880911-Can-I-get-a-copy-of-my-account-data)
confirms a desktop Settings export containing CSV files in a ZIP; it does not
specify the list CSV schema. ZIP upload is outside this importer. Fresh account
export and manual end-to-end browser verification must be reported separately.
