# Published HTML parity (P7)

`baseline/` is the published-HTML snapshot of the site taken after Phase 1 (dependencies) and before any fetch-layer change (`347555f`). Phases 3, 4, 5, 8, 9 and 12 compare against it.

The crawler is `apps/web/scripts/check-parity.ts`. Its pure helpers live in `apps/web/scripts/lib/{crawl,parity}.ts` and are unit-tested (`cd apps/web && bunx vitest run scripts/lib`).

## What a record holds

There is one JSON file per URL in `baseline/pages/`, plus `baseline/summary.json` (URL count, status counts, git SHA, build label). The crawl covers every `sitemap.xml` URL (1,104) plus 21 probes: listing `?page=2`, sort and filter combinations, `/porownaj/`, both archives and four 404s.

Each record holds:

- the status code and the redirect `location`;
- `<title>`, meta description, canonical and meta robots (all occurrences, de-duplicated, sorted, joined with `||`);
- the JSON-LD blocks, parsed and key-sorted;
- the visible text as a bag of words, stega-stripped (`<script>`, `<style>`, `<noscript>`, `<template>` and inline SVG are excluded);
- `ssrErrors`: React error templates, plus one `client-render digest="…"` entry for each streamed `$RX(…)` fallback.

Site origins (`audiofast.pl`, `localhost:*`, `*.vercel.app`, the crawl base) are rewritten to `{origin}`, so a local build and production compare equal. `dataSanity` is recorded but not compared; the stega crawler (Phase 10) owns it.

## How to re-run the gate

The crawl must run against an isolated production build on its own port, never a shared dev server. Build with the same env as the baseline. `VERCEL_ENV=preview` pins the pre-Phase-3 client to `perspective: 'published'`. Without it, a local build reads drafts.

```bash
cd apps/web
VERCEL_ENV=preview VERCEL_URL=audiofast.pl bun run build
VERCEL_ENV=preview VERCEL_URL=audiofast.pl bun run next start -p 3107   # leave running

# from the repo root, in another shell
bun run check:parity --compare parity/baseline     # exit 0 = no diff, 1 = diff, 2 = setup error
```

Once Phase 3 removes the env switch, any local production build renders published content. Keep the env anyway so `BASE_URL` matches. Each run writes `parity/runs/<timestamp>/` (gitignored): the records, `diff.json` and `report.md`.

`bun run check:parity --help` lists every flag. `--limit` and `--probe` are retest tools and never satisfy the gate. Re-capture the baseline only on purpose:

```bash
bun run check:parity --out parity/baseline --label "<build command + SHA>"
```

Intentional diffs found by later phases go into `parity/accepted-diffs.md`, each with its reason.

## Known state of the baseline (pre-existing, also on production)

- The main content of `/`, `/marki/` and `/o-nas/` is not server-rendered. Its Suspense boundary streams `$RX("B:0","")`, so the HTML holds only the chrome and a spinner, and those pages' word bags are small. audiofast.pl does the same (checked 2026-10-27). If a later phase restores SSR there, the diff is an expected improvement; record it in `accepted-diffs.md`.
- Unknown URLs answer **200**, not 404. Under PPR the status is sent before `notFound()` streams (`digest="NEXT_HTTP_ERROR_FALLBACK;404"`). Production behaves the same (`/this-page-does-not-exist/` → 200).
- Content can drift between crawls: editor publishes and Excel price runs change the published site. When a later diff traces to such an edit (check `_updatedAt`), re-capture the baseline from the pre-change commit, or record the diff as accepted.
