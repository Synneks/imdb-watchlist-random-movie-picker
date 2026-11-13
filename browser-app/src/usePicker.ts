import { useCallback, useEffect, useRef, useState } from "react";
import { parseWatchlistCsv } from "./csv.ts";
import { enrichTitle } from "./enrich.ts";
import { applyProviderTheme, PROVIDER_NAMES } from "./provider.ts";
import { createPickerState, currentList, pickerReducer, pickerStatus } from "./pickerState.ts";
import type { PickerAction } from "./pickerState.ts";
import type { LoadedOptions, OptionsStorage } from "./storage.ts";
import type { Provider } from "./types.ts";
import { eligibleTitles, pickRandom } from "./titles.ts";

/** Coordinate browser I/O around pure transitions; the view only sends user intentions. */
export function usePicker(initial: LoadedOptions, storage: OptionsStorage) {
  const [state, setState] = useState(() => createPickerState(initial.options, initial.warning));
  const latest = useRef(state);
  const importVersion = useRef(0);

  // Ref access lets async callbacks apply actions to the latest source/filter, without
  // performing persistence inside React's replayable state updater functions.
  const dispatch = useCallback((action: PickerAction) => {
    const previous = latest.current;
    let next = pickerReducer(previous, action);
    if (next.options !== previous.options) {
      const result = storage.save(next.options);
      next = { ...next, warning: result.ok ? null : { kind: "unsaved", message: `${result.error} Changes are available for this session only.` } };
    }
    latest.current = next;
    setState(next);
  }, [storage]);

  const provider = state.options.selectedProvider;
  const list = currentList(state);
  const items = list?.items ?? [];
  const pool = eligibleTitles(items, list?.moviesOnly ?? false);
  const pickedId = state.selection.kind === "result" ? state.selection.id : null;
  const picked = items.find(item => item.id === pickedId) ?? null;

  const lookupId = picked?.provider === "imdb" && !(picked.poster && picked.stars.length)
    ? picked.imdbId ?? picked.id : null;

  useEffect(() => { applyProviderTheme(provider); }, [provider]);
  useEffect(() => () => { importVersion.current += 1; }, []);

  useEffect(() => {
    if (!lookupId || !pickedId) return;
    let active = true;
    const selection = state.selection;
    const revision = state.revision;
    enrichTitle(lookupId).then(details => {
      const current = latest.current;
      if (active && current.selection === selection && current.revision === revision
        && current.options.selectedProvider === provider && (details.poster || details.stars.length)) {
        dispatch({ type: "enrich", id: pickedId, details, now: Date.now() });
      }
    });
    return () => { active = false; };
    // Source revision cancels a lookup even when a replacement has the same film ID.
  }, [pickedId, lookupId, provider, state.selection, state.revision, dispatch]);

  /** Every new read, provider switch, clear, and unmount invalidates older file callbacks. */
  async function importFile(file: File | undefined) {
    if (!file) return;
    const version = ++importVersion.current;
    try {
      const text = await file.text();
      if (version !== importVersion.current) return;
      dispatch({ type: "import", parsed: parseWatchlistCsv(text), fileName: file.name, now: Date.now() });
    } catch (error) {
      if (version === importVersion.current) dispatch({ type: "error", message: error instanceof Error ? error.message : "Could not read that CSV." });
    }
  }

  function switchProvider(nextProvider: Provider) {
    importVersion.current += 1;
    dispatch({ type: "provider", provider: nextProvider });
  }

  function clearList() {
    importVersion.current += 1;
    dispatch({ type: "clear" });
  }

  function pick() {
    const title = pickRandom(pool);
    dispatch(title ? { type: "pick", id: title.id } : {
      type: "error", message: items.length ? "No movies match that filter. Uncheck Movies & TV movies only." : `Import a ${PROVIDER_NAMES[provider]} list CSV first.`,
    });
  }

  return {
    provider, list, picked, error: state.error, warning: state.warning, status: pickerStatus(state),
    importFile, switchProvider, clearList, pick,
    setMoviesOnly: (checked: boolean) => dispatch({ type: "filter", checked, now: Date.now() }),
  };
}
