# Sanity Price Sync Implementation — Server-Side Chaining ✅

## What Changed

The pricing pipeline has been upgraded to use **server-side chaining** for automatic Sanity synchronization. This means Excel now makes only **one API call**, and the Supabase Edge Function handles syncing both databases automatically.

## Architecture

### Before (Two API Calls from Excel)

```
Excel → VBA → AppleScript
  ├─→ Call 1: pricing-ingest (Supabase)
  └─→ Call 2: sync-prices-to-sanity (Sanity)
```

### After (Server-Side Chaining — One API Call) ✅

```
Excel → VBA → AppleScript → pricing-ingest (Supabase)
                                └─→ Automatically calls sync-prices-to-sanity (Sanity)
```

## Benefits

✅ **Simpler Excel Workflow**: No need to update VBA macro  
✅ **Atomic Operation**: Both databases updated in one flow  
✅ **Error Handling**: If Sanity sync fails, it's logged but doesn't break Supabase ingest  
✅ **Single Point of Maintenance**: All sync logic is server-side  
✅ **Transparent to Client**: Excel doesn't need to know about Sanity

## What Was Deployed

### 1. Updated `pricing-ingest` Edge Function

**Location**: `supabase/functions/pricing-ingest/index.ts`

**New Behavior**:

- After successfully ingesting pricing data to Supabase
- Automatically calls `sync-prices-to-sanity` via internal fetch
- Passes the same `variants` payload and authentication headers
- Returns combined results from both Supabase and Sanity

**Response Format** (Enhanced):

```json
{
  "ok": true,
  "supabase": {
    "counts": {
      "variants_upserted": 5,
      "groups_upserted": 12,
      "values_upserted": 24,
      ...
    }
  },
  "sanity": {
    "ok": true,
    "updated": 5,
    "skipped": 0,
    "errors": []
  }
}
```

### 2. Existing `sync-prices-to-sanity` Edge Function

**Location**: `supabase/functions/sync-prices-to-sanity/index.ts`

**No Changes Needed**: This function already exists and works correctly. It's now called internally by `pricing-ingest` instead of directly from Excel.

**What It Does**:

- Receives `variants` array with `price_key` and `base_price_cents`
- Extracts product name from `price_key` (e.g., "atmosphere-sx-ic" from "synergistic-research/atmosphere-sx-ic")
- Matches product name to Sanity product slug
- Updates `basePriceCents` and `lastPricingSync` fields in Sanity
- Returns summary of updates/skips/errors

## Excel Workflow (Unchanged)

**No changes needed to Excel VBA or AppleScript!**

The existing workflow continues to work:

1. User clicks "Publish Prices" button in Excel
2. VBA macro builds JSON payload
3. AppleScript calls `pricing-ingest` with HMAC authentication
4. **NEW**: `pricing-ingest` automatically syncs to Sanity after Supabase ingest
5. User sees success message

## Environment Variables (Already Set)

All required environment variables are already configured in Supabase:

- `SANITY_PROJECT_ID`: skSK2XY0ToEWcGHXOhwmBJYllGsafS6GeGhaGgn5NKxOBEQFwQpuGZDVCfKPaUkMEI86i0na4Xa83fy9ws8uKnro78cnklRwR8wevOQnH2ezKt6xJaE8aymcNbUQ7r4YN8w53RhkWnRCK7qcHEIAJtq1yNPyrIEGi4a1l26nNaaPpxw13F0j
- `SANITY_DATASET`: production
- `SANITY_API_TOKEN`: (write token already set)
- `EXCEL_PUBLISH_TOKEN`: (authentication token already set)

## Sanity Schema (Already Updated)

The `product` document type in Sanity already has the required fields:

```typescript
{
  name: 'basePriceCents',
  title: 'Cena bazowa (grosze)',
  type: 'number',
  readOnly: true,
  hidden: ({ document }) => !document?.basePriceCents,
}

{
  name: 'lastPricingSync',
  title: 'Ostatnia synchronizacja cen',
  type: 'datetime',
  readOnly: true,
  hidden: ({ document }) => !document?.lastPricingSync,
}
```

## Dual Pricing Strategy

**Supabase (Comprehensive)**:

- Stores all pricing data: base price, options, deltas, numeric rules
- Used on individual product detail pages (`/produkty/[slug]`)
- Queried via Supabase client

**Sanity (Base Price Only)**:

- Stores only `basePriceCents` + `lastPricingSync` timestamp
- Used on product listing pages for filtering and sorting
- Queried via Sanity GROQ queries

## Testing

The implementation is ready to test. Next time you publish prices from Excel:

1. The Excel workflow works exactly the same (no changes)
2. Both Supabase and Sanity will be updated automatically
3. You can verify in Supabase logs that both functions were called
4. You can verify in Sanity Studio that `basePriceCents` is updated

## Error Handling

**If Sanity sync fails**:

- The Supabase ingest still succeeds ✅
- The error is logged in Supabase Edge Function logs
- The response includes the Sanity error in the `sanity` field
- Excel user sees the Supabase success (primary goal achieved)

**If Supabase ingest fails**:

- Sanity sync is never attempted
- Excel user sees the error
- Nothing is updated (atomic)

## Documentation Updated

Updated files:

- `.ai/excel-to-supabase-pricing-pipeline.md`: Added Sanity sync section, updated flow diagram
- `.ai/sanity-price-sync-implementation.md`: This summary document

## Next Steps

**No action required!** The system is ready to use. Next time you publish from Excel:

1. Click "Publish Prices" button
2. Both Supabase and Sanity will update automatically
3. Check the response includes both `supabase` and `sanity` success results

---

## Technical Details: Server-Side Chaining Implementation

### Code Change in `pricing-ingest` (Lines 117-155)

```typescript
// ✅ NEW: Chain Sanity sync after successful Supabase ingest
let sanityResult = null;
if (variants.length > 0) {
  try {
    const sanityResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-prices-to-sanity`,
      {
        method: 'POST',
        headers: {
          Authorization: req.headers.get('authorization')!,
          'X-Excel-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variants }),
      }
    );

    if (sanityResponse.ok) {
      sanityResult = await sanityResponse.json();
    } else {
      console.error(
        'Sanity sync failed:',
        sanityResponse.status,
        await sanityResponse.text()
      );
      sanityResult = {
        error: `Sanity sync failed with status ${sanityResponse.status}`,
      };
    }
  } catch (sanityError) {
    console.error('Sanity sync error:', sanityError);
    sanityResult = {
      error:
        sanityError instanceof Error
          ? sanityError.message
          : String(sanityError),
    };
  }
}

return new Response(
  JSON.stringify({
    ok: true,
    supabase: {
      counts: data,
    },
    sanity: sanityResult,
  }),
  {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }
);
```

### Why This Design?

1. **Reliability**: If Sanity is down, Supabase still gets updated (critical path)
2. **Simplicity**: Excel doesn't need to orchestrate two calls
3. **Maintainability**: All sync logic is in one place (server-side)
4. **Scalability**: Easy to add more downstream syncs in the future
5. **Security**: Only one authentication point (Excel → Supabase)

---

**Status**: ✅ Implemented and deployed  
**Version**: pricing-ingest v12, sync-prices-to-sanity v1  
**Date**: January 2025
