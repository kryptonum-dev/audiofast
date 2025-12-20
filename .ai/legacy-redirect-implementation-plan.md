# Legacy URL Redirect Implementation Plan

## Overview

This document outlines the complete redirect strategy for migrating from the legacy Audiofast website (SilverStripe CMS) to the new Next.js/Sanity-based site deployed on Vercel.

### Legacy Site URL Structure

- Base domain: `www.audiofast.pl`
- All content pages use `/pl/` prefix (Polish locale)
- Products: `/pl/{brand-slug}/{product-slug}`
- Brands: `/pl/{brand-slug}/`
- Categories: `/pl/{category-slug}/`

### New Site URL Structure

- Products: `/produkty/{product-slug}/`
- Brands: `/marki/{brand-slug}/`
- Categories: `/produkty/kategoria/{category-slug}/`
- Reviews (page): `/recenzje/{slug}/`
- Reviews (PDF): `/recenzje/pdf/{slug}/`
- Blog: `/blog/{slug}/`

---

## URL Inventory Summary

### Verified Data from Sanity CMS (as of 2024-12-19)

| Category               | Legacy Count             | Sanity Count | New Route                         | Status                       |
| ---------------------- | ------------------------ | ------------ | --------------------------------- | ---------------------------- |
| **Products**           | 781 (sitemap) / 828 (DB) | -            | `/produkty/[slug]/`               | ✅ Data ready (CSV)          |
| **Brands**             | 28                       | 35           | `/marki/[slug]/`                  | ✅ Data in Sanity            |
| **Categories**         | 44                       | 42           | `/produkty/kategoria/[category]/` | ✅ Data in Sanity            |
| **Reviews (pages)**    | ~386                     | 346          | `/recenzje/[slug]/`               | ✅ Data in Sanity            |
| **Reviews (PDFs)**     | ~46                      | 127          | `/recenzje/pdf/[slug]/`           | ✅ Data in Sanity            |
| **Reviews (external)** | -                        | 374          | N/A - external links              | ✅ NO redirect needed        |
| **Blog/News**          | ~38                      | 12           | `/blog/[slug]/`                   | ✅ Data in Sanity            |
| **Static Pages**       | 11                       | 3            | Various                           | ✅ Mapped                    |
| **Other**              | ~27                      | -            | Various/homepage                  | ✅ Redirect to homepage/blog |
| **Assets/PDFs**        | 46                       | -            | `/recenzje/pdf/[slug]/`           | ✅ Handled by PDF reviews    |
| **TOTAL**              | ~1,373                   | 847 reviews  |                                   |                              |

---

## Phase 1: Products (828 redirects)

### Source Data

- File: `/Users/oliwiersellig/Desktop/products.csv`
- Contains: `ID, product_slug, product_name, brand_slug, brand_name, old_url`

### Redirect Pattern

```
/pl/{brand-slug}/{product-slug} → /produkty/{product-slug}/
/{brand-slug}/{product-slug} → /produkty/{product-slug}/   (without /pl/ prefix)
```

### Example Redirects

```json
[
  {
    "source": "/pl/aurender/n20",
    "destination": "/produkty/n20/",
    "isPermanent": true
  },
  {
    "source": "/aurender/n20",
    "destination": "/produkty/n20/",
    "isPermanent": true
  },
  {
    "source": "/pl/wilson-audio/alexia-v",
    "destination": "/produkty/alexia-v/",
    "isPermanent": true
  }
]
```

### Implementation Notes

- Need both `/pl/` and non-`/pl/` variants for safety
- Total redirects: 828 × 2 = **1,656 redirect rules**

---

## Phase 2: Brands (28 redirects)

### Source Data

Derived from products CSV - unique `brand_slug` values.

### Redirect Pattern

```
/pl/{brand-slug}/ → /marki/{brand-slug}/
/{brand-slug}/ → /marki/{brand-slug}/
```

### Brand List

```
acoustic-signature, artesania-audio, audioresearch, aurender, ayre, bricasti,
dan-dagostino, dcs, dutchdutch, exogal, goldenear, grand-prix-audio, grimm-audio,
gryphon-audio, keces-audio, klh-audio, moonriver-audio, mutec, primaluna,
rogue-audio, roon-labs, shunyata-research, soundsmith, spiral-groove, stealth-audio,
symposium, synergistic-research, taiko-audio, thixar, usher, vandersteen, vibrapod,
viv-laboratory, weiss, wilson-audio
```

