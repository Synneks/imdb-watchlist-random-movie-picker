export type Provider = "imdb" | "letterboxd";

export type Title = {
  provider: Provider;
  imdbId?: string;
  id: string;
  title: string;
  year: number | null;
  rating: number | null;
  voteCount: number | null;
  type: string | null;
  runtime: string | null;
  director: string | null;
  stars: string[];
  plot: string | null;
  poster: string | null;
  metascore: number | null;
  certificate: string | null;
  url: string;
};

export type StoredWatchlist = {
  provider: Provider;
  importWarnings?: string[];
  sourceName?: string;
  items: Title[];
  moviesOnly: boolean;
  importedAt: number;
  fileName: string;
};
