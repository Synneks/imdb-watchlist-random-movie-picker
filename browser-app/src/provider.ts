import type { Provider } from "./types.ts";

export const PROVIDER_NAMES: Record<Provider, string> = { imdb: "IMDb", letterboxd: "Letterboxd" };

/** Update both React's theme and the separately authored export instructions. */
export function applyProviderTheme(provider: Provider): void {
  document.documentElement.dataset.provider = provider;
}
