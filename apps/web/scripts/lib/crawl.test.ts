// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  bagDifference,
  bagOfWords,
  buildProbes,
  buildRecord,
  compareCrawls,
  comparePages,
  decodeEntities,
  extractPage,
  fetchPage,
  normalizeJsonLd,
  originPattern,
  type PageRecord,
  parseSitemap,
  pool,
  snapshotFileName,
  stripStega,
  toPath,
} from './crawl';

const pattern = originPattern(['http://localhost:3107']);
const STEGA = '\u200B\u200C\u200D\uFEFF\u2060';

const html = `<!DOCTYPE html><html lang="pl"><head>
<meta charset="utf-8"/>
<title>Wzmacniacz &amp; DAC | Audiofast</title>
<meta name="description" content="Opis &quot;produktu&quot;${STEGA}"/>
<meta name="robots" content="index, follow"/>
<link rel="canonical" href="https://audiofast.pl/produkty/x/"/>
<link rel="stylesheet" href="/a.css"/>
<script type="application/ld+json">{"name":"X${STEGA}","@type":"Product","url":"https://audiofast.pl/produkty/x/"}</script>
<script>self.__next_f.push([1,"Ukryty tekst $RX(\\"B:9\\")"])</script>
<script>$RX=function(a){};$RX("B:0","")</script>
<script>$RX("B:1","abc123","msg")</script>
<style>.a{color:red}</style>
</head><body>
<!-- komentarz z tekstem -->
<header><nav><a href="/">Start</a> <a href="/produkty/">Produkty</a></nav></header>
<main><h1>Hel<strong>lo</strong> świat</h1>
<p>Cena:&nbsp;12&#160;000 zł</p>
<svg viewBox="0 0 1 1"><title>Ikona</title><path d="M0"/></svg>
<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING" data-msg="ignored"></template>
<template data-dgst="123" data-msg="Switched to client rendering because the server rendering errored"></template>
<noscript><iframe src="https://gtm"></iframe></noscript>
<div hidden id="S:0"><p>Strumieniowana treść</p></div>
<p data-sanity="abc">a &lt; b</p>
</main></body></html>`;

describe('stripStega / decodeEntities', () => {
  it('strips runs of four or more marker characters only', () => {
    expect(stripStega(`Tytuł${STEGA}`)).toBe('Tytuł');
    // A ZWJ emoji keeps its single joiner.
    expect(stripStega('👩\u200D💻')).toBe('👩\u200D💻');
  });

  it('decodes named and numeric entities', () => {
    expect(decodeEntities('a &amp; b &#x41;&#66; &nbsp;&unknown;')).toBe(
      'a & b AB \u00A0&unknown;',
    );
  });
});

describe('extractPage', () => {
  const page = extractPage(html);

  it('reads head metadata', () => {
    expect(page.titles).toEqual(['Wzmacniacz & DAC | Audiofast']);
    expect(page.descriptions).toEqual([`Opis "produktu"${STEGA}`]);
    expect(page.robots).toEqual(['index, follow']);
    expect(page.canonicals).toEqual(['https://audiofast.pl/produkty/x/']);
    expect(page.jsonLd).toHaveLength(1);
  });

  it('collects visible text, joining inline tags and skipping raw/hidden content', () => {
    // `<a>` breaks segments, so glued nav links stay separate words.
    expect(page.text).toEqual([
      'Start',
      'Produkty',
      'Hello świat',
      'Cena:\u00A012\u00A0000 zł',
      'Strumieniowana treść',
      'a < b',
    ]);
    const joined = page.text.join(' ');
    expect(joined).not.toContain('Ukryty');
    expect(joined).not.toContain('Ikona');
    expect(joined).not.toContain('komentarz');
    expect(joined).not.toContain('color');
  });

  it('reports real SSR errors and data-sanity attributes', () => {
    expect(page.ssrErrors).toEqual([
      'client-render digest=""',
      'client-render digest="abc123"',
      'Switched to client rendering because the server rendering errored',
    ]);
    expect(page.dataSanity).toBe(1);
  });

  it('keeps adjacent links apart', () => {
    expect(extractPage('<nav><a>Blog</a><a>Kontakt</a></nav>').text).toEqual([
      'Blog',
      'Kontakt',
    ]);
  });

  it('treats a stray "<" as text and survives unclosed svg children', () => {
    const result = extractPage('<p>1 < 2</p><svg><g></svg><p>po</p>');
    expect(result.text).toEqual(['1 < 2', 'po']);
  });
});