### Implementation Notes

- Total: 35 brands × 2 variants = **~70 redirect rules**

---

## Phase 3: Categories (44 redirects)

### Legacy Category URLs

```
/pl/przetworniki-dac/ → /produkty/kategoria/przetworniki-dac/
/pl/glosniki-podlogowe/ → /produkty/kategoria/glosniki-podlogowe/
/pl/wzmacniacze-zintegrowane/ → /produkty/kategoria/wzmacniacze-zintegrowane/
... etc.
```

### Full Category List (44)

| Legacy Path                                   | New Path                                                      |
| --------------------------------------------- | ------------------------------------------------------------- |
| `/pl/akcesoria-akustyczne/`                   | `/produkty/kategoria/akcesoria-akustyczne/`                   |
| `/pl/akcesoria-gramofonowe/`                  | `/produkty/kategoria/akcesoria-gramofonowe/`                  |
| `/pl/akcesoria/`                              | `/produkty/kategoria/akcesoria/`                              |
| `/pl/bezpieczniki/`                           | `/produkty/kategoria/bezpieczniki/`                           |
| `/pl/glosniki-aktywne/`                       | `/produkty/kategoria/glosniki-aktywne/`                       |
| `/pl/glosniki-do-kina-domowego/`              | `/produkty/kategoria/glosniki-do-kina-domowego/`              |
| `/pl/glosniki-instalacyjne/`                  | `/produkty/kategoria/glosniki-instalacyjne/`                  |
| `/pl/glosniki-podlogowe/`                     | `/produkty/kategoria/glosniki-podlogowe/`                     |
| `/pl/glosniki-podstawkowe/`                   | `/produkty/kategoria/glosniki-podstawkowe/`                   |
| `/pl/gramofony/`                              | `/produkty/kategoria/gramofony/`                              |
| `/pl/interkonekty/`                           | `/produkty/kategoria/interkonekty/`                           |
| `/pl/kable-cyfrowe/`                          | `/produkty/kategoria/kable-cyfrowe/`                          |
| `/pl/kable-do-subwooferow/`                   | `/produkty/kategoria/kable-do-subwooferow/`                   |
| `/pl/kable-ethernet/`                         | `/produkty/kategoria/kable-ethernet/`                         |
| `/pl/kable-glosnikowe/`                       | `/produkty/kategoria/kable-glosnikowe/`                       |
| `/pl/kable-usb/`                              | `/produkty/kategoria/kable-usb/`                              |
| `/pl/kable-uziemiajace/`                      | `/produkty/kategoria/kable-uziemiajace/`                      |
| `/pl/kable-zasilajace/`                       | `/produkty/kategoria/kable-zasilajace/`                       |
| `/pl/kable-zegarowe/`                         | `/produkty/kategoria/kable-zegarowe/`                         |
| `/pl/kondycjonery/`                           | `/produkty/kategoria/kondycjonery/`                           |
| `/pl/odtwarzacze-cd/`                         | `/produkty/kategoria/odtwarzacze-cd/`                         |
| `/pl/podstawki-i-kolce/`                      | `/produkty/kategoria/podstawki-i-kolce/`                      |
| `/pl/polki/`                                  | `/produkty/kategoria/polki/`                                  |
| `/pl/przedwzmacniacze-gramofonowe/`           | `/produkty/kategoria/przedwzmacniacze-gramofonowe/`           |
| `/pl/przedwzmacniacze/`                       | `/produkty/kategoria/przedwzmacniacze/`                       |
| `/pl/przetworniki-dac/`                       | `/produkty/kategoria/przetworniki-dac/`                       |
| `/pl/przewody-gramofonowe/`                   | `/produkty/kategoria/przewody-gramofonowe/`                   |
| `/pl/ramiona-gramofonowe/`                    | `/produkty/kategoria/ramiona-gramofonowe/`                    |
| `/pl/serwery-muzyczne-z-wyjsciem-analogowym/` | `/produkty/kategoria/serwery-muzyczne-z-wyjsciem-analogowym/` |
| `/pl/serwery-muzyczne/`                       | `/produkty/kategoria/serwery-muzyczne/`                       |
| `/pl/sluchawki/`                              | `/produkty/kategoria/sluchawki/`                              |
| `/pl/soundbary/`                              | `/produkty/kategoria/soundbary/`                              |
| `/pl/stacje-uziemiajace/`                     | `/produkty/kategoria/stacje-uziemiajace/`                     |
| `/pl/stoliki/`                                | `/produkty/kategoria/stoliki/`                                |
| `/pl/subwoofery/`                             | `/produkty/kategoria/subwoofery/`                             |
| `/pl/switche/`                                | `/produkty/kategoria/switche/`                                |
| `/pl/upsamplery/`                             | `/produkty/kategoria/upsamplery/`                             |
| `/pl/wkladki-gramofonowe/`                    | `/produkty/kategoria/wkladki-gramofonowe/`                    |
| `/pl/wzmacniacze-sluchawkowe/`                | `/produkty/kategoria/wzmacniacze-sluchawkowe/`                |
| `/pl/wzmacniacze-zintegrowane/`               | `/produkty/kategoria/wzmacniacze-zintegrowane/`               |
| `/pl/wzmacniacze/`                            | `/produkty/kategoria/wzmacniacze/`                            |
| `/pl/zasilacze/`                              | `/produkty/kategoria/zasilacze/`                              |
| `/pl/zegary-wzorcowe/`                        | `/produkty/kategoria/zegary-wzorcowe/`                        |

