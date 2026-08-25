import { useEffect, useMemo, useRef, useState } from "react";
import { isMovieType, parseImdbWatchlistCsv } from "./csv";
import { clearWatchlist, loadWatchlist, saveWatchlist } from "./storage";
import type { Title } from "./types";

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
  const [moviesOnly, setMoviesOnly] = useState(false);
  const [items, setItems] = useState<Title[]>([]);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<Mode>("empty");
  const [picked, setPicked] = useState<Title | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Paste is not needed — upload your CSV");

  useEffect(() => {
    const stored = loadWatchlist();
    if (!stored?.items.length) return;
    setItems(stored.items);
    setMoviesOnly(stored.moviesOnly);
    setFileName(stored.fileName);
    setMode("ready");
    setStatus(`${stored.items.length} titles saved`);
  }, []);

  const pool = useMemo(() => {
    if (!moviesOnly) return items;
    return items.filter((item) => isMovieType(item.type));
  }, [items, moviesOnly]);

  function persist(nextItems: Title[], nextMoviesOnly: boolean, nextFileName: string) {
    saveWatchlist({
      items: nextItems,
      moviesOnly: nextMoviesOnly,
      importedAt: Date.now(),
      fileName: nextFileName,
    });
  }

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError("");

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseImdbWatchlistCsv(text);
        setItems(parsed);
        setFileName(file.name);
        setPicked(null);
        setMode("ready");
        persist(parsed, moviesOnly, file.name);
        const filtered = moviesOnly ? parsed.filter((item) => isMovieType(item.type)) : parsed;
        setStatus(`Imported ${filtered.length} titles`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that CSV.");
        setStatus("Import failed");
      }
    };
    reader.onerror = () => {
      setError("Could not read that file.");
      setStatus("Import failed");
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleMoviesOnly(checked: boolean) {
    setMoviesOnly(checked);
    if (items.length) persist(items, checked, fileName);
    const nextPool = checked ? items.filter((item) => isMovieType(item.type)) : items;
    if (!nextPool.length && items.length) {
      setPicked(null);
      setMode("ready");
      setStatus("Filter hides every title — uncheck to pick again");
      return;
    }
    if (items.length) setStatus(`${nextPool.length} titles in watchlist`);
  }

  function handlePick() {
    const movie = pickRandom(pool);
    if (!movie) {
      setError(
        pool.length === 0 && items.length > 0
          ? "No movies match that filter. Uncheck Movies & TV movies only."
          : "Import a watchlist CSV first."
      );
      return;
    }
    setError("");
    setPicked(movie);
    setMode("result");
    setStatus(`${pool.length} titles in watchlist`);
  }

  function handleClear() {
    clearWatchlist();
    setItems([]);
    setPicked(null);
    setFileName("");
    setMode("empty");
    setStatus("Upload your IMDb CSV to get started");
    setError("");
  }

  const hasList = items.length > 0;

  return (
    <section className="picker" aria-label="Watchlist picker">
      <p className="status">{status}</p>

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
              Open on IMDb
            </a>
          </div>
          <MovieDetails movie={picked} />
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
                Replace watchlist CSV
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn primary large"
              onClick={() => fileInputRef.current?.click()}
            >
              Import watchlist
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
          Saved locally{fileName ? ` from ${fileName}` : ""}.{" "}
          <button type="button" className="text-button" onClick={handleClear}>
            Clear list
          </button>
        </p>
      ) : (
        <p className="hint">
          Follow the export steps below, then import the CSV.{" "}
          <a href="#how-to">How to export from IMDb</a>
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
        <div className="poster placeholder" aria-hidden="true" />
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
