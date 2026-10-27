# 10 — Sanity Functions: denormalization + sync-tag invalidation (retiring `/api/revalidate`)

Scope: replace `apps/web/src/app/api/revalidate/route.ts` (1007 lines) with (a) a Sync Tag Invalidate
Function → new `/api/revalidate-tags/` route and (b) a document Function that maintains product
denormalized fields. Old webhook and new Functions run in parallel during cut-over.
Read-only research, 2026-10-26. Paths are repo-relative unless prefixed `Najbar/` or `lsse/lsse-www/`.

Builds on `04-audiofast-fetch-layer.md` §3.4, §3.5, §7.2, §8, `01-najbar-live-fetching.md`,
`02-lsse-live-fetching.md`, `07-sanity-docs-live-presentation.md` §3.

---

## 0. Key findings (read this first)

1. **Only three denorm fields matter.** Of the six `denorm*` fields, the web reads only `denormBrandSlug`,
   `denormBrandName` and `denormCategorySlugs` (plus `denormParentCategorySlugs[0]` in one projection, but it is
   **always empty**: `productCategoryParent` has no `slug` field in the schema or in the data, so
   `parentCategory->slug.current` is always null). `denormFilterKeys` is never read (also noted in
   `.ai/rendering-revalidation-research-2026-08.md:136`). `denormLastSync` is debug-only.
2. **The live dataset is consistent today.** Measured on the API CDN: 869 published products, 41 brands,
   42 sub-categories, 6 parents. Brand name/slug drift = 0, products with categories but no
   `denormCategorySlugs` = 0. 13 products have the right category **set** in a different **order**. That
   matters, because `denormCategorySlugs[0]` is used as the product's `categorySlug` (`query.ts:1790`); see §1.3.
3. **The webhook's denorm work is fire-and-forget on Vercel** (`route.ts:734-738`: not awaited, no `after()`).
   It can be frozen mid-run. The category path is N+1 (one fetch and one commit per product, `route.ts:970-996`).
4. **`NEXT_REVALIDATE_TOKEN` is both the webhook bearer secret and a Sanity write token**
   (`route.ts:36` vs `:503`; also `.ai/b2c/production-readiness-runbook.md:428`). The cut-over must **revoke that
   Sanity token** in Manage, not only delete the env var.
5. **The production webhook URL has no trailing slash**: `https://audiofast.pl/api/revalidate`
   (from `bunx sanity hooks list`). The site runs `trailingSlash: true` (`apps/web/next.config.ts:72`), and a
   GET to that URL returns **308 → `/api/revalidate/`**. This is the trap lsse documented. Check the webhook's attempt
   log in Manage. If Sanity's deliverer doesn't re-POST the body on 308, the old webhook has been mostly failing
   silently. Whatever that shows, the new Function URL **must** end in `/api/revalidate-tags/`.
6. **The Supabase pricing cache depends on the Sanity webhook.** `fetchProductPricing` caches Supabase data under
   `product-pricing:<slug>` (`apps/web/src/global/supabase/queries.ts:42`). Only `/api/revalidate` ever expires that
   tag (`route.ts:141`), as a side effect of `sync-prices-to-sanity` patching the Sanity product. Sync tags cannot
   cover non-Sanity data, so this needs an explicit replacement (§3.4). If it's missed, PDP prices freeze for up
   to `cacheLife('weeks')`.
7. **The project has 4 webhooks**, not 1 (`bunx sanity hooks list`):
   - `Revalidate Next.js` → `https://audiofast.pl/api/revalidate`, dataset `*`
   - `Embeddings index: blog` → `reindeer.sanity.services` (legacy Embeddings Index)
   - `Vercel Deploy on Redirect Change` → Vercel deploy hook
   - `Revalidate CPO (TEMP)` → `https://audiofast-git-cpo-implementation-kryptonum.vercel.app/api/revalidate`.
     This is a stale preview-branch target; delete it per D5.

   `.ai/product-denormalization-implementation.md:547` records "limit of 4 webhooks, all slots in use".
8. **No Blueprint stack exists yet** (`bunx sanity blueprints stacks --project-id fsw3likv` → "No stacks found").
   Functions entitlement is unverified (§6).
9. **A secret-shaped literal is committed in docs.** `.ai/sanity-price-sync-implementation.md:113` has a
   `SANITY_PROJECT_ID:` line whose value is an `sk…` token-shaped string; the file is tracked in git. If it is a real
   token, rotate it and scrub it. It's the same class of issue as D1.

---

## 1. Denormalization today

### 1.1 Fields (schema `apps/studio/schemaTypes/documents/collections/product.ts:490-548`, all `hidden`+`readOnly`)

