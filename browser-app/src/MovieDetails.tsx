import type { Title } from "./types.ts";
import { formatRuntime, formatType, formatVotes, truncateText } from "./formatters.ts";

/** Render whichever title details are available, omitting fields with no data. */
export default function MovieDetails({ movie }: { movie: Title }) {
  // Build the metadata line once so missing values do not leave empty separators.
  const metaParts = [
    movie.year ? String(movie.year) : null,
    formatRuntime(movie.runtimeMinutes),
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