### Sanity Category Data (42 categories)

Categories verified in Sanity (slug format: `/kategoria/{slug}/`):

- akcesoria-akustyczne, bezpieczniki, gramofony, glosniki-aktywne, glosniki-do-kina-domowego
- glosniki-instalacyjne, glosniki-podstawkowe, glosniki-podlogowe, interkonekty, kable-cyfrowe
- kable-usb, kable-do-subwooferow, kable-ethernet, kable-glosnikowe, kable-uziemiajace
- kable-zasilajace, kable-zegarowe, kondycjonery, odtwarzacze-cd, podstawki-i-kolce
- akcesoria, przedwzmacniacze-gramofonowe, przedwzmacniacze, przetworniki-dac, przewody-gramofonowe
- polki, ramiona-gramofonowe, zegary-wzorcowe, serwery-muzyczne, serwery-muzyczne-z-wyjsciem-analogowym
- soundbary, stacje-uziemiajace, stoliki, subwoofery, switche, upsamplery, wkladki-gramofonowe
- wzmacniacze, wzmacniacze-sluchawkowe, wzmacniacze-zintegrowane, zasilacze

### Missing from Sanity (need special handling)

- `/pl/akcesoria-gramofonowe/` → Redirect to `/produkty/kategoria/akcesoria/`
- `/pl/sluchawki/` → Category doesn't exist, redirect to `/produkty/`

### Implementation Notes

- Total: 44 × 2 variants = **~88 redirect rules**
- Most categories have 1:1 mapping
- 2 categories need fallback redirects

---

## Phase 4: Static Pages (11 redirects)

### Data from Sanity CMS

Pages already exist in Sanity (`page` collection):

- ✅ `/o-nas/` - "O nas" page exists
- ✅ `/kontakt/` - "Kontakt" page exists
- ✅ `/serwis/` - "Serwis" page exists

### Direct Mappings

| Legacy Path                      | New Path                 | Notes                           |
| -------------------------------- | ------------------------ | ------------------------------- |
| `/pl/o-nas/`                     | `/o-nas/`                | ✅ Exists in Sanity             |
| `/pl/kontakt/`                   | `/kontakt/`              | ✅ Exists in Sanity             |
| `/pl/polityka-prywatnosci/`      | `/polityka-prywatnosci/` | ✅ Exists                       |
| `/pl/regulamin/`                 | `/regulamin/`            | ✅ Exists                       |
| `/pl/marki/`                     | `/marki/`                | ✅ Exists                       |
| `/pl/cenniki/`                   | `/marki/`                | ✅ Redirect to brands page      |
| `/pl/rejestracja-gwarancji/`     | `/`                      | ✅ Redirect to homepage         |
| `/pl/rejestracja-na-newsletter/` | `/`                      | ✅ Redirect to homepage         |
| `/pl/rezygnazja-z-newsletter/`   | `/`                      | ✅ Redirect to homepage         |
| `/pl/typy-urzadzen/`             | `/produkty/`             | ✅ Redirect to products listing |
| `/pl/mapa-serwisu/`              | `/`                      | ✅ Redirect to homepage         |
| `/pl/blad-serwera/`              | 404                      | Let it 404 naturally            |

### Implementation Notes

