// @vitest-environment node
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { PageRecord } from './crawl';
import {
  DEFAULT_BASE,
  formatRecord,
  parseArgs,
  renderReport,
  resolveDir,
  timestampDirName,
  UsageError,
} from './parity';

describe('parseArgs', () => {
  it('applies defaults', () => {
    expect(parseArgs([])).toEqual({
      base: DEFAULT_BASE,
      out: null,
      compare: null,
      concurrency: 4,
      probes: [],
      noProbes: false,
      limit: null,
      label: null,
    });
  });

  it('reads every flag, in both "--flag value" and "--flag=value" form', () => {
    expect(
      parseArgs([
        '--base',
        'http://localhost:3107/ignored/path',
        '--out=parity/baseline',
        '--compare',
        'parity/old',
        '--concurrency',
        '8',
        '--probe',
        '/a/',
        '--probe=/b/?x=1',
        '--no-probes',
        '--limit',
        '10',
        '--label',
        'build: x',
      ]),
    ).toEqual({
      base: 'http://localhost:3107',
      out: 'parity/baseline',
      compare: 'parity/old',
      concurrency: 8,
      probes: ['/a/', '/b/?x=1'],
      noProbes: true,
      limit: 10,
      label: 'build: x',
    });
  });

  it.each([
    [['--base', 'not-a-url']],
    [['--base', 'ftp://x']],
    [['--concurrency', '0']],
    [['--limit', '1.5']],
    [['--probe', 'no-slash']],
    [['--out']],
    [['--out', '--compare']],
    [['--wat']],
  ])('rejects %j as a usage error', (argv) => {
    expect(() => parseArgs(argv)).toThrow(UsageError);
  });
});

describe('resolveDir', () => {
  const changeDir = '/repo/context/changes/sanity-modernization';

  it('keeps absolute paths', () => {
    expect(resolveDir('/tmp/x', '/repo', changeDir)).toBe('/tmp/x');
  });

  it('maps parity/ to the change folder when the cwd has no parity dir', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'parity-'));
    expect(resolveDir('parity/baseline', cwd, changeDir)).toBe(
      `${changeDir}/parity/baseline`,
    );
    expect(resolveDir('out/x', cwd, changeDir)).toBe(join(cwd, 'out/x'));
  });

  it('prefers a cwd-local parity dir', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'parity-'));
    mkdirSync(join(cwd, 'parity'));
    expect(resolveDir('parity/baseline', cwd, changeDir)).toBe(
      join(cwd, 'parity/baseline'),
    );
  });
});

describe('timestampDirName', () => {
  it('is filesystem safe', () => {
    expect(timestampDirName(new Date('2026-10-27T10:20:30.456Z'))).toBe(
      '2026-10-27T10-20-30-456Z',
    );
  });
});

describe('formatRecord', () => {
  const record: PageRecord = {
    path: '/x/',
    status: 200,
    location: null,
    title: 'T',
    description: null,
    canonical: '{origin}/x/',
    robots: 'index, follow',
    jsonLd: [{ '@type': 'A', name: 'a' }, { '@type': 'B' }],
    words: { a: 2, b: 1 },
    wordCount: 3,
    ssrErrors: [],
    dataSanity: 0,
  };

  it('round-trips through JSON.parse', () => {
    expect(JSON.parse(formatRecord(record))).toEqual(record);
    expect(JSON.parse(formatRecord({ ...record, jsonLd: [] }))).toEqual({
      ...record,
      jsonLd: [],
    });
  });

  it('puts one key, and one JSON-LD block, per line', () => {
    expect(formatRecord(record)).toBe(
      [
        '{',
        '  "path": "/x/",',
        '  "status": 200,',
        '  "location": null,',
        '  "title": "T",',
        '  "description": null,',
        '  "canonical": "{origin}/x/",',
        '  "robots": "index, follow",',
        '  "jsonLd": [',
        '    {"@type":"A","name":"a"},',
        '    {"@type":"B"}',
        '  ],',
        '  "words": {"a":2,"b":1},',
        '  "wordCount": 3,',
        '  "ssrErrors": [],',
        '  "dataSanity": 0',
        '}',
        '',
      ].join('\n'),
    );
  });
});

describe('renderReport', () => {
  it('says so when there are no differences', () => {
    const report = renderReport({
      baselineDir: 'parity/baseline',
      base: DEFAULT_BASE,
      baselineCount: 2,
      currentCount: 2,
      diffs: [],
    });
    expect(report).toContain('Differing paths: 0');
    expect(report).toContain('No differences.');
  });

  it('lists each path with its field changes', () => {
    const report = renderReport({
      baselineDir: 'parity/baseline',
      base: DEFAULT_BASE,
      baselineCount: 3,
      currentCount: 3,
      diffs: [
        { path: '/gone/', kind: 'missing' },
        { path: '/new/', kind: 'added' },
        {
          path: '/x/',
          kind: 'changed',
          fields: [
            { field: 'title', baseline: 'Stary', current: 'Nowy' },
            {
              field: 'words',
              diff: { added: { nowe: 2 }, removed: { stare: 1 } },
            },
          ],
        },
      ],
    });
    expect(report).toContain('- Missing from current: 1');
    expect(report).toContain('- New in current: 1');
    expect(report).toContain('`title` differs on 1 path(s)');
    expect(report).toContain('- `/gone/` — missing');
    expect(report).toContain('title: `Stary` → `Nowy`');
    expect(report).toContain('words added: `nowe×2`');
    expect(report).toContain('words removed: `stare`');
  });
});
