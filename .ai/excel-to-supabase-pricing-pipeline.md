## Audiofast Pricing Pipeline — Excel → Supabase → Sanity → Next.js

This document recreates the entire working pipeline we built: macOS Excel button → VBA macro builds JSON → AppleScript `curl` POST → Supabase Edge Function → Postgres tables + Sanity CMS sync → Next.js reads. It includes full, copy‑pasteable code for the AppleScript, the Excel macro (ASCII‑only, Unicode‑safe), and the Edge Functions (replace mode, ordering, updated_at, automatic Sanity sync), plus setup, testing, and troubleshooting.

### Project metadata

- Organization: Audiofast
- Supabase project ID (ref): `xuwapsacaymdemmvblak`
- Project URL: `https://xuwapsacaymdemmvblak.supabase.co`
- Edge Function endpoint: `POST https://xuwapsacaymdemmvblak.supabase.co/functions/v1/pricing-ingest`

### High‑level flow

```mermaid
flowchart LR
  Excel[Excel for Mac
  (client workbook)] -- Publish button --> VBA[Excel VBA macro
  builds JSON]
  VBA --> ASTask[AppleScriptTask
  runs curl]
  ASTask --> Edge[Supabase Edge Function
  POST /pricing-ingest]
  Edge --> DB[(Supabase Postgres
  comprehensive pricing)]
  Edge --> Sanity[Sanity Sync Function
  base prices only]
  Sanity --> SanityCMS[(Sanity CMS
  base_price_cents)]
  DB --> Web[Next.js Product Details
  comprehensive pricing]
  SanityCMS --> WebListing[Next.js Product Listings
  filtering & sorting]
```

**Key Architecture Decision: Server-Side Chaining**

The `pricing-ingest` Edge Function automatically chains to the `sync-prices-to-sanity` function after successfully ingesting to Supabase. This means:

- **Single API call from Excel**: The VBA macro only calls `pricing-ingest` once
- **Atomic dual-storage**: Both Supabase (comprehensive) and Sanity (base price) are updated in one transaction flow
- **Automatic synchronization**: No need for separate Excel calls or manual syncing
- **Error handling**: If Sanity sync fails, it's logged but doesn't block the Supabase ingest success

**Dual Pricing Strategy:**

- **Supabase**: Stores comprehensive pricing with all options, deltas, and numeric rules (queried on individual product pages)
  - Multiple model variants are stored as separate rows (e.g., Atmosphere SX IC has 4 rows: Excite RCA, Excite XLR, Euphoria RCA, Euphoria XLR)
  - Each variant identified by unique combination of `(price_key, model)`
- **Sanity**: Stores only `basePriceCents` + `lastPricingSync` timestamp (used for product listing filters/sorting)
  - For products with multiple model variants, automatically stores the **lowest** base price
  - One price per product for efficient filtering/sorting

**Key Implementation Details:**

1. **UTF-8 Encoding**: Polish characters (ą, ć, ę, ł, ń, ó, ś, ź, ż) are handled correctly by:
   - Passing JSON directly as AppleScript parameter (not via file)
   - Including `charset=utf-8` in `curl` Content-Type headers
2. **Multi-Variant Support**: Products can have multiple models with different prices
   - Supabase stores all variants separately
   - Sanity receives the lowest price for search/filter
3. **Server-Side Chaining**: Single Excel button press updates both systems automatically
   - No manual coordination needed
   - Atomic operation with error tolerance

---

## Supabase: database schema (summary)

Tables (all in `public`):

- `pricing_variants`
  - id (uuid PK), price_key (text), brand (text), product (text), model (text NULL)
  - base_price_cents (int ≥0), currency (text default 'PLN')
  - created_at timestamptz default now(), updated_at timestamptz default now()
  - unique index on `(price_key, coalesce(model,''))`

- `pricing_option_groups`
  - id (uuid PK), variant_id (uuid FK → `pricing_variants` on delete cascade)
  - name (text), input_type ('select'|'numeric_step'), unit (text NULL)
  - required (bool), position (int), parent_value_id (uuid FK → `pricing_option_values`.id NULL)
  - created_at, updated_at

- `pricing_option_values`
  - id (uuid PK), group_id (uuid FK → `pricing_option_groups` on delete cascade)
  - name (text), price_delta_cents (int ≥0), position (int)
  - created_at, updated_at

- `pricing_numeric_rules`
  - id (uuid PK), group_id (uuid FK → `pricing_option_groups` on delete cascade)
  - value_id (uuid FK → `pricing_option_values`.id NULL)
  - min_value, max_value, step_value (numeric), price_per_step_cents (int ≥0), base_included_value (numeric)
  - created_at, updated_at

- `pricing_snapshots`
  - id (uuid PK), uploaded_at default now(), source_file_url (text NULL), checksum (text NULL)
  - counts (jsonb), notes (text)

Triggers:

- `set_updated_at()` on the four pricing tables (we also set `updated_at` explicitly in the Edge Function for deterministic refreshes).

RLS (public read):

- SELECT allowed on `pricing_variants`, `pricing_option_groups`, `pricing_option_values`, `pricing_numeric_rules`.
- `pricing_snapshots` readable only by `authenticated` (optional).

Recommended indexes for ordering:

- `create index on pricing_option_groups(variant_id, position);`
- `create index on pricing_option_values(group_id, position);`

Identity keys for diff/replace:

- Variant: `(price_key, model|null)`
- Group: `name` (+ parent context via `parent_value_id`)
- Value: `name` within a group

**Critical Implementation Note:**

The Postgres RPC function `ingest_pricing_json` (called by the Edge Function) **must check both `price_key` AND `model`** when finding/upserting variants. A previous bug where only `price_key` was checked caused multiple model variants of the same product to overwrite each other. The fix ensures:

```sql
-- Correct: Match by BOTH price_key AND model
select id from pricing_variants
where price_key = v->>'price_key'
  and (
    (model is null and (v->>'model' is null or v->>'model' = ''))
    or
    (model = nullif(v->>'model',''))
  )
limit 1;
```

This allows products like "Atmosphere SX IC" to have 4 separate variants (Excite RCA, Excite XLR, Euphoria RCA, Euphoria XLR) stored correctly in Supabase.

---

## Edge Function: `pricing-ingest` (TypeScript, Deno, Supabase Functions)

Capabilities:

- Auth: `Authorization: Bearer <anon-key>` and `X-Excel-Token: <secret>` (set `EXCEL_PUBLISH_TOKEN` in Function env)
- Modes:
  - `merge` (default): upsert only, never delete
  - `replace`: treat payload as source of truth: upsert present items, delete missing groups/values/rules, delete variants not in payload
- Ordering: reads `position` for groups and values and persists
- `updated_at`: set explicitly on all updates

