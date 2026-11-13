import type { PickerOptions, Provider, StoredWatchlist } from "./types.ts";
import type { ParsedList } from "./types.ts";
import type { TitleEnrichment } from "./titles.ts";
import { eligibleTitles, mergeEnrichment } from "./titles.ts";
import { PROVIDER_NAMES } from "./provider.ts";

/** A result carries only identity; its details always come from the current source list. */
export type PickerState = {
  options: PickerOptions;
  selection: { kind: "idle" } | { kind: "result"; id: string };
  error: string | null;
  warning: { kind: "restore" | "unsaved"; message: string } | null;
  lastAction: "restored" | "imported" | "changed";
  revision: number;
};

export type PickerAction =
  | { type: "provider"; provider: Provider }
  | { type: "import"; parsed: ParsedList; fileName: string; now: number }
  | { type: "filter"; checked: boolean; now: number }
  | { type: "pick"; id: string }
  | { type: "clear" }
  | { type: "enrich"; id: string; details: TitleEnrichment; now: number }
  | { type: "error"; message: string };

export function createPickerState(options: PickerOptions, warning: string | null = null): PickerState {
  return { options, selection: { kind: "idle" }, error: null, warning: warning ? { kind: "restore", message: warning } : null, lastAction: "restored", revision: 0 };
}

/** Read the current source; an absent source still allows a provider-specific filter preference. */
export function currentList(state: PickerState): StoredWatchlist | null {
  return state.options.lists[state.options.selectedProvider];
}

function replaceList(state: PickerState, list: StoredWatchlist | null): PickerState {
  const provider = state.options.selectedProvider;
  return { ...state, options: { ...state.options, lists: { ...state.options.lists, [provider]: list } } };
}

function emptyList(provider: Provider, now: number): StoredWatchlist {
  return { provider, items: [], moviesOnly: false, fileName: "", importedAt: now };
}

/** Pure transitions keep related list, selection, and feedback changes together. */
export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  const provider = state.options.selectedProvider;
  const list = currentList(state);
  switch (action.type) {
    case "provider":
      return { ...state, options: { ...state.options, selectedProvider: action.provider }, selection: { kind: "idle" }, error: null, lastAction: "restored" };
    case "import": {
      if (action.parsed.provider !== provider) return { ...state, error: `This is a ${PROVIDER_NAMES[action.parsed.provider]} CSV. Select ${PROVIDER_NAMES[action.parsed.provider]} before importing it.` };
      const next = replaceList(state, { ...action.parsed, moviesOnly: list?.moviesOnly ?? false, fileName: action.fileName, importedAt: action.now });
      return { ...next, selection: { kind: "idle" }, error: null, lastAction: "imported", revision: state.revision + 1 };
    }
    case "filter": {
      const source = list ?? emptyList(provider, action.now);
      const next = replaceList(state, { ...source, moviesOnly: action.checked, updatedAt: action.now });
      const visible = eligibleTitles(source.items, action.checked);
      const selectedId = state.selection.kind === "result" ? state.selection.id : null;
      const selectedVisible = visible.some(item => item.id === selectedId);
      return { ...next, selection: selectedVisible ? state.selection : { kind: "idle" }, error: null, lastAction: "changed" };
    }
    case "pick":
      return list && eligibleTitles(list.items, list.moviesOnly).some(item => item.id === action.id)
        ? { ...state, selection: { kind: "result", id: action.id }, error: null, lastAction: "changed" } : state;
    case "clear":
      return { ...replaceList(state, null), selection: { kind: "idle" }, error: null, lastAction: "restored", revision: state.revision + 1 };
    case "enrich":
      return list && list.items.some(item => item.id === action.id)
        ? replaceList(state, { ...list, items: list.items.map(item => item.id === action.id ? mergeEnrichment(item, action.details) : item), updatedAt: action.now }) : state;
    case "error":
      return { ...state, error: action.message };
  }
}

/** Derive status from the actual source/filter instead of maintaining a second title count. */
export function pickerStatus(state: PickerState): string {
  const list = currentList(state);
  if (!list?.items.length) return `Upload your ${PROVIDER_NAMES[state.options.selectedProvider]} CSV to get started`;
  const count = eligibleTitles(list.items, list.moviesOnly).length;
  if (!count) return "Filter hides every title — uncheck to pick again";
  if (state.lastAction === "imported") return `Imported ${count} titles`;
  return state.lastAction === "restored" ? `${count} titles saved` : `${count} titles in list`;
}