| Field | Computed from | Format | Read by web |
|---|---|---|---|
| `denormBrandSlug` | `brand->slug.current`, with `/marki/` and the trailing `/` stripped | `"yamaha"` | listings / filters: `query.ts:1788,1863,1897,1940,1962,1977,1997,2081,2153` |
| `denormBrandName` | `brand->name` | string | `query.ts:1789`; fallback `coalesce(brand->name, denormBrandName)` at `:2723` |
| `denormCategorySlugs` | `categories[]->slug.current`, **full path, not stripped** | `["/kategoria/gramofony/"]` | every listing filter (`query.ts:1782-1792,1858-1862,1893-1916,1936-1997,2076-2079,2142-2145`). `defined(...) && count(...) > 0` **excludes the product from listings** when it is empty |
| `denormParentCategorySlugs` | `categories[]->parentCategory->slug.current` | always `[]` (parents have no slug) | `query.ts:1791` `[0]`, always null |
| `denormFilterKeys` | `customFilterValues[filterName && value]` → `slugify(filterName)+":"+lower(value)` | `["kolor:czarny"]` | **none** |
| `denormLastSync` | `now()` | datetime | none (debug) |

Pure helper: `apps/studio/utils/denormalize-product.ts:34-115` (`computeDenormalizedFields`). `computeFilterKeys`
(`:122-142`) is exported but **unused**. The Phase 4.5 wiring planned in `.ai/product-denormalization-implementation.md:745+`
was never done.

### 1.2 Writers and triggers

| Writer | Trigger | What it does | Notes |
|---|---|---|---|
| Studio publish wrapper `apps/studio/actions/wrap-publish-with-denorm.ts:86-113`, wired via `applyDenormToPublish` (`:139-155`) in `apps/studio/sanity.config.ts:75` | Studio **Publish** on `product` | computes from the **draft**, `patch(drafts.<id>).set(all 6).commit({visibility:'sync'})`, then calls the original publish | The only path that sets `denormFilterKeys`. Fragile: it relies on a ref to the latest `onHandle` after the realtime listener catches up (`:43-47`). On failure it still publishes (`:110-113`). Same wrapper also recounts `reviewAuthor.reviewCount` on review publish (`:60-84`, `setTimeout 800ms`, tx `visibility:'sync'`), unrelated to products. |
| Webhook `updateProductsForBrand` `route.ts:855-918` | any `brand` webhook with `operation !== 'delete'` (`:663-666`); **no check that name/slug changed** | fetch brand → fetch product ids (`brand._ref == $id`, published) → tx of **50** patches setting `denormBrandSlug`, `denormBrandName`, `denormLastSync` → `commit({visibility:'async'})` | Not awaited (`:734-738`). Every patch is a product mutation, which re-fires the webhook (the cascade in `.ai/isr-cost-reduction-strategy-v2.md:11,44-73`). |
| Webhook `updateProductsForCategory` `route.ts:924-1007` | `productCategorySub` webhook, not delete (`:666-667`) | fetch the category → fetch products (`$id in categories[]._ref`) → **per product**: fetch its categories (`*[_id in $ids]`, which **loses ref order**) + a separate `patch().commit({visibility:'async'})` | **N+1**: 2 requests per product, sequential. The largest sub-category has **76** products, so 152 API requests per category publish. Does not touch the brand or filter keys. |
| (none) | `productCategoryParent` edit | no denorm | Harmless today, since parents have no slug. |
| Migration `apps/studio/scripts/migrate-denormalized-fields.ts` (161 lines; `apps/studio/package.json:16-17` `migrate:denormalize[:dry]`) | manual | all published products, `computeDenormalizedFields` per product (2 fetches each), tx per **10**, `visibility:'async'` | Backfill tool. A Function backfill mode can replace it (§3.2). |

Gaps the Function should close:
- Products whose `brand`, `categories` or `customFilterValues` change **without** a Studio Publish get no recompute.
  Today that is `custom-filters-config-view.tsx:434-455`, which writes `customFilterValues` straight onto the
  **published** product (filter keys only, unread, so no visible bug yet). Any future API or migration
  write would hit it too.
- Brand denorm fires on every brand publish, even description-only edits. That means up to 186 product patches
  (the largest brand has 186 products) and 186 webhook re-fires per brand save, unless the dashboard filter excludes
  them; the repo can't verify this, see `04` §3.4.

### 1.3 Ordering subtlety (must preserve)
`denormCategorySlugs[0]` is surfaced as `categorySlug` (`query.ts:1790`). The Studio wrapper and the webhook both
use `*[_id in $ids]{slug}`, which returns documents in index order, not in the product's `categories[]` order. That
is why 13 products have the same set in a different order. The Function should compute in GROQ with
`categories[]->slug.current`, which **preserves array order**. This changes `[0]` for those 13 products, so check
which category the editor intends to be primary.

### 1.4 Related docs
- `.ai/product-denormalization-implementation.md` (1234 lines): original plan. It names fields `_categorySlugs` and similar (renamed
  later); webhook filter `_type in ["product","brand","productCategorySub"]` + projection
  `{_type,_id,operation: delta::operation()}` (`:712-735`); `.ai/ssg-route-restructuring-implementation.md:1545`
  adds `productCategoryParent`.
- `.ai/isr-cost-reduction-strategy.md:205-226` (projection `{_type,_id,"slug":slug.current,"operation":delta::operation()}`),
  `:295-300` (delta filter on user-editable fields).
