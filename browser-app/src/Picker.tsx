import { useRef } from "react";
import MovieDetails from "./MovieDetails.tsx";
import { PROVIDER_NAMES } from "./provider.ts";
import { usePicker } from "./usePicker.ts";
import type { LoadedOptions, OptionsStorage } from "./storage.ts";

type PickerProps = { initial: LoadedOptions; storage: OptionsStorage };

/** Render the picker; state transitions and browser operations live in usePicker. */
export default function Picker({ initial, storage }: PickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const picker = usePicker(initial, storage);
  const { provider, picked, status, error } = picker;
  const providerName = PROVIDER_NAMES[provider];
  const moviesOnly = picker.list?.moviesOnly ?? false;
  const sourceName = picker.list?.sourceName;
  const fileName = picker.list?.fileName;
  const hasList = Boolean(picker.list?.items.length);

  return (
    <section className="picker" aria-label="Watchlist picker">
      {/* One radio group changes both the provider-specific list and the page-wide theme. */}
      <fieldset className="provider-switch">
        <legend>List provider</legend>
        {(["imdb", "letterboxd"] as const).map((value) => (
          <label className="provider-option" key={value}>
            <input type="radio" name="provider" value={value} checked={provider === value}
              onChange={() => picker.switchProvider(value)} />
            {PROVIDER_NAMES[value]}
          </label>
        ))}
      </fieldset>
      <p className="status" role="status">{status}</p>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={moviesOnly}
          onChange={(event) => picker.setMoviesOnly(event.target.checked)}
        />
        Movies &amp; TV movies only
      </label>

      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          void picker.importFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {/* The result state keeps pick-again and replace actions alongside the chosen film. */}
      {picked ? (
        <div className="result">
          <div className="actions">
            <button type="button" className="btn primary large" onClick={picker.pick}>
              Pick again
            </button>
            <a className="btn secondary" href={picked.url} target="_blank" rel="noopener noreferrer">
              Open on {PROVIDER_NAMES[picked.provider]}
            </a>
          </div>
          <MovieDetails movie={picked} />
          <button type="button" className="btn link" onClick={() => fileInputRef.current?.click()}>
            Replace list CSV
          </button>
        </div>
      ) : (
        <div className="idle">
          {/* Empty and ready states share this area; ready also offers pick and replace actions. */}
          {hasList ? (
            <>
              <button type="button" className="btn primary large" onClick={picker.pick}>
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

      {/* Errors are separate from the live status message so assistive tech can announce them. */}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {picker.warning ? <p className="error" role="alert">{picker.warning.message}</p> : null}

      {/* Show the saved source/clear action, or export instructions when this provider is empty. */}
      {hasList ? (
        <p className="hint">
          {providerName} list {picker.warning?.kind === "unsaved" ? "available this session" : "saved locally"}{sourceName || fileName ? ` from ${sourceName || fileName}` : ""}.{" "}
          <button type="button" className="text-button" onClick={picker.clearList}>
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
