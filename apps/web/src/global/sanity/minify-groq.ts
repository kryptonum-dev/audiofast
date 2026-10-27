/**
 * Collapses insignificant whitespace in a GROQ string (ported from lsse-www
 * `global/sanity/minify-groq.ts`).
 *
 * The queries in `query.ts` are composed from generously indented fragment
 * factories; GROQ ignores all of that whitespace, but it rides the wire on
 * every request and counts toward the API CDN's GET-length and body limits.
 * Minifying at the ONE fetch funnel (`live.ts`, `fetch.ts`) keeps the source
 * readable and leaves `sanity typegen` untouched: typegen resolves the source
 * statically and never sees this. That is also why it runs at fetch time
 * rather than wrapping each exported constant — a wrapped `defineQuery` is no
 * longer found by typegen.
 *
 * WHAT IT PRESERVES. Everything inside string literals, escapes included. GROQ
 * has two string forms, `"…"` and `'…'`, and both are copied verbatim (lsse
 * only knew the double-quoted one). `//` comments are removed outright:
 * outside a string two slashes always open a comment, and collapsing the
 * newline that ends one without dropping it would feed the rest of the query
 * to the comment.
 *
 * A collapsed space is dropped entirely when it touches pure punctuation, or
 * when exactly one side of it is an operator character. A space between TWO
 * operator characters is kept, so adjacent operators can never fuse into a
 * different token (`a && !b`, `=> *[…]`). `/` is deliberately not an operator:
 * dropping a space is how `a / /b` would become a comment.
 *
 * ⚠️ THE WALK MUST STAY LINEAR. Output is collected in chunks and joined once,
 * and the last emitted character is tracked in a variable: reading
 * `out[out.length - 1]` after `out += char` flattens a V8 rope on every
 * character and turns a large query quadratic (lsse traced 46 s of blocked
 * event loop to exactly that).
 *
 * Results are memoised with a bounded map. Queries are mostly module
 * constants; the listing builders (`getProductsListingQuery(sortBy)` and
 * friends) add a handful of variants.
 */
const minified = new Map<string, string>();

const MEMO_LIMIT = 200;

const NO_SPACE_AFTER = new Set(['{', '(', '[', ',', ':']);
const NO_SPACE_BEFORE = new Set(['}', ')', ']', ',']);
const OPERATOR = new Set(['=', '!', '<', '>', '+', '-', '*', '&', '|', '%']);

export function minifyGroq(query: string): string {
  const cached = minified.get(query);
  if (cached !== undefined) return cached;

  const chunks: string[] = [];
  let last = '';
  let quote: '"' | "'" | null = null;
  let pendingSpace = false;

  for (let i = 0; i < query.length; i++) {
    const char = query[i] as string;

    if (quote !== null) {
      chunks.push(char);
      last = char;
      if (char === '\\') {
        // Copy the escaped character verbatim so an escaped quote cannot
        // terminate the string state.
        const next = query[i + 1];
        if (next !== undefined) {
          chunks.push(next);
          last = next;
          i++;
        }
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      pendingSpace = last !== '';
      continue;
    }

    if (char === '/' && query[i + 1] === '/') {
      const lineEnd = query.indexOf('\n', i);
      if (lineEnd === -1) break;
      i = lineEnd;
      pendingSpace = last !== '';
      continue;
    }

    if (pendingSpace) {
      const prevIsOperator = OPERATOR.has(last);
      const charIsOperator = OPERATOR.has(char);
      const drop =
        NO_SPACE_AFTER.has(last) ||
        NO_SPACE_BEFORE.has(char) ||
        prevIsOperator !== charIsOperator;

      if (!drop) chunks.push(' ');
      pendingSpace = false;
    }

    chunks.push(char);
    last = char;
    if (char === '"' || char === "'") quote = char;
  }

  const out = chunks.join('');
  if (minified.size >= MEMO_LIMIT) {
    const oldest = minified.keys().next().value;
    if (oldest !== undefined) minified.delete(oldest);
  }
  minified.set(query, out);
  return out;
}
