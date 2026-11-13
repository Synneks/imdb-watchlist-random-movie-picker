/** Load IMDb's JSONP response with one cleanup path for callbacks, timeouts, and failures. */
export function requestImdbSuggestions(id: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const callbackName = `imdb$${id}`;
    // JSONP requires a dynamically named global; all payload validation happens in enrich.ts.
    const callbacks = window as unknown as Record<string, unknown>;
    const previous = callbacks[callbackName];
    const script = document.createElement("script");
    let settled = false;

    function cleanup() {
      window.clearTimeout(timer);
      if (previous === undefined) delete callbacks[callbackName];
      else callbacks[callbackName] = previous;
      script.remove();
    }

    function finish(error: Error | null, payload?: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(payload);
    }

    callbacks[callbackName] = (payload: unknown) => finish(null, payload);
    script.src = `https://sg.media-imdb.com/suggests/t/${encodeURIComponent(id)}.json`;
    script.async = true;
    script.onerror = () => finish(new Error("IMDb metadata request failed."));
    const timer = window.setTimeout(() => finish(new Error("IMDb metadata request timed out.")), 7000);
    try { document.head.appendChild(script); }
    catch { finish(new Error("IMDb metadata script could not be loaded.")); }
  });
}