- `.ai/isr-cost-reduction-strategy-v2.md:52-69`: proposed dashboard filter
  `!(_type=="product" && delta::changedAny("denormLastSync") && !delta::changedAny(<user fields>))`, with a simpler
  fallback keyed on `name`. Whether it was applied is **unknown**: `sanity hooks list` does not print
  filter/projection. Read it in Manage → API → Webhooks before cut-over. The Studio wrapper also sets
  `denormLastSync` on every real publish, so the "simple" variant would also drop real edits that don't touch `name`.

---

## 2. Writers to Sanity outside the Studio publish flow

| Writer | Where | Patches | Denorm must react? |
|---|---|---|---|
| Excel → `pricing-ingest` → `sync-prices-to-sanity` (Supabase Edge Functions) | Office Script `.ai/office-scripts/synchronizacja-cen.ts:796-867` (current; `SyncPricingToSupabase.ts` is older). Edge Function **source is not in the repo** (`supabase/` has only `migrations/`). Docs: `.ai/sanity-price-sync-implementation.md`, `.ai/excel-web-pricing-pipeline-v2.md:495-600` | `product.basePriceCents`, `lastPricingSync`, `relatedProducts` (refs from P1–P10), and per the script output "ceny/flagi" presumably `isSellableOnline`/`isReturnable` (`synchronizacja-cen.ts:7-16,818-867`). Writes the **published** doc directly, probably one `patch` per product (`excel-web-pricing-pipeline-v2.md:591-594`) | **No** for denorm (no brand/categories/filters). **Yes for invalidation**: up to ~869 product mutations per run, each firing the webhook today, which is also the only thing expiring `product-pricing:<slug>` (finding 6). |
| Excel → `cpo-product-sync` (Supabase Edge Function) | `.ai/office-scripts/SyncCpoToSupabase.ts:130`, chained from `pricing-ingest`; plan `.ai/cpo-phase-2-excel-sync-implementation-plan.md:423-710` | `cpoProduct` `createIfNotExists`+`patch` (name, brandName, priceCents, shortDescription, `internalProduct` ref, flags), `isArchived` archive/unarchive, some created as drafts | No denorm (cpoProduct has none). The plan's "Option A" (`:890-908`) has the Edge Function POST `{tags:['cpoProduct','cpoPage']}` to `/api/revalidate` with `NEXT_REVALIDATE_TOKEN`. **Check whether it was implemented** (download the function source: `supabase functions download cpo-product-sync`). If it was, deleting the route breaks it. |
| B2C checkout `apps/web/src/global/b2c/checkout/server/cpo-availability.ts` | `reserveCpoItemsForOrder` (`:307-377`), `releaseExpiredCpoHoldBySlug` (`:271-305`), `releaseCpoReservationsForOrder` (`:380+`), `markCpoItemsSoldForOrder` (`:438-496`); write client `SANITY_API_WRITE_TOKEN` (`:87-113`). Callers: `app/actions/checkout-submit.ts`, `global/b2c/checkout/server/{submit-checkout,payment-update}.ts`, `global/b2c/cart/server/revalidation.ts:130` (via server action `app/actions/cart-revalidation.ts`) | `cpoProduct.availabilityStatus`, `hold*`, `soldOrderNumber`, `availabilityUpdatedAt` (with `ifRevisionId`) | No denorm. See §4 for invalidation. |
| Studio custom-filter tools (not document actions) | `apps/studio/components/custom-filters-config/custom-filters-config-view.tsx:353-455` (published + draft), `product-filters-view/product-filters-view.tsx:191-208` (draft only), category `customFilters` `:145-176` | `product.customFilterValues`; `productCategorySub.customFilters` | Only `denormFilterKeys`, which is unread. The Function covers it for free if the filter includes `customFilterValues` (§3.2). |
| Review author manager `apps/studio/components/review-author-manager/index.tsx:201` + wrapper `:60-84` | Studio | `reviewAuthor.reviewCount` | Not product denorm. Could become a second document Function later (out of scope). |
| App SDK apps `apps/b2c-admin`, `apps/cms-activity` | | none found (no `patch`/`applyDocumentActions`; b2c-admin "mutations" are Supabase API calls) | — |
| Other web code | only `revalidate/route.ts` and `cpo-availability.ts` construct a writing client (`grep createClient`) | — | — |

Conclusion: **only Studio edits (brand, sub-category, product brand/categories/filter values) drive denorm.**
The automated writers drive invalidation volume, not denorm.

---

## 3. Function design

### 3.1 Blueprint (repo root `sanity.blueprint.ts`, next to `bun.lock`)

Copy the Najbar/lsse shape. Project `fsw3likv`, dataset `production`. Pin the dataset; the old webhook uses
`Dataset: *`, so it also fires for any other dataset.

