import { fetchWatchlist, parseWatchlistUrl, pickRandom } from "../lib/watchlist.js";

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_VERSION = 3;

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

async function saveCache(watchlist, settings) {
  const current = await getSettings();
  if (
    parseWatchlistUrl(current.watchlistSource)?.url !== parseWatchlistUrl(settings.watchlistSource)?.url ||
    Boolean(current.moviesOnly) !== Boolean(settings.moviesOnly)
  ) {
    throw new Error("Source or filter changed during import. Retry Import or Refresh with the current settings.");
  }
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
  const hasPool = Array.isArray(cachedWatchlist?.items);
  const sameFilter = cachedWatchlist?.moviesOnly === Boolean(settings.moviesOnly);
  return Boolean(
    cachedWatchlist &&
      sameSource &&
      fresh &&
      hasPool &&
      cacheVersion === CACHE_VERSION &&
      sameFilter &&
      cachedWatchlist.complete === true
  );
}

async function loadWatchlist(forceRefresh = false) {
  const settings = await getSettings();
  if (!settings.watchlistSource?.trim()) {
    throw new Error("Paste your IMDb watchlist or custom-list URL in the extension popup first.");
  }

  if (!forceRefresh) {
    const { cachedWatchlist, cachedAt, cacheVersion } = await getCachedWatchlist();
    if (cacheIsUsable(cachedWatchlist, cachedAt, cacheVersion, settings)) {
      return { ...cachedWatchlist, cached: true };
    }
  }

  const watchlist = await fetchWatchlist(settings.watchlistSource, {
    moviesOnly: settings.moviesOnly,
  });
  await saveCache(watchlist, settings);
  return { ...watchlist, cached: false };
}

async function runImport({ openPanel = false } = {}) {
  if (importInFlight) {
    return importInFlight;
  }

  importInFlight = (async () => {
    const settings = await getSettings();
    if (!settings.watchlistSource?.trim()) {
      throw new Error("Paste your IMDb watchlist or custom-list URL first.");
    }
    if (!parseWatchlistUrl(settings.watchlistSource)) {
      throw new Error("That does not look like a valid IMDb watchlist or custom-list URL or ID.");
    }

    await setImportState({
      status: "running",
      message: "Opening your IMDb list…",
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

      await saveCache(watchlist, settings);

      await setImportState({
        status: "done",
        message: watchlist.items.length
          ? `Imported ${watchlist.items.length} titles`
          : "List read successfully; no titles match. Try disabling the movie filter.",
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
    }
  })().finally(() => {
    importInFlight = null;
  });

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
              "No titles were found. Import your watchlist or custom list first, or click Refresh list.",
          });
          return;
        }
        sendResponse({
          ok: true,
          movie,
          total: watchlist.items.length,
          cached: watchlist.cached,
        });
        return;
      }

      if (message.type === "refreshWatchlist") {
        await setImportState({
          status: "running",
          message: "Refreshing list…",
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
        const { cachedWatchlist, cachedAt, cacheVersion } = await getCachedWatchlist();
        const usable = cacheIsUsable(cachedWatchlist, cachedAt, cacheVersion, settings);
        const importState = await getImportState();
        sendResponse({
          ok: true,
          configured: Boolean(settings.watchlistSource?.trim()),
          watchlistSource: settings.watchlistSource,
          moviesOnly: settings.moviesOnly,
          cachedCount: usable ? cachedWatchlist.items.length : 0,
          cachedAt: usable ? cachedAt : 0,
          importState: usable || importState.status === "running" || importState.status === "error"
            ? importState
            : { status: "idle", count: 0, message: "" },
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