describe('buildRecord', () => {
  it('normalises origins, stega and JSON-LD key order', () => {
    const record = buildRecord(
      {
        path: '/produkty/x/',
        status: 200,
        location: null,
        html,
      },
      pattern,
    );
    expect(record.canonical).toBe('{origin}/produkty/x/');
    expect(record.description).toBe('Opis "produktu"');
    expect(record.jsonLd).toEqual([
      { '@type': 'Product', name: 'X', url: '{origin}/produkty/x/' },
    ]);
    expect(Object.keys(record.jsonLd[0] as object)).toEqual([
      '@type',
      'name',
      'url',
    ]);
    expect(record.words).toMatchObject({ Hello: 1, świat: 1, zł: 1 });
    expect(record.words['12']).toBe(1);
    expect(record.wordCount).toBe(
      Object.values(record.words).reduce((a, b) => a + b, 0),
    );
  });

  it('records redirects with a normalised location', () => {
    const record = buildRecord(
      {
        path: '/a',
        status: 308,
        location: 'http://localhost:3107/a/',
        html: '',
      },
      pattern,
    );
    expect(record.location).toBe('{origin}/a/');
    expect(record.title).toBeNull();
    expect(record.wordCount).toBe(0);
  });

  it('folds repeated metadata order-independently', () => {
    const a = buildRecord(
      {
        path: '/404/',
        status: 200,
        location: null,
        html: '<meta name="robots" content="noindex"/><meta name="robots" content="index, follow"/>',
      },
      pattern,
    );
    const b = buildRecord(
      {
        path: '/404/',
        status: 200,
        location: null,
        html: '<meta name="robots" content="index, follow"/><meta name="robots" content="noindex"/><meta name="robots" content="noindex"/>',
      },
      pattern,
    );
    expect(a.robots).toBe('index, follow || noindex');
    expect(b.robots).toBe(a.robots);
    expect(a.description).toBeNull();
  });

  it('keeps a JSON-LD parse error as data instead of throwing', () => {
    expect(normalizeJsonLd('{broken', pattern)).toMatchObject({
      raw: '{broken',
    });
  });
});

describe('bag of words + comparison', () => {
  it('counts words across segments, ignoring stega', () => {
    expect(bagOfWords([`a b${STEGA}`, 'b  c'], pattern)).toEqual({
      a: 1,
      b: 2,
      c: 1,
    });
  });

  it('diffs bags by count', () => {
    expect(bagDifference({ a: 2, b: 1 }, { a: 1, c: 3 })).toEqual({
      added: { c: 3 },
      removed: { a: 1, b: 1 },
    });
  });

  const record = (overrides: Partial<PageRecord> = {}): PageRecord => ({
    path: '/x/',
    status: 200,
    location: null,
    title: 'T',
    description: 'D',
    canonical: '{origin}/x/',
    robots: null,
    jsonLd: [{ a: 1 }],
    words: { a: 1 },
    wordCount: 1,
    ssrErrors: [],
    dataSanity: 0,
    ...overrides,
  });

  it('reports no diff for identical records', () => {
    expect(comparePages(record(), record())).toEqual([]);
  });

  it('reports each differing field', () => {
    const diffs = comparePages(
      record(),
      record({ status: 404, jsonLd: [{ a: 2 }], words: { b: 1 } }),
    );
    expect(diffs.map((diff) => diff.field)).toEqual([
      'status',
      'jsonLd',
      'words',
    ]);
  });

  it('ignores dataSanity (stega crawler territory) but not ssrErrors', () => {
    expect(comparePages(record(), record({ dataSanity: 3 }))).toEqual([]);
    expect(
      comparePages(record(), record({ ssrErrors: ['boom'] })).map(
        (diff) => diff.field,
      ),
    ).toEqual(['ssrErrors']);
  });

  it('compares crawls by path, including missing and new paths', () => {
    const baseline = new Map([
      ['/a/', record({ path: '/a/' })],
      ['/b/', record({ path: '/b/' })],
    ]);
    const current = new Map([
      ['/a/', record({ path: '/a/', title: 'Inny' })],
      ['/c/', record({ path: '/c/' })],
    ]);
    expect(
      compareCrawls(baseline, current).map((diff) => [diff.path, diff.kind]),
    ).toEqual([
      ['/a/', 'changed'],
      ['/b/', 'missing'],
      ['/c/', 'added'],
    ]);
    expect(compareCrawls(baseline, baseline)).toEqual([]);
  });
});

