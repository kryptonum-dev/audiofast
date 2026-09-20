---
date: 2026-09-20T07:08:52+02:00
researcher: Codex
git_commit: 39f135155b56f17212e85fe73669f31d84515366
branch: main
repository: audiofast
topic: Sanity dataset embeddings migration — projection-design
tags: [research, sanity, embeddings, search]
status: complete
last_updated: 2026-09-20
last_updated_by: Codex
last_updated_note: Added follow-up research for confirmed decisions and live Sanity inspection
---

# Projection design and reference inventory

## Evidence before design

The live index configuration is now captured in [legacy-indexes.snapshot.json](legacy-indexes.snapshot.json). Historical examples at [.ai/embeddings-search-implementation-plan.md:74](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/.ai/embeddings-search-implementation-plan.md#L74) use the wrong blog document type and obsolete field names. Use the exported settings rather than those historical examples.

| Content | Current local fields | References / complexity |
| --- | --- | --- |
| Blog article | name, title, description, content, keywords, seo | Category, internal author, featured products; custom Portable Text and page builder |
| Product | name, subtitle, shortDescription, details, denormBrandName | Brand, categories, reviews, related products; two detail-content formats |

Blog evidence: [apps/studio/schemaTypes/documents/collections/blog-article.ts:27](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/schemaTypes/documents/collections/blog-article.ts#L27), [apps/studio/schemaTypes/documents/collections/blog-article.ts:103](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/schemaTypes/documents/collections/blog-article.ts#L103), [apps/studio/schemaTypes/documents/collections/blog-article.ts:181](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/schemaTypes/documents/collections/blog-article.ts#L181). Product evidence: [apps/studio/schemaTypes/documents/collections/product.ts:115](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/schemaTypes/documents/collections/product.ts#L115) and [apps/studio/schemaTypes/documents/collections/product.ts:142](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/schemaTypes/documents/collections/product.ts#L142).

## Proposed starting projection

This compact sketch preserves effective old text inputs. It is not applied or service-validated; adding body text or corrected SEO is a separately measured quality variant:

```groq
{
  _type == "blog-article" => {
    name,
    title,
    description,
    keywords
  }
}
```

Inspect representative documents before selecting full content: custom blocks may add noise or contain meaningful text absent from normal text extraction. Compare title/summary-only and body-inclusive variants using real queries. Do not silently discard custom block text with an assumed Portable Text conversion.

Add product fields only if an identified consumer needs them. A future product branch could include name, subtitle, shortDescription and denormBrandName; include detail bodies only after inspecting both current `details.productDetailContent` and legacy `details.content`.

## Reference handling

Dataset embedding projections cannot follow references, although ordinary GROQ query filters/projections still can. See [Dataset Embeddings](https://www.sanity.io/docs/content-lake/dataset-embeddings). Thus category filtering through `category->slug.current` can remain, while embedding category names requires local materialized text.

[apps/studio/utils/denormalize-product.ts:55](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/utils/denormalize-product.ts#L55) already materializes brand name. Category denormalizations are slugs, not names. Blog has no analogous category/author materialization. The publish wrapper can continue publishing after a denormalization failure; using those fields for semantic coverage requires an audit/backfill strategy.

Do not introduce new denormalized fields merely because references exist. First establish that the deployed projection used those values and that their removal harms accepted queries. If needed, include backfill and updates after reference edits, not just article/product publication.

## Exclusions and safeguards

Exclude asset IDs, operational timestamps, prices and unrelated document types from a minimal search representation. Preserve visibility checks in queries. `doNotIndex` means search-engine indexing, whereas `hideFromList` controls listing eligibility: [apps/studio/schemaTypes/shared/seo.ts:77](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/schemaTypes/shared/seo.ts#L77) and [apps/studio/schemaTypes/shared/seo.ts:92](https://github.com/kryptonum-dev/audiofast/blob/39f135155b56f17212e85fe73669f31d84515366/apps/studio/schemaTypes/shared/seo.ts#L92). Do not exchange them.

Keep this projection in reviewed infrastructure configuration once validated. Export existing dataset settings first to avoid overwriting another consumer's representation.

## Follow-up Research 2026-09-20T07:22:15+02:00

Both exported legacy projections have no reference dereference. No reference materialization/backfill is required for parity. Blog currently embeds name/title/description plus empty keywords and empty obsolete SEO aliases. Prefer compact effective parity first; corrected seo.title/seo.description and body inclusion are deliberate variants to compare. All 25 published articles have body content; 0 have old SEO fields, 25 have current SEO title, 15 current SEO description, and 0 have nonempty keywords.

See [live verification](live-verification.md), [index snapshot](legacy-indexes.snapshot.json), and [query baseline](legacy-query-baseline.md). This follow-up supersedes earlier statements that live configuration or readiness had not been inspected.
