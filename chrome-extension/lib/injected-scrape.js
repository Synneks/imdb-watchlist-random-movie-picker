function parseNextData(html) {
  const match = html.match(/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function parseCredits(node) {
  const groups = Array.isArray(node.principalCreditsV2) ? node.principalCreditsV2 : [];
  let director = null;
  let stars = [];

  for (const group of groups) {
    const label = (group.grouping?.text || "").toLowerCase();
    const names = (group.credits || [])
      .map((credit) => credit?.name?.nameText?.text)
      .filter(Boolean);

    if (!names.length) continue;

    if (label.includes("director") || label.includes("creator")) {
      director = names[0];
    } else if (label.includes("star")) {
      stars = names.slice(0, 3);
    }
  }

  return { director, stars };
}

function formatRuntime(seconds) {
  if (typeof seconds !== "number" || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function parseTitleNode(node) {
  if (!node || typeof node !== "object") return null;

  const id = node.id;
  if (!id || !/^tt\d+$/.test(id)) return null;

  const title = node.titleText?.text ?? node.originalTitleText?.text ?? "Unknown title";
  const year = node.releaseYear?.year ?? null;
  const rating = node.ratingsSummary?.aggregateRating ?? null;
  const voteCount = node.ratingsSummary?.voteCount ?? null;
  const type = node.titleType?.id ?? null;
  const poster = node.primaryImage?.url ?? null;
  const plot = node.plot?.plotText?.plainText ?? null;
  const metascore = node.metacritic?.metascore?.score ?? null;
  const certificate = node.certificate?.rating ?? null;
  const runtime = formatRuntime(node.runtime?.seconds);
  const { director, stars } = parseCredits(node);

  return {
    id,
    title,
    year,
    rating: typeof rating === "number" ? rating : null,
    voteCount: typeof voteCount === "number" ? voteCount : null,
    type,
    poster,
    plot,
    metascore: typeof metascore === "number" ? metascore : null,
    certificate,
    runtime,
    director,
    stars,
    url: `https://www.imdb.com/title/${id}/`,
    displayTitle: year ? `${title} (${year})` : title,
  };
}

function collectTitleSearch(data) {
  const pageProps = data?.props?.pageProps ?? {};
  const main = pageProps.mainColumnData ?? {};

  const candidates = [
    main.predefinedList?.titleListItemSearch,
    main.advancedTitleSearch,
    main.list?.titleListItemSearch,
    main.titleListItemSearch,
  ].filter(Boolean);

  for (const search of candidates) {
    if (Array.isArray(search.edges)) {
      return {
        search,
        total: pageProps.totalItems ?? search.total ?? null,
        structured: true,
      };
    }
  }

  return {
    search: null,
    total: null,
    structured: false,
  };
}

function extractItemsFromPage(data) {
  const { search, total, structured } = collectTitleSearch(data);
  if (!search?.edges?.length) {
    return { items: [], total, structured };
  }

  const items = search.edges
    .map((edge) =>
      parseTitleNode(
        edge?.listItem ??
          edge?.node?.title ??
          edge?.node?.listItem ??
          edge?.node
      )
    )
    .filter(Boolean);

  return { items, total, structured };
}

function readItemsFromDocument() {
  const script = document.getElementById("__NEXT_DATA__");
  if (script?.textContent) {
    try {
      const parsed = extractItemsFromPage(JSON.parse(script.textContent));
      if (parsed.structured) return parsed;
    } catch {
      // Unsupported data must not become a successful partial DOM import.
    }
  }
  return { items: [], total: null, structured: false };
}

async function fetchPageItems(url) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`IMDb returned HTTP ${response.status}`);
  }
  const html = await response.text();
  const data = parseNextData(html);
  if (!data) {
    throw new Error("Could not parse IMDb page data.");
  }
  return extractItemsFromPage(data);
}

function filterMoviesOnly(items, moviesOnly) {
  if (!moviesOnly) return items;
  return items.filter((item) => !item.type || item.type === "movie" || item.type === "tvMovie");
}

async function scrapeWatchlistInPage(params) {
  const { baseUrl, kind, moviesOnly } = params;
  const search = new URLSearchParams();
  if (kind === "watchlist") {
    search.set("view", "detail");
  } else {
    search.set("sort", "list_order,asc");
  }
  // Read the full source, then filter locally: IMDb totals may describe the
  // unfiltered list even when a title_type query parameter is present.
  let total = null;
  const unique = [];
  const seen = new Set();

  for (let page = 1; page <= 100; page += 1) {
    search.set("page", String(page));
    const pageUrl = `${baseUrl}?${search.toString()}`;
    let batch;
    try {
      batch = page === 1 ? readItemsFromDocument() : await fetchPageItems(pageUrl);
    } catch (error) {
      throw new Error(`Import incomplete (${unique.length} unique titles read): ${error.message} Open the list in IMDb, check access, and retry Import or Refresh.`);
    }

    if (!batch.structured || !Number.isSafeInteger(batch.total) || batch.total < 0) {
      throw new Error("Could not verify the complete IMDb list. It may be private, unavailable, or using an unsupported page format. Open the list while logged in, then retry Import or Refresh. No partial list was saved.");
    }
    if (total === null) total = batch.total;
    if (batch.total !== total) {
      throw new Error("The IMDb list changed during import. Retry Import or Refresh; no partial list was saved.");
    }

    let added = 0;
    for (const item of batch.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
      added += 1;
    }
    if (unique.length === total) break;
    if (unique.length > total || added === 0 || page === 100) {
      throw new Error(`Import incomplete: read ${unique.length} unique titles of ${total}. IMDb returned a repeated, empty, or unreadable page, or the 100-page limit was reached. Retry Import or Refresh; no partial list was saved.`);
    }
  }

  return {
    items: filterMoviesOnly(unique, moviesOnly),
    fetchedAt: Date.now(),
    complete: true,
    sourceCount: total,
  };
}

(async () => {
  const raw = sessionStorage.getItem("imdb-scrape-params");
  if (!raw) {
    throw new Error("Missing scrape parameters.");
  }
  try {
    return await scrapeWatchlistInPage(JSON.parse(raw));
  } catch (error) {
    return { error: error.message ?? String(error) };
  }
})();