describe('sitemap + probes', () => {
  it('parses url sets and sitemap indexes', () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://audiofast.pl/</loc><lastmod>2026</lastmod></url>
      <url><loc><![CDATA[https://audiofast.pl/blog/?a=1&amp;b=2]]></loc></url>
    </urlset>`;
    expect(parseSitemap(xml)).toEqual({
      urls: ['https://audiofast.pl/', 'https://audiofast.pl/blog/?a=1&b=2'],
      sitemaps: [],
    });
    expect(
      parseSitemap(
        '<sitemapindex><sitemap><loc>https://x/s-1.xml</loc></sitemap></sitemapindex>',
      ),
    ).toEqual({ urls: [], sitemaps: ['https://x/s-1.xml'] });
  });

  it('drops the origin from a URL', () => {
    expect(toPath('http://localhost:3107/produkty/?page=2')).toBe(
      '/produkty/?page=2',
    );
    expect(toPath('/a/')).toBe('/a/');
  });

  it('builds probes from sitemap slugs', () => {
    const probes = buildProbes([
      '/marki/zeta/',
      '/marki/alfa/',
      '/produkty/kategoria/kable/',
      '/blog/kategoria/testy/',
    ]);
    expect(probes).toContain('/produkty/?brands=alfa');
    expect(probes).toContain('/produkty/?brands=alfa,zeta&sortBy=priceDesc');
    expect(probes).toContain('/produkty/kategoria/kable/?page=2');
    expect(probes).toContain('/blog/kategoria/testy/?page=2');
    expect(probes).toContain('/porownaj/');
    expect(probes).toContain('/produkty/archiwalne/');
    expect(probes).toContain('/this-page-does-not-exist/');
    expect(probes).toEqual([...probes].sort());
    expect(new Set(probes).size).toBe(probes.length);
  });

  it('skips slug-derived probes when the sitemap lacks them', () => {
    const probes = buildProbes(['/']);
    expect(probes.some((probe) => probe.includes('brands='))).toBe(false);
    expect(probes.some((probe) => probe.includes('/kategoria/'))).toBe(false);
  });
});

describe('snapshotFileName', () => {
  it('is stable, safe and collision-free for query variants', () => {
    const a = snapshotFileName('/produkty/?page=2');
    expect(a).toMatch(/^produkty_page_2-[0-9a-f]{8}\.json$/);
    expect(snapshotFileName('/produkty/?page=2')).toBe(a);
    expect(snapshotFileName('/produkty/?page=3')).not.toBe(a);
    expect(snapshotFileName('/')).toMatch(/^index-[0-9a-f]{8}\.json$/);
    expect(snapshotFileName('/żółw/')).toMatch(/^[a-z0-9_-]+\.json$/);
  });
});

describe('pool', () => {
  it('keeps result order and respects the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const result = await pool([5, 1, 3, 2], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, value));
      active -= 1;
      return value * 10;
    });
    expect(result).toEqual([50, 10, 30, 20]);
    expect(peak).toBe(2);
  });
});

describe('fetchPage', () => {
  it('does not follow redirects and returns the location', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('', { status: 308, headers: { location: '/a/' } }),
    );
    const result = await fetchPage('http://x/a', {
      userAgent: 'test',
      fetchImpl,
    });
    expect(result).toMatchObject({ status: 308, location: '/a/' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://x/a',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('retries a 5xx and returns the last answer', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('x', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const result = await fetchPage('http://x/', {
      userAgent: 'test',
      fetchImpl,
      retryDelayMs: 0,
    });
    expect(result).toMatchObject({ status: 200, html: 'ok' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reports an unreachable host after every attempt', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await fetchPage('http://x/', {
      userAgent: 'test',
      fetchImpl,
      attempts: 2,
      retryDelayMs: 0,
    });
    expect(result.status).toBe('unreachable');
    expect(result.error).toContain('ECONNREFUSED');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
