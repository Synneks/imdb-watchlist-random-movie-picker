import { parseWatchlistUrl } from "../lib/watchlist.js";

const isPanelWindow = new URLSearchParams(location.search).get("window") === "1";

const els = {
  status: document.getElementById("status"),
  result: document.getElementById("result"),
  idle: document.getElementById("idle"),
  importProgress: document.getElementById("import-progress"),
  importMessage: document.getElementById("import-message"),
  title: document.getElementById("title"),
  meta: document.getElementById("meta"),
  ratingLine: document.getElementById("rating-line"),
  plot: document.getElementById("plot"),
  credits: document.getElementById("credits"),
  poster: document.getElementById("poster"),
  openTitle: document.getElementById("open-imdb"),
  error: document.getElementById("error"),
  primaryAction: document.getElementById("primary-action"),
  pickAgain: document.getElementById("pick-again"),
  refreshList: document.getElementById("refresh-list"),
  watchlistSource: document.getElementById("watchlist-source"),
  moviesOnly: document.getElementById("movies-only"),
};

let lastSaved = { watchlistSource: "", moviesOnly: false };
let uiMode = "empty"; // empty | importing | ready | result
let cachedCount = 0;

function showError(message) {
  if (!message) {
    els.error.classList.add("hidden");
    els.error.textContent = "";
    return;
  }
  els.error.textContent = message;
  els.error.classList.remove("hidden");
}

function setControlsDisabled(disabled) {
  els.primaryAction.disabled = disabled;
  els.pickAgain.disabled = disabled;
  els.refreshList.disabled = disabled;
  els.watchlistSource.disabled = disabled;
  els.moviesOnly.disabled = disabled;
}

function setText(el, text) {
  if (!text) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = text;
  el.classList.remove("hidden");
}

function formatVotes(count) {
  if (count == null) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}K`;
  return String(count);
}

function truncateText(text, maxLength = 40) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, 37)}...`;
}

function formatType(type) {
  const map = {
    movie: "Movie",
    tvMovie: "TV Movie",
    tvSeries: "TV Series",
    tvMiniSeries: "Mini Series",
    tvSpecial: "TV Special",
    short: "Short",
    video: "Video",
    videoGame: "Game",
  };
  return map[type] ?? type;
}

function renderMode() {
  const importing = uiMode === "importing";
  const ready = uiMode === "ready" || uiMode === "result";
  const showingResult = uiMode === "result";

  els.importProgress.classList.toggle("hidden", !importing);
  els.idle.classList.toggle("hidden", importing || showingResult);
  els.result.classList.toggle("hidden", !showingResult);

  if (ready) {
    els.primaryAction.textContent = "Pick random";
    els.refreshList.classList.remove("hidden");
  } else {
    els.primaryAction.textContent = "Import list";
    els.refreshList.classList.add("hidden");
  }

  setControlsDisabled(importing);
}

