/**
 * Pure pieces of `scripts/check-parity.ts`: argument parsing, path
 * resolution and the markdown diff report. Bun-free so vitest can import it.
 */

import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import type { FieldDiff, PageRecord, PathDiff } from './crawl';

export const DEFAULT_BASE = 'http://localhost:3107';
export const DEFAULT_CONCURRENCY = 4;

export class UsageError extends Error {}

export type ParityOptions = {
  base: string;
  out: string | null;
  compare: string | null;
  concurrency: number;
  probes: string[];
  noProbes: boolean;
  limit: number | null;
  label: string | null;
};

export const USAGE = `Usage: bun run check:parity [--base <url>] [--out <dir>] [--compare <baselineDir>]
                          [--concurrency <n>] [--probe <path>]... [--no-probes]
                          [--limit <n>] [--label <text>]

  --base         Origin to crawl (default ${DEFAULT_BASE}: an isolated \`next start\`).
  --out          Snapshot directory to write (default: parity/runs/<timestamp>).
  --compare      Baseline snapshot directory to diff against.
  --concurrency  Parallel requests (default ${DEFAULT_CONCURRENCY}).
  --probe        Extra path to crawl (repeatable).
  --no-probes    Crawl only the sitemap.
  --limit        Crawl only the first n paths (a retest tool, never a gate).
  --label        Free text stored in summary.json (e.g. the build command).

Relative paths starting with "parity/" resolve against the change folder
(context/changes/sanity-modernization/) unless ./parity exists in the cwd.

Exit codes: 0 = no diff, 1 = diff (or a crawl with server errors when not
comparing), 2 = bad arguments or the base is unreachable.`;

export function parseArgs(argv: readonly string[]): ParityOptions {
  const options: ParityOptions = {
    base: DEFAULT_BASE,
    out: null,
    compare: null,
    concurrency: DEFAULT_CONCURRENCY,
    probes: [],
    noProbes: false,
    limit: null,
    label: null,
  };

  const value = (flag: string, index: number): string => {
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--'))
      throw new UsageError(`${flag} needs a value`);
    return next;
  };
  const positiveInt = (flag: string, raw: string): number => {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1)
      throw new UsageError(`${flag} must be a positive integer, got "${raw}"`);
    return parsed;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const [flag, inline] = arg.includes('=')
      ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
      : [arg, undefined];
    const take = (): string => {
      if (inline !== undefined) {
        if (!inline) throw new UsageError(`${flag} needs a value`);
        return inline;
      }
      const next = value(flag, index);
      index += 1;
      return next;
    };

    switch (flag) {
      case '--base': {
        const raw = take();
        let url: URL;
        try {
          url = new URL(raw);
        } catch {
          throw new UsageError(`--base must be an absolute URL, got "${raw}"`);
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:')
          throw new UsageError('--base must be http(s)');
        options.base = url.origin;
        break;
      }
      case '--out':
        options.out = take();
        break;
      case '--compare':
        options.compare = take();
        break;
      case '--concurrency':
        options.concurrency = positiveInt(flag, take());
        break;
      case '--probe': {
        const probe = take();
        if (!probe.startsWith('/'))
          throw new UsageError(`--probe must start with "/", got "${probe}"`);
        options.probes.push(probe);
        break;
      }
      case '--no-probes':
        options.noProbes = true;
        break;
      case '--limit':
        options.limit = positiveInt(flag, take());
        break;
      case '--label':
        options.label = take();
        break;
      case '--help':
      case '-h':
        throw new UsageError('');
      default:
        throw new UsageError(`Unknown argument "${arg}"`);
    }
  }
  return options;
}

/**
 * Resolve a CLI directory. `parity/...` maps to the change folder so the
 * documented gate command (`--compare parity/baseline`) works from the repo
 * root; anything else is relative to the cwd.
 */
export function resolveDir(
  path: string,
  cwd: string,
  changeDir: string,
): string {
  if (isAbsolute(path)) return path;
  if (
    (path === 'parity' || path.startsWith('parity/')) &&
    !existsSync(resolve(cwd, 'parity'))
  )
    return resolve(changeDir, path);
  return resolve(cwd, path);
}

export function timestampDirName(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * One snapshot file: a top-level key per line with a compact value, and one
 * JSON-LD block per line. Line-diffable in git without pretty-printing the
 * repeated JSON-LD and the word bag (~3x smaller than indented JSON).
 */
export function formatRecord(record: PageRecord): string {
  const lines = Object.entries(record).map(([key, value]) => {
    if (key === 'jsonLd' && Array.isArray(value) && value.length) {
      const items = value.map((item) => `    ${JSON.stringify(item)}`);
      return `  ${JSON.stringify(key)}: [\n${items.join(',\n')}\n  ]`;
    }
    return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

function shown(value: unknown, max = 160): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const single = (text ?? 'null').replace(/\s+/g, ' ');
  const clipped = single.length > max ? `${single.slice(0, max - 1)}…` : single;
  return `\`${clipped.replace(/`/g, "'")}\``;
}

function words(record: Record<string, number>, max = 30): string {
  const entries = Object.entries(record);
  const list = entries
    .slice(0, max)
    .map(([word, count]) => (count > 1 ? `${word}×${count}` : word))
    .join(' ');
  return entries.length > max ? `${list} … (+${entries.length - max})` : list;
}

function fieldLine(diff: FieldDiff): string {
  if (diff.field === 'words') {
    const lines = [];
    if (Object.keys(diff.diff.added).length)
      lines.push(`  - words added: ${shown(words(diff.diff.added), 400)}`);
    if (Object.keys(diff.diff.removed).length)
      lines.push(`  - words removed: ${shown(words(diff.diff.removed), 400)}`);
    return lines.join('\n');
  }
  return `  - ${diff.field}: ${shown(diff.baseline)} → ${shown(diff.current)}`;
}

export function renderReport(input: {
  baselineDir: string;
  base: string;
  baselineCount: number;
  currentCount: number;
  diffs: PathDiff[];
}): string {
  const { diffs } = input;
  const byField = new Map<string, number>();
  for (const diff of diffs) {
    if (diff.kind !== 'changed') continue;
    for (const field of diff.fields)
      byField.set(field.field, (byField.get(field.field) ?? 0) + 1);
  }

  const lines = [
    '# Parity report',
    '',
    `- Base: ${input.base}`,
    `- Baseline: ${input.baselineDir} (${input.baselineCount} URLs)`,
    `- Current crawl: ${input.currentCount} URLs`,
    `- Differing paths: ${diffs.length}`,
  ];
  const missing = diffs.filter((diff) => diff.kind === 'missing');
  const added = diffs.filter((diff) => diff.kind === 'added');
  if (missing.length) lines.push(`- Missing from current: ${missing.length}`);
  if (added.length) lines.push(`- New in current: ${added.length}`);
  for (const [field, count] of [...byField].sort())
    lines.push(`- \`${field}\` differs on ${count} path(s)`);
  lines.push('');

  if (!diffs.length) {
    lines.push('No differences.');
    return `${lines.join('\n')}\n`;
  }

  lines.push('## Paths', '');
  for (const diff of diffs) {
    if (diff.kind === 'missing') lines.push(`- \`${diff.path}\` — missing`);
    else if (diff.kind === 'added') lines.push(`- \`${diff.path}\` — new`);
    else {
      lines.push(`- \`${diff.path}\``);
      for (const field of diff.fields) lines.push(fieldLine(field));
    }
  }
  return `${lines.join('\n')}\n`;
}
