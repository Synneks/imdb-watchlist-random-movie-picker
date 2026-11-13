function parseListPage(doc) {
  const items = [...doc.querySelectorAll('li.posteritem [data-item-slug][data-item-link]')].map((node) => {
    const slug = node.getAttribute('data-item-slug');
    const link = node.getAttribute('data-item-link');
    if (!slug || !/^\/film\/[a-z0-9-]+\/$/i.test(link ?? '')) return null;
    const displayName = node.getAttribute('data-item-name') || node.getAttribute('data-item-full-display-name') || slug;
    const match = displayName.match(/^(.*?)(?:\s+\((\d{4})\))?$/);
    return {
      id: `letterboxd:${slug.toLowerCase()}`, provider: 'letterboxd', title: match?.[1] || slug,
      year: match?.[2] ? Number(match[2]) : null, rating: null, voteCount: null, type: 'movie',
      runtime: null, director: null, stars: [], plot: null, poster: null, metascore: null,
      certificate: null, url: `https://letterboxd.com${link}`, displayTitle: displayName,
    };
  }).filter(Boolean);
  const next = doc.querySelector('.pagination a.next')?.getAttribute('href') || null;
  const pageLinks = [...doc.querySelectorAll('.pagination a[href]')].map((a) => a.getAttribute('href')).filter((href) => /\/page\/\d+\//.test(href));
  const pages = pageLinks.map((href) => Number(href.match(/\/page\/(\d+)\//)?.[1])).filter(Number.isInteger);
  const maxPage = Math.max(1, ...pages);
  return { items, next, maxPage };
}

(async () => {
  try {
    const first = parseListPage(document);
    if (!first.items.length) return { error: 'No films found. The list may be private, unavailable, or the page format may have changed.' };
    const items = [...first.items];
    const seen = new Set(items.map((item) => item.id));
    let next = first.next;
    let page = 1;
    while (next && page < first.maxPage && page < 100) {
      const url = new URL(next, location.origin);
      if (url.origin !== location.origin || !url.pathname.startsWith(location.pathname.replace(/\/$/, '') + '/page/')) return { error: 'Letterboxd returned an unexpected pagination link. No partial list was saved.' };
      const response = await fetch(url.href, { credentials: 'include' });
      if (!response.ok) return { error: `Letterboxd page ${page + 1} returned HTTP ${response.status}. No partial list was saved.` };
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const batch = parseListPage(doc);
      if (!batch.items.length) return { error: `Could not read Letterboxd page ${page + 1}. No partial list was saved.` };
      let added = 0;
      for (const item of batch.items) if (!seen.has(item.id)) { seen.add(item.id); items.push(item); added++; }
      if (!added) return { error: 'Letterboxd repeated a page during import. No partial list was saved.' };
      next = batch.next;
      page++;
    }
    if (next || page < first.maxPage) return { error: 'Letterboxd list exceeds the 100-page import limit. No partial list was saved.' };
    return { items, sourceCount: items.length, complete: true, fetchedAt: Date.now() };
  } catch (error) { return { error: error.message || String(error) }; }
})();
