/** Sources supported by the picker and its provider-specific saved lists. */
export type Provider = "imdb" | "letterboxd";

/** Normalized source data. Display formatting belongs to the view. */
export type Title = {
  provider: Provider;
  id: string;
  imdbId?: string;
  title: string;
  year: number | null;
  rating: number | null;
  voteCount: number | null;
  type: string | null;
  runtimeMinutes: number | null;
  director: string | null;
  stars: string[];
  plot: string | null;
  poster: string | null;
  metascore: number | null;
  certificate: string | null;
  url: string;
};

/** Full imported source and its preferences; picking never removes source rows. */
export type StoredWatchlist = {
  provider: Provider;
  items: Title[];
  moviesOnly: boolean;
  importedAt: number;
  updatedAt?: number;
  fileName: string;
  sourceName?: string;
  importWarnings?: string[];
};

/** One selected provider in memory; the disk serializer owns the historical flag layout. */
export type PickerOptions = {
  selectedProvider: Provider;
  lists: Record<Provider, StoredWatchlist | null>;
};

/** Recognized source format plus optional custom-list metadata. */
export type ParsedList = { provider: Provider; items: Title[]; sourceName?: string };
