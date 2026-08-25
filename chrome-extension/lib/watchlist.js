export function parseWatchlistUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^ur\d{7,9}$/i.test(trimmed) || /^p\.[a-z0-9]+$/i.test(trimmed)) {
    return { kind: "watchlist", id: trimmed, url: `https://www.imdb.com/user/${trimmed}/watchlist` };
  }

  if (/^ls\d{7,10}$/i.test(trimmed)) {
    return { kind: "list", id: trimmed, url: `https://www.imdb.com/list/${trimmed}/` };
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.hostname !== "www.imdb.com" && url.hostname !== "imdb.com") return null;

    const listMatch = url.pathname.match(/\/list\/(ls\d{7,10})/i);
    if (listMatch) {
      return { kind: "list", id: listMatch[1], url: `https://www.imdb.com/list/${listMatch[1]}/` };
    }

    const userMatch = url.pathname.match(/\/user\/((?:ur\d{7,9}|p\.[a-z0-9]+))\/watchlist/i);
    if (userMatch) {
      return {
        kind: "watchlist",
        id: userMatch[1],
        url: `https://www.imdb.com/user/${userMatch[1]}/watchlist`,
      };
    }

    const userOnly = url.pathname.match(/\/user\/((?:ur\d{7,9}|p\.[a-z0-9]+))/i);
    if (userOnly) {
      return {
        kind: "watchlist",
        id: userOnly[1],
        url: `https://www.imdb.com/user/${userOnly[1]}/watchlist`,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function extractWatchlistFromTabUrl(tabUrl) {
  if (!tabUrl) return null;
  return parseWatchlistUrl(tabUrl);
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out loading IMDb watchlist."));
    }, 45000);

    function listener(updatedTabId, info) {
      if (updatedTabId !== tabId || info.status !== "complete") return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (tab.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

function buildStartUrl(parsed, moviesOnly) {
  const params = new URLSearchParams();
  if (parsed.kind === "watchlist") {
    params.set("view", "detail");
  } else {
    params.set("sort", "list_order,asc");
  }
  if (moviesOnly) {
    params.set("title_type", "movie,tvMovie");
  }
  params.set("page", "1");
  return `${parsed.url}?${params.toString()}`;
}

async function findExistingWatchlistTab(parsed) {
  const tabs = await chrome.tabs.query({ url: ["https://www.imdb.com/*", "https://imdb.com/*"] });
  const prefix = parsed.url.replace(/\/$/, "");
  return tabs.find((tab) => tab.url?.replace(/\/$/, "").startsWith(prefix)) ?? null;
}

export async function fetchWatchlist(
  source,
  { moviesOnly = false, activateTab = false, keepTab = false } = {}
) {
  const parsed = typeof source === "string" ? parseWatchlistUrl(source) : source;
  if (!parsed?.url) {
    throw new Error("Invalid watchlist URL or user ID.");
  }

  const scrapeParams = {
    baseUrl: parsed.url.replace(/\/$/, ""),
    kind: parsed.kind,
    moviesOnly,
  };

  let tab = await findExistingWatchlistTab(parsed);
  let createdTab = false;
  const startUrl = buildStartUrl(parsed, moviesOnly);

  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: startUrl, active: activateTab });
    createdTab = true;
  } else {
    await chrome.tabs.update(tab.id, { url: startUrl, active: activateTab });
  }

  try {
    await waitForTabComplete(tab.id);
    // Give IMDb a moment after navigation/redirects before scraping.
    await new Promise((resolve) => setTimeout(resolve, 800));

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (params) => {
        sessionStorage.setItem("imdb-scrape-params", JSON.stringify(params));
      },
      args: [scrapeParams],
    });

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["lib/injected-scrape.js"],
    });

    if (injection?.error) {
      throw new Error(injection.error.message || "Watchlist scrape failed.");
    }

    const payload = injection?.result;
    if (!payload || !Array.isArray(payload.items)) {
      throw new Error(
        "Could not read watchlist from IMDb. Open your watchlist while logged in and try again."
      );
    }

    return { source: parsed, items: payload.items, fetchedAt: payload.fetchedAt ?? Date.now() };
  } finally {
    if (createdTab && !keepTab && tab?.id) {
      await chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

export function pickRandom(items) {
  if (!items?.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}