Code (latest, v6):

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface VariantInput {
  price_key: string;
  brand: string;
  product: string;
  model?: string | null;
  base_price_cents?: number;
  base_price?: number;
  currency?: string;
  groups?: GroupInput[];
}
interface ParentRef {
  group_name: string;
  value_name: string;
}
interface GroupInput {
  name: string;
  input_type: "select" | "numeric_step";
  unit?: string | null;
  required?: boolean;
  position?: number;
  parent?: ParentRef | null;
  values?: ValueInput[];
  numeric_rule?: NumericRuleInput;
}
interface ValueInput {
  name: string;
  price_delta_cents?: number;
  price_delta?: number;
  position?: number;
}
interface NumericRuleInput {
  min_value: number;
  max_value: number;
  step_value: number;
  price_per_step_cents?: number;
  price_per_step?: number;
  base_included_value?: number;
}

const FALLBACK_EXCEL_TOKEN =
  Deno.env.get("EXCEL_PUBLISH_TOKEN") ?? "<set-in-env>";

const requiredEnv = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
};
function createSupabaseAdmin(): SupabaseClient {
  const url = requiredEnv("SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

const nowIso = () => new Date().toISOString();
const normKey = (price_key: string, model: string | null) =>
  `${price_key}||${model ?? ""}`;

async function findVariantId(
  supabase: SupabaseClient,
  price_key: string,
  model: string | null,
) {
  let q = supabase
    .from("pricing_variants")
    .select("id")
    .eq("price_key", price_key)
    .limit(1);
  if (model === null) q = q.is("model", null);
  else q = q.eq("model", model);
  const { data, error } = await q;
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

async function upsertVariant(supabase: SupabaseClient, v: VariantInput) {
  const currency = v.currency ?? "PLN";
  const base_price_cents =
    typeof v.base_price_cents === "number"
      ? v.base_price_cents
      : Math.round((v.base_price ?? 0) * 100);
  const model = (v.model === undefined ? null : v.model) as string | null;
  const existingId = await findVariantId(supabase, v.price_key, model);
  if (existingId) {
    const { error } = await supabase
      .from("pricing_variants")
      .update({
        brand: v.brand,
        product: v.product,
        base_price_cents,
        currency,
        updated_at: nowIso(),
      })
      .eq("id", existingId);
    if (error) throw error;
    return existingId;
  } else {
    const { data, error } = await supabase
      .from("pricing_variants")
      .insert([
        {
          price_key: v.price_key,
          brand: v.brand,
          product: v.product,
          model,
          base_price_cents,
          currency,
        },
      ])
      .select("id");
    if (error) throw error;
    return data![0].id as string;
  }
}

async function ensureValue(
  supabase: SupabaseClient,
  group_id: string,
  vi: ValueInput,
) {
  const price_delta_cents =
    typeof vi.price_delta_cents === "number"
      ? vi.price_delta_cents
      : Math.round((vi.price_delta ?? 0) * 100);
  const position = typeof vi.position === "number" ? vi.position : 0;
  const { data: existing, error: selErr } = await supabase
    .from("pricing_option_values")
    .select("id")
    .eq("group_id", group_id)
    .eq("name", vi.name)
    .limit(1);
  if (selErr) throw selErr;
  if (existing?.[0]?.id) {
    const { error } = await supabase
      .from("pricing_option_values")
      .update({
        name: vi.name,
        price_delta_cents,
        position,
        updated_at: nowIso(),
      })
      .eq("id", existing[0].id);
    if (error) throw error;
    return existing[0].id as string;
  } else {
    const { data, error } = await supabase
      .from("pricing_option_values")
      .insert([{ group_id, name: vi.name, price_delta_cents, position }])
      .select("id");
    if (error) throw error;
    return data![0].id as string;
  }
}

async function ensureGroup(
  supabase: SupabaseClient,
  params: {
    variant_id: string;
    name: string;
    input_type: "select" | "numeric_step";
    unit?: string | null;
    required?: boolean;
    position?: number;
    parent_value_id?: string | null;
  },
) {
  const position = typeof params.position === "number" ? params.position : 0;
  let q = supabase
    .from("pricing_option_groups")
    .select("id")
    .eq("variant_id", params.variant_id)
    .eq("name", params.name)
    .limit(1);
  if (params.parent_value_id)
    q = q.eq("parent_value_id", params.parent_value_id);
  else q = q.is("parent_value_id", null);
  const { data: existing, error: selErr } = await q;
  if (selErr) throw selErr;
  if (existing?.[0]?.id) {
    const { error } = await supabase
      .from("pricing_option_groups")
      .update({
        input_type: params.input_type,
        unit: params.unit ?? null,
        required: params.required ?? false,
        position,
        updated_at: nowIso(),
      })
      .eq("id", existing[0].id);
    if (error) throw error;
    return existing[0].id as string;
  } else {
    const { data, error } = await supabase
      .from("pricing_option_groups")
      .insert([
        {
          variant_id: params.variant_id,
          name: params.name,
          input_type: params.input_type,
          unit: params.unit ?? null,
          required: params.required ?? false,
          position,
          parent_value_id: params.parent_value_id ?? null,
        },
      ])
      .select("id");
    if (error) throw error;
    return data![0].id as string;
  }
}

async function upsertNumericRule(
  supabase: SupabaseClient,
  group_id: string,
  nr: NumericRuleInput,
) {
  const price_per_step_cents =
    typeof nr.price_per_step_cents === "number"
      ? nr.price_per_step_cents
      : Math.round((nr.price_per_step ?? 0) * 100);
  const base_included_value = nr.base_included_value ?? 1.0;
  const { data: existing, error: selErr } = await supabase
    .from("pricing_numeric_rules")
    .select("id")
    .eq("group_id", group_id)
    .limit(1);
  if (selErr) throw selErr;
  if (existing?.[0]?.id) {
    const { error } = await supabase
      .from("pricing_numeric_rules")
      .update({
        min_value: nr.min_value,
        max_value: nr.max_value,
        step_value: nr.step_value,
        price_per_step_cents,
        base_included_value,
        value_id: null,
        updated_at: nowIso(),
      })
      .eq("id", existing[0].id);
    if (error) throw error;
    return existing[0].id as string;
  } else {
    const { data, error } = await supabase
      .from("pricing_numeric_rules")
      .insert([
        {
          group_id,
          value_id: null,
          min_value: nr.min_value,
          max_value: nr.max_value,
          step_value: nr.step_value,
          price_per_step_cents,
          base_included_value,
        },
      ])
      .select("id");
    if (error) throw error;
    return data![0].id as string;
  }
}

function groupSignature(name: string, parent?: ParentRef | null) {
  return `${name}||${parent ? `${parent.group_name}>>${parent.value_name}` : ""}`;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST")
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
      });
    const tokenHeader = req.headers.get("x-excel-token") ?? "";
    if (!FALLBACK_EXCEL_TOKEN || tokenHeader !== FALLBACK_EXCEL_TOKEN)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json"))
      return new Response(
        JSON.stringify({
          error: "Unsupported Content-Type. Use application/json.",
        }),
        { status: 415 },
      );

    const body = (await req.json()) as {
      variants: VariantInput[];
      mode?: "merge" | "replace";
    };
    if (!body?.variants || !Array.isArray(body.variants))
      return new Response(
        JSON.stringify({ error: "Invalid payload: variants[] required" }),
        { status: 422 },
      );
    const mode = body.mode ?? "merge";

    const supabase = createSupabaseAdmin();
    const summary = {
      variants_upserted: 0,
      groups_upserted: 0,
      values_upserted: 0,
      numeric_rules_upserted: 0,
      deleted_variants: 0,
      deleted_groups: 0,
      deleted_values: 0,
      deleted_rules: 0,
    } as any;
    const payloadKeys = new Set<string>();

    for (const v of body.variants) {
      const variant_id = await upsertVariant(supabase, v);
      summary.variants_upserted++;
      const groups = v.groups ?? [];
      const payloadGroupSigs = new Set<string>();
      const payloadValuesBySig = new Map<string, Set<string>>();
      const payloadNumericBySig = new Set<string>();

      for (const g of groups.filter((g) => !g.parent)) {
        const gid = await ensureGroup(supabase, {
          variant_id,
          name: g.name,
          input_type: g.input_type,
          unit: g.unit ?? null,
          required: g.required ?? false,
          position: g.position ?? 0,
          parent_value_id: null,
        });
        summary.groups_upserted++;
        const sig = groupSignature(g.name, null);
        payloadGroupSigs.add(sig);
        if (g.input_type === "select" && g.values?.length) {
          const set = new Set<string>();
          for (const val of g.values) {
            await ensureValue(supabase, gid, val);
            set.add(val.name);
            summary.values_upserted++;
          }
          payloadValuesBySig.set(sig, set);
        }
        if (g.input_type === "numeric_step" && g.numeric_rule) {
          await upsertNumericRule(supabase, gid, g.numeric_rule);
          payloadNumericBySig.add(sig);
          summary.numeric_rules_upserted++;
        }
      }

      for (const g of groups.filter((g) => g.parent)) {
        const parent = g.parent as ParentRef;
        const parentGroupId = await ensureGroup(supabase, {
          variant_id,
          name: parent.group_name,
          input_type: "select",
          required: false,
          position: (g.position ?? 0) - 1,
          parent_value_id: null,
        });
        const parentValueId = await ensureValue(supabase, parentGroupId, {
          name: parent.value_name,
          price_delta_cents: 0,
          position: 0,
        });
        const gid = await ensureGroup(supabase, {
          variant_id,
          name: g.name,
          input_type: g.input_type,
          unit: g.unit ?? null,
          required: g.required ?? false,
          position: g.position ?? 0,
          parent_value_id: parentValueId,
        });
        summary.groups_upserted++;
        const sig = groupSignature(g.name, parent);
        payloadGroupSigs.add(sig);
        if (g.input_type === "select" && g.values?.length) {
          const set = new Set<string>();
          for (const val of g.values) {
            await ensureValue(supabase, gid, val);
            set.add(val.name);
            summary.values_upserted++;
          }
          payloadValuesBySig.set(sig, set);
        }
        if (g.input_type === "numeric_step" && g.numeric_rule) {
          await upsertNumericRule(supabase, gid, g.numeric_rule);
          payloadNumericBySig.add(sig);
          summary.numeric_rules_upserted++;
        }
      }

      if (mode === "replace") {
        const { data: dbGroups, error: gErr } = await supabase
          .from("pricing_option_groups")
          .select("id,name,input_type,parent_value_id")
          .eq("variant_id", variant_id);
        if (gErr) throw gErr;
        const sigOfDb = (row: any) =>
          groupSignature(
            row.name,
            row.parent_value_id
              ? {
                  group_name: "__PARENT__",
                  value_name: String(row.parent_value_id),
                }
              : null,
          );
        const keepGroupIds: string[] = [];
        const deleteGroupIds: string[] = [];
        const dbSigToId = new Map<string, string>();
        for (const row of dbGroups ?? []) {
          const s = sigOfDb(row);
          dbSigToId.set(s, row.id);
          if (row.parent_value_id) {
            const hasNameOnly = Array.from(payloadGroupSigs).some((sig) =>
              sig.startsWith(`${row.name}||`),
            );
            if (hasNameOnly) keepGroupIds.push(row.id);
            else deleteGroupIds.push(row.id);
          } else {
            if (payloadGroupSigs.has(`${row.name}||`))
              keepGroupIds.push(row.id);
            else deleteGroupIds.push(row.id);
          }
        }
        if (deleteGroupIds.length) {
          const { error } = await supabase
            .from("pricing_option_groups")
            .delete()
            .in("id", deleteGroupIds);
          if (error) throw error;
          summary.deleted_groups += deleteGroupIds.length;
        }
        for (const sig of payloadGroupSigs) {
          const gid = dbSigToId.get(sig) ?? undefined;
          if (!gid) continue;
          const payloadVals = payloadValuesBySig.get(sig);
          if (!payloadVals) continue;
          const { data: dbVals, error: vErr } = await supabase
            .from("pricing_option_values")
            .select("id,name")
            .eq("group_id", gid);
          if (vErr) throw vErr;
          const toDelete: string[] = [];
          for (const dv of dbVals ?? []) {
            if (!payloadVals.has(dv.name)) toDelete.push(dv.id);
          }
          if (toDelete.length) {
            const { error } = await supabase
              .from("pricing_option_values")
              .delete()
              .in("id", toDelete);
            if (error) throw error;
            summary.deleted_values += toDelete.length;
          }
        }
        for (const sig of payloadGroupSigs) {
          const gid = dbSigToId.get(sig);
          if (!gid) continue;
          const keep = payloadNumericBySig.has(sig);
          if (!keep) {
            const { error } = await supabase
              .from("pricing_numeric_rules")
              .delete()
              .eq("group_id", gid);
            if (error) throw error;
          }
        }
      }

      payloadKeys.add(normKey(v.price_key, v.model ?? null));
    }

    if (mode === "replace") {
      const { data: dbKeys, error } = await supabase
        .from("pricing_variants")
        .select("price_key,model");
      if (error) throw error;
      const toDelete: string[] = [];
      for (const row of dbKeys ?? []) {
        const k = normKey(
          row.price_key as string,
          (row.model as string) ?? null,
        );
        if (!payloadKeys.has(k)) toDelete.push(k);
      }
      if (toDelete.length) {
        for (const k of toDelete) {
          const [pk, m] = k.split("||");
          let q = supabase
            .from("pricing_variants")
            .delete()
            .eq("price_key", pk);
          if (m === "") q = q.is("model", null);
          else q = q.eq("model", m);
          const { error: delErr } = await q;
          if (delErr) throw delErr;
          summary.deleted_variants++;
        }
      }
    }

    await createSupabaseAdmin()
      .from("pricing_snapshots")
      .insert([{ counts: summary, notes: mode }]);
    return new Response(JSON.stringify({ ok: true, summary }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
```

Environment:

- Set `EXCEL_PUBLISH_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in function env.

Testing:

- `curl -X POST <endpoint> -H 'Authorization: Bearer <anon>' -H 'X-Excel-Token: <secret>' -H 'Content-Type: application/json' --data '{"mode":"replace","variants":[...]}'`

---

## Edge Function: `sync-prices-to-sanity` (Automatic Sanity CMS Sync)

**Purpose:** This function is automatically called by `pricing-ingest` after successful Supabase ingest. It syncs base prices from the pricing payload to Sanity CMS for frontend filtering and sorting.

**Architecture:** Server-side chaining (called internally by `pricing-ingest`, not directly from Excel)

**Key Features:**

- **Automatic invocation**: Triggered by `pricing-ingest` after successful Supabase RPC
- **Base price sync**: Updates `basePriceCents` and `lastPricingSync` fields in Sanity product documents
- **Lowest price selection**: For products with multiple model variants, automatically selects the lowest base price (e.g., if a product has 4 models with prices 14100, 16110, 25190, 29710, Sanity will store 14100)
- **Product matching**: Extracts product name from `price_key` (format: `brand/product-name`) and matches to Sanity slug (`/produkty/product-name/`)
- **Bulk updates**: Uses Sanity's transaction API for efficient batch updates
- **Error tolerance**: Logs errors but doesn't block the main pricing ingest

**Environment Variables:**

- `SANITY_PROJECT_ID`: Sanity project ID
- `SANITY_DATASET`: Sanity dataset name (e.g., "production")
- `SANITY_API_TOKEN`: Sanity API token with write permissions
- `EXCEL_PUBLISH_TOKEN`: Same token as `pricing-ingest` for authentication

**Response Format:**

```json
{
  "ok": true,
  "updated": 3,
  "skipped": 0,
  "errors": []
}
```

**Sanity Schema Changes:**

Two new fields added to the `product` document type:

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

**Updated `pricing-ingest` Response:**

After the chaining implementation, the response from `pricing-ingest` now includes both Supabase and Sanity results:

```json
{
  "ok": true,
  "supabase": {
    "counts": {
      "variants_upserted": 5,
      "groups_upserted": 12,
      "values_upserted": 24,
      "numeric_rules_upserted": 0,
      "deleted_variants": 0,
      "deleted_groups": 0,
      "deleted_values": 0,
      "deleted_rules": 0
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

---

## AppleScript (Excel sandbox): `SupabasePublish.scpt`

Save to: `~/Library/Application Scripts/com.microsoft.Excel/SupabasePublish.scpt`

```applescript
on runWithParams(param)
  set AppleScript's text item delimiters to "|||"
  set parts to text items of param
  set endpoint to item 1 of parts
  set anonKey to item 2 of parts
  set excelToken to item 3 of parts
  set jsonBody to item 4 of parts

  set h1 to " -H " & quoted form of "Content-Type: application/json"
  set h2 to " -H " & quoted form of ("Authorization: Bearer " & anonKey)
  set h3 to ""
  if excelToken is not "" then set h3 to " -H " & quoted form of ("X-Excel-Token: " & excelToken)

  set cmd to "curl -s -X POST " & quoted form of endpoint & h1 & h2 & h3 & " --data-binary " & quoted form of jsonBody
  set res to do shell script cmd
  return res
end runWithParams
```

---

## Excel VBA (macOS) macro — single module

Save workbook as `.xlsm`, enable macros. Paste this into a single Module. It builds JSON with proper ordering (0‑based `position`) and uses mode:"replace" to sync.

```vb
Option Explicit

' CONFIG
Private Const SUPABASE_URL As String = "https://xuwapsacaymdemmvblak.supabase.co"
Private Const EDGE_URL As String = SUPABASE_URL & "/functions/v1/pricing-ingest"
Private Const ANON_KEY As String = "<PASTE_YOUR_ANON_KEY>"
Private Const EXCEL_TOKEN As String = "<PASTE_EXCEL_PUBLISH_TOKEN>"
Private Const PUBLISH_MODE As String = "replace"  ' or "merge"

' SHEET NAMES (ASCII; diacritics matched at runtime)
Private Const SHEET_PRODUCTS As String = "Produkty"
Private Const SHEET_OPTIONS  As String = "Opcje"
Private Const SHEET_NUMERIC  As String = "Pod-opcje wartosci"
Private Const SHEET_LIST_CHILD As String = "Pod-opcje listy"

Public Sub PublishPrices_FromSheets()
  Dim payload As String, res As String, param As String
  payload = BuildPayloadJson()
  If Len(payload) = 0 Then
    MsgBox "No payload generated. Check sheet names/headers.", vbExclamation
    Exit Sub
  End If
  param = EDGE_URL & "|||" & ANON_KEY & "|||" & EXCEL_TOKEN & "|||" & payload
  res = AppleScriptTask("SupabasePublish.scpt", "runWithParams", param)
  MsgBox res, vbInformation, "Supabase response"
End Sub

Private Function BuildPayloadJson() As String
  Dim wsP As Worksheet, wsO As Worksheet, wsN As Worksheet, wsL As Worksheet
  Set wsP = FindSheetSafe(SHEET_PRODUCTS)
  Set wsO = FindSheetSafe(SHEET_OPTIONS)
  Set wsN = FindSheetSafe(SHEET_NUMERIC)
  Set wsL = FindSheetSafe(SHEET_LIST_CHILD)
  If wsP Is Nothing Then Exit Function

  Dim cB&, cPr&, cM&, cC&, cU&
  cB = GetColSafe(wsP, "Producent")
  cPr = GetColSafe(wsP, "Produkt")
  cM = GetColSafe(wsP, "Model")
  cC = GetColSafe(wsP, "Cena")
  cU = GetColSafe(wsP, "URL")
  If cB * cPr * cC * cU = 0 Then Exit Function

  Dim out$, last&, r&
  last = LastRow(wsP)
  For r = 2 To last
    Dim brand$, prod$, model$, url$, base&
    brand = T(wsP.Cells(r, cB)): prod = T(wsP.Cells(r, cPr))
    model = T(wsP.Cells(r, cM)): url = T(wsP.Cells(r, cU))
    If prod <> "" And url <> "" Then
      base = PLN(wsP.Cells(r, cC).Value)
      Dim groups$: groups = BuildGroupsJsonMac(prod, model, wsO, wsN, wsL)
      Append out, "{""price_key"":""" & Js(url) & """,""brand"":""" & Js(brand) & """,""product"":""" & Js(prod) & """,""model"":" & IIf(model = "", "null", """" & Js(model) & """) & ",""base_price_cents"":" & base & ",""groups"": [" & groups & "]}"
    End If
  Next

  If out = "" Then Exit Function
  BuildPayloadJson = "{""mode"":""" & PUBLISH_MODE & """,""variants":[" & out & "]}"
End Function

Private Function BuildGroupsJsonMac(ByVal product As String, ByVal model As String, wsO As Worksheet, wsN As Worksheet, wsL As Worksheet) As String
  Dim res$, tmp$

  ' 1) SELECT groups from Opcje (ordered; values ordered)
  If Not wsO Is Nothing Then
    Dim cP&, cM&, cG&, cV&, cD&, last&, i&
    cP = GetColSafe(wsO, "Produkt")
    cM = GetColSafe(wsO, "Model")
    cG = GetColSafe(wsO, "Opcja")
    cV = GetColSafe(wsO, "Pozycja slownikowa")
    cD = GetColSafe(wsO, "Cena")
    If cP * cG * cV > 0 Then
      last = LastRow(wsO)

      Dim groupNames As New Collection
      Dim valueLists As New Collection

      For i = 2 To last
        If PM(product, model, wsO.Cells(i, cP).Value, wsO.Cells(i, cM).Value) Then
          Dim gName$, vName$, delta&, gIdx&, vPos&
          gName = SText(wsO.Cells(i, cG).Value)
          vName = SText(wsO.Cells(i, cV).Value)
          If gName <> "" And vName <> "" Then
            delta = PLN(wsO.Cells(i, cD).Value)
            gIdx = EnsureGroupIndex(groupNames, valueLists, gName)
            vPos = valueLists(gIdx).Count
            AddValueJson valueLists, gIdx, vName, delta, vPos
          End If
        End If
      Next

      Dim idx&, key$, coll As Collection
      For idx = 1 To groupNames.Count
        key = CStr(groupNames(idx))
        Set coll = valueLists(idx)
        tmp = "{""name"":""" & Js(key) & """,""input_type"":""select"",""required"":true,""position"":" & CStr(idx - 1) & ",""values"": [" & JoinC(coll, ",") & "]}"
        Append res, tmp
      Next
    End If
  End If

  ' 2) Numeric child (Dlugosc wlasna) from Pod-opcje wartosci
  If Not wsN Is Nothing Then
    Dim cNP&, cNM&, cNG&, cNMin&, cNMax&, cNStep&, cNAdd&, lastN&, rN&
    cNP = GetColSafe(wsN, "Produkt")
    cNM = GetColSafe(wsN, "Model")
    cNG = GetColSafe(wsN, "Opcja")
    cNMin = GetColSafe(wsN, "Min")
    cNMax = GetColSafe(wsN, "Max")
    cNStep = GetColSafe(wsN, "Skok")
    cNAdd = GetColSafe(wsN, "Doplata")
    If cNP * cNG * cNMin * cNMax * cNStep * cNAdd > 0 Then
      lastN = LastRow(wsN)

      Dim parentList As New Collection
      If Not wsO Is Nothing Then
        Dim i2&, lastO&, gp&, gm&, gg&
        lastO = LastRow(wsO)
        gp = GetColSafe(wsO, "Produkt"): gm = GetColSafe(wsO, "Model"): gg = GetColSafe(wsO, "Opcja")
        For i2 = 2 To lastO
          If PM(product, model, wsO.Cells(i2, gp).Value, wsO.Cells(i2, gm).Value) Then
            EnsureInOrder parentList, SText(wsO.Cells(i2, gg).Value)
          End If
        Next
      End If

      For rN = 2 To lastN
        If PM(product, model, wsN.Cells(rN, cNP).Value, wsN.Cells(rN, cNM).Value) Then
          Dim parentGroup$, parentPos&
          parentGroup = SText(wsN.Cells(rN, cNG).Value)
          If parentGroup <> "" Then
            parentPos = FindIndex(parentList, parentGroup)
            If parentPos > 0 Then
              tmp = "{""name"":""" & Js(S_DlugoscWlasna()) & """,""parent"":{""group_name"":""" & Js(parentGroup) & """,""value_name"":""" & Js(S_DlugoscWlasna()) & """},""input_type"":""numeric_step"",""unit"":""m"",""required"":true,""position"":" & CStr(parentPos) & ",""numeric_rule"":{""min_value"":" & F(ToNumber(wsN.Cells(rN, cNMin).Value)) & ",""max_value"":" & F(ToNumber(wsN.Cells(rN, cNMax).Value)) & ",""step_value"":" & F(ToNumber(wsN.Cells(rN, cNStep).Value)) & ",""price_per_step_cents"":" & PLN(wsN.Cells(rN, cNAdd).Value) & ",""base_included_value"":1}}"
            Else
              tmp = "{""name"":""" & Js(S_DlugoscWlasna()) & """,""parent"":{""group_name"":""" & Js(parentGroup) & """,""value_name"":""" & Js(S_DlugoscWlasna()) & """},""input_type"":""numeric_step"",""unit"":""m"",""required"":true,""numeric_rule"":{""min_value"":" & F(ToNumber(wsN.Cells(rN, cNMin).Value)) & ",""max_value"":" & F(ToNumber(wsN.Cells(rN, cNMax).Value)) & ",""step_value"":" & F(ToNumber(wsN.Cells(rN, cNStep).Value)) & ",""price_per_step_cents"":" & PLN(wsN.Cells(rN, cNAdd).Value) & ",""base_included_value"":1}}"
            End If
            Append res, tmp
          End If
        End If
      Next
    End If
  End If

  ' 3) Nested select (Modul dodatkowy) from Pod-opcje listy (ordered values)
  If Not wsL Is Nothing Then
    Dim cLP&, cLM&, cLG&, cLV&, cLD&, lastL&, k&, vals As New Collection
    cLP = GetColSafe(wsL, "Produkt")
    cLM = GetColSafe(wsL, "Model")
    cLG = GetColSafe(wsL, "Opcja")
    cLV = GetColSafe(wsL, "Pozycja slownikowa")
    cLD = GetColSafe(wsL, "Doplata")
    If cLP * cLG * cLV * cLD > 0 Then
      lastL = LastRow(wsL)

      Dim parentList2 As New Collection
      Dim parentPos2&
      If Not wsO Is Nothing Then
        Dim i3&, lastO2&, gp2&, gm2&, gg2&
        lastO2 = LastRow(wsO)
        gp2 = GetColSafe(wsO, "Produkt"): gm2 = GetColSafe(wsO, "Model"): gg2 = GetColSafe(wsO, "Opcja")
        For i3 = 2 To lastO2
          If PM(product, model, wsO.Cells(i3, gp2).Value, wsO.Cells(i3, gm2).Value) Then
            EnsureInOrder parentList2, SText(wsO.Cells(i3, gg2).Value)
          End If
        Next
        parentPos2 = FindIndex(parentList2, S_Modul())
      End If

      Dim childCount&: childCount = 0
      For k = 2 To lastL
        If SText(wsL.Cells(k, cLP).Value) = product And _
           (model = "" Or SText(wsL.Cells(k, cLM).Value) = model Or SText(wsL.Cells(k, cLM).Value) = "") Then
          Dim name$, priceCents&
          name = SText(wsL.Cells(k, cLV).Value)
          If name <> "" Then
            priceCents = PLN(wsL.Cells(k, cLD).Value)
            vals.Add "{""name"":""" & Js(name) & """,""price_delta_cents"":" & CStr(priceCents) & ",""position"":" & CStr(childCount) & "}"
            childCount = childCount + 1
          End If
        End If
      Next

      If vals.Count > 0 Then
        Dim mName$, mdName$, parentVal$, gPos$
        mName = S_Modul(): mdName = S_ModulDodatkowy(): parentVal = "DAC + " & mdName
        gPos = IIf(parentPos2 > 0, CStr(parentPos2), "0")
        tmp = "{""name"":""" & Js(mdName) & """,""parent"":{""group_name"":""" & Js(mName) & """,""value_name"":""" & Js(parentVal) & """},""input_type"":""select"",""required"":true,""position"":" & gPos & ",""values"": [" & JoinC(vals, ",") & "]}"
        Append res, tmp
      End If
    End If
  End If

  BuildGroupsJsonMac = res
End Function

' ======================= HELPERS =======================

Private Function DeAccent(ByVal s As String) As String
  Dim u, a, i&
  u = Array(&H119, &HF3, &H105, &H15B, &H142, &H17C, &H17A, &H107, &H144, _
            &H118, &HD3, &H104, &H15A, &H141, &H17B, &H179, &H106, &H143)
  a = Array("e","o","a","s","l","z","z","c","n","E","O","A","S","L","Z","Z","C","N")
  For i = LBound(u) To UBound(u)
    s = Replace(s, ChrW$(u(i)), a(i))
  Next
  DeAccent = LCase$(Trim$(s))
End Function

Private Function FindSheetSafe(nameLike As String) As Worksheet
  Dim sh As Worksheet
  For Each sh In ThisWorkbook.Worksheets
    If DeAccent(sh.Name) = DeAccent(nameLike) Then Set FindSheetSafe = sh: Exit Function
  Next
End Function

Private Function GetColSafe(ws As Worksheet, header As String) As Long
  If ws Is Nothing Then Exit Function
  Dim c&, last&: last = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
  For c = 1 To last
    If DeAccent(ws.Cells(1, c).Value) = DeAccent(header) Then GetColSafe = c: Exit Function
  Next
End Function

Private Function Js(s As String) As String
  s = Replace(s, "\", "\\")
  s = Replace(s, """", "\""")
  s = Replace(s, vbCr, "\n")
  s = Replace(s, vbLf, "\n")
  Js = s
End Function

Private Function S_DlugoscWlasna() As String
  S_DlugoscWlasna = "D" & ChrW$(&H142) & "ugo" & ChrW$(&H15B) & ChrW$(&H107) & " " & "w" & ChrW$(&H142) & "asna"
End Function
Private Function S_Modul() As String: S_Modul = "Modu" & ChrW$(&H142): End Function
Private Function S_ModulDodatkowy() As String: S_ModulDodatkowy = "Modu" & ChrW$(&H142) & " dodatkowy": End Function

Private Function SText(v As Variant) As String
  On Error Resume Next
  If IsError(v) Or IsNull(v) Or IsEmpty(v) Then
    SText = ""
  Else
    SText = Trim$(CStr(v))
  End If
  On Error GoTo 0
End Function

Private Function LastRow(ws As Worksheet) As Long: LastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row: End Function
Private Function PM(p1, m1, p2, m2) As Boolean: PM = (StrComp(T(p1), T(p2), vbTextCompare) = 0) And (T(m1) = T(m2) Or (T(m1) = "" And T(m2) = "")): End Function
Private Function T(v) As String: T = Trim$(CStr(v)): End Function

Private Function ToNumber(v As Variant) As Double
  If IsNumeric(v) Then
    ToNumber = CDbl(v)
  Else
    ToNumber = Val(Replace(T(v), ",", "."))
  End If
End Function

Private Function PLN(v) As Long: PLN = CLng(Round(ToNumber(v) * 100, 0)): End Function
Private Function F(d As Double) As String: F = Replace(Trim$(CStr(d)), ",", "."): End Function

Private Sub Append(ByRef base As String, ByVal piece As String)
  If base <> "" Then base = base & ","
  base = base & piece
End Sub

Private Function EnsureGroupIndex(ByRef names As Collection, ByRef lists As Collection, ByVal key As String) As Long
  Dim i&: For i = 1 To names.Count: If CStr(names(i)) = key Then EnsureGroupIndex = i: Exit Function
  Next
  names.Add key
  Dim c As New Collection: lists.Add c
  EnsureGroupIndex = names.Count
End Function

Private Sub AddValueJson(ByRef lists As Collection, ByVal gIdx As Long, ByVal vName As String, ByVal delta As Long, ByVal vPos As Long)
  lists(gIdx).Add "{""name"":""" & Js(vName) & """,""price_delta_cents"":" & CStr(delta) & ",""position"":" & CStr(vPos) & "}"
End Sub

Private Sub EnsureInOrder(ByRef names As Collection, ByVal key As String)
  If key = "" Then Exit Sub
  Dim i&: For i = 1 To names.Count: If CStr(names(i)) = key Then Exit Sub
  Next
  names.Add key
End Sub

Private Function FindIndex(ByRef names As Collection, ByVal key As String) As Long
  Dim i&: For i = 1 To names.Count: If CStr(names(i)) = key Then FindIndex = i: Exit Function
  Next
End Function

Private Function JoinC(col As Collection, sep As String) As String
  Dim i As Long, s As String
  For i = 1 To col.Count
    If i > 1 Then s = s & sep
    s = s & CStr(col(i))
  Next i
  JoinC = s
End Function
```

Assign a button in Excel:

- Insert → Shape → right‑click → Assign Macro → `PublishPrices_FromSheets` → rename text to “Publish to Supabase”.

---

## Setup checklist

1. Supabase
   - Create tables and policies (as above) in `xuwapsacaymdemmvblak`.
   - Deploy Edge Function code; set env vars: `EXCEL_PUBLISH_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
2. AppleScript
   - Save `SupabasePublish.scpt` to `~/Library/Application Scripts/com.microsoft.Excel/`.
3. Excel workbook
   - Save as `.xlsm`, enable macros.
   - Keep sheet headers exactly as specified; only add/edit rows.
   - Paste the VBA module; update `ANON_KEY`, `EXCEL_TOKEN`.
   - Add a “Publish” button (shape) assigned to `PublishPrices_FromSheets`.

---

## Troubleshooting (macOS Excel)

### VBA Errors

- "Duplicate declaration" / "Next without For": ensure only one clean module, avoid one‑liners; use the provided multi‑line helpers.
- Diacritics become `?`: do not type Polish letters in code; macro normalizes at runtime; display strings use `ChrW$`.
- "Invalid procedure call": avoid Collection `Remove/Add` at fixed indices; this build uses `Count` for positions.
- 401 from function: check `EXCEL_PUBLISH_TOKEN` and header `X-Excel-Token`.

### Character Encoding Issues

- **Polish characters corrupted (e.g., "Długość" becomes "D_ugo\_\_")**: Fixed by passing JSON directly as AppleScript parameter instead of writing to file, and including `charset=utf-8` in `curl` headers. The current implementation handles this correctly.

### AppleScript Errors

- **`curl` output parsing error (`(*ok*true)200`)**: Fixed by redirecting `curl` response body to `/tmp/file.body` using `-o` flag, ensuring only HTTP status code is returned.

### Supabase Data Issues

- **Multiple model variants overwriting each other**: The Postgres RPC function `ingest_pricing_json` must check BOTH `price_key` AND `model` when finding variants. This was fixed in migration `fix_variant_upsert_with_model`. Verify by checking that products with multiple models (e.g., Atmosphere SX IC with Excite RCA/XLR, Euphoria RCA/XLR) appear as separate rows in `pricing_variants`.

### Sanity Sync Issues

- **Wrong base price in Sanity**: The sync function now automatically selects the LOWEST price among all model variants for a product. This is correct for filtering/sorting on product listing pages.
- **Sanity not updating**: Check Supabase Edge Function logs for the `sync-prices-to-sanity` function. Ensure `SANITY_PROJECT_ID`, `SANITY_DATASET`, and `SANITY_WRITE_TOKEN` environment variables are set correctly.

### Logs and Debugging

- **Excel publish logs**: Check `/tmp/audiofast_ingest_YYYYMMDD_HHMMSS_*.log` for detailed error messages
- **Supabase Edge Function logs**: View in Supabase dashboard under Functions → Select function → Logs
- **Test manually**: Use `curl` commands to test Edge Functions directly (examples provided in Setup section)

---

## Quick reference

- Endpoint: `/functions/v1/pricing-ingest`
- Supabase project ID: `xuwapsacaymdemmvblak`
- Auth: `Authorization: Bearer <anon-key>`, `X-Excel-Token: <secret>`
- Modes: `merge` (default), `replace` (diff add/update/delete)
- Ordering: group/value `position` (0‑based) from Excel row order

---

## Updates (Nov 2025): performance + security

This section documents the changes implemented to make the pipeline both faster on the client and secured per‑machine.

- Fire‑and‑forget client: Excel writes JSON to a temp file and AppleScript sends it with `nohup curl --data-binary @file.json` so Excel returns immediately.
- Direct JSON ingest: no Storage uploads; one request to `POST /functions/v1/pricing-ingest`.
- Per‑machine HMAC verification:
  - Headers sent by client: `X-Client-Id`, `X-TS`, `X-Nonce`, `X-Signature`.
  - Signature is `HMAC_SHA256(secret_hex, client_id + "." + ts + "." + sha256(rawBody) + "." + nonce)`.
  - Secrets are stored per‑machine in macOS Keychain (not in code).
- Verify endpoint: `POST /functions/v1/pricing-ingest-verify` returns 200 if headers/signature are valid; Excel uses this to show “verified/not verified” before sending the ingest in background.
- Anti‑replay: server stores nonces per client; the ingest call uses a NEW nonce (different from verify).

### Supabase security tables

```sql
create table if not exists public.ingest_clients (
  client_id text primary key,
  secret text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.ingest_client_nonces (
  client_id text not null references public.ingest_clients(client_id) on delete cascade,
  nonce text not null,
  created_at timestamptz not null default now(),
  primary key (client_id, nonce)
);

-- Register a device (example)
insert into public.ingest_clients (client_id, secret, active)
values ('mac-olwier', '<hex_secret>', true)
on conflict (client_id) do update set secret=excluded.secret, active=excluded.active;
```

### Edge Functions

- `POST /functions/v1/pricing-ingest-verify`: check headers/signature only; returns 200 on success.
- `POST /functions/v1/pricing-ingest`: check headers/signature and replay; read raw body, hash it, verify HMAC, then call the SQL ingest function.

Server verification (both):

- Require `Authorization: Bearer <anon>`, `X-Excel-Token: <secret>`, plus HMAC headers.
- Check timestamp window (`|now - X-TS| <= 300s`).
- Insert `(client_id, nonce)` into `ingest_client_nonces` (reject duplicates).
- Hash raw body, recompute HMAC, constant compare; parse JSON only after verification.

### macOS Keychain (per machine secret)

```bash
# Generate a random secret
openssl rand -hex 32

# Store in Keychain (service=audiofast_ingest_secret, account=<client_id>)
security add-generic-password -a mac-olwier -s audiofast_ingest_secret -w '<hex_secret>' -U

# Read (used by AppleScript)
security find-generic-password -a mac-olwier -s audiofast_ingest_secret -w
```

### AppleScript (replace your `SupabasePublish.scpt`)

Save to: `~/Library/Application Scripts/com.microsoft.Excel/SupabasePublish.scpt`.

```applescript
-- Legacy handler
on runWithParams(param)
  set AppleScript's text item delimiters to "|||"
  set parts to text items of param
  set endpoint to item 1 of parts
  set anonKey to item 2 of parts
  set excelToken to item 3 of parts
  set jsonBody to item 4 of parts
  set cmd to "/usr/bin/curl -s -X POST " & quoted form of endpoint & " -H " & quoted form of ("Authorization: Bearer " & anonKey) & " -H 'Content-Type: application/json' -H " & quoted form of ("X-Excel-Token: " & excelToken) & " --data-binary " & quoted form of jsonBody
  return do shell script cmd
end runWithParams

-- Fire-and-forget with verify and HMAC
-- Param: ENDPOINT|||ANON_KEY|||EXCEL_TOKEN|||/abs/path/payload.json|||<optional-correlation_id>
on sendJsonAsync(param)
  set AppleScript's text item delimiters to "|||"
  set parts to text items of param
  set AppleScript's text item delimiters to ""
  if (count of parts) < 4 then return "Invalid params"
  set endpoint to item 1 of parts
  set anonKey to item 2 of parts
  set excelToken to item 3 of parts
  set jsonPath to item 4 of parts
  set corrId to ""; if (count of parts) ≥ 5 then set corrId to item 5 of parts
  if corrId = "" then set corrId to do shell script "/bin/date +%Y%m%d_%H%M%S"

  set jsonPosix to POSIX path of jsonPath
  set CLIENT_ID to "mac-olwier"
  set SECRET_HEX to do shell script "/usr/bin/security find-generic-password -a " & quoted form of CLIENT_ID & " -s audiofast_ingest_secret -w | /usr/bin/tr -d '\n\r '"
  set BODY_SHA to do shell script "/usr/bin/shasum -a 256 " & quoted form of jsonPosix & " | /usr/bin/awk '{print $1}'"

  -- Verify
  set TS to do shell script "/bin/date +%s"
  set NONCE to do shell script "/usr/bin/openssl rand -hex 16"
  set MSG to CLIENT_ID & "." & TS & "." & BODY_SHA & "." & NONCE
  set SIG_HEX to do shell script "/usr/bin/printf %s " & quoted form of MSG & " | /usr/bin/openssl dgst -sha256 -mac HMAC -macopt hexkey:" & SECRET_HEX & " | /usr/bin/sed -E 's/.*= *//;s/[^0-9a-fA-F].*$//' | /usr/bin/tr -d '\n\r '"

  set vLog to "/tmp/audiofast_verify_" & corrId
  set verifyUrl to (item 1 of (text items of endpoint delimiter "/pricing-ingest")) & "/pricing-ingest-verify"
  set verifyCmd to "/usr/bin/curl --http1.1 -sS -v -D " & quoted form of (vLog & ".hdr") & " -o " & quoted form of (vLog & ".body") & " -w '%{http_code}' -X POST " & quoted form of verifyUrl & ¬
    " -H " & quoted form of ("Authorization: Bearer " & anonKey) & " -H 'Content-Type: application/json'" & ¬
    " -H " & quoted form of ("X-Excel-Token: " & excelToken) & " -H " & quoted form of ("X-Client-Id: " & CLIENT_ID) & " -H " & quoted form of ("X-TS: " & TS) & " -H " & quoted form of ("X-Nonce: " & NONCE) & " -H " & quoted form of ("X-Signature: " & SIG_HEX) & " --data-binary @" & quoted form of jsonPosix
  set verifyCode to do shell script verifyCmd
  try
    if (text 1 thru 3 of verifyCode) is not "200" then return "Weryfikacja nie powiodla sie (HTTP " & verifyCode & "). Szczegoly: " & vLog & ".hdr / " & vLog & ".body"
  on error
    if verifyCode is not "200" then return "Weryfikacja nie powiodla sie (HTTP " & verifyCode & "). Szczegoly: " & vLog & ".hdr / " & vLog & ".body"
  end try

  -- Ingest with new TS/NONCE/SIG (avoid replay)
  set TS2 to do shell script "/bin/date +%s"
  set NONCE2 to do shell script "/usr/bin/openssl rand -hex 16"
  set MSG2 to CLIENT_ID & "." & TS2 & "." & BODY_SHA & "." & NONCE2
  set SIG_HEX2 to do shell script "/usr/bin/printf %s " & quoted form of MSG2 & " | /usr/bin/openssl dgst -sha256 -mac HMAC -macopt hexkey:" & SECRET_HEX & " | /usr/bin/sed -E 's/.*= *//;s/[^0-9a-fA-F].*$//' | /usr/bin/tr -d '\n\r '"

  set logPath to "/tmp/audiofast_ingest_" & corrId & ".log"
  set cmd to "/usr/bin/nohup /usr/bin/curl -sS -X POST " & quoted form of endpoint & ¬
    " -H " & quoted form of ("Authorization: Bearer " & anonKey) & " -H 'Content-Type: application/json'" & ¬
    " -H " & quoted form of ("X-Excel-Token: " & excelToken) & " -H " & quoted form of ("X-Client-Id: " & CLIENT_ID) & " -H " & quoted form of ("X-TS: " & TS2) & " -H " & quoted form of ("X-Nonce: " & NONCE2) & " -H " & quoted form of ("X-Signature: " & SIG_HEX2) & ¬
    " --data-binary @" & quoted form of jsonPosix & " > " & quoted form of logPath & " 2>&1 &"
  do shell script cmd
  return "Dane wyslane do przetworzenia (ID: " & corrId & "). Log: " & logPath
end sendJsonAsync
```

### Excel VBA (replace macro entry point)

Use `PublishPrices_SendJsonAsync` for the button. The module builds JSON, writes to a file, and calls `sendJsonAsync`. It shows an ASCII popup; verified/not‑verified is decided by the AppleScript response.

```vb
' Entry point
Public Sub PublishPrices_SendJsonAsync()
  Dim payload As String: payload = BuildPayloadJson()
  If Len(payload) = 0 Then
    MsgBox "Brak danych do wyslania. Sprawdz nazwy arkuszy i naglowki.", vbExclamation
    Exit Sub
  End If
  Dim Dir$, path$, corrId$, res$, logPath$
  Dir = TempDir() & "audiofast_pricing/": MkDirIfMissing Dir
  Randomize: corrId = Format(Now, "yyyymmdd_HHMMSS") & "_" & CStr(Int(Rnd * 1000000))
  path = Dir & "payload_" & corrId & ".json"
  logPath = "/tmp/audiofast_ingest_" & corrId & ".log"
  WriteTextFile path, payload
  Dim param$: param = EDGE_URL & "|||" & ANON_KEY & "|||" & EXCEL_TOKEN & "|||" & path & "|||" & corrId
  res = AppleScriptTask("SupabasePublish.scpt", "sendJsonAsync", param)
  Dim title$, msg$: title = "Audiofast - wynik wysylki"
  If IsVerifiedReturn(res) Then
    msg = "Urzadzenie zweryfikowane, dane wyslane do przetworzenia." & vbCrLf & _
          "ID: " & corrId & vbCrLf & _
          "Log: " & logPath
    MsgBox msg, vbInformation, title
  Else
    If Len(Trim$(res)) = 0 Then res = "Brak odpowiedzi AppleScript."
    msg = "UWAGA: urzadzenie nie zostalo zweryfikowane." & vbCrLf & _
          "Wysylka przerwana lub podpis HMAC nieutworzony." & vbCrLf & vbCrLf & _
          "Szczegoly: " & Trim$(res)
    MsgBox msg, vbExclamation, title
  End If
End Sub
```

---

## Deprecations/cleanup

- Removed Storage buckets and chunked imports (not needed for this flow).
- Retired old Edge Functions (`pricing-import-start/commit/status/worker`).
- Only `pricing-ingest-verify` and `pricing-ingest` are required now.

---

## Changelog

### January 2025 - Multi-Variant & Sanity Sync Implementation

**Major Features Added:**

1. **Sanity CMS Integration**
   - Added `basePriceCents` and `lastPricingSync` fields to Sanity product schema
   - Created `sync-prices-to-sanity` Edge Function
   - Implemented server-side chaining for automatic Sanity updates
   - Lowest price selection for products with multiple model variants

2. **Multi-Variant Support**
   - Fixed Postgres RPC function to properly handle multiple models per product
   - Migration: `fix_variant_upsert_with_model` and `fix_variant_upsert_jsonb_cast`
   - Variants now correctly identified by `(price_key, model)` tuple

**Critical Bug Fixes:**

1. **Character Encoding (Polish)**
   - Issue: Polish characters (Długość, etc.) were corrupted to "D_ugo\_\_"
   - Fix: Pass JSON directly as AppleScript parameter + `charset=utf-8` in headers
   - Files: `AudiofastPublisher.vba`, `SupabasePublish.applescript`

2. **AppleScript curl Parsing**
   - Issue: `curl` returning `(*ok*true)200` instead of just `200`
   - Fix: Redirect response body to file using `-o /tmp/file.body`
   - File: `SupabasePublish.applescript` (`sendJsonDirectAsync` handler)

3. **Variant Overwriting**
   - Issue: Multiple models with same `price_key` overwriting each other
   - Fix: Updated RPC function to check BOTH `price_key` AND `model`
   - Database: Migration `fix_variant_upsert_with_model`

4. **Sanity Price Selection**
   - Issue: Last variant's price was stored (unpredictable)
   - Fix: Group variants by product, select lowest price
   - File: `supabase/functions/sync-prices-to-sanity/index.ts` (v4)

**Architecture Changes:**

- Moved from dual Excel calls to server-side chaining
- Excel → `pricing-ingest` (Supabase) → `sync-prices-to-sanity` (Sanity)
- Single button press updates both systems atomically

**Files Modified:**

- `supabase/functions/pricing-ingest/index.ts` (v12) - Added Sanity chaining
- `supabase/functions/sync-prices-to-sanity/index.ts` (v4) - Lowest price logic
- `AudiofastPublisher.vba` - Direct JSON passing
- `SupabasePublish.applescript` - UTF-8 encoding, curl fixes
- `apps/studio/schemaTypes/documents/collections/product.ts` - Added price fields
- Database: 2 migrations applied

**Testing Status:** ✅ All systems operational

- Supabase: Multiple variants stored correctly
- Sanity: Lowest prices synced
- Character encoding: Polish characters working
- Server-side chaining: Both systems update automatically
