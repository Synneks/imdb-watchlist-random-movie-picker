These are synthetic regression fixtures built from the IMDb column aliases and
`__NEXT_DATA__` shapes already supported by this repository. They are **not** a
captured real export or live page and do not establish IMDb's current contract.
Titles/IDs identify public films/shows; dates, notes, ratings and counts are test
data. The CSV includes custom-list Position/Original Title fields, optional
metadata, a duplicate, a missing URL recoverable from Const, quoted commas, and
an embedded newline. Tests additionally apply BOM and CRLF variants.

A sanitized real custom-list export and live multi-page Chrome checks remain
manual verification requirements. Do not relabel these as real-world evidence.
