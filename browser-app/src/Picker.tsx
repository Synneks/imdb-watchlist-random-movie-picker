import { useEffect, useMemo, useRef, useState } from "react";
import { isMovieType, parseWatchlistCsv } from "./csv";
import { enrichTitle } from "./enrich";
import { loadSelectedProvider, selectProvider } from "./provider";
import { clearWatchlist, loadWatchlist, saveWatchlist } from "./storage";
import type { Provider, Title } from "./types";

type Mode = "empty" | "ready" | "result";

function formatType(type: string | null): string | null {
  if (!type) return null;
  const map: Record<string, string> = {
    movie: "Movie",
    tvmovie: "TV Movie",
    tvseries: "TV Series",
    tvminiseries: "Mini Series",
    tvspecial: "TV Special",
    short: "Short",
    video: "Video",
    videogame: "Game",
  };
  return map[type.replace(/\s+/g, "").toLowerCase()] ?? type;
}

function formatVotes(count: number | null): string {
  if (count == null) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}K`;
  return String(count);
}

function truncateText(text: string, maxLength = 40): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, 37)}...`;
}

function pickRandom(items: Title[]): Title | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export default function Picker() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importVersion = useRef(0);
  const [initial] = useState(() => {
    const provider = loadSelectedProvider();
    return { provider, stored: loadWatchlist(provider) };
  });
  const [moviesOnly, setMoviesOnly] = useState(initial.stored?.moviesOnly ?? false);
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [items, setItems] = useState<Title[]>(initial.stored?.items ?? []);
  const [fileName, setFileName] = useState(initial.stored?.fileName ?? "");
  const [sourceName, setSourceName] = useState(initial.stored?.sourceName ?? "");
  const [mode, setMode] = useState<Mode>(initial.stored?.items.length ? "ready" : "empty");
  const [picked, setPicked] = useState<Title | null>(null);
  const [error, setError] = useState("");
  const providerName = provider === "letterboxd" ? "Letterboxd" : "IMDb";
  const [status, setStatus] = useState(initial.stored?.items.length
    ? `${initial.stored.items.length} titles saved`
    : `Upload your ${initial.provider === "letterboxd" ? "Letterboxd" : "IMDb"} CSV to get started`);

  function handleProvider(nextProvider: Provider) {
    if (nextProvider === provider) return;
    importVersion.current += 1;
    const stored = loadWatchlist(nextProvider);
    selectProvider(nextProvider);
    setProvider(nextProvider);
    setItems(stored?.items ?? []);
    setMoviesOnly(stored?.moviesOnly ?? false);
    setFileName(stored?.fileName ?? "");
    setSourceName(stored?.sourceName ?? "");
    setPicked(null);
    setError("");
    setMode(stored?.items.length ? "ready" : "empty");
    setStatus(stored?.items.length ? `${stored.items.length} titles saved` : `Upload your ${nextProvider === "letterboxd" ? "Letterboxd" : "IMDb"} CSV to get started`);
  }

  useEffect(() => {
    if (!picked?.id || picked.provider !== "imdb") return;
    if (picked.poster && picked.stars.length) return;

    let cancelled = false;
    enrichTitle(picked.imdbId ?? picked.id).then((enrichment) => {
      if (cancelled) return;
      if (!enrichment.poster && !enrichment.stars.length) return;

      setPicked((current) => {
        if (!current || current.id !== picked.id) return current;
        return {
          ...current,
          poster: enrichment.poster ?? current.poster,
          stars: enrichment.stars.length ? enrichment.stars : current.stars,
        };
      });

      setItems((current) => {
        const next = current.map((item) =>
          item.id === picked.id
            ? {
                ...item,
                poster: enrichment.poster ?? item.poster,
                stars: enrichment.stars.length ? enrichment.stars : item.stars,
              }
            : item
        );
        saveWatchlist({
          provider,
          items: next,
          moviesOnly,
          importedAt: Date.now(),
          fileName,
          sourceName,
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [picked?.id, picked?.poster, picked?.stars.length, moviesOnly, fileName, sourceName, provider, picked?.provider, picked?.imdbId]);

  const pool = useMemo(() => {
    if (!moviesOnly) return items;
    return items.filter((item) => isMovieType(item.type));
  }, [items, moviesOnly]);

  function persist(nextItems: Title[], nextMoviesOnly: boolean, nextFileName: string, nextProvider = provider, nextSourceName = sourceName) {
    saveWatchlist({
      provider: nextProvider,
      items: nextItems,
      moviesOnly: nextMoviesOnly,
      importedAt: Date.now(),
      fileName: nextFileName,
      sourceName: nextSourceName || undefined,
    });
  }

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError("");

    const version = ++importVersion.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (version !== importVersion.current) return;
      try {
        const text = String(reader.result ?? "");
        const imported = parseWatchlistCsv(text);
        if (imported.provider !== provider) {
          const source = imported.provider === "letterboxd" ? "Letterboxd" : "IMDb";
          throw new Error(`This is a ${source} CSV. Select ${source} before importing it.`);
        }
        const parsed = imported.items;
        persist(parsed, moviesOnly, file.name, imported.provider, imported.sourceName ?? "");
        setItems(parsed);
        setFileName(file.name);
        setSourceName(imported.sourceName ?? "");
        setPicked(null);
        setMode("ready");

        const filtered = moviesOnly ? parsed.filter((item) => isMovieType(item.type)) : parsed;
        setStatus(`Imported ${filtered.length} titles`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that CSV.");
        setStatus("Import failed");
      }
    };
    reader.onerror = () => {
      if (version !== importVersion.current) return;
      setError("Could not read that file.");
      setStatus("Import failed");
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleMoviesOnly(checked: boolean) {
    setMoviesOnly(checked);
    persist(items, checked, fileName);
    const nextPool = checked ? items.filter((item) => isMovieType(item.type)) : items;
    if (!nextPool.length && items.length) {
      setPicked(null);
      setMode("ready");
      setStatus("Filter hides every title — uncheck to pick again");
      return;
    }
    if (items.length) setStatus(`${nextPool.length} titles in list`);
  }

  function handlePick() {
    const movie = pickRandom(pool);
    if (!movie) {
      setError(
        pool.length === 0 && items.length > 0
          ? "No movies match that filter. Uncheck Movies & TV movies only."
          : `Import a ${providerName} list CSV first.`
      );
      return;
    }
    setError("");
    setPicked(movie);
    setMode("result");
    setStatus(`${pool.length} titles in list`);
  }

  function handleClear() {
    importVersion.current += 1;
    clearWatchlist(provider);
    setItems([]);
    setPicked(null);
    setFileName("");
    setSourceName("");
    setMode("empty");
    setMoviesOnly(false);
    setStatus(`Upload your ${providerName} CSV to get started`);
    setError("");
  }

  const hasList = items.length > 0;

  return (
    <section className="picker" aria-label="Watchlist picker">
      <fieldset className="provider-switch">
        <legend>List provider</legend>
        {(["imdb", "letterboxd"] as const).map((value) => (
          <label className="provider-option" key={value}>
            <input type="radio" name="provider" value={value} checked={provider === value}
              onChange={() => handleProvider(value)} />
            {value === "imdb" ? "IMDb" : "Letterboxd"}
          </label>
        ))}
      </fieldset>
      <p className="status" role="status">{status}</p>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={moviesOnly}
          onChange={(event) => handleMoviesOnly(event.target.checked)}
        />
        Movies &amp; TV movies only
      </label>

      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {mode === "result" && picked ? (
        <div className="result">
          <div className="actions">
            <button type="button" className="btn primary large" onClick={handlePick}>
              Pick again
            </button>
            <a className="btn secondary" href={picked.url} target="_blank" rel="noopener noreferrer">
              Open on {picked.provider === "letterboxd" ? "Letterboxd" : "IMDb"}
            </a>
          </div>
          <MovieDetails movie={picked} />
          <button type="button" className="btn link" onClick={() => fileInputRef.current?.click()}>
            Replace list CSV
          </button>
        </div>
      ) : (
        <div className="idle">
          {hasList ? (
            <>
              <button type="button" className="btn primary large" onClick={handlePick}>
                Pick random
              </button>
              <button
                type="button"
                className="btn link"
                onClick={() => fileInputRef.current?.click()}
              >
                Replace list CSV
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primary large"
              onClick={() => fileInputRef.current?.click()}
            >
              Import {providerName} CSV
            </button>
          )}
        </div>
      )}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {hasList ? (
        <p className="hint">
          {providerName} list saved locally{sourceName || fileName ? ` from ${sourceName || fileName}` : ""}.{" "}
          <button type="button" className="text-button" onClick={handleClear}>
            Clear list
          </button>
        </p>
      ) : (
        <p className="hint">
          Follow the export steps below, then import the CSV.{" "}
          <a href="#how-to">How to export from {providerName}</a>
        </p>
      )}
    </section>
  );
}

function MovieDetails({ movie }: { movie: Title }) {
  const metaParts = [
    movie.year ? String(movie.year) : null,
    movie.runtime,
    movie.certificate,
    formatType(movie.type),
  ].filter(Boolean);

  return (
    <>
      <div className="result-top">
        {movie.poster ? (
          <img className="poster" src={movie.poster} alt="" loading="lazy" />
        ) : (
          <div className="poster placeholder" aria-hidden="true" />
        )}
        <div className="result-body">
          <h2>{movie.title}</h2>
          {metaParts.length ? <p className="meta">{metaParts.join(" · ")}</p> : null}
          {movie.rating != null || movie.metascore != null ? (
            <p className="rating-line">
              {movie.metascore != null ? (
                <>
                  <span className="metascore">{movie.metascore}</span> Metascore
                  {movie.rating != null ? " · " : null}
                </>
              ) : null}
              {movie.rating != null
                ? `★ ${movie.rating.toFixed(1)}${movie.voteCount != null ? ` (${formatVotes(movie.voteCount)})` : ""}`
                : null}
            </p>
          ) : null}
          {movie.director || movie.stars.length ? (
            <p className="credits">
              {movie.director ? (
                <span className="credit-line">
                  <strong>Director</strong> {truncateText(movie.director)}
                </span>
              ) : null}
              {movie.stars.length ? (
                <span className="credit-line">
                  <strong>Stars</strong> {truncateText(movie.stars.join(", "))}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      {movie.plot ? <p className="plot">{movie.plot}</p> : null}
    </>
  );
}