- All static pages now have clear destinations
- Newsletter signup will use footer form (no dedicated page needed)
- Warranty registration was product-specific but we redirect to homepage for simplicity
- Device types → products listing

---

## Phase 5: Reviews - Page Type (346 in Sanity)

### Legacy Pattern

```
/pl/recenzja-{publication}{date}-{topic}/
/pl/recenzje-{publication}{date}-{topic}/
/pl/test-{description}/
```

### Examples

```
/pl/recenzja-audiobeat201604-wilsonaudio-sabrina/
/pl/test-lampowego-wzmacniacza-zintegrowanego-primaluna-evo-300-integrated-w-watt-audio/
```

### Redirect Strategy

**Approach:** Static redirect JSON in `next.config.ts` (edge-cached)

1. Add `legacySlug` field to review schema in Sanity
2. Run migration to populate legacy slugs from SQL database
3. Generate script queries Sanity and creates redirect entries
4. All redirects included in `legacy-redirects.json`

### Required Schema Update

Add to `apps/studio/schemaTypes/documents/collections/review.tsx`:

```typescript
defineField({
  name: 'legacySlug',
  title: 'Legacy URL Slug',
  type: 'string',
  description: 'Original URL from legacy site (e.g., "recenzja-audiobeat201604-wilsonaudio-sabrina")',
  group: GROUP.MAIN_CONTENT,
  hidden: true, // Only used for redirects
}),
```

---

## Phase 6: Reviews - PDF Type (127 in Sanity)

### Legacy Pattern

```
/assets/pdfy/{filename}.pdf
/assets/Uploads/{filename}.pdf
```

### New Pattern

```
/recenzje/pdf/{slug}/
```

### Redirect Strategy

**Approach:** Static redirect JSON in `next.config.ts` (edge-cached)

1. Add `legacyPdfPath` field to review schema in Sanity
2. Run migration to populate from SQL database
3. Generate script creates redirect entries for each PDF

### Required Schema Update

Add to `apps/studio/schemaTypes/documents/collections/review.tsx`:

```typescript
defineField({
  name: 'legacyPdfPath',
  title: 'Legacy PDF Path',
  type: 'string',
  description: 'Original PDF path from legacy site (e.g., "/assets/pdfy/test-audio-research.pdf")',
  group: GROUP.MAIN_CONTENT,
  hidden: ({ document }) => document?.destinationType !== 'pdf',
}),
```

---

## Phase 7: Reviews - External Type (NO REDIRECT NEEDED)

External reviews link directly to third-party websites. These should:

- ✅ NOT be redirected
- ✅ Be displayed in the UI as external links
- ✅ Open in new tab

No action required for redirects.

---

## Phase 8: Blog & News Articles (~38 redirects)

### Data from Sanity CMS

12 blog articles exist in Sanity, including migrated legacy content:

