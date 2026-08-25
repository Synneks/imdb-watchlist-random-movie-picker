export type TitleEnrichment = {
  poster: string | null;
  stars: string[];
};

const cache = new Map<string, TitleEnrichment>();

function shrinkPoster(url: string): string {
  return url.replace(/\._V1_\.jpg$/i, "._V1_UX148_CR0,0,148,219_AL_.jpg");
}

function parsePayload(id: string, payload: unknown): TitleEnrichment {
  const data = payload as { d?: Array<Record<string, unknown>> };
  const entry =
    data.d?.find((item) => item.id === id) ??
    data.d?.find((item) => String(item.id ?? "").startsWith("tt")) ??
    data.d?.[0];

  if (!entry) return { poster: null, stars: [] };

  let poster: string | null = null;
  const image = entry.i;
  if (Array.isArray(image) && typeof image[0] === "string") {
    poster = shrinkPoster(image[0]);
  } else if (image && typeof image === "object" && "imageUrl" in image) {
    const imageUrl = (image as { imageUrl?: string }).imageUrl;
    if (imageUrl) poster = shrinkPoster(imageUrl);
  }

  const stars =
    typeof entry.s === "string"
      ? entry.s
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

  return { poster, stars };
}

/** Load poster + stars via IMDb's JSONP suggestion endpoint (no backend/CORS). */
export function enrichTitle(id: string): Promise<TitleEnrichment> {
  if (!/^tt\d+$/i.test(id)) {
    return Promise.resolve({ poster: null, stars: [] });
  }

  const cached = cache.get(id);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const callbackName = `imdb$${id}`;
    const previous = (window as unknown as Record<string, unknown>)[callbackName];
    let settled = false;

    const finish = (result: TitleEnrichment) => {
      if (settled) return;
      settled = true;
      cache.set(id, result);
      cleanup();
      resolve(result);
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      const globalWindow = window as unknown as Record<string, unknown>;
      if (previous !== undefined) globalWindow[callbackName] = previous;
      else delete globalWindow[callbackName];
      script.remove();
    };

    (window as unknown as Record<string, unknown>)[callbackName] = (payload: unknown) => {
      finish(parsePayload(id, payload));
    };

    const script = document.createElement("script");
    script.src = `https://sg.media-imdb.com/suggests/t/${encodeURIComponent(id)}.json`;
    script.async = true;
    script.onerror = () => finish({ poster: null, stars: [] });

    const timer = window.setTimeout(() => finish({ poster: null, stars: [] }), 7000);
    document.head.appendChild(script);
  });
}