```ts
const DATASET = { type: 'dataset', id: 'fsw3likv.production' } as const;
export default defineBlueprint({ resources: [
  defineSyncTagInvalidateFunction({ name: 'invalidate-sync-tags', src: './apps/functions/invalidate-sync-tags', event: { resource: DATASET } }),
  defineDocumentFunction({
    name: 'denormalize-products', src: './apps/functions/denormalize-products', timeout: 60,
    event: {
      on: ['create', 'update'],            // published docs only (includeDrafts defaults false); covers Studio publish AND API writes
      filter: DENORM_FILTER,               // below
      projection: '{_id, _type, _rev}',    // handler re-reads; keep payload tiny
      resource: DATASET,
    },
  }),
]});
```

Event names available in `@sanity/blueprints` (`lsse/lsse-www/node_modules/@sanity/blueprints/src/types/functions/event.ts:119`):
`'publish' | 'create' | 'delete' | 'update'` (default `['publish']`); options `includeDrafts`, `includeAllVersions`.
Najbar/lsse use `on:['publish']` for Studio-only reactions and `create/update/delete` when API writes must count.
Here API writes (custom-filters view) must count, so use `create`+`update`. **[verify]** with `functions dev` that a
Studio publish is delivered as `update` on the published id.

### 3.2 `denormalize-products` (document Function)

