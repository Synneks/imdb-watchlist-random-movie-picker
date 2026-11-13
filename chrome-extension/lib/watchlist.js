export function parseWatchlistUrl(input) {
  const trimmed = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!trimmed) return null;

  if (/^ur\d{7,9}$/i.test(trimmed) || /^p\.[a-z0-9]+$/i.test(trimmed)) {
    return { kind: "watchlist", id: trimmed, url: `https://www.imdb.com/user/${trimmed}/watchlist` };
  }

  if (/^ls\d{7,10}$/i.test(trimmed)) {
    return { kind: "list", id: trimmed, url: `https://www.imdb.com/list/${trimmed}/` };
  }

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    if (url.hostname !== "www.imdb.com" && url.hostname !== "imdb.com") return null;

    const listMatch = url.pathname.match(/^\/list\/(ls\d{7,10})\/?$/i);
    if (listMatch) {
      return { kind: "list", id: listMatch[1], url: `https://www.imdb.com/list/${listMatch[1]}/` };
    }

    const userMatch = url.pathname.match(/^\/user\/((?:ur\d{7,9}|p\.[a-z0-9]+))\/watchlist\/?$/i);
    if (userMatch) {
      return {
        kind: "watchlist",
        id: userMatch[1],
        url: `https://www.imdb.com/user/${userMatch[1]}/watchlist`,
      };
    }

    const userOnly = url.pathname.match(/^\/user\/((?:ur\d{7,9}|p\.[a-z0-9]+))\/?$/i);
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
      reject(new Error("Timed out loading the IMDb list. Open it in IMDb and retry."));
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

function buildStartUrl(parsed) {
  const params = new URLSearchParams();
  if (parsed.kind === "watchlist") {
    params.set("view", "detail");
  } else {
    params.set("sort", "list_order,asc");
  }
  params.set("page", "1");
  return `${parsed.url}?${params.toString()}`;
}

async function findExistingWatchlistTab(parsed) {
  const tabs = await chrome.tabs.query({ url: ["https://www.imdb.com/*", "https://imdb.com/*"] });
  return tabs.find((tab) => parseWatchlistUrl(tab.url)?.url === parsed.url) ?? null;
}

export async function fetchWatchlist(
  source,
  { moviesOnly = false, activateTab = false, keepTab = false } = {}
) {
  const parsed = typeof source === "string" ? parseWatchlistUrl(source) : source;
  if (!parsed?.url) {
    throw new Error("Invalid IMDb watchlist/custom-list URL or user/list ID.");
  }

  const scrapeParams = {
    baseUrl: parsed.url.replace(/\/$/, ""),
    kind: parsed.kind,
    moviesOnly,
  };

  let tab = await findExistingWatchlistTab(parsed);
  let createdTab = false;
  const startUrl = buildStartUrl(parsed);

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
      throw new Error(injection.error.message || "IMDb list import failed.");
    }

    const payload = injection?.result;
    if (payload?.error) throw new Error(payload.error);
    if (!payload || !Array.isArray(payload.items) || payload.complete !== true) {
      throw new Error(
        "Could not read a complete list from IMDb. Open the watchlist or custom list while logged in and retry Import or Refresh."
      );
    }

    return { source: parsed, items: payload.items, moviesOnly: Boolean(moviesOnly), complete: true, sourceCount: payload.sourceCount, fetchedAt: payload.fetchedAt ?? Date.now() };
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
