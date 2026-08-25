export type Title = {
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
  items: Title[];
  moviesOnly: boolean;
  importedAt: number;
  fileName: string;
};
