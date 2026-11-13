import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isMovieType, parseWatchlistCsv } from '../src/csv.ts';
import { clearWatchlist, loadWatchlist, saveWatchlist } from './storageFixture.ts';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('v7 custom list separates metadata, preserves names and unique film order', () => {
  const parsed = parseWatchlistCsv(fixture('letterboxd-custom-v7.csv'));
  assert.equal(parsed.provider, 'letterboxd');
  assert.equal(parsed.sourceName, 'Weekend, cinéma');
  assert.deepEqual(parsed.items.map(item => item.title), ['Amélie', 'The Good, the Bad and the Ugly', 'Unknown year']);
  assert.deepEqual(parsed.items.map(item => item.url), [
    'https://boxd.it/2aUc',
    'https://letterboxd.com/film/the-good-the-bad-and-the-ugly/',
    'https://letterboxd.com/film/unknown-year/',
  ]);
  assert.equal(parsed.items[2].year, null);
  assert.ok(parsed.items.every(item => item.provider === 'letterboxd' && item.imdbId == null));
  assert.ok(parsed.items.every(item => isMovieType(item.type)));
});

test('single-cell marker and blank separators match the second observed v7 shape', () => {
  const csv = fixture('letterboxd-custom-v7.csv').replace('v7,,,,', 'v7').replace('\n,,,,\n', '\n\n');
  assert.equal(parseWatchlistCsv(csv).items.length, 3);
  assert.equal(parseWatchlistCsv(csv).sourceName, 'Weekend, cinéma');
});

test('table-only custom lists retain row order and skip unsafe and non-film links', () => {
  const parsed = parseWatchlistCsv(fixture('letterboxd-custom-table.csv'));
  assert.equal(parsed.sourceName, undefined);
  assert.deepEqual(parsed.items.map(item => item.title), ['The Kid', 'The Scarecrow']);
  assert.equal(parsed.items.length, 2);
});

test('metadata never becomes a film, even when its URL is a film URL', () => {
  const csv = fixture('letterboxd-custom-v7.csv').replace(
    'https://letterboxd.com/example/list/weekend/', 'https://letterboxd.com/film/metadata-is-not-a-film/');
  assert.equal(parseWatchlistCsv(csv).items.length, 3);
});

test('empty, malformed, unsupported and metadata-only inputs throw', () => {
  for (const csv of [
    '',
    'Letterboxd list export v8\nPosition,Name,Year,URL\n1,Unsupported version,2000,https://boxd.it/abc',
    'Letterboxd list export v7\nDate,Name,Tags,URL,Description\n2026-01-01,Only metadata,,https://boxd.it/abc,',
    'Position,Name,Year,URL,Description\n1,Broken,2000,javascript:alert(1),',
    'Position,Name,Year,URL,Description\n1,"Unclosed,2000,https://boxd.it/abc,',
    'Name,Year\nUnsupported,2020',
  ]) assert.throws(() => parseWatchlistCsv(csv));
});

test('IMDb and Letterboxd watchlist dispatch still work', () => {
  assert.equal(parseWatchlistCsv('Const,Title,Year,URL\ntt1234567,IMDb title,2000,https://www.imdb.com/title/tt1234567/').provider, 'imdb');
  const parsed = parseWatchlistCsv('Date,Name,Year,Letterboxd URI\n2026-01-01,Amélie,2001,https://boxd.it/2aUc');
  assert.equal(parsed.provider, 'letterboxd');
  assert.equal(parsed.items.length, 1);
});

test('custom-list label and films survive save, replacement, failed parsing and clear', () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  const parsed = parseWatchlistCsv(fixture('letterboxd-custom-v7.csv'));
  saveWatchlist({ ...parsed, fileName: 'weekend.csv', importedAt: 100, moviesOnly: true });
  assert.equal(loadWatchlist()?.sourceName, 'Weekend, cinéma');
  assert.deepEqual(loadWatchlist()?.items, parsed.items);
  assert.throws(() => parseWatchlistCsv('invalid'));
  assert.equal(loadWatchlist()?.items.length, 3);
  const replacement = parseWatchlistCsv(fixture('letterboxd-custom-table.csv'));
  saveWatchlist({ ...replacement, fileName: 'replacement.csv', importedAt: 200, moviesOnly: false });
  assert.equal(loadWatchlist()?.sourceName, undefined);
  assert.equal(loadWatchlist()?.fileName, 'replacement.csv');
  assert.equal(loadWatchlist()?.items.length, 2);
  clearWatchlist();
  assert.equal(loadWatchlist(), null);
});