| Legacy URL                                                                 | New URL in Sanity                                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/pl/audioshow-2018/`                                                      | `/blog/audioshow-2018/`                                                      |
| `/pl/audioshow-2019/`                                                      | `/blog/audioshow-2019/`                                                      |
| `/pl/pazdziernik-z-gryphon-audio-designs/`                                 | `/blog/pazdziernik-z-gryphon-audio-designs/`                                 |
| `/pl/premierowe-prezentacje-wilson-audio-sabrina-x-i-audio-research/`      | `/blog/premierowe-prezentacje-wilson-audio-sabrina-x-i-audio-research/`      |
| `/pl/premierowe-prezentacje-integry-dan-dagostino-progression-integrated/` | `/blog/premierowe-prezentacje-integry-dan-dagostino-progression-integrated/` |
| `/pl/porady-na-temat-doboru-bezpiecznikow-synergistic-research/`           | `/blog/porady-na-temat-doboru-bezpiecznikow-synergistic-research/`           |
| `/pl/refleksje-po-audio-video-show-2022/`                                  | `/blog/refleksje-po-audio-video-show-2022/`                                  |
| `/pl/nagrody-stereophile-recommended-components-2024/`                     | `/blog/nagrody-stereophile-recommended-components-2024/`                     |
| `/pl/nagrody-the-absolute-sound-product-of-the-year-2025/`                 | `/blog/nagrody-the-absolute-sound-product-of-the-year-2025/`                 |
| `/pl/nagrody-the-absolute-sound-editors-choice-2025/`                      | `/blog/nagrody-the-absolute-sound-editors-choice-2025/`                      |

### Redirect Pattern

```
/pl/{legacy-slug}/ → /blog/{new-slug}/
```

### Strategy

1. ✅ **Migrated articles** - Create 1:1 redirects (matching by slug)
2. ✅ **Non-migrated articles** - Redirect to `/blog/` index
3. ✅ **Old news pages** (`/pl/news-*`, `/pl/nowosc-*`) - Redirect to `/blog/`

### Implementation

For migrated articles, the new slug often matches the legacy slug (just different prefix).
Create pattern-based redirects where possible, static redirects for mismatches.

---

## Phase 9: Other/Miscellaneous (~27 URLs)

### Strategy (Based on User Decisions)

Most of these are either:

1. **Blog articles** → Already covered in Phase 8 (redirect to `/blog/`)
2. **Outdated content** → Redirect to homepage

### URLs to Redirect

| Legacy URL Pattern             | Destination          | Reason               |
| ------------------------------ | -------------------- | -------------------- |
| `/pl/audioshow-*`              | `/blog/audioshow-*/` | ✅ Migrated to blog  |
| `/pl/audiofast-na-*`           | `/blog/`             | Blog content         |
| `/pl/promocje/`                | `/produkty/`         | Redirect to products |
| `/pl/salon-*`                  | `/kontakt/`          | Store info → contact |
| `/pl/premierowe-prezentacje-*` | `/blog/*/`           | ✅ Migrated to blog  |
| `/pl/refleksje-*`              | `/blog/*/`           | ✅ Migrated to blog  |
| `/pl/porownanie-*`             | `/blog/`             | Comparison articles  |
| `/pl/porady-*`                 | `/blog/*/`           | ✅ Migrated to blog  |
| `/pl/nagrody-*`                | `/blog/*/`           | ✅ Migrated to blog  |
| `/pl/nowosc-*`                 | `/blog/`             | News articles        |
| `/pl/news-*`                   | `/blog/`             | News articles        |
| `/pl/dcs-bartok-*`             | `/blog/`             | Product news         |
| `/pl/evo-*`                    | `/blog/`             | Product news         |
| `/pl/*-w-*` (review titles)    | `/recenzje/`         | Review content       |

### Implementation

1. Pattern match known migrated content to exact blog slugs
2. Fallback to `/blog/` for news/article patterns
3. Fallback to `/` (homepage) for everything else

---

## Implementation Architecture

### ✅ Chosen Approach: Sanity-Managed Redirects + next.config.ts

All redirects will be stored in **Sanity's redirects document** and fetched by `next.config.ts` at build time. This approach:

- **Sanity is the source of truth** - Users can manage redirects via Sanity Studio
- **Edge-cached at build time** - Zero runtime overhead
- **No middleware needed** - Redirects handled before app code runs
- **Vercel optimized** - Native support for Next.js redirects

### Why This Approach?

1. **Legacy URLs are frozen** - No new `/pl/{brand}/{product}` URLs will be created
2. **Fastest possible** - Edge network handles redirects before hitting the app
3. **User-manageable** - Redirects can be edited in Sanity Studio
4. **Build-time fetch** - Sanity queried once during `next build`, then edge-cached

---

## Implementation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  ONE-TIME SETUP                             │
│                                                             │
│  1. Claude generates complete JSON (~2,868 redirects)       │
│  2. User pastes JSON into Sanity Studio redirects document  │
│  3. Sanity stores redirects in production dataset           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  BUILD TIME (next build)                    │
│                                                             │
│  next.config.ts fetches redirects from Sanity               │
│  Transforms to Next.js redirect format                      │
│  All redirects baked into build                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  EDGE CACHE (Vercel)                        │
│                                                             │
│  All redirects cached at edge - ZERO runtime overhead       │
│  301 redirects handled before app code runs                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Step 1: Claude Generates Complete JSON

I will generate a complete JSON array with all ~2,868 redirects in the format required by Sanity's redirects document:

```json
[
  {
    "source": "/pl/aurender/n20",
    "destination": "/produkty/n20/",
    "isPermanent": true
  },
  {
    "source": "/aurender/n20",
    "destination": "/produkty/n20/",
    "isPermanent": true
  },
  {
    "source": "/pl/wilson-audio/",
    "destination": "/marki/wilson-audio/",
    "isPermanent": true
  }
]
```

### Step 2: Paste JSON into Sanity Studio

1. Open Sanity Studio → "Przekierowania" (Redirects) document
2. Use the "Edytor JSON" field (JSON Editor)
3. Paste the complete JSON array
4. Click "Przetwórz JSON i zaktualizuj przekierowania" (Process JSON and update redirects)
5. Publish the document

### Step 3: Update next.config.ts to Fetch from Sanity

```typescript
import type { NextConfig } from 'next';
import { createClient } from '@sanity/client';

// Sanity client for build-time fetching
const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-12-19',
  useCdn: false, // We want fresh data at build time
});

const nextConfig: NextConfig = {
  // ... existing config

  async redirects() {
    try {
      // Fetch redirects from Sanity at build time
      const redirectsDoc = await sanityClient.fetch(`
        *[_type == "redirects"][0]{
          redirects[]{
            "source": source.current,
            "destination": destination.current,
            "permanent": isPermanent
          }
        }
      `);

      if (!redirectsDoc?.redirects) {
        console.warn('No redirects found in Sanity');
        return [];
      }

      console.log(
        `Loaded ${redirectsDoc.redirects.length} redirects from Sanity`
      );
      return redirectsDoc.redirects;
    } catch (error) {
      console.error('Failed to fetch redirects from Sanity:', error);
      return [];
    }
  },
};

export default nextConfig;
```

---

## JSON Format for Sanity

The JSON array I will generate uses Sanity's expected format:

```typescript
interface SanityRedirect {
  source: string; // Legacy URL path (e.g., "/pl/aurender/n20")
  destination: string; // New URL path (e.g., "/produkty/n20/")
  isPermanent: boolean; // true = 301, false = 307
}
```

**Important Notes:**

- `source` must start with `/`
- `destination` must start with `/`
- Use `isPermanent: true` for SEO (301 redirect)
- Trailing slashes should match your `trailingSlash` config (currently `true`)

---

## Estimated Redirect Count

| Category       | Count | × 2 variants | Total      |
| -------------- | ----- | ------------ | ---------- |
| Products       | 828   | ✅           | 1,656      |
| Brands         | 35    | ✅           | 70         |
| Categories     | 44    | ✅           | 88         |
| Static Pages   | 12    | ✅           | 24         |
| Reviews (page) | 346   | ✅           | 692        |
| Reviews (PDF)  | 127   | ✅           | 254        |
| Blog/News      | 12    | ✅           | 24         |
| Misc/Fallback  | ~30   | ✅           | ~60        |
| **TOTAL**      |       |              | **~2,868** |

This is well within Next.js capabilities (no hard limit like Vercel's 1024).

---

## Build & Deploy Considerations

### When Redirects Update

Since redirects are fetched at **build time**, changes in Sanity require a rebuild:

1. **Automatic**: Set up Sanity webhook to trigger Vercel rebuild when redirects document changes
2. **Manual**: Trigger redeploy from Vercel dashboard

### Build Time Impact

With ~2,900 redirects:

- **Build impact**: Minimal - Single Sanity query during build
- **Edge performance**: All redirects cached at edge - zero latency

---

## Future Management

After initial setup, redirects can be managed via Sanity Studio:

1. **Add new redirect**: Edit the redirects array in Sanity → Redeploy
2. **Remove redirect**: Delete from array in Sanity → Redeploy
3. **Bulk update**: Use JSON editor to paste updated array → Redeploy

---

## Testing Plan

### Pre-Launch Testing

1. Set up staging environment
2. Test all redirect patterns with sample URLs
3. Verify 404 page for unmatched URLs
4. Test canonical URLs to avoid redirect chains

### Post-Launch Monitoring

1. Monitor 404 errors in Vercel analytics
2. Check Google Search Console for crawl errors
3. Submit updated sitemap to Google

---

## Redirect Count Summary

All redirects are **static** (no pattern matching) and **edge-cached** at build time.

| Phase              | Count | × 2 variants | Total Redirects |
| ------------------ | ----- | ------------ | --------------- |
| Products           | 828   | ✅           | 1,656           |
| Brands             | 35    | ✅           | 70              |
| Categories         | 44    | ✅           | 88              |
| Static Pages       | 12    | ✅           | 24              |
| Reviews (page)     | 346   | ✅           | 692             |
| Reviews (PDF)      | 127   | ✅           | 254             |
| Reviews (external) | 0     | N/A          | 0               |
| Blog/News          | 12    | ✅           | 24              |
| Other/Misc         | ~30   | ✅           | ~60             |
| **TOTAL**          |       |              | **~2,868**      |

### Why × 2 Variants?

Each legacy URL needs two redirect rules:

1. With `/pl/` prefix: `/pl/aurender/n20` → `/produkty/n20/`
2. Without `/pl/` prefix: `/aurender/n20` → `/produkty/n20/`

This ensures both URL formats are handled (some external links may not include the `/pl/` prefix).

---

## Next Steps

### ✅ Completed Actions

1. [x] Review and approve this plan
2. [x] Verify static pages exist in Sanity (o-nas, kontakt, serwis) - ✅ DONE
3. [x] Verify category slugs in Sanity - ✅ 42 of 44 exist
4. [x] Verify blog articles exist in Sanity - ✅ 12 articles migrated
5. [x] Get review counts from Sanity - ✅ 847 total (346 page, 127 PDF, 374 external)
6. [x] Choose implementation approach - ✅ Sanity-managed + next.config.ts

### Implementation Tasks

#### Phase 1: JSON Generation (Claude)

7. [ ] Claude generates complete JSON array with all ~2,868 redirects:
   - Products: from CSV (`/Users/oliwiersellig/Desktop/products.csv`)
   - Brands: derived from products CSV
   - Categories: from Sanity query
   - Static pages: hardcoded list
   - Reviews (page): from Sanity query (need legacy slugs)
   - Reviews (PDF): from Sanity query (need legacy paths)
   - Blog articles: from Sanity query
   - Misc/fallbacks: hardcoded list

#### Phase 2: Data Import (User)

8. [ ] User pastes JSON into Sanity Studio:
   - Open "Przekierowania" document
   - Use "Edytor JSON" field
   - Paste complete JSON array
   - Click "Przetwórz JSON i zaktualizuj przekierowania"
   - Publish document

#### Phase 3: Integration (Code)

9. [ ] Update `apps/web/next.config.ts`:
   - Add Sanity client for build-time fetching
   - Add `async redirects()` function that queries Sanity
   - Transform Sanity format to Next.js format

#### Phase 4: Deployment & Verification

10. [ ] Deploy to staging/preview environment
11. [ ] Test redirect samples from each category:
    - Products: `/pl/aurender/n20` → `/produkty/n20/`
    - Brands: `/pl/wilson-audio/` → `/marki/wilson-audio/`
    - Categories: `/pl/przetworniki-dac/` → `/produkty/kategoria/przetworniki-dac/`
    - Static: `/pl/kontakt/` → `/kontakt/`
    - Reviews: Test a few known legacy review URLs
12. [ ] Deploy to production
13. [ ] Monitor 404s in Vercel analytics
14. [ ] Submit updated sitemap to Google Search Console

#### Optional: Webhook for Auto-Rebuild

15. [ ] Set up Sanity webhook to trigger Vercel rebuild when redirects document changes

---

## Decisions Made ✅

All redirect decisions have been finalized:

| Question                   | Decision                                                     |
| -------------------------- | ------------------------------------------------------------ |
| **Cenniki (price lists)**  | → `/marki/` (brands page)                                    |
| **Warranty registration**  | → `/` (homepage) - product-specific info handled differently |
| **Newsletter signup**      | → `/` (homepage) - footer newsletter form is sufficient      |
| **Old events (AudioShow)** | → `/blog/audioshow-*/` - Already migrated to blog            |
| **Promos**                 | → `/produkty/` (products listing)                            |
| **Device types**           | → `/produkty/` (products listing)                            |
| **External reviews**       | No redirect needed - they link to external sites             |

---

## Data Sources

### SQL Database (Legacy)

- Products CSV: `/Users/oliwiersellig/Desktop/products.csv` (828 products)
- Full SQL dump: `/Users/oliwiersellig/Developer/audiofast/20251219_audiofast.sql`

### Legacy Sitemap

- Location: `/Users/oliwiersellig/Developer/audiofast/legacy-sitemap/`
- Files: `legacy-sitemap.xml`, `legacy-sitemap.csv`
- Total URLs: 1,373

### Sanity CMS (New)

- Project ID: `fsw3likv`
- Dataset: `production`
- Reviews: 847 total (346 page, 127 PDF, 374 external)
- Brands: 35
- Categories: 42
- Blog articles: 12
- Pages: 3 (o-nas, kontakt, serwis)