**Filter (loop guard #1, fire only on inputs).** lsse records that delta functions don't deep-compare
objects (`lsse/lsse-www/sanity.blueprint.ts:120-127`), so compare **primitives** built with `before()`/`after()`:

```groq
(_type == "product" && (
   before().brand._ref != after().brand._ref
   || array::join(coalesce(before().categories[]._ref, []), ",") != array::join(coalesce(after().categories[]._ref, []), ",")
   || array::join(coalesce(before().customFilterValues[defined(value)].value, []), "|") != array::join(coalesce(after().customFilterValues[defined(value)].value, []), "|")
   || array::join(coalesce(before().customFilterValues[defined(value)].filterName, []), "|") != array::join(coalesce(after().customFilterValues[defined(value)].filterName, []), "|")
   || !defined(after().denormCategorySlugs)                     // first publish / API-created product
))
|| (_type == "brand" && (before().name != after().name || before().slug.current != after().slug.current))
|| (_type == "productCategorySub" && before().slug.current != after().slug.current)
```

- The Function's own writes only touch `denorm*`. None of the compared inputs change, so its patches **cannot
  re-trigger it**. Price-sync, CPO and availability patches don't match either, so there are zero invocations for the
  ~869-mutation Excel runs.
- On `create`, `before()` is null and every comparison is true; that is fine (a new brand has no products).
- `productCategorySub.parentCategory` and `productCategoryParent` are omitted while parents have no slug. If parents ever
  gain slugs, add them and resolve products via sub-categories.
- **[verify]** with `bunx sanity functions test denormalize-products --file <event.json>` and `functions dev` that
  `array::join` with `before()` works in Function filters. Fallback: filter by `_type` only and rely on guard #2
  (~1 read per product mutation, which costs extra API requests on price-sync runs).
- `@sanity/functions` 1.8.1 also carries a lineage token with `MAX_RECURSION_COUNT = 16`
  (`~/.bun/install/cache/@sanity/functions@1.8.1*/dist/invoke.d.ts:4`). Don't rely on it; it is a backstop at most.

**Handler (loop guard #2 = idempotent diff):**
1. `client = createClient({...context.clientOptions, apiVersion: '<pinned>', useCdn: false, perspective: 'published'})`.
   The token is minted by the Blueprint deploy; never create one by hand (`lsse/lsse-www/apps/functions/auto-redirect/index.ts:35-36`).
2. Resolve the affected products in **one** query, with denorm inputs dereferenced in GROQ (this fixes the N+1 and the
   ordering issue):
   ```groq
   *[_type == "product" && !(_id in path("drafts.**")) && (
       _id == $id || brand._ref == $id || $id in categories[]._ref )]{
     _id, _rev,
     "brandSlug": brand->slug.current, "brandName": brand->name,
     "categorySlugs": categories[]->slug.current,
     "parentSlugs": categories[]->parentCategory->slug.current,
     customFilterValues[]{filterName, value},
     denormBrandSlug, denormBrandName, denormCategorySlugs, denormParentCategorySlugs, denormFilterKeys }
   ```
3. Compute with a shared pure function, a **copy** of `apps/studio/utils/denormalize-product.ts` minus I/O, because
   Function bundles can't import workspace packages; same reason as lsse's duplicated `API_VERSION`
   (`auto-redirect/index.ts:39-42`). Strip `/marki/`; keep category slugs as full paths; `filter(Boolean)`; slugify filter
   keys exactly as today. Add a parity unit test against the Studio helper.
4. **Diff** the computed fields against the stored ones, ignoring `denormLastSync`. Skip unchanged products. Set
   `denormLastSync` only on products that are actually patched.
5. Patch in transactions of **≤100** mutations (the webhook used 50; that is fine too) with `ifRevisionId(_rev)`. On 409,
   re-read that product and retry up to 3 times (pattern: `lsse/lsse-www/apps/functions/record-first-publication/index.ts:21-46`).
   Use `commit({visibility: 'async'})` for brand/category fan-out. Worst case today: 186 products, so 2 transactions.
6. `if (context.local) { log plan; return; }` before any mutation (`auto-redirect/index.ts:225-238`). Throw on failure
   so it shows in `sanity functions logs denormalize-products`.
7. Idempotent by construction: a redelivery recomputes the same values, diffs to zero and writes nothing.

**Interaction with sync tags (expected second wave).** Brand rename → sync-tag event #1 (queries reading the brand
doc). The Function's product patches → sync-tag event #2 (listing queries reading `denormBrandName`). Both use `'max'`,
both are needed, and both are cheap. Between them there is a window of a few seconds where listings show the old brand name.

**Studio wrapper.** Keep it during the parallel run: it gives zero-lag denorm on product publish, and the Function then
diffs to zero. Remove it after cut-over (D3 "denormalization relocation"). That also removes the fragile
`onHandle`-ref dance. The trade-off: a brand-new product has empty `denormCategorySlugs` for the seconds until
the Function lands, so it is absent from listings in that window and appears on the next sync-tag wave. The
`reviewCount` half of the wrapper stays in Studio, or moves to its own Function later.

**Backfill.** Add a `--all` path, a small script reusing the same pure function, or keep
`migrate:denormalize` after fixing its ordering. Run it once at cut-over to normalize the 13 mis-ordered products.

### 3.3 `invalidate-sync-tags` Function + `/api/revalidate-tags/` route (port of lsse)

**Reference inventory**

| File | Najbar | lsse-www |
|---|---|---|
| `sanity.blueprint.ts` | 75 lines, 3 resources | 143 lines, 4 resources, `DATASET` const |
| `.sanity/blueprint.config.json` (committed; `projectId`, `stackId`, `runtimeCliVersion`) | `ST-rzhgyqi3a8` | `ST-kq6sdqv8xr` |
| `apps/functions/package.json` (workspace: `check-types`, lint) | 18 (`@sanity/client` 7.25.0, `@sanity/functions` ^1.4.0) | 21 (`@sanity/client` 8.9.0, `@sanity/functions` 1.8.1) |
| `apps/functions/tsconfig.json` | 7 | 13 |
| `apps/functions/eslint.config.mjs` | — | 34 |
| `apps/functions/.env.example` (documents only) | — | 71 |
| `invalidate-sync-tags/index.ts` + own `package.json` | 66 + 10 | 97 + 10 (pins only `@sanity/functions` 1.7.1) |
| `auto-redirect/{index,urls}.ts` | 241 + 62 | 278 + 204 (+ `locales.ts` 116, `urls.test.ts` 72) |
| `sync-bulk-redirects/index.ts` | 183 | 233 |
| `record-first-publication/{index,record,record.test}.ts` | — | 49 + 31 + 49 |
| `apps/web/src/app/api/revalidate-tags/route.ts` | 88, `{expire: 0}`, no warm, **no test** | 190, `'max'` + `after()` warm, `route.test.ts` 273 lines |
| `.gitignore` | `.build`, `/.sanity/*`, `!/.sanity/blueprint.config.json` | same |
| deploy script (root `package.json`) | `"blueprints:deploy": "bunx sanity blueprints deploy"` | same; `@sanity/blueprints` 0.28.0 devDep |

**Function** (`lsse/lsse-www/apps/functions/invalidate-sync-tags/index.ts:37-97`): `syncTagInvalidateEventHandler`;
throw if `event.data?.syncTags` is not an array (`sanity functions test` delivers **no payload**); throw if env is missing
(name both variables); `fetch(${REVALIDATE_ENDPOINT_URL}?secret=…, POST {tags})`; throw on non-2xx; then `await done(syncTags)` in a
try/catch that **only logs**, because the invalidation already happened. `done()` matters only for `<SanityLive waitFor="function">`
(07 §3). audiofast mounts SanityLive draft-only, but keep `done()`.

**Route** (`lsse/lsse-www/apps/web/src/app/api/revalidate-tags/route.ts`):
- Auth: `?secret=` compared with `timingSafeEqual` after a length check (`:115-131`); the secret is a required env-schema
  entry. For audiofast, consider an `Authorization: Bearer` header instead: query strings land in Vercel request logs. This is a
  one-line change on each side; keep `timingSafeEqual` either way.
- Body `{tags: string[]}`, 400 otherwise; storm cap `MAX_TAGS = 1000` (`:48,152-160`).
- `revalidateTag(\`sanity:${tag}\`, 'max')` for each tag (`:162-164`). The payload is **unprefixed**, and a wrong prefix expires nothing
  while still answering 200. lsse moved from `{expire:0}` to `'max'` after measuring 2.5–3.2 s cold TTFBs (`:19-31`). Najbar
  still uses `{expire:0}` (`Najbar/.../route.ts:12-15,71`).
- Warm (`:88-113,173`): `after(warmLocaleHomepages(origin))`, using a browser UA (not on `htmlLimitedBots`), `cache:'no-store'`,
  a 5 s timeout, and draining the body. Skip it when `tags.length === 0`. For audiofast, warm `/` and `/produkty/` (the listing shell holds
  `filter-metadata`). **Add a per-instance throttle** (e.g. ≥30 s between warms): price-sync runs produce bursts of
  invalidations, and lsse never had that traffic shape.
- 500 on any exception, so the Function throws and the failure is logged (`:180-189`).
- Tests to port (`route.test.ts`): `'max'` profile and `sanity:` prefix; profile is a string; response shape; warm URLs on
  the request origin; browser UA; response before warm settles; failing warm keeps 200; empty batch warms nothing; wrong
  secret / malformed body / over-cap → no revalidate, no warm.

**Function quirks both repos hit**
- The **trailing slash** in `REVALIDATE_ENDPOINT_URL` is load-bearing (`lsse/lsse-www/apps/functions/.env.example:21-26`). It
  applies to audiofast too (finding 5).
- Each function directory has its **own `package.json`**. Bundles resolve deps from there, never from the workspace.
  `invalidate-sync-tags` needs only `@sanity/functions`; `denormalize-products` needs `@sanity/client` + `@sanity/functions`,
  pinned to the same `@sanity/client` major as web after D2 (8.x).
- Env is **imperative per function**: `bunx sanity functions env add invalidate-sync-tags REVALIDATE_ENDPOINT_URL https://audiofast.pl/api/revalidate-tags/`
  and `… SANITY_REVALIDATE_TAGS_SECRET <value>`. Changes apply to the next invocation, no redeploy
  (`.env.example:8-12`). The value must be byte-identical to Vercel `SANITY_REVALIDATE_TAGS_SECRET`; a mismatch shows only as
  401 in `sanity functions logs`. (`@sanity/blueprints` also supports a declarative `env` field per resource,
  `Najbar/context/archive/2026-07-29-validated-env/research.md:216`; unused.) The denorm Function needs **no env**: it uses
  `context.clientOptions`.
- `sanity functions test <name> --data '{"syncTags":["s1:x"]}'` / `--file <event.json>` for local runs; guard mutations with `context.local`.
- One sync-tag function per dataset (07 §3: more than one causes races or extra usage).
- Retry-on-throw semantics are undocumented, so idempotency is the safety mechanism in both handlers.
- `.build/` output is created next to each function, so gitignore it.
- Add `SANITY_REVALIDATE_TAGS_SECRET` to `turbo.json` `globalEnv` and the web env schema (lsse: `turbo.json:11`).

**Deploy and auth.** `bunx sanity blueprints init` (once; creates the remote **Stack** and writes `.sanity/blueprint.config.json`)
→ `bunx sanity blueprints plan` → `bunx sanity blueprints deploy` from the repo root (Najbar: `context/archive/2026-07-29-slug-overhaul/plan.md:127,435`).
Then `functions env add`, then `functions logs <name>`. Manual, not in CI (`lsse/lsse-www/sanity.blueprint.ts:13-16`); CI would use
`blueprints mint-deploy-token`. The CLI here is `@sanity/cli` 8.2.1 and is logged in. **[verify]** the role needed to
init/deploy a stack and mint the function robot token (expect project Administrator). Oliwier runs init/deploy/env (D1
working mode: credentials and approvals are his).

### 3.4 `product-pricing` (Supabase) invalidation: pick one
Sync tags never cover `fetchProductPricing` (`apps/web/src/global/supabase/queries.ts:36-60`, `cacheLife('weeks')`).
- **A (recommended):** `pricing-ingest` (Supabase) POSTs once per run to a small **custom-tag** branch of the new route,
  e.g. `{customTags:['product-pricing']}` → `revalidateTag('product-pricing','max')`, with an allowlist of non-Sanity
  prefixes (`product-pricing`, `product-pricing:`). The trigger is the actual source of truth, there is 1 call per run, and it is
  independent of whether Sanity got patched. It needs the Edge Function source and a redeploy.
- **B:** a second document Function on `_type=="product" && before().lastPricingSync != after().lastPricingSync`
  that POSTs `product-pricing:<slug>`. No Supabase change, but it costs ~869 invocations plus 869 Vercel calls per Excel run, and it
  misses option-only changes if the Sanity patch is skipped.
- Either way, the old webhook keeps doing it during the parallel run. This must ship **before** the old webhook is
  deleted.

### 3.5 Cost, order of magnitude
- Sanity Growth (07 §2): Functions **500k invocations/org/mo** (+$1/1M), 20k GB-s; requests made *from* a Function
  **count** toward API quota (250k API requests/mo).
- Sync-tag Function: one invocation per invalidation batch. Editorial volume is ~600 webhook events/mo
  (`.ai/isr-cost-reduction-strategy.md:198`), plus Excel runs (≤869 product mutations each; Sanity may batch the
  invalidations). Expect **10³–10⁴ invocations/mo, under 2% of quota**, and zero Sanity API requests (it only POSTs to Vercel).
- Denorm Function: fires only on brand/sub-category/product-input edits, so tens to hundreds per month. Each invocation does 1 read
  plus 0–2 transactions, so **under 1k API requests/mo**, versus today's webhook: 1–3 live-API lookups on **every** event
  (`getProductBrandTag`, `getReferencingDocumentTags`, …; 04 §3.4) plus the N+1 category path.
- Vercel: one `/api/revalidate-tags/` invocation per sync-tag event, plus throttled warm requests. With `'max'` there is no regeneration
  until a visit, so ISR writes move from webhook-fan-out-driven to visit-driven.

---

## 4. CPO availability invalidation (`apps/web/src/global/b2c/checkout/server/cpo-availability.ts:231-251`)

Today `invalidateCpoAvailabilityCache` does `revalidateTag('cpoProduct',{expire:0})` + `revalidatePath('/certyfikowany-sprzet-uzywany/')` +
`revalidatePath(slug)` + `revalidateTag('cpoProduct:<slug>',{expire:0})` on every reserve, release or sale (`:254-266,377,408-412,491-493`).

- `availabilityStatus` is read **only** by the detail query `queryCpoProductBySlug` (`query.ts:1235-1245`). The detail page uses
  it at `certyfikowany-sprzet-uzywany/[slug]/page.tsx:142`. Listing fragments (`cpoProductFragment` `query.ts:406-421`, filter
  `:1133-1146`) don't read it. The broad `cpoProduct` expire:0 and the listing `revalidatePath` therefore make **every** CPO
  listing/detail/sitemap entry render blocking, for no visible change.
- **Narrow to** `revalidateTag('cpoProduct:'+productSlug, {expire: 0})` (+ keep `revalidatePath(slug)` only if the detail page
  is not fully tag-covered). `expire:0` is right here: it's read-your-writes for the buyer's next view, and there is a single page.
- **Coexistence with defineLive:** keep passing the custom tag through `sanityFetch({..., tags: ['cpoProduct:'+slug]})`
  on the detail call sites (`certyfikowany-sprzet-uzywany/[slug]/page.tsx:90,117`). The local `revalidateTag` runs in the same
  request (route handler / server action contexts are fine: `cart-revalidation.ts` is a server action, `payment/status` a route).
  The sync-tag Function then fires a few seconds later with `'max'`; double expiry is harmless.
- Cart and checkout correctness reads stay on `sanityFetchFresh` (04 §8). Never move `availabilityStatus` reads to CDN.

---

## 5. Tags during the parallel run, and the cut-over checklist

### 5.1 Hand tags at call sites (must keep working while both channels run)
From `grep tags:|cacheTag(|revalidateTag(` in `apps/web/src` (excluding the old route):
- Sanity data: `settings` (layout:36, seo:109, product/blog/cpo pages, koszyk, contact:383, CookieConsent, ContactMap,
  transactional email:21), `homePage` (page:12, seo:115), `navbar`, `footer`, `notFound`, `termsAndConditions`, `privacyPolicy`,
  `products` + `filter-metadata` (listing pages + `cacheTag` at `produkty/(listing)/page.tsx:51`, `kategoria/[category]/page.tsx:88,100`,
  `marki/[slug]/page.tsx:88`, `components/products/ProductsListing:159,194`, `pageBuilder/ProductsListing:38-43`),
  `productCategorySub`, `brands`, `brand` + `brand:<slug>` (`marki/[slug]/page.tsx:64-105`), `brand-stores` +
  `brand-stores:<brandId>` (`produkty/[slug]/page.tsx:82`), `product` + `product:<slug>` (`produkty/[slug]/page.tsx:61,89,110`,
  `actions/product-quick-add.ts:85`, `actions/comparison.ts:42`, `produkty/archiwalne:19`, `pliki/[pdfKey]:24`), `blog`,
  `blog-category`, `blog-article` + `blog-article:<slug>`, `review` + `review:<slug>`, `page` + `page:<slug>`, `cpoPage`,
  `cpoProduct` + `cpoProduct:<slug>` (`CpoProductsListing:46-75`, `[slug]/page.tsx:65-117`), `mailchimp-settings`
  (`global/mailchimp/subscribe.ts:48`, never emitted, see 04 §3.5), and the sitemap tags (`sitemap.ts:34-64`).
- **Non-Sanity (sync tags will never cover them):** `product-pricing`, `product-pricing:<slug>` (Supabase, §3.4); `geocode`
  (`StoreLocations/index.tsx:63`, Nominatim, never invalidated by design).
- Path invalidations: CPO safety net `route.ts:590-600`; `cpo-availability.ts`; account actions (`revalidatePath` in
  `customer-*`, unrelated to Sanity).

Parallel-run rule (04 §7.2, `.ai/rendering-revalidation-research-2026-08.md:544-551`): defineLive's `sanityFetch` receives the
**existing `tags` arrays unchanged** alongside its sync tags, so `/api/revalidate` keeps working. Outer `cacheTag()` calls stay
until cut-over. After cut-over, keep only `product-pricing*`, `cpoProduct:<slug>` and `geocode`. Every other hand tag and outer
`cacheTag()` is deleted; `BRAND_STORES_TAG`/`getBrandStoresTag` (`global/products/brand-stores.ts:1-19`) go with them.

### 5.2 Sequenced checklist
1. **Prereqs:** verify the plan and Functions entitlement (§6); read the current webhook filter, projection and attempt log in
   Manage (finding 5); download `pricing-ingest`, `sync-prices-to-sanity` and `cpo-product-sync` sources and grep for `/api/revalidate`.
2. Add `apps/functions/` (workspace is auto-included by `"workspaces": ["apps/*"]`), the root `sanity.blueprint.ts`, `@sanity/blueprints`,
   the `blueprints:deploy` script, and `.gitignore` entries (`.build`, `/.sanity/*`, `!/.sanity/blueprint.config.json`).
3. Ship `denormalize-products` first; it doesn't depend on defineLive. Deploy, test with `functions test`, then check one real brand
   edit in `functions logs`. Then **remove the denorm block from the webhook** (`route.ts:547-548,658-669,732-738,847-1007`)
   so the two writers don't race and the cascade stops. Run the backfill once.
4. Ship `/api/revalidate-tags/` + `SANITY_REVALIDATE_TAGS_SECRET` (Vercel, `turbo.json`), deploy web, then deploy the sync-tag
   Function and its env. This only matters once defineLive's `sanityFetch` emits `sanity:` tags; before that it is a harmless no-op.
5. Ship the `product-pricing` replacement (§3.4) and the CPO narrowing (§4).
6. **Verify gates** (`.ai/rendering-revalidation-research-2026-08.md:553-561`): publish → fresh, twice; publish with zero tabs open →
   next visit fresh; `functions logs invalidate-sync-tags` shows sane tag counts; an Excel price run updates PDP prices; a CPO
   reserve or sell flips the detail page immediately.
7. **Delete:**
   - Sanity webhooks `Revalidate Next.js` and `Revalidate CPO (TEMP)` (Manage → API → Webhooks). Keep `Embeddings index: blog`
     (separate decision) and `Vercel Deploy on Redirect Change`. The hooks list then shows 2 entries, not 0.
   - Files: `apps/web/src/app/api/revalidate/route.ts` and `route.test.ts` (207 lines). Fix the comment references in
     `global/products/brand-stores.ts:4` and `global/sanity/query.ts:2407`.
   - The Studio denorm wrapper's product branch (`wrap-publish-with-denorm.ts:86-113`), after the Function has run for a while.
   - Env: `NEXT_REVALIDATE_TOKEN` (Vercel, `turbo.json:16`, `apps/web/.env.example:19`, `.env.e2e.example:19`), and
     **revoke the Sanity API token it holds**. Also `SANITY_WEBHOOK_SECRET` (`turbo.json:23`): it is **not read anywhere in code**,
     only in `CODEBASE_OVERVIEW.md:581` and `.ai/caching-revalidation-plan.md`.
   - Keep `SANITY_API_WRITE_TOKEN` (CPO checkout).
   - Docs: update `CODEBASE_OVERVIEW.md` "Caching & Revalidation" and env table, and `.ai/b2c/production-readiness-runbook.md:34,400-430,740`.
8. Rollback: redeploy the old route, recreate the webhook (keep its filter and projection text from step 1), restore the token.
   Blueprint resources are removed by deleting them from the file and running `blueprints deploy` again.

---

## 6. Plan and CLI status (read-only probes, 2026-10-26)
- `bunx sanity --version` → `@sanity/cli/8.2.1`; logged in (`~/.config/sanity/config.json` holds a token).
- `bunx sanity projects list` → `fsw3likv  audiofast  12 members` (also Najbar `81ryxohl` and ŁSSE `kzwa1yid`, both with stacks).
- `bunx sanity blueprints stacks --project-id fsw3likv` → **No stacks found**.
- `bunx sanity hooks list` → the 4 hooks in finding 7. No CLI read shows filter or projection.
- Plan tier: **not stated anywhere in the repo**. The only hint is "limit of 4 webhooks, all slots in use"
  (`.ai/product-denormalization-implementation.md:547`), which matches a paid tier (inference, not proof). Najbar
  documented Functions as entitled on Growth (`Najbar/context/archive/2026-07-27-sanity-gold-standard/research.md:9,106`).
  **Prerequisite:** confirm in Manage → `fsw3likv` → Plan/Usage before `blueprints init`. Init or deploy will also fail
  loudly if the project isn't entitled.
- Read-only CDN queries were used for the dataset numbers in §0 and §1 (counts and drift only).

## 7. Open items to verify
1. Webhook filter, projection and **delivery status** (the 308 from the slashless URL).
2. Supabase Edge Function sources: do they call `/api/revalidate`? Does `sync-prices-to-sanity` patch unchanged rows? Which flags does it set?
3. GROQ `before()/after()` + `array::join` in a Function filter (fall back to a `_type` filter plus the handler diff if not).
4. The event name a Studio publish arrives as (`update` vs `publish`) when `on: ['create','update']`.
5. The role required for `blueprints init/deploy` on `fsw3likv`.
6. Primary-category intent for the 13 re-ordered products before the backfill rewrites `denormCategorySlugs[0]`.
7. Whether the `.ai/sanity-price-sync-implementation.md:113` literal is a live token.
