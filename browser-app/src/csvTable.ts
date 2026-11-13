/** Split CSV text into rows/cells while respecting quoted commas, quotes, and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Spreadsheet exports can start with a BOM, which otherwise becomes part of the first header.
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    // Inside a quoted field, separators are ordinary text; doubled quotes encode one quote.
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    // Accept both Windows CRLF and Unix LF row endings (and standalone CR below).
    if (char === "\n" || char === "\r") {
      row.push(field);
      field = "";
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = [];
      if (char === "\r" && next === "\n") i += 1;
      continue;
    }

    field += char;
  }

  // A final unmatched quote means the parser cannot safely determine field boundaries.
  if (inQuotes) throw new Error("Malformed CSV: an opening quote has no closing quote.");
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

/** Canonicalize a column name so case and repeated whitespace do not affect matching. */
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Return the first matching header index, checking preferred aliases in order. */
export function column(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index !== -1) return index;
  }
  return -1;
}

/** Read and trim a cell; a missing column is represented as an empty string. */
export function cell(row: string[], index: number): string {
  if (index < 0) return "";
  return (row[index] ?? "").trim();
}

/** Parse comma-formatted numeric CSV values, returning null for missing/invalid values. */
export function parseNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

