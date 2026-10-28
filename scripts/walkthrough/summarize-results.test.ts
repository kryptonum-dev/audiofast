import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseResults } from './summarize-results';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(HERE, 'fixtures', name), 'utf8');

function runCli(name: string) {
  return spawnSync(
    'bun',
    [resolve(HERE, 'summarize-results.ts'), resolve(HERE, 'fixtures', name)],
    {
      encoding: 'utf8',
    },
  );
}

describe('parseResults', () => {
  it('parses a clean table (PASS + BLOCKED, no FAIL)', () => {
    const rows = parseResults(fixture('results.clean.md'));
    expect(rows.map((row) => [row.id, row.result])).toEqual([
      ['A1', 'PASS'],
      ['G1', 'BLOCKED'],
    ]);
  });

  it('keeps FAIL rows with their Cause', () => {
    const rows = parseResults(fixture('results.sample.md'));
    expect(rows.find((row) => row.id === 'A2')).toMatchObject({
      result: 'FAIL',
      notes: 'Cause: focus returned to the document body.',
    });
  });

  it('rejects an unknown Result vocabulary', () => {
    expect(() => parseResults(fixture('results.malformed.md'))).toThrow(
      /Result must be PASS, FAIL, or BLOCKED/,
    );
  });

  it('rejects a FAIL without Cause, duplicate ids and a missing table', () => {
    const head =
      '| ID | Result | Evidence | Notes |\n| --- | --- | --- | --- |\n';
    expect(() => parseResults(`${head}| A1 | FAIL | e | broken |\n`)).toThrow(
      /Cause:/,
    );
    expect(() =>
      parseResults(`${head}| A1 | PASS | e | ok |\n| A1 | PASS | e | ok |\n`),
    ).toThrow(/duplicate scenario ID/);
    expect(() => parseResults('no table here')).toThrow(
      /missing results table/,
    );
  });
});

describe('summarize-results CLI', () => {
  it('exits 0 for the clean fixture and 1 for the sample and malformed ones', () => {
    expect(runCli('results.clean.md').status).toBe(0);
    expect(runCli('results.sample.md').status).toBe(1);
    expect(runCli('results.malformed.md').status).toBe(1);
  });
});