function showMovie(movie) {
  els.title.textContent = movie.title ?? movie.displayTitle ?? "Unknown title";

  const metaParts = [];
  if (movie.year) metaParts.push(String(movie.year));
  if (movie.runtime) metaParts.push(movie.runtime);
  if (movie.certificate) metaParts.push(movie.certificate);
  if (movie.type) metaParts.push(formatType(movie.type));
  els.meta.textContent = metaParts.join(" · ");

  els.ratingLine.replaceChildren();
  if (movie.metascore != null || movie.rating != null) {
    if (movie.metascore != null) {
      const badge = document.createElement("span");
      badge.className = "metascore";
      badge.textContent = String(movie.metascore);
      els.ratingLine.append(badge, document.createTextNode(" Metascore"));
      if (movie.rating != null) {
        els.ratingLine.append(document.createTextNode(" · "));
      }
    }
    if (movie.rating != null) {
      const votes = movie.voteCount != null ? ` (${formatVotes(movie.voteCount)})` : "";
      els.ratingLine.append(document.createTextNode(`★ ${movie.rating.toFixed(1)}${votes}`));
    }
    els.ratingLine.classList.remove("hidden");
  } else {
    setText(els.ratingLine, "");
  }

  setText(els.plot, movie.plot);

  els.credits.replaceChildren();
  if (movie.director || movie.stars?.length) {
    if (movie.director) {
      const line = document.createElement("span");
      line.className = "credit-line";
      const dirLabel = document.createElement("strong");
      dirLabel.textContent = "Director";
      line.append(dirLabel, document.createTextNode(` ${truncateText(movie.director)}`));
      els.credits.append(line);
    }
    if (movie.stars?.length) {
      const line = document.createElement("span");
      line.className = "credit-line";
      const starsLabel = document.createElement("strong");
      starsLabel.textContent = "Stars";
      line.append(
        starsLabel,
        document.createTextNode(` ${truncateText(movie.stars.join(", "))}`)
      );
      els.credits.append(line);
    }
    els.credits.classList.remove("hidden");
  } else {
    setText(els.credits, "");
  }

  if (movie.poster) {
    els.poster.src = movie.poster;
    els.poster.alt = movie.title;
    els.poster.classList.remove("hidden");
  } else {
    els.poster.classList.add("hidden");
    els.poster.removeAttribute("src");
  }

  els.openTitle.href = movie.url ?? "#";
  els.openTitle.textContent = movie.provider === "letterboxd" ? "Open on Letterboxd" : "Open on IMDb";
  uiMode = "result";
  renderMode();
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function applyImportState(importState, count = cachedCount) {
  if (importState?.status === "running" || importState?.status === "error") {
    cachedCount = count;
  } else if (typeof importState?.count === "number") {
    cachedCount = importState.count;
  } else {
    cachedCount = count;
  }
  const status = importState?.status ?? "idle";

  if (status === "running") {
    uiMode = "importing";
    els.importMessage.textContent = importState.message || "Importing list…";
    els.status.textContent = importState.message || "Import in progress…";
    showError("");
    renderMode();
    return;
  }

  if (status === "error") {
    uiMode = cachedCount > 0 ? "ready" : "empty";
    els.status.textContent = importState.message || "Import failed";
    showError(importState.error || "Import failed.");
    renderMode();
    return;
  }

  if (cachedCount > 0) {
    if (uiMode !== "result") uiMode = "ready";
    els.status.textContent =
      importState?.status === "done" && importState.message
        ? importState.message
        : `${cachedCount} titles cached`;
    showError("");
  } else {
    uiMode = "empty";
    els.status.textContent = importState?.status === "done" && importState.message
      ? importState.message
      : lastSaved.watchlistSource
      ? "Paste an IMDb or Letterboxd list URL, then import"
      : "Paste an IMDb watchlist/custom-list or Letterboxd list URL above";
  }
  renderMode();
}

async function loadSettings() {
  const response = await sendMessage({ type: "getStatus" });
  if (!response?.ok) {
    showError(response?.error ?? "Could not load extension status.");
    els.status.textContent = "Error";
    return;
  }

  els.watchlistSource.value = response.watchlistSource ?? "";
  els.moviesOnly.checked = Boolean(response.moviesOnly);
  lastSaved = {
    watchlistSource: response.watchlistSource ?? "",
    moviesOnly: Boolean(response.moviesOnly),
  };
  cachedCount = response.cachedCount ?? 0;
  applyImportState(response.importState, cachedCount);
}

async function saveSettingsIfNeeded() {
  const watchlistSource = els.watchlistSource.value.trim();
  const moviesOnly = els.moviesOnly.checked;

  if (watchlistSource && !parseWatchlistUrl(watchlistSource)) {
    throw new Error("That does not look like a valid IMDb watchlist/custom-list or public Letterboxd list URL.");
  }

  const changed =
    watchlistSource !== lastSaved.watchlistSource || moviesOnly !== lastSaved.moviesOnly;

  if (!changed) {
    return false;
  }

  await chrome.storage.sync.set({ watchlistSource, moviesOnly });
  await chrome.storage.local.remove(["cachedWatchlist", "cachedAt", "cacheVersion"]);
  await chrome.storage.local.set({ importState: { status: "idle", count: 0, message: "" } });
  cachedCount = 0;
  lastSaved = { watchlistSource, moviesOnly };
  return true;
}

async function importWatchlist() {
  showError("");

  try {
    await saveSettingsIfNeeded();
  } catch (error) {
    showError(error.message ?? String(error));
    els.status.textContent = "Fix list URL";
    return;
  }

  if (!els.watchlistSource.value.trim()) {
    showError("Paste an IMDb watchlist or custom-list URL or ID above first.");
    els.status.textContent = "List not configured";
    return;
  }

  uiMode = "importing";
  els.importMessage.textContent = "Starting import…";
  els.status.textContent = "Starting import…";
  renderMode();

  // Open a sticky panel window while the source list loads (closes the toolbar popup).
  const openPanel = !isPanelWindow;
  const response = await sendMessage({ type: "importWatchlist", openPanel });

  if (!response?.ok) {
    uiMode = cachedCount > 0 ? "ready" : "empty";
    showError(response?.error ?? "Import failed.");
    els.status.textContent = "Import failed";
    renderMode();
    return;
  }

  cachedCount = response.count ?? cachedCount;
  uiMode = cachedCount > 0 ? "ready" : "empty";
  els.status.textContent =
    cachedCount > 0 ? `Imported ${cachedCount} titles` : "List read; no titles match. Try disabling the movie filter.";
  showError("");
  renderMode();
}

async function pickRandom() {
  showError("");

  try {
    await saveSettingsIfNeeded();
  } catch (error) {
    showError(error.message ?? String(error));
    els.status.textContent = "Fix list URL";
    return;
  }

  setControlsDisabled(true);
  els.status.textContent = "Picking…";

  try {
    const response = await sendMessage({ type: "pickRandom", forceRefresh: false });
    if (!response?.ok) {
      showError(response.error ?? "Something went wrong.");
      els.status.textContent = "Could not pick a title";
      return;
    }
    showMovie(response.movie);
    cachedCount = response.total;
    els.status.textContent = `${response.total} titles in list`;
  } finally {
    setControlsDisabled(false);
  }
}

async function refreshWatchlist() {
  showError("");

  try {
    await saveSettingsIfNeeded();
  } catch (error) {
    showError(error.message ?? String(error));
    els.status.textContent = "Fix list URL";
    return;
  }

  uiMode = "importing";
  els.importMessage.textContent = "Refreshing list…";
  els.status.textContent = "Refreshing list…";
  renderMode();

  const response = await sendMessage({ type: "refreshWatchlist" });
  if (!response?.ok) {
    uiMode = cachedCount > 0 ? "ready" : "empty";
    showError(response?.error ?? "Refresh failed.");
    els.status.textContent = "Refresh failed";
    renderMode();
    return;
  }

  cachedCount = response.total ?? 0;
  uiMode = cachedCount > 0 ? "ready" : "empty";
  els.status.textContent = `${cachedCount} titles cached`;
  showError("");
  renderMode();
}

els.primaryAction.addEventListener("click", () => {
  if (uiMode === "ready" || uiMode === "result") {
    pickRandom();
  } else {
    importWatchlist();
  }
});
els.pickAgain.addEventListener("click", () => pickRandom());
els.refreshList.addEventListener("click", () => refreshWatchlist());

els.moviesOnly.addEventListener("change", async () => {
  try {
    const changed = await saveSettingsIfNeeded();
    if (changed) {
      cachedCount = 0;
      uiMode = "empty";
      els.status.textContent = "Filter updated — import your list again";
      renderMode();
    }
    showError("");
  } catch (error) {
    showError(error.message ?? String(error));
  }
});

els.watchlistSource.addEventListener("change", async () => {
  try {
    const changed = await saveSettingsIfNeeded();
    if (changed) {
      cachedCount = 0;
      uiMode = "empty";
    }
    els.status.textContent = els.watchlistSource.value.trim()
      ? "List saved — click Import list"
      : "Paste an IMDb watchlist/custom-list or Letterboxd list URL above";
    showError("");
    renderMode();
  } catch (error) {
    showError(error.message ?? String(error));
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.importState) {
    applyImportState(changes.importState.newValue, cachedCount);
  }

  if (changes.cachedWatchlist) {
    cachedCount = changes.cachedWatchlist.newValue?.items?.length ?? 0;
    if (cachedCount > 0 && uiMode !== "importing" && uiMode !== "result") {
      uiMode = "ready";
      els.status.textContent = `${cachedCount} titles cached`;
      renderMode();
    }
    if (cachedCount === 0 && uiMode !== "importing") {
      uiMode = "empty";
      renderMode();
    }
  }
});

loadSettings();
