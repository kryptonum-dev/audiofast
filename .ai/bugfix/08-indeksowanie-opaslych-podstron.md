# 08. Problem z indeksowaniem "opaslych podstron"

## Client context (mail)

> "Google widzi za duzo podstron przez menu glowne... menu powinno byc widoczne dla robota tylko na stronie glownej."

## Root diagnosis

## Important SEO clarification

- Hiding main menu links from crawlers on subpages is generally **not** recommended.
- Site-wide navigation links are normal and useful for crawl discoverability + UX.
- So requested "menu only indexable on homepage" is not a best-practice target.

## What is likely really causing concern

1. **Perceived link overload** from filters/listings.
2. **Potential crawl waste on faceted/filter URLs** (query parameters).
3. **Scanner warnings** interpreted as "menu problem".

## Clarification to keep in project notes

- Repeated internal links in global navigation/footer across subpages are **normal and correct**.
- Linking to featured products from homepage is also **correct** and helps crawl + internal authority flow.
- We should **not** add `noindex`/`nofollow` to global menu links on subpages.
- Focus should stay on controlling low-value, parameterized/filter URL variants.

## Current code signals

- Products/brand listing experiences use filtering and query params.
- Robots currently only disallow `/api/` and `/_next/`; no faceted URL policy in `robots.ts`.
- Canonical metadata is path-based (good baseline), but crawler control for parameterized URLs can still be improved.

## Fix plan (step-by-step)

1. **Do not noindex main navigation globally**
   - Keep header/footer links crawlable.
   - This preserves information architecture and user experience.

2. **Control faceted URL crawl**
   - Add robots disallow rules for noisy filter params (if confirmed as crawl issue), e.g.:
     - search/filter parameter combinations.
   - Keep clean category/brand URLs indexable.

3. **Canonical consistency audit**
   - Ensure filtered URLs always canonicalize to core listing/category URL.
   - Verify this in rendered `<head>` on listing/filter states.

4. **Sidebar/link-density tuning (optional)**
   - Keep current progressive behavior (`show all brands` already gated).
   - If needed, cap visible low-value links and expose expanded sets on user interaction.

5. **Client-facing SEO report**
   - Provide before/after:
     - total links on representative pages,
     - indexed URL patterns,
     - crawl stats from GSC.
   - This addresses business concern transparently.

## Acceptance criteria

- Main menu remains crawlable (correct SEO behavior).
- Low-value faceted URL crawl is reduced.
- No SEO regression in discoverability of core product/brand/category pages.

## Risks / rollback

- **Risk:** over-blocking in robots can hide useful pages.
- **Mitigation:** only block parameterized patterns after verification.
- **Rollback:** robots rules are easily reversible.

