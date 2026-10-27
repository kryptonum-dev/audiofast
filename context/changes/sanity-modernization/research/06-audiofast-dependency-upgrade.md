# 06 — Audiofast dependency upgrade surface

Research date: 2026-10-26. Read-only: no `bun install`/`bun update`, no manifest or lockfile edits.
Sources: every `package.json` in the repo, `bun.lock` (resolved versions), `bun outdated --recursive`,
`npm view` (latest + peer/engine ranges), GitHub release notes via `gh`/WebFetch, and the two
reference repos (`lsse/lsse-www`, `Najbar`).

## Summary

- **The most urgent item is not a "nice to have" bump.** Studio runs `sanity@6.10.1`. Sanity marked
  **6.9.2–6.14.0 as deprecated for a Portable Text data-loss bug**, fixed in 6.14.1 (release banner on
  v6.10.0 / v6.10.1: "potential data-loss bug when working with Portable Text fields. This issue is
  resolved in 6.14.1"). Audiofast is a heavily rich-text CMS (blog, brand/product content,
  `@portabletext/*`). Moving Studio to 6.20.0 should ship first and on its own.
- Real majors in the runtime path: `@sanity/client` 7→8, `@sanity/ui` 3→4, `@sanity/icons` 3→5,
  `@sanity/sdk-react` 2→3 (App SDK apps), `@portabletext/react` 7→8. Everything else in the web
  runtime is minor/patch (`next` 16.3.2→16.4.3, `react` 19.2.8→19.3.1, `next-sanity` 13.3.3→13.4.0).
