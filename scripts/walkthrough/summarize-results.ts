/**
 * Summarise one immutable Presentation walkthrough results table
 * (sanity-modernization Phase 11, ported from lsse-www).
 *
 * Usage:
 *   bun scripts/walkthrough/summarize-results.ts <results.md>
 *
 * Exit 0 means there are no FAIL rows. BLOCKED rows are reported but do not
 * fail the immediate fix loop; malformed input and any FAIL row exit 1.
 * `parseResults` is exported for `summarize-results.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RESULT_COLUMNS = ['ID', 'Result', 'Evidence', 'Notes'] as const;
const ALLOWED_RESULTS = new Set(['PASS', 'FAIL', 'BLOCKED']);

export type Result = 'PASS' | 'FAIL' | 'BLOCKED';

export type ResultRow = {
  id: string;
  result: Result;
  evidence: string;
  notes: string;
};

function cellsFromRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll('\\|', '|'));
}

export function parseResults(source: string): ResultRow[] {
  const lines = source.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    if (!line.trim().startsWith('|') || !line.trim().endsWith('|'))
      return false;
    return cellsFromRow(line).join('\0') === RESULT_COLUMNS.join('\0');
  });

  if (headerIndex === -1) {
    throw new Error(
      `missing results table with columns: ${RESULT_COLUMNS.join(', ')}`,
    );
  }

  const separator = lines[headerIndex + 1]?.trim() ?? '';
  if (
    !/^\|\s*:?-{3,}:?\s*\|\s*:?-{3,}:?\s*\|\s*:?-{3,}:?\s*\|\s*:?-{3,}:?\s*\|$/.test(
      separator,
    )
  ) {
    throw new Error('missing or malformed results-table separator');
  }

  const rows: ResultRow[] = [];
  const ids = new Set<string>();

  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith('|')) break;

    const cells = cellsFromRow(line);
    if (cells.length !== 4) {
      throw new Error(`expected 4 cells, found ${cells.length}: ${line}`);
    }

    const [id, rawResult, evidence, notes] = cells;
    if (!id) throw new Error('result row has an empty ID');
    if (ids.has(id)) throw new Error(`duplicate scenario ID: ${id}`);
    if (!ALLOWED_RESULTS.has(rawResult)) {
      throw new Error(
        `${id}: Result must be PASS, FAIL, or BLOCKED; received ${rawResult || '(empty)'}`,
      );
    }
    if (rawResult === 'FAIL' && !/\bCause:\s*\S/.test(notes)) {
      throw new Error(
        `${id}: FAIL Notes must contain a non-empty Cause: sentence`,
      );
    }

    ids.add(id);
    rows.push({ id, result: rawResult as Result, evidence, notes });
  }

  if (rows.length === 0) throw new Error('results table contains no rows');
  return rows;
}

function main(): void {
  const input = process.argv[2];
  if (!input) {
    console.error(
      'Usage: bun scripts/walkthrough/summarize-results.ts <results.md>',
    );
    process.exit(1);
  }

  try {
    const rows = parseResults(readFileSync(resolve(input), 'utf8'));
    const counts = { PASS: 0, FAIL: 0, BLOCKED: 0 };
    for (const row of rows) counts[row.result] += 1;

    console.log(`PASS: ${counts.PASS}`);
    console.log(`FAIL: ${counts.FAIL}`);
    console.log(`BLOCKED: ${counts.BLOCKED}`);

    for (const row of rows.filter(({ result }) => result !== 'PASS')) {
      console.log(`${row.result} ${row.id}: ${row.notes} [${row.evidence}]`);
    }

    process.exit(counts.FAIL === 0 ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`MALFORMED: ${message}`);
    process.exit(1);
  }
}

// Run only as a script (bun or node), never when imported by the test.
const invokedDirectly =
  (import.meta as ImportMeta & { main?: boolean }).main ??
  process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
