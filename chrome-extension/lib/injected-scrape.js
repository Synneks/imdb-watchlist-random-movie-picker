function parseNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
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
        total: pageProps.totalItems ?? search.total ?? search.edges.length,
      };
    }
  }

  return {
    search: null,
    total: pageProps.totalItems ?? 0,
  };
}

function extractItemsFromPage(data) {
  const { search, total } = collectTitleSearch(data);
  if (!search?.edges?.length) {
    return { items: [], total: total || 0 };
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

  return { items, total: total || items.length };
}

function extractItemsFromDom() {
  const cards = document.querySelectorAll(
    '[data-testid="list-page-mc-list-content"] li, .ipc-metadata-list-summary-item, .lister-item'
  );
  const seen = new Set();
  const items = [];

  const roots = cards.length
    ? cards
    : [document];

  for (const root of roots) {
    const links = root.querySelectorAll('a[href*="/title/tt"]');
    for (const link of links) {
      const match = link.getAttribute("href")?.match(/\/title\/(tt\d+)\//);
      if (!match || seen.has(match[1])) continue;
      seen.add(match[1]);

      const title =
        link.getAttribute("aria-label") ||
        link.textContent?.trim() ||
        "Unknown title";
      if (!title || title === "Unknown title") continue;

      const yearMatch = title.match(/\((\d{4})\)\s*$/);
      const cleanTitle = yearMatch ? title.replace(/\s*\(\d{4}\)\s*$/, "").trim() : title;

      items.push({
        id: match[1],
        title: cleanTitle,
        year: yearMatch ? Number(yearMatch[1]) : null,
        rating: null,
        voteCount: null,
        type: null,
        poster: null,
        plot: null,
        metascore: null,
        certificate: null,
        runtime: null,
        director: null,
        stars: [],
        url: `https://www.imdb.com/title/${match[1]}/`,
        displayTitle: yearMatch ? `${cleanTitle} (${yearMatch[1]})` : cleanTitle,
      });
    }
  }

  return { items, total: items.length };
}

function readItemsFromDocument() {
  const script = document.getElementById("__NEXT_DATA__");
  if (script?.textContent) {
    try {
      const parsed = extractItemsFromPage(JSON.parse(script.textContent));
      if (parsed.items.length) return parsed;
    } catch {
      // fall through to DOM
    }
  }
  return extractItemsFromDom();
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
  if (moviesOnly) {
    search.set("title_type", "movie,tvMovie");
  }

  let page = 1;
  let total = Infinity;
  const allItems = [];
  let sawStructuredData = false;

  while (allItems.length < total) {
    search.set("page", String(page));
    const pageUrl = `${baseUrl}?${search.toString()}`;

    let batch;
    if (page === 1) {
      batch = readItemsFromDocument();
      if (!batch.items.length) {
        batch = await fetchPageItems(pageUrl);
      }
      sawStructuredData = batch.items.length > 0;
    } else {
      batch = await fetchPageItems(pageUrl);
    }

    if (page === 1) {
      total = batch.total || batch.items.length;
      if (!batch.items.length) {
        if (total > 0) {
          throw new Error(
            `IMDb reports ${total} titles, but none could be read. Try opening your watchlist tab and clicking Refresh again.`
          );
        }
        return { items: [], fetchedAt: Date.now() };
      }
    }

    if (!batch.items.length) break;
    allItems.push(...batch.items);

    if (allItems.length >= total) break;
    page += 1;
    if (page > 100) break;
  }

  if (!sawStructuredData && !allItems.length) {
    throw new Error("Could not read titles from the IMDb watchlist page.");
  }

  const seen = new Set();
  const unique = allItems.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return {
    items: filterMoviesOnly(unique, moviesOnly),
    fetchedAt: Date.now(),
  };
}

(async () => {
  const raw = sessionStorage.getItem("imdb-scrape-params");
  if (!raw) {
    throw new Error("Missing scrape parameters.");
  }
  return scrapeWatchlistInPage(JSON.parse(raw));
})();
