/**
 * What the Presentation gate tests share (Phase 10, Tier 0): the repo root, a
 * recursive source walk and a comment stripper, so a `list:` in a doc comment,
 * a `[]->` in a warning about `[]->`, or the retired stega class named in
 * prose never counts as the thing it warns against.
 *
 * Ported from lsse-www `scripts/presentation-gates/source.ts`. The stripper is
 * deliberately simple: it blanks `/* … *\/` blocks and every `//` comment whose
 * opener is not inside a string literal (an even count of each quote kind
 * before it). That is enough for TypeScript written under this repo's Prettier
 * config; it does not parse.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The monorepo root (this file lives in `apps/web/scripts/presentation-gates/`). */
export const ROOT = new URL('../../../../', import.meta.url);

export const ROOT_PATH = fileURLToPath(ROOT);

/** An absolute path for a repo-relative one. */
export function repoPath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, ROOT));
}

/** Every file under `dir` whose name matches, as absolute paths, sorted. */
export function walk(
  dir: string,
  matches: (name: string) => boolean,
): string[] {
  const out: string[] = [];
  const visit = (path: string): void => {
    for (const entry of readdirSync(path).sort()) {
      const full = `${path}/${entry}`;
      if (statSync(full).isDirectory()) {
        if (entry !== 'node_modules' && entry !== '.next') visit(full);
      } else if (matches(entry)) out.push(full);
    }
  };
  visit(dir.replace(/\/$/, ''));
  return out;
}

export const isTypeScript = (name: string): boolean =>
  /\.tsx?$/.test(name) && !name.endsWith('.d.ts');

export const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path);

export function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/** `path` relative to the repo root, for failure messages. */
export function relative(path: string): string {
  return path.replace(ROOT_PATH, '');
}

function outsideStrings(lineBefore: string): boolean {
  let single = 0;
  let double = 0;
  let back = 0;
  for (const char of lineBefore) {
    if (char === "'") single += 1;
    else if (char === '"') double += 1;
    else if (char === '`') back += 1;
  }
  return single % 2 === 0 && double % 2 === 0 && back % 2 === 0;
}

/**
 * The source with comments blanked: replaced by spaces, never removed, so
 * every remaining character keeps its line number.
 */
export function stripComments(source: string): string {
  const blanked = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    block.replace(/[^\n]/g, ' '),
  );
  return blanked
    .split('\n')
    .map((line) => {
      let from = 0;
      for (;;) {
        const at = line.indexOf('//', from);
        if (at === -1) return line;
        // `https://…` inside a string is not a comment opener.
        if (outsideStrings(line.slice(0, at)) && line[at - 1] !== ':')
          return line.slice(0, at) + ' '.repeat(line.length - at);
        from = at + 2;
      }
    })
    .join('\n');
}
