import { fetchWatchlist, parseWatchlistUrl, pickRandom } from "../lib/watchlist.js";

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_VERSION = 2;

let importInFlight = null;

async function getSettings() {
  const { watchlistSource, moviesOnly } = await chrome.storage.sync.get({
    watchlistSource: "",
    moviesOnly: false,
  });
  return { watchlistSource, moviesOnly };
}

async function getCachedWatchlist() {
  const { cachedWatchlist, cachedAt, cacheVersion } = await chrome.storage.local.get({
    cachedWatchlist: null,
    cachedAt: 0,
    cacheVersion: 0,
  });
  return { cachedWatchlist, cachedAt, cacheVersion };
}

async function saveCache(watchlist) {
  await chrome.storage.local.set({
    cachedWatchlist: watchlist,
    cachedAt: Date.now(),
    cacheVersion: CACHE_VERSION,
  });
}

async function getImportState() {
  const { importState } = await chrome.storage.local.get({
    importState: { status: "idle", message: "" },
  });
  return importState;
}

async function setImportState(partial) {
  const current = await getImportState();
  const next = { ...current, ...partial, updatedAt: Date.now() };
  await chrome.storage.local.set({ importState: next });
  return next;
}

async function ensurePanelWindow() {
  const { importWindowId } = await chrome.storage.local.get({ importWindowId: null });

  if (importWindowId != null) {
    try {
      await chrome.windows.get(importWindowId);
      await chrome.windows.update(importWindowId, { focused: true });
      return importWindowId;
    } catch {
      // Window was closed.
    }
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("popup/popup.html?window=1"),
    type: "popup",
    width: 380,
    height: 640,
    focused: true,
  });

  await chrome.storage.local.set({ importWindowId: win.id });
  return win.id;
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { importWindowId } = await chrome.storage.local.get({ importWindowId: null });
  if (importWindowId === windowId) {
    await chrome.storage.local.remove("importWindowId");
  }
});

function cacheIsUsable(cachedWatchlist, cachedAt, cacheVersion, settings) {
  const sameSource =
    cachedWatchlist?.source?.url === parseWatchlistUrl(settings.watchlistSource)?.url;
  const fresh = Date.now() - cachedAt < CACHE_TTL_MS;
  const hasItems = (cachedWatchlist?.items?.length ?? 0) > 0;
  const hasDetails = cachedWatchlist?.items?.some(
    (item) => item.plot != null || item.director != null || item.metascore != null
  );
  return Boolean(
    cachedWatchlist &&
      sameSource &&
      fresh &&
      hasItems &&
      cacheVersion === CACHE_VERSION &&
      hasDetails
  );
}

async function loadWatchlist(forceRefresh = false) {
  const settings = await getSettings();
  if (!settings.watchlistSource?.trim()) {
    throw new Error("Paste your IMDb watchlist URL in the extension popup first.");
  }

  if (!forceRefresh) {
    const { cachedWatchlist, cachedAt, cacheVersion } = await getCachedWatchlist();
    if (cacheIsUsable(cachedWatchlist, cachedAt, cacheVersion, settings)) {
      return cachedWatchlist;
    }
  }

  const watchlist = await fetchWatchlist(settings.watchlistSource, {
    moviesOnly: settings.moviesOnly,
  });
  await saveCache(watchlist);
  return watchlist;
}

async function runImport({ openPanel = false } = {}) {
  if (importInFlight) {
    return importInFlight;
  }

  importInFlight = (async () => {
    const settings = await getSettings();
    if (!settings.watchlistSource?.trim()) {
      throw new Error("Paste your IMDb watchlist URL first.");
    }
    if (!parseWatchlistUrl(settings.watchlistSource)) {
      throw new Error("That does not look like a valid IMDb watchlist URL or ID.");
    }

    await setImportState({
      status: "running",
      message: "Opening your IMDb watchlist…",
      error: "",
      count: 0,
    });

    if (openPanel) {
      await ensurePanelWindow();
    }

    try {
      await setImportState({
        status: "running",
        message: "Importing titles from IMDb…",
      });

      const watchlist = await fetchWatchlist(settings.watchlistSource, {
        moviesOnly: settings.moviesOnly,
        activateTab: true,
        keepTab: true,
      });

      await saveCache(watchlist);

      if (!watchlist.items.length) {
        await setImportState({
          status: "error",
          message: "Import finished, but no titles were found.",
          error:
            "No titles were found. Make sure you are logged into IMDb and the watchlist URL is correct.",
          count: 0,
        });
        return { ok: false, count: 0 };
      }

      await setImportState({
        status: "done",
        message: `Imported ${watchlist.items.length} titles`,
        error: "",
        count: watchlist.items.length,
      });

      if (openPanel) {
        await ensurePanelWindow();
      }

      return { ok: true, count: watchlist.items.length };
    } catch (error) {
      const message = error.message ?? String(error);
      await setImportState({
        status: "error",
        message: "Import failed",
        error: message,
        count: 0,
      });
      throw error;
    } finally {
      importInFlight = null;
    }
  })();

  return importInFlight;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "importWatchlist") {
        const result = await runImport({ openPanel: message.openPanel === true });
        sendResponse({ ok: result.ok, count: result.count });
        return;
      }

      if (message.type === "pickRandom") {
        const watchlist = await loadWatchlist(message.forceRefresh === true);
        const movie = pickRandom(watchlist.items);
        if (!movie) {
          sendResponse({
            ok: false,
            error:
              "No titles were found. Import your watchlist first, or click Refresh watchlist.",
          });
          return;
        }
        sendResponse({
          ok: true,
          movie,
          total: watchlist.items.length,
          cached: !message.forceRefresh,
        });
        return;
      }

      if (message.type === "refreshWatchlist") {
        await setImportState({
          status: "running",
          message: "Refreshing watchlist…",
          error: "",
        });
        try {
          const watchlist = await loadWatchlist(true);
          await setImportState({
            status: "done",
            message: `${watchlist.items.length} titles cached`,
            error: "",
            count: watchlist.items.length,
          });
          sendResponse({ ok: true, total: watchlist.items.length });
        } catch (error) {
          await setImportState({
            status: "error",
            message: "Refresh failed",
            error: error.message ?? String(error),
          });
          throw error;
        }
        return;
      }

      if (message.type === "getStatus") {
        const settings = await getSettings();
        const { cachedWatchlist, cachedAt } = await getCachedWatchlist();
        const importState = await getImportState();
        sendResponse({
          ok: true,
          configured: Boolean(settings.watchlistSource?.trim()),
          watchlistSource: settings.watchlistSource,
          moviesOnly: settings.moviesOnly,
          cachedCount: cachedWatchlist?.items?.length ?? 0,
          cachedAt,
          importState,
        });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type." });
    } catch (error) {
      sendResponse({ ok: false, error: error.message ?? String(error) });
    }
  })();

  return true;
});
