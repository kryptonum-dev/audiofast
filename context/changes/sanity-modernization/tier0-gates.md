# Tier 0 Presentation gates (Phase 10)

The deterministic gates that run before any browser work in the Phase 11 audit (research/03 §3.2, research/11 §5–6). Every gate is a command; each one exits non-zero on a finding.

| # | Gate | Command | Where |
| --- | --- | --- | --- |
| 0.1 | Stega-leak crawler | `bun run check:stega-leaks --base <url> --mode published\|draft\|both` | `apps/web/scripts/check-stega-leaks.ts`, helpers in `scripts/lib/stega-crawl.ts` |
| 0.2 | Enum coverage | `cd apps/web && bunx vitest run scripts/presentation-gates` | `enum-stega-coverage.test.ts` |
| 0.4 | Emptiness predicates | same | `emptiness-predicates.test.ts` |
| 0.5 | `[]->` projection lint | same | `deref-key-lint.test.ts` |
| 0.6 | Per-block `dataAttribute` coverage | same | `data-attribute-coverage.test.ts` |
| 0.7 | Resolver completeness | `cd apps/studio && bun run test` | `apps/studio/presentation/locations.test.ts` (Phase 7) |
| 0.8 | `StegaBranded` types probe | `bun run check-types` (type-level) + the vitest run | `stega-branded-types.test.ts` |
| 0.9 | Dataset hygiene | `bun run scan:dataset-stega` | `apps/web/scripts/scan-dataset-stega.ts` |
| — | Draft not-found status | vitest (source half) + `--mode both` crawl (live half) | `draft-not-found-status.test.ts` |

The gate tests live under `apps/web/scripts/presentation-gates/`, inside the web vitest `include`, so they run in `bun run test` (turbo) as well. Gate 0.3 (`onSuspiciousStega`) is the dev-only reporter Phase 8 mounted in `LiveVisualEditing`.

## How to run the crawler

- **Published gate:** against production, `bun run check:stega-leaks --base https://audiofast.pl --mode published`.
- **Draft gate:** against an isolated local production build, never a shared dev server:

  ```bash
  cd apps/web && bun run next build && bun run next start -p 3108   # leave running
  bun run check:stega-leaks --base http://localhost:3108 --mode both --concurrency 6
  ```

  The draft session uses the share-access secret (share access is enabled in Presentation), read with the Viewer token `SANITY_API_READ_TOKEN` from `apps/web/.env.local`. If share access is ever turned off, the crawler mints a 60-minute preview secret instead, which needs the write token `SANITY_AUTH_TOKEN`.
- `--out <file.md>` writes the full report. `--limit` is a smoke run and never satisfies the gate.

### Reading a `--mode both` report

- **Cross-mode divergence is informational while the dataset holds pending drafts.** The production dataset always has some (132 on 2026-10-27). The report says which mode it ran in. Known benign divergence classes:
  - an overlay wrapper (`data-sanity` element) splits two text runs that the published HTML glues together (`r.Oryginał` vs `r. Oryginał`);
  - `StoreLocations` renders no map in draft mode, so „Ładowanie mapy...” exists only in published HTML (Phase 8, by design);
  - `/`: the published render streams its main content client-side (pre-existing, see `parity/README.md`).
- **Never-published drafts** of routed types (up to two per type) are probed automatically: they must render in draft mode and stay not-found on the published site. Not-found is the 404 status or the streamed `NEXT_HTTP_ERROR_FALLBACK;404` digest, because PPR sends a 200 before the boundary resolves.
- `NEXT_HTTP_ERROR_FALLBACK;*` and `NEXT_REDIRECT;*` digests are control flow, not `ssr-error` findings.

## Results (2026-10-27)

- **0.2 / 0.4 / 0.5 / 0.6 / 0.8 + draft not-found (source):** 6 files, all green. Enum coverage: 11 `options.list` fields; all are covered by `STEGA_LOGIC_ONLY_FIELDS` or by the vendor `filterDefault` (`productType`, `filterType`, `authorType` match its `/type/i` rule). Emptiness: 38 bare `.trim()` sites in `components/`, all covered by 31 ALLOW rows with reasons (visitor input, code-built strings, Supabase order data, published-only B2C and JSON-LD, a `select()`-built slug). Deref lint: 0 bare `[]->` under `apps/web/src`. Data attributes: 21 registered blocks, 7 thread `dataAttribute`, 14 excluded with reasons.
- **0.7:** Studio tests green (8 files, 123 tests).
- **0.8 (`StegaBranded`):** the brand does **not** reach consumers. `live.ts` returns `result.data as TResult`, so `sanityFetch`, `sanityFetchCached` and `sanityFetchPublished` all type their data as the plain typegen result. This matches lsse-www. The probe is now a type-level test, so a change in `live.ts` that starts returning branded data fails `check-types`.
- **0.9:** `production` export: 10,032 documents (133 drafts), 1,155,583 strings, **0** with a stega run.
- **0.1 published (production, before the Phase 10 deploy):** 1,117 URLs, 0 findings, 0 `data-sanity`.
- **0.1 both (local build, first run):** 29 pages with draft findings, all real leaks, fixed in this phase:
  - `img[alt]` of a YouTube publication card (`PublicationCard`, `LatestPublication`): `stegaClean`;
  - `img[alt]` of the brand banner (`app/marki/[slug]/page.tsx`): `stegaClean`;
  - `button[aria-label]` „Dodaj do koszyka: …” on product cards (`ProductCardAddToCart`): `stegaClean`.

  The divergence pass also surfaced a draft-only truncation bug: `Breadcrumbs` measured the stega-encoded label, so short labels rendered as „Blog...” in Presentation (442 pages). It now measures `stripStega(name)`.
- **0.1 both (local build `next start -p 3108`, after the fixes): CLEAN.** 1,121 URLs (1,104 sitemap + 13 probes + 4 never-published drafts), 200 in both modes, 0 published findings, 0 `data-sanity` in published HTML, 0 draft findings, 110,048 visible-text marker runs. The 4 never-published drafts (2 products, 2 reviews) rendered in draft mode and stayed not-found when published. Divergence on 668 pages is informational (132 pending drafts); apart from the benign classes above, the draft-only „Zakup niedostępny w podglądzie” note (P10) and the „Gdzie kupić” heading of the geocoding-free store list are expected.
