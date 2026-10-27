// @vitest-environment node
import { stegaClean } from 'next-sanity';
import { describe, expect, it } from 'vitest';

import {
  analyse,
  buildStegaProbes,
  extractLocations,
  isNotFound,
  markerRuns,
  normalizePath,
  templateKey,
  textTokens,
  tokenDifference,
} from './stega-crawl';

/**
 * A marker run in the current encoder's four-symbol alphabet (U+200B/C/D,
 * U+FEFF), the shape `vercelStegaEncode` appends; checked against
 * `stegaClean` below so the fixture cannot drift from the vendor.
 */
const RUN = '\u200B\u200C\u200D\uFEFF'.repeat(6);
const encoded = (value: string): string => `${value}${RUN}`;

describe('markerRuns', () => {
  it('counts encoder runs and ignores a lone ZWJ in an emoji', () => {
    const value = encoded('Wzmacniacz');
    expect(stegaClean(value)).toBe('Wzmacniacz');
    expect(markerRuns(value)).toBe(1);
    expect(markerRuns('👩‍💻 Kod')).toBe(0);
  });
});

describe('extractLocations + analyse', () => {
  const marked = encoded('Kolumny');

  it('published: any marker or data-sanity is a finding', () => {
    const page = extractLocations(
      `<html><head><title>Audio</title></head><body><main data-sanity="x"><h1>${marked}</h1></main></body></html>`,
    );
    const { findings } = analyse(page, 'published');
    expect(findings.map((f) => f.kind).sort()).toEqual(['data-sanity', 'text']);
    expect(page.dataSanity).toBe(1);
  });

  it('draft: markers in visible text are counted, elsewhere they are findings', () => {
    const html = [
      `<title>${marked}</title>`,
      `<a href="/p/${marked}/" data-sanity="id=1"><span>${marked}</span></a>`,
      `<img alt="${marked}">`,
      `<input value="${marked}">`,
      `<textarea>${marked}</textarea>`,
      `<script type="application/ld+json">${JSON.stringify({ name: marked })}</script>`,
      `<script>self.__next_f.push([1,"${marked}"])</script>`,
      `<svg><title>${marked}</title></svg>`,
    ].join('');
    const { findings, textRuns } = analyse(extractLocations(html), 'draft');
    expect(textRuns).toBe(1);
    expect(findings.map((f) => f.kind).sort()).toEqual([
      'attr:alt',
      'attr:href',
      'attr:value',
      'form-value',
      'jsonld:$.name',
      'svg',
      'title',
    ]);
  });

  it('reports a server-render error but not the ssr:false bailout', () => {
    const page = extractLocations(
      '<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING" data-msg="bail"></template>' +
        '<template data-dgst="123" data-msg="Switched to client rendering because the server rendering errored: boom"></template>' +
        '<script>$RC("B:1","S:1");$RX("B:2","456");$RX("B:3","NEXT_HTTP_ERROR_FALLBACK;404")</script>',
    );
    const { findings } = analyse(page, 'published');
    expect(findings.map((f) => f.text)).toEqual([
      'Switched to client rendering because the server rendering errored: boom',
      'client-render digest="456"',
    ]);
  });
});

describe('cross-mode text', () => {
  it('ignores markers and order, reports real differences', () => {
    const published = extractLocations('<p>Kolumny podłogowe</p><p>Nowość</p>');
    const draft = extractLocations(
      `<p>Nowość</p><div hidden><p>${encoded('Kolumny')} podłogowe</p></div>`,
    );
    expect(tokenDifference(textTokens(published), textTokens(draft))).toBe(
      null,
    );
    const edited = extractLocations('<p>Kolumny stojące</p><p>Nowość</p>');
    expect(tokenDifference(textTokens(published), textTokens(edited))).toBe(
      'only published 1: “podłogowe”; only draft 1: “stojące”',
    );
  });
});

describe('paths', () => {
  it('groups slugs and query keys into templates', () => {
    expect(templateKey('/')).toBe('/');
    expect(templateKey('/produkty/')).toBe('/produkty/');
    expect(templateKey('/produkty/abc/')).toBe('/produkty/<slug>/');
    expect(templateKey('/produkty/?page=2&sortBy=x')).toBe(
      '/produkty/?page&sortBy',
    );
  });

  it('normalises probe paths', () => {
    expect(normalizePath('koszyk')).toBe('/koszyk/');
    expect(normalizePath('/blog?page=2')).toBe('/blog/?page=2');
  });

  it('builds fixed probes, B2C included, plus category pagination', () => {
    const probes = buildStegaProbes([
      '/produkty/kategoria/kolumny/',
      '/blog/kategoria/testy/',
    ]);
    expect(probes).toContain('/koszyk/twoje-dane/');
    expect(probes).toContain('/this-page-does-not-exist/');
    expect(probes).toContain('/produkty/kategoria/kolumny/?page=2');
    expect(probes).toContain('/blog/kategoria/testy/?page=2');
  });

  it('treats the streamed not-found digest as not found', () => {
    expect(isNotFound(404, '')).toBe(true);
    expect(isNotFound(200, '"digest":"NEXT_HTTP_ERROR_FALLBACK;404"')).toBe(
      true,
    );
    expect(isNotFound(200, '<p>ok</p>')).toBe(false);
  });
});
