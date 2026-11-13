import type { Provider } from "./types";

const PROVIDER_KEY = "watchlist-picker-provider-v1";

export function loadSelectedProvider(): Provider {
  try {
    return localStorage.getItem(PROVIDER_KEY) === "letterboxd" ? "letterboxd" : "imdb";
  } catch {
    return "imdb";
  }
}

export function selectProvider(provider: Provider): void {
  document.documentElement.dataset.provider = provider;
  try {
    localStorage.setItem(PROVIDER_KEY, provider);
  } catch {
    // Switching still works for this session when browser storage is unavailable.
  }
}