- `sanity@6.20.0` itself already depends on `@sanity/client ^8.9`, `@sanity/ui ^4.4.9`,
  `@sanity/icons ^5.2.3`, `@sanity/sdk-react ^3.9.1`, `@sanity/cli ^8.17.1`. Today the lock already
  carries **two copies** of UI (3.5.3 ours / 4.0.6 Sanity's), icons (3.8.0 / 5.2.1) and client
  (7.26.2 / 8.2.0). The upgrade is mostly about converging onto Sanity's own graph.
- The biggest mechanical port is `@sanity/ui` 4 + `@sanity/icons` 5 across **three apps**
  (studio, b2c-admin, cms-activity): **228 `space=` props, 28 `Grid columns=`, 13 files importing
  moved components from the root, 61 `@sanity/icons` barrel imports (65 symbols)**. All are
  TypeScript-guided (`never` tombstones), so `check-types` finds every site.
- **Hold (blocked upstream, same verdict as lsse and Najbar):** TypeScript 7 (typescript-eslint
  8.72 peer is still `>=4.8.4 <6.1.0`), ESLint 10 (`eslint-plugin-react` 7.37.5 peers `^9.7`;
  lsse tried it, lint crashed on removed `getFilename()`), `@sanity/eslint-config-studio` 7
  (requires eslint 10), `@types/node` 26 (web deploys on Node 24).
- **Optional, own change:** TypeScript 6.0.3 (lsse runs it; needs `baseUrl` removal + explicit
  `types`), vitest 5 + jsdom 30 + msw 3 (test-stack majors with real breaking changes; 118 test files).
- Nothing in audiofast uses an API removed in `@sanity/client` 8 (grep-verified). `cacheMode:
  'noStale'` and `CurrentSanityUser` still exist in v8 types.

## Version table

`declared` = range in package.json, `resolved` = `bun.lock`, `latest` = npm `latest` dist-tag on
2026-10-26. lsse = `lsse/lsse-www` pins (its `apps/web` / `apps/studio`), Najbar = `Najbar` pins.
"—" = not used there. Bump type is resolved → latest.

### Framework / Sanity runtime

| pkg | workspace | declared | resolved | latest | lsse-www | Najbar | bump |
| --- | --- | --- | --- | --- | --- | --- | --- |
| next | web | 16.3.2 (exact) | 16.3.2 | 16.4.3 | 16.4.0 | 16.3.8 | minor |
| react / react-dom | web | 19.2.8 (exact) | 19.2.8 | 19.3.1 | 19.3.0 | 19.2.8 | minor |
| react / react-dom | studio, b2c-admin, cms-activity | ^19.2.8 | 19.2.8 | 19.3.1 | 19.3.0 | 19.2.8 | minor (floats on next install!) |
| @types/react / -dom | all apps | 19.2.18 / 19.2.4 (exact) | same | 19.3.0 / 19.3.0 | 19.3.0 | 19.2.17 / 19.2.3 | minor |
| next-sanity | web | ^13.3.3 | 13.3.3 | 13.4.0 | 13.3.4 | 13.2.2 | minor |
| @sanity/client | web | ^7.26.2 | 7.26.2 (+8.2.0 nested under cli/assist/media) | 8.11.0 | 8.9.0 | 7.25.0 | **major** |
| @sanity/image-url | web | ^2.1.1 | 2.1.1 | 2.1.1 | 2.1.1 | 2.1.1 | — |
| @sanity/asset-utils | web | ^2.2.1 | 2.3.0 | 2.3.0 | — | — | — |
| @sanity/preview-url-secret | (transitive) | — | 4.1.5 | 4.1.5 | transitive | ^4.1.2 (dev) | — |
| @sanity/visual-editing | (transitive) | — | 6.1.1 | 6.2.0 | transitive | transitive | minor |
| groq | (transitive) | — | 3.88.1-typegen-experimental.0 hoisted; 6.10.1 under next-sanity | 6.20.0 | transitive | transitive | (fixed by sdk 3) |
| @portabletext/react | web | ^7.0.1 | 7.0.1 (Sanity nests 8.0.1) | 8.0.1 | 8.0.1 | ^7.0.1 | **major** |
| @portabletext/to-html | web | ^6.0.0 | 6.0.0 | 6.0.0 | — | — | — |
| sanity | studio, b2c-admin, cms-activity | ^6.10.1 | 6.10.1 | 6.20.0 | 6.19.0 (exact) | 6.6.0 | minor (**data-loss fix**) |
| @sanity/vision | studio | ^6.10.1 | 6.10.1 | 6.20.0 | — | — | minor |
| @sanity/cli | root (dependencies) | ^8.2.1 | 8.2.1 | 8.23.0 | 8.16.0 (dev) | — | minor |
| @sanity/assist | studio | ^6.1.21 | 6.1.21 | 6.2.5 | 6.2.4 | — | minor |
| @sanity/orderable-document-list | studio | 2.0.20 (exact) | 2.0.20 | 2.0.28 | 2.0.27 | ^2.0.17 | patch (pin can be lifted) |
| sanity-plugin-media | studio | ^6.1.6 | 6.1.6 | 6.5.0 | 6.3.4 | ^6.0.7 | minor |
| @sanity/ui | studio, b2c-admin, cms-activity | ^3.5.3 | 3.5.3 (+4.0.6 nested) | 4.4.10 | ^4.4.4 | ^3.4.5 | **major** |
| @sanity/icons | studio, b2c-admin, cms-activity | ^3.8.0 | 3.8.0 (+5.2.1 nested) | 5.2.3 | ^5.2.3 | ^5.2.1 | **major (x2)** |
| @sanity/sdk-react | b2c-admin, cms-activity | ^2.20.1 | 2.20.1 | 3.9.1 | — | — | **major** |
| @sanity/sdk | (transitive) | — | 2.20.1 | 3.9.1 | — | — | major |
| styled-components | studio, b2c-admin, cms-activity | ^6.5.3 | 6.5.3 | 6.6.0 | 6.6.0 | 6.4.4 | minor |
| @sanity/eslint-config-studio | studio (dev) | ^6.0.0 | 6.0.0 | 7.0.0 | ^6.0.0 | ^6.0.0 | major — **hold** (needs eslint 10) |

### Web runtime (non-Sanity)

| pkg | workspace | declared | resolved | latest | lsse-www | Najbar | bump |
| --- | --- | --- | --- | --- | --- | --- | --- |
| @supabase/supabase-js | web | ^2.112.3 | 2.112.3 | 2.118.0 | — | — | minor |
| @supabase/ssr | web | ^0.12.4 | 0.12.4 | 0.12.7 | — | — | patch |
| zod | web | ^4.4.3 | 4.4.3 | 4.6.7 | — | — | minor |
| sass | web | ^1.103.1 | 1.103.1 | 1.106.1 | ^1.105.1 | ^1.102.0 | minor |
| lucide-react | web, studio | ^1.33.0 | 1.33.0 | 1.61.0 | ^1.55.0 | ^1.27.0 | minor |
| react-hook-form | web | ^7.86.0 | 7.86.0 | 7.91.0 | ^7.90.0 | ^7.83.0 | minor |
| @azure/identity | web | ^4.13.2 | 4.13.2 | 4.14.0 | — | — | minor |
| @react-email/render | web | ^2.1.0 | 2.1.0 | 2.1.1 | 2.1.0 | — | patch |
| babel-plugin-react-compiler | web (dev) | ^1.0.0 | 1.0.0 | 1.0.0 | — | — | — |
| next-themes, @vercel/edge-config | web | ^0.4.6 / ^1.5.1 | — | — | — | — | **0 import sites — removal candidates** |
| minimatch | web (dev) | ^10.2.6 | — | — | — | — | 0 import sites (check if it is a security pin) |

### Tooling / tests

| pkg | workspace | declared | resolved | latest | lsse-www | Najbar | bump |
| --- | --- | --- | --- | --- | --- | --- | --- |
| typescript | all | 5.9.3 (exact) | 5.9.3 | 7.0.2 | 6.0.3 | 5.9.3 | major — TS 6 optional, TS 7 **hold** |
| turbo | root | ^2.10.11 | 2.10.11 | 2.11.10 | 2.11.7 | 2.10.7 | minor |
| prettier | root | ^3.9.6 | 3.9.6 | 3.9.10 | ^3.9.10 | ^3.9.6 | patch |
| eslint | all | ^9.39.5 | 9.39.5 | 10.13.0 | ^9.39.5 | ^9.39.5 | major — **hold** |
| @eslint/js | eslint-config | ^9.39.5 | 9.39.5 | 10.0.1 | ^9.39.5 | ^9.39.5 | major — hold with eslint |
| typescript-eslint (+ parser/plugin) | eslint-config | ^8.67.0 | 8.67.0 | 8.72.0 | ^8.71.2 | ^8.65.0 | minor |
| @next/eslint-plugin-next | eslint-config | ^16.3.2 | 16.3.2 | 16.4.3 | ^16.4.0 | ^16.2.12 | minor |
| eslint-plugin-react-hooks | eslint-config | ^7.1.1 | 7.1.1 | 7.1.1 | ^7.1.1 | ^7.1.1 | — |
| eslint-plugin-turbo | eslint-config | ^2.10.11 | 2.10.11 | 2.11.10 | ^2.11.7 | ^2.10.7 | minor |
| globals | eslint-config | ^17.11.0 | 17.11.0 | 17.13.0 | ^17.13.0 | ^17.8.0 | minor |
| vitest | web, b2c-admin | ^4.1.11 | 4.1.11 | 5.0.5 | — (bun:test) | — | major — own change |
| vite | web (dev) | ^8.2.2 | 8.2.2 | 8.3.5 | — | — | minor |
| jsdom | web, b2c-admin | ^29.1.1 | 29.1.1 | 30.1.3 | 30.1.2 (studio) | — | major — own change |
| msw | web (dev) | ^2.15.0 | 2.15.0 | 3.0.3 | — | — | major — own change |
| @playwright/test | web (dev) | ^1.62.1 | 1.62.1 | 1.64.1 | playwright-core 1.64.0 | — | minor (re-install browsers) |
| @testing-library/* | web, b2c-admin | 10.4.1 / 16.3.2 / 14.6.6 | same | 10.4.2 / 16.3.3 / 14.6.8 | — | — | patch |
| @types/node | all | ^24.13.3 | 24.13.3 | 26.6.5 (24.x line: 24.19.2) | 24.13.3 | 25.0.0 | stay on 24.x — **hold 26** |
| csv-parse / node-html-parser / p-limit / uuid / sharp | studio (dev, migration scripts) | 6.1 / 7.1 / 3.1 / 11.1 / 0.34.5 | same | 7.0.3 / 9.0.5 / 7.3.3 / 14.0.3 / 0.35.5 | sharp 0.35.5 | sharp ^0.35.3 | majors, low value |
| bun (packageManager) | root | bun@1.3.2 | — | 1.4.4 | bun@1.3.2 | bun@1.3.2 | out of scope (both refs stay 1.3.2) |

## Breaking-change notes per major / notable bump

### 1. `sanity` 6.10.1 → 6.20.0 (+ `@sanity/vision`, plugins, root `@sanity/cli`)

- **Why now:** 6.9.2–6.14.0 deprecated for Portable Text data loss; fix in 6.14.1. lsse took 6.18 for
  the same reason (`89dc8d1c`: "fixes the Portable Text Editor bug that could drop rich text edits").
- Release notes 6.11–6.20 contain no user-facing breaking change for us. Relevant internals:
  6.12 moved Sanity onto `@sanity/sdk(-react)` 3 and `@sanity/client` ^8.4; 6.13 typegen registers
  query result types on a global `SanityQueries` interface (expect `sanity.types.ts` diff on
  `bun run typegen`); 6.19 removed the global context registry ("two versions of sanity can render
  on one page"); presentation fixes in 6.12/6.17/6.19/6.20 (relevant for the planned Presentation tool).
- `@sanity/orderable-document-list` is pinned to **2.0.20** because 2.0.21+ imported
  `DocumentVersionsStatusIndicator`, missing from sanity 6.10.1 (audiofast commit `981bc2c`). lsse
  confirmed 2.0.23 reverted that import and ran 2.0.27 on 6.12–6.19. Pin can be lifted to 2.0.28.
  Used in `apps/studio/structure.ts` + 9 collection schemas (award, brand, product, review,
  blog-article, blog-category, product-category-parent/-sub, team-member).
- `sanity@6.20` needs `@sanity/cli ^8.17.1`; root declares `^8.2.1` (resolved 8.2.1) → bump root to
  `^8.23.0` in the same commit to avoid a second CLI copy.
- Plugins at latest all converge on `@sanity/ui ^4.4.x` / `@sanity/icons ^5.2.3` / `@sanity/client
  ^8.9` (assist 6.2.5, media 6.5.0, orderable 2.0.28, vision 6.20). `@sanity/vision@6.20` also pulls
  `ui5: npm:@sanity/ui@5.0.0-alpha.14` — expected, not ours to manage.
- Studio code imports `@sanity/client` in ~45 files (bulk-actions-table plugin + `scripts/migration/**`)
  **without declaring it**; it resolves via hoisting. After the bump the hoisted copy becomes v8.
  Declare it explicitly in `apps/studio/package.json`.
- Can ship **without** porting our own code to UI 4: our components already run on a separate
  `@sanity/ui` 3 copy next to Sanity's 4.0.6 today (contexts are `Symbol.for(...)`-scoped in both
  majors — lsse research).

### 2. `@sanity/ui` 3.5.3 → 4.4.10 (studio, b2c-admin, cms-activity)

Source: `sanity-io/ui` `MIGRATION.md` "from v3 to v4".
- Runtime: ESM-only, Node ≥22.12, React ≥19.2, styled-components ^6.1, `moduleResolution`
  must be `node16`/`nodenext`/`bundler` (all our tsconfigs are Bundler/NodeNext/Preserve — OK).
- **Stylesheet is not auto-loaded:** add `import '@sanity/ui/styles.css'` where `ThemeProvider` renders.
  Needed in the App SDK apps — `apps/b2c-admin/src/App.tsx:2,32` and `apps/cms-activity/src/App.tsx:2,38`
  — and in the studio plugin that mounts its own provider,
  `apps/studio/plugins/bulk-actions-table/createBulkActionsTable.tsx:18,547` (Studio itself loads it
  since sanity 6.12). Without it `Spinner`/`SrOnly`/text overflow render unstyled.
- **`space` prop removed → `gap`:** 115 sites in studio, 94 in b2c-admin, 19 in cms-activity.
  Heaviest files: `b2c-admin/src/admin/components/OrderDetailView.tsx` (59),
  `studio/tools/comparator/index.tsx` (30), `studio/components/review-author-manager/index.tsx` (17).
- **Grid `columns`/`rows` removed → `gridTemplateColumns`/`gridTemplateRows`:** 23 sites in b2c-admin
  (e.g. `CouponForm.tsx:163`, `CouponsFilters.tsx:47`, `AnalyticsView.tsx:192,249`,
  `DateRangePicker.tsx:112`, `CouponProductPicker.tsx:95`, `OrderDetailView.tsx:247,320,422,…,1449`),
  5 in studio (`tools/newsletter/index.tsx:961,1206`, `components/review-author-manager/index.tsx:665,815`,
  `components/technical-data-table/technical-data-view.tsx:1154`). Most use responsive arrays
  `[1, 1, 2]` — verify the v4 responsive form renders the same breakpoints.
- **Moved to subpath entry points** (`@sanity/ui/toast|popover|tooltip|menu|autocomplete|code|breadcrumbs`):
  - `apps/b2c-admin/src/admin/components/DateRangePicker.tsx:2` — Popover
  - `apps/studio/components/custom-filter-value-input.tsx:2` — Autocomplete
  - `apps/studio/components/custom-filters-config/custom-filters-config-view.tsx:19` — useToast
  - `apps/studio/components/review-author-manager/index.tsx:3` — Autocomplete, useToast
  - `apps/studio/components/technical-data-table/technical-data-view.tsx:28` — useToast
  - `apps/studio/plugins/bulk-actions-table/BulkActionsMenu/index.tsx:8` — Menu, MenuButton, MenuDivider, MenuItem, useToast
  - `apps/studio/plugins/bulk-actions-table/ColumnSelector/index.tsx:2` — Menu, MenuButton, MenuDivider, MenuItem
  - `apps/studio/plugins/bulk-actions-table/ReferenceFilter/index.tsx:2` — Popover
  - `apps/studio/plugins/bulk-actions-table/createBulkActionsTable.tsx:9` — ToastProvider, Tooltip
  - `apps/studio/plugins/bulk-actions-table/table/TableHeadCell.tsx:2` — Tooltip
  - `apps/studio/schemaTypes/documents/singletons/redirects.tsx:1` — Tooltip, useToast
  - `apps/studio/tools/comparator/index.tsx:29` — ToastProvider, useToast
  - `apps/studio/tools/newsletter/index.tsx:24` — ToastProvider, useToast
- Removed hooks/props (`useClickOutside`, `useElementRect`, `useForwardedRef`, `useArrayProp`,
  `ConditionalWrapper`, `boundaryElement`, `focusFirst/Last`, `allowedAutoPlacements`,
  `@sanity/ui/_visual-editing`): **0 hits**. MenuButton top-level popover props → `popover={{…}}`:
  check the two Menu files above.
- Behaviour: closed `Tooltip`/`Popover` content stays mounted (`<Activity>`), so b2c-admin vitest
  tests asserting absence of tooltip/popover text must switch to visibility checks (10 test files in
  b2c-admin; none matched an obvious tooltip assertion, but re-run).
- lsse did exactly this port in `23457993` (35 `space=`→`gap=`, 2 Grid, subpath moves) — use it as
  the worked example.

### 3. `@sanity/icons` 3.8.0 → 5.2.3

- v4: ESM-only, React 19, refs as props (`IconComponent` type changed). v5.1.0 restored React 18 /
  forwardRef — irrelevant for us.
- **v5: root barrel exports removed.** `import {RocketIcon} from '@sanity/icons'` no longer resolves at
  runtime; use `import {RocketIcon} from '@sanity/icons/Rocket'`. Since 5.1 the root entry has
  `never` tombstones naming the subpath, so `check-types` lists every site.
- Audiofast: **61 import statements, 65 distinct icons, all from the root** (43 files studio, 13
  b2c-admin, 5 cms-activity; 0 deep imports). Purely mechanical rewrite (one import per icon).
- Independent of `@sanity/ui` (Najbar runs icons 5 with ui 3), but share the commit to keep one review.

### 4. `@sanity/sdk-react` 2.20.1 → 3.9.1 (b2c-admin, cms-activity)

Source: `sanity-io/sdk` release `sdk-react-v3.0.0` + PR #1048.
- `useProject`, `useProjects`, `useOrganization`, `useOrganizations` now return
  `{data, isFetching, error, refetch}` instead of the value. **Affected:**
  `apps/cms-activity/src/components/usePeople.ts:26` (`project.members` → `project.data.members`).
- `useNavigate`, `useOrganizationId`, dashboard Comlink hooks moved to the dashboard entrypoint;
  `useManageFavorite` split; deprecated user-application stores/hooks and utils removed; React 19.2
  baseline. Our usage is only `SanityApp`, `SanityConfig`, `useAuthToken` (b2c-admin, 6 files),
  `useCurrentUser` (`cms-activity/src/access/AccessGate.tsx:19`), `useClient` (`ReportApp.tsx:78`,
  `usePeople.ts:31`) — none in the removed list; confirm with `check-types`.
- Coupling: `sanity@6.20` depends on `@sanity/sdk-react ^3.9.1`; bumping `sanity` in these two apps
  while they stay on sdk-react 2 leaves two SDK copies (and the odd hoisted
  `groq@3.88.1-typegen-experimental.0` from sdk 2). Move sdk-react 3 together with the UI 4 port.
- b2c-admin previously hit "2.20.0 shipped raw JSX" (`981bc2c`) — run `sanity build` for both apps,
  not just `tsc`.

### 5. `@sanity/client` 7.26.2 → 8.11.0 (web)

Source: `sanity-io/client` v8.0.0 release notes.
- ESM-only, Node ≥22.12 (web runs Node 24 — OK), `exports`-only resolution, no UMD/`typesVersions`.
- Removed: `HttpRequestEvent`/`ResponseEvent`/`ProgressEvent`, `unstable__adapter`/`unstable__environment`,
  `_requestHandler`/`RequestHandler`, `requester`, per-request `proxy`. **0 hits in audiofast**
  (including studio migration scripts).
- Behaviour: `ClientError`/`ServerError` messages now include HTTP status text (we key on
  `statusCode`, `apps/web/src/global/sanity/blog-search.ts:99-101` — unaffected); DNS `ENOTFOUND`
  now retried for idempotent requests; Node observable uploads emit only the terminal event.
- **next-sanity gotcha:** `next-sanity` 13.3.4+/13.4.0 accepts `@sanity/client ^7.28 || ^8.11` as a
  peer but keeps **v7 as its own dependency**. lsse's lock shows `next-sanity/@sanity/client@7.26.2`
  nested beside top-level 8.9.0. Audiofast creates clients from both sources:
  `apps/web/src/global/sanity/client.ts:5` (`createClient` from `next-sanity` → v7) and
  `fetch.ts:3`, `blog-search.ts:3`, `operator-auth.ts:1`, `b2c/admin/server/auth.ts:3`,
  `b2c/checkout/server/cpo-availability.ts:3`, `app/api/revalidate/route.ts:1`,
  `scripts/generate-redirects.ts:10`, `scripts/verify-blog-search.ts:2`, `e2e/cpo-purchase.spec.ts:2`
  (from `@sanity/client` → v8). Decide one source before wiring `defineLive({client})`
  (type mismatch risk between v7 and v8 `SanityClient`).
- `next-sanity` 13.3.4 also stopped re-exporting `unstable__adapter`/`unstable__environment` — unused here.

### 6. `@portabletext/react` 7.0.1 → 8.0.1 (web)

- Node ≥22.12. **Lists now nest to their real `level`**; content that starts deeper than level 1 or
  jumps levels renders differently, and a return to a shallower level continues the list (affects
  `<ol>` numbering). Renderers: `apps/web/src/components/portableText/index.tsx` (+ `CircleNumberedList`).
  Migrated WordPress content (blog/brand) is the likeliest source of odd levels → visual check of a
  few long articles. lsse note: add `li:has(> ul:only-child)` styling only if empty markers appear.

### 7. `next` 16.3.2 → 16.4.3, `react` 19.2.8 → 19.3.1

- 16.4 is additive (blog 2026-10-06): Cache Components recommended for all apps, `ensureStatic`,
  `navigation()`/`prefetch()` from `next/cache`, `experimental.agentUpgrade` (default `'security'`),
  `experimental.agentFeedback`, Rust React Compiler (`experimental.turbopackRustReactCompiler`),
  `turbopackGc`, lazy dynamic imports, smaller CSS-module class names in prod, React 19.3 bundled.
  Removed: `experimental.appNewScrollHandler` (unused). No migration needed for our config.
- Our `apps/web/next.config.ts`: `reactCompiler: true` (babel-plugin-react-compiler 1.0.0),
  `cacheComponents: true`, `partialPrefetching: true` (now officially "part of the model"),
  custom `cacheLife` profiles, `experimental.inlineCss`, `enablePrerenderSourceMaps: false`,
  `trailingSlash`, wrapped by `withBotId`. All still valid on 16.4.
- 16.4 production builds shorten CSS-module class names → any e2e/Playwright selector or test that
  matches generated class names breaks (check `apps/web/e2e`).
- React must stay **byte-identical across all four apps** (lsse rule: a skew makes Bun hoist two
  React copies and Studio stops booting). Web pins `19.2.8` exactly; the other three use `^19.2.8`
  and would float to 19.3.1 on any fresh resolve. `apps/web/vitest.config.ts` also aliases
  `react`/`react-dom` to the root `node_modules`, so a skew silently changes what tests run against.
- `apps/web/package.json` has an `overrides` block for `@types/react(-dom)`; Bun applies
  overrides from the root manifest only — verify it does anything, or move it to root.

### 8. TypeScript 5.9.3 → 6.0.3 (optional) / 7.0.2 (hold)

- **TS 7 blocked:** `typescript-eslint@8.72.0` peer `typescript >=4.8.4 <6.1.0` (Najbar: forcing it
  crashes ESLint with `Cannot read properties of undefined (reading 'Cjs')`). Also: TS 7 drops the JS
  compiler API; Next supports it only via `experimental.useTypeScriptCli` (16.3+). next-sanity 13.4's
  `.groq` query typing needs TS 7.1 + `--runExternalCode` — not reachable yet.
- **TS 6.0.3 is what lsse runs** (`0108b089`). Changes needed here: remove `baseUrl` at
  `apps/web/tsconfig.json:4` (error in TS 6; `paths` resolve relative to tsconfig); `types`
  now defaults to `[]` → add explicit `types` where globals are relied on (web: node; studio has no
  `types` at all; b2c-admin/cms-activity already list them); `noUncheckedSideEffectImports` defaults on
  (web `global.scss`/`leaflet.css` covered by Next decls; App SDK `App.css` covered by `vite/client`).
  msw 3 requires TS ≥5.9 and supports 6/7.

### 9. ESLint 9 → 10 (hold)

- `eslint-plugin-react@7.37.5` peers `^9.7`; `eslint-plugin-import@2.32.0` peers `^9`;
  `@sanity/eslint-config-studio@7` requires `^10`. lsse attempted 10 (`decisions.md` §6): failed at
  `react/display-name` (`contextOrFilename.getFilename()` removed) and fell back to 9.39.5.
  `packages/eslint-config/next.js:26` spreads `pluginReact.configs.flat.recommended` — same blocker.

### 10. vitest 4 → 5, jsdom 29 → 30, msw 2 → 3 (own change)

- vitest 5: Node 22 + Vite ≥6.4; **mocks cleared before each test by default**; `sequential`
  option removed; `loupe.inspect` → pretty-format (snapshot/message diffs); `expect.poll` fails if
  unresolved; deprecated entry points removed. 108 web + 10 b2c-admin test files; several rely on
  manual `mockReset()` (e.g. `blog-search.test.ts:29-31`, `ProductsListing/index.test.tsx:17-18`) —
  harmless, but any test relying on mock call history across tests will change.
- jsdom 30 engines: `^22.22.2 || ^24.15.0 || >=26` — **local Node 25.6.1 is outside the range**.
- msw 3: ESM-only, Node ≥22, cookies no longer managed in Node, `onUnhandledRequest` renamed
  `onUnhandledFrame` → `apps/web/vitest.setup.ts:14` (`server.listen({ onUnhandledRequest: 'error' })`);
  no `setTimeout` patching under fake timers; handlers in `apps/web/src/test/msw/{handlers,server}.ts`.

### 11. Studio dev-script majors (low value)

`csv-parse` 6→7, `node-html-parser` 7→9, `p-limit` 3→7 (ESM-only since 4), `uuid` 11→14, `sharp`
0.34→0.35 — used only by `apps/studio/scripts/migration/**` one-off importers (18 csv-parse sites).
Recommend leaving them or bumping without re-running the migrations; not worth a gate.

## Engines, `turbo.json`, Next config

- Engines today: root `"node": ">=22.12"`, web `"node": "24.x"`. Local Node is **25.6.1**
  (outside web's own `24.x`). `@sanity/client` 8, `@sanity/ui` 4, `sanity` 6, `@portabletext/react` 8,
  msw 3 all need ≥22.12 — satisfied. `@types/node` must track the deployed runtime (24) → take
  24.19.2, not 26 (Najbar and lsse rule). Confirm Vercel project Node = 24 (Najbar could not read
  it from CLI; lsse pins `.nvmrc` 24). No `.nvmrc` in audiofast.
- `packageManager: bun@1.3.2` — both reference repos stay on 1.3.2; Bun 1.4.4 exists but is out of scope.
- `turbo.json`: `$schema` already `turborepo.dev`; turbo 2.11 adds a managed block to `AGENTS.md`
  (lsse `89dc8d1c`) — audiofast has `apps/web/AGENTS.md`, expect a diff. Env allowlist is
  `globalEnv` (strict mode): the Sanity modernization will add vars (e.g. a browser/Viewer token
  for `defineLive`, `SANITY_STUDIO_PREVIEW_URL` for Presentation) — add them there. Studio reads
  `SANITY_STUDIO_PROJECT_ID/DATASET/TITLE`, which are not in `globalEnv` (works today because the
  Sanity CLI loads `.env` itself; a value that only lives in the shell/Vercel env would be filtered).
  `test` task has no `inputs`; `build` outputs include `.sanity/**`.
- Next config flags are covered in §7. React Compiler stays on the Babel plugin unless we opt into
  the Rust compiler (experimental).
- Security note for the defineLive work: `apps/web/src/global/sanity/client.ts:30-33` reads the
  read token from `NEXT_PUBLIC_SANITY_API_READ_TOKEN` (inlined into any client bundle that imports
  it). `defineLive` wants a server-only `serverToken` and a Viewer-scoped `browserToken` (Najbar
  research: without `browserToken`, `<SanityLive includeDrafts>` silently degrades to published in prod).

## Suggested upgrade ordering / batches

Rule from both references: **explicit target versions in package.json + `bun install`**, never
`bun update`/`--latest` (Najbar: `bun update` output is unreliable); one commit per batch; gate each
batch on `bun run typegen` (no unexpected drift), `check-types`, `lint` (0 errors), `test`
(web + b2c-admin vitest), and **full `bun run build`** (the only thing that exercises
`sanity build` for studio, b2c-admin and cms-activity). lsse adds `--force` on the turbo build.

0. **Prereqs.** Clean tree (`apps/web/next-env.d.ts` is modified; `.claude/worktrees/` holds a
   second checkout with its own package.jsons — exclude from greps/format). Record baseline
   lint warning count, test count and build. Confirm Vercel Node 24. Builds need Sanity tokens
   (redirect generation + `verify:build-env`).
1. **Studio data-loss fix (ship alone, first).** `sanity` + `@sanity/vision` 6.20.0, root
   `@sanity/cli` ^8.23.0, `@sanity/assist` 6.2.5, `sanity-plugin-media` 6.5.0,
   `@sanity/orderable-document-list` 2.0.28 (lift pin), `styled-components` 6.6.0, declare
   `@sanity/client` in studio. Keep our `@sanity/ui` 3 / icons 3 for now. `sanity deploy` after merge.
   Smoke: open a long blog article and a product, edit Portable Text, drag an orderable list.
2. **React + web runtime.** react/react-dom 19.3.1 and @types/react(-dom) 19.3.0 in **all four apps
   in one commit**; `next` 16.4.3 + `@next/eslint-plugin-next` 16.4.3; `next-sanity` 13.4.0;
   `@sanity/client` 8.11.0 (decide single `createClient` source); `@portabletext/react` 8.0.1;
   Supabase, zod, sass, lucide-react, react-hook-form, azure, react-email patches. Smoke: PDP,
   blog article with nested lists, cart → checkout (P24 mock), konto-klienta OTP, e2e suite.
   This is the base the defineLive/Presentation work should start from.
3. **Sanity UI 4 + icons 5 + SDK 3 port.** Studio, b2c-admin, cms-activity: `@sanity/ui` ^4.4.10,
   `@sanity/icons` ^5.2.3, `@sanity/sdk-react` ^3.9.1; `styles.css` imports; `space`→`gap`;
   Grid props; subpath imports; icon subpaths; `usePeople.ts:26` `.data`. Gate: `grep -c '"@sanity/ui@3' bun.lock`
   = 0 (lsse gate), `sanity build` for all three, visual pass of b2c-admin Orders/Coupons/Analytics
   and the Raport pracy CMS app (both are operator-facing; layout regressions from Grid props are
   the main risk). Can run in parallel with the Presentation-tool work only if that work does not
   touch Studio components.
4. **Tooling minors.** turbo 2.11.10 + eslint-plugin-turbo, prettier 3.9.10 (expect reformat;
   isolate), typescript-eslint 8.72.0, globals 17.13.0, vite 8.3.5, vitest 4.1.12, testing-library
   patches, @playwright/test 1.64.1 (+ `bunx playwright install`), `@types/node` 24.19.2.
5. **Optional, separate changes:** TypeScript 6.0.3 (§8); test-stack majors vitest 5 + jsdom 30 +
   msw 3 (§10); studio dev-script majors (§11).
6. **Cleanup + docs.** Drop `next-themes`, `@vercel/edge-config` (0 imports; confirm `minimatch`
   intent); write a "held upgrades" note (TS 7, ESLint 10, eslint-config-studio 7, @types/node 26,
   each with its unblock condition) into CLAUDE.md, as Najbar did; fix stale CLAUDE.md lines
   ("Sanity v5 Studio" at `CLAUDE.md:20`, "bump Node heap to 8 GB" at `CLAUDE.md:43` — `981bc2c`
   removed the heap flag).

## Lessons from Najbar / lsse dependency-update changes

- **Najbar `2026-07-27-dependency-updates`** (6 tiered commits, each with full build): explicit
  versions not `bun update`; prettier bump isolated because 3.9 rewrote the Markdown parser and
  reformats files; `eslint-plugin-only-warn` + Next 16 not linting in `next build` means lint churn
  cannot break CI, so the gate is "0 errors" plus watching the warning count *direction*
  (a react-hooks bump that adds zero warnings means the config spread broke); never run an unscoped
  `eslint --fix` after react-hooks v7 (compiler rules have semantic autofixes); `@types/node` follows
  the deployed Node major; write the held-back reasons into CLAUDE.md so nobody re-researches them.
- **lsse `2026-09-04-orderable-lists`** (`23457993`, `0108b089`, `b2758acc`): Studio 6.9.1→6.12 with
  `@sanity/ui` 4 port (35 `space=`→`gap=`, 2 Grid, Code/Menu/Popover/useToast to subpaths; gate:
  no `@sanity/ui@3` left in `bun.lock`); `@sanity/client` 8 was a clean major there too (only
  error-message text changed); TS 6 instead of 7 (drop `baseUrl`, explicit `types`); ESLint 10 tried
  and rolled back in the same commit; react/react-dom/@types byte-identical across apps; builds
  run with dev servers stopped because `bun install` mutates the shared `node_modules`; nothing
  pushed before local `bun run build --force` + manual smoke walk (main deploys production).
- **lsse `89dc8d1c`** ("bump every non-major to latest"): sanity →6.18 for the PT data-loss fix,
  next 16.4.0, react 19.3.0, client 8.9.0, turbo 2.11.7 (AGENTS.md managed block); held TS 7,
  ESLint 10 (+@eslint/js, eslint-config-studio 7), `@types/node` 26. Gates: typegen (no drift),
  check-types, lint, tests, `bun run build --force`.
- lsse `tech-stack.md`: every `sanity` bump re-checks custom Studio UI by hand (they have a
  `@beta` toolMenu wrapper); audiofast's analogue is the vendored `bulk-actions-table` plugin and the
  custom tools (`tools/comparator`, `tools/newsletter`) — the largest `@sanity/ui` consumers.
- Najbar `2026-07-28-live-content-api-adoption`: `defineLive` needs **no** dependency upgrade
  (next-sanity 13.2+ with client 7.25 was enough); under `cacheComponents: true` `strict: true` is
  mandatory and every `sanityFetch` changes return shape to `{data, sourceMap, tags}`; a separate
  Viewer `browserToken` is a hard prerequisite.

## Risks

1. **Production Studio is on a deprecated, data-loss-affected Sanity version right now.** Every week
   on 6.10.1 is exposure; batch 1 should not wait for the larger modernization.
2. React version skew during partial bumps (exact pin in web vs caret elsewhere) → two React copies,
   Studio fails to boot or hooks error at runtime.
3. `@sanity/client` v7 (via `next-sanity`) and v8 (direct) coexisting → `SanityClient` type
   mismatch when passing a client into `defineLive`, and two copies in the server bundle.
4. UI 4 port is wide (≈250 edits over ~60 files) in operator-critical apps (b2c-admin handles
   orders/coupons); Grid responsive-array semantics and `<Activity>`-mounted popovers are the subtle
   parts — needs a visual pass, not just `tsc`.
5. `@portabletext/react` 8 list nesting changes rendered HTML for imported WordPress content.
6. Next 16.4 shortened CSS-module class names in production could break any selector that depends on
   generated names (e2e, analytics, CSS-in-JS overrides).
7. `bun.lock` is monorepo-wide; any in-flight branch touching manifests (e.g. the
   `.claude/worktrees/search-brand-name-*` checkout, or the defineLive change itself) will conflict.
8. Turbo strict env: new Sanity/Presentation env vars silently missing in builds unless added to
   `globalEnv`.

## Open questions

1. Is the deployed Studio (`audiofast.sanity.studio`) on 6.10.1, and have editors reported lost
   Portable Text edits since 2026-08-22 (when `981bc2c` moved to 6.10.1)? Ship batch 1 as a hotfix?
2. Vercel project Node version for `web` — confirm 24 (drives `@types/node`, jsdom 30, `.nvmrc`).
3. Should the Sanity modernization (defineLive + Presentation) start on top of batch 2 (client 8,
   next-sanity 13.4) — recommended — or on current versions (Najbar proved it works on 13.2/7.25)?
4. Single `createClient` source for web: `next-sanity` (v7 internally) or `@sanity/client` 8 directly?
5. Take TypeScript 6 in this "pełna aktualizacja" (lsse did) or keep 5.9.3 until TS 7 is unblocked?
6. Test-stack majors (vitest 5 / jsdom 30 / msw 3): in scope now or a follow-up change?
7. Are `next-themes`, `@vercel/edge-config`, `minimatch` intentionally kept (e.g. planned use or a
   transitive security pin), or can they be dropped?
8. `NEXT_PUBLIC_SANITY_API_READ_TOKEN`: is this token actually reachable from client bundles today,
   and should the defineLive change replace it with a server-only token + separate Viewer token?
