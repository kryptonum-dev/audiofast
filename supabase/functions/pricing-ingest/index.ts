import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3';

// v41 - No hard-coded token fallback: the shared secret lives only in the
// EXCEL_PUBLISH_TOKEN function secret.
const EXCEL_TOKEN = Deno.env.get('EXCEL_PUBLISH_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-excel-token, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Variant {
  price_key?: string;
  brand?: string;
  product?: string;
  model?: string | null;
  base_price_cents?: number;
  position?: number;
  related_products?: string[];
  groups?: unknown[];
  is_sellable_online?: boolean;
  is_returnable?: boolean;
  isSellableOnline?: boolean;
  isReturnable?: boolean;
}

interface CpoProductInput {
  brand?: string;
  name?: string;
  key?: string;
  price_cents?: number;
  url?: string;
  description?: string;
  is_sellable_online?: boolean;
  is_returnable?: boolean;
  isSellableOnline?: boolean;
  isReturnable?: boolean;
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

// v43 - Expires the web's Supabase pricing cache (`product-pricing` tag) once
// per run. Sanity sync tags never cover Supabase data, and until 2026-10 the
// only thing expiring this tag was the old `/api/revalidate` webhook, as a side
// effect of sync-prices-to-sanity patching Sanity products.
//
// Secrets (Supabase function secrets, never in source):
// - SANITY_REVALIDATE_TAGS_SECRET: byte-identical to the Vercel value of the
//   same name (the web route authenticates it in constant time).
// - REVALIDATE_TAGS_URL (optional): defaults to the production endpoint. The
//   TRAILING SLASH is required: the site 308s slashless paths and drops the body.
const DEFAULT_REVALIDATE_TAGS_URL = 'https://audiofast.pl/api/revalidate-tags/';

const createTimeoutSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
};

async function invalidatePricingCache(): Promise<string> {
  const secret = Deno.env.get('SANITY_REVALIDATE_TAGS_SECRET');
  if (!secret) {
    console.error(
      'SANITY_REVALIDATE_TAGS_SECRET is not configured; product pricing cache NOT invalidated',
    );
    return 'skipped:missing_secret';
  }

  const url =
    Deno.env.get('REVALIDATE_TAGS_URL') ?? DEFAULT_REVALIDATE_TAGS_URL;
  const timeout = createTimeoutSignal(15000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customTags: ['product-pricing'] }),
      redirect: 'manual',
      signal: timeout.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(
        'revalidate-tags failed:',
        response.status,
        text.slice(0, 200),
      );
      return 'failed:' + response.status;
    }
    console.log('revalidate-tags completed:', text.slice(0, 200));
    return 'ok';
  } catch (err) {
    console.error('revalidate-tags error:', err);
    return 'error:' + (err instanceof Error ? err.message : String(err));
  } finally {
    timeout.clear();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    const auth = req.headers.get('authorization') || '';
    if (!auth.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Missing Bearer token' }, 401);
    }

    if (!EXCEL_TOKEN) {
      console.error('EXCEL_PUBLISH_TOKEN is not configured');
      return jsonResponse({ error: 'Server misconfigured' }, 500);
    }

    const token = req.headers.get('x-excel-token');
    if (token !== EXCEL_TOKEN) {
      return jsonResponse({ error: 'Invalid X-Excel-Token' }, 401);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    const mode = body?.mode ?? 'replace';
    const variants: Variant[] = body?.variants ?? [];
    const cpoProducts: CpoProductInput[] = body?.cpo_products ?? [];

    if (!Array.isArray(variants)) {
      return jsonResponse({ error: 'variants must be an array' }, 422);
    }

    if (!Array.isArray(cpoProducts)) {
      return jsonResponse({ error: 'cpo_products must be an array' }, 422);
    }

    const variantsWithoutPosition: string[] = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (typeof v.position !== 'number') {
        const identifier = v.price_key || v.product || `index ${i}`;
        variantsWithoutPosition.push(identifier);
      }
    }

    if (variantsWithoutPosition.length > 0) {
      const maxExamples = 5;
      const examples = variantsWithoutPosition.slice(0, maxExamples);
      const moreCount = variantsWithoutPosition.length - maxExamples;

      return jsonResponse(
        {
          error: 'Missing position field',
          message: `All variants must have a numeric 'position' field. Found ${variantsWithoutPosition.length} variant(s) without position.`,
          examples,
          hint: 'Update your Excel script to include position tracking. See documentation.',
          more: moreCount > 0 ? `...and ${moreCount} more` : undefined,
        },
        422,
      );
    }

    console.log(
      'pricing-ingest v43: ' +
        variants.length +
        ' variants, ' +
        cpoProducts.length +
        ' cpo products',
    );

    const variantsWithRelated = variants.filter(
      (v: Variant) =>
        v.related_products &&
        Array.isArray(v.related_products) &&
        v.related_products.length > 0,
    );

    console.log(
      'Found ' + variantsWithRelated.length + ' variants with related_products',
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase.rpc('ingest_pricing_json', {
      p_mode: mode,
      p_variants: variants,
    });

    if (error) {
      console.error('RPC error:', error);
      throw new Error(error.message);
    }

    const headers = {
      Authorization: 'Bearer internal-edge-function',
      'X-Excel-Token': token!,
      'Content-Type': 'application/json',
    };

    const pricesPromise = (async () => {
      const timeout = createTimeoutSignal(180000);
      try {
        console.log(
          'Starting sync-prices-to-sanity with ' +
            variants.length +
            ' variants',
        );

        const response = await fetch(
          supabaseUrl + '/functions/v1/sync-prices-to-sanity',
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ trigger: true, variants }),
            signal: timeout.signal,
          },
        );

        const responseText = await response.text();
        if (!response.ok) {
          console.error('sync-prices-to-sanity failed:', responseText);
          return 'failed:' + response.status;
        }

        const result = JSON.parse(responseText);
        console.log('sync-prices-to-sanity completed:', JSON.stringify(result));
        // v15 reconcile response shape.
        const results = result?.results ?? {};
        const planned = results.planned ?? {};
        return (
          'applied:' +
          (results.applied ?? 0) +
          ',set:' +
          (planned.set ?? 0) +
          ',cleared:' +
          (planned.unset ?? 0) +
          ',unchanged:' +
          (planned.unchanged ?? 0) +
          ',unmatched:' +
          (results.unmatchedSupabaseSlugs?.length ?? 0) +
          ',errors:' +
          (results.errorCount ?? 0)
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('sync-prices-to-sanity timed out after 180s');
          return 'timeout';
        }
        console.error('sync-prices-to-sanity error:', err);
        return 'error:' + (err instanceof Error ? err.message : String(err));
      } finally {
        timeout.clear();
      }
    })();

    const relatedPromise =
      variantsWithRelated.length > 0
        ? (async () => {
            const timeout = createTimeoutSignal(120000);
            try {
              console.log(
                'Starting sync-related-products with ' +
                  variantsWithRelated.length +
                  ' variants',
              );

              const relatedResp = await fetch(
                supabaseUrl + '/functions/v1/sync-related-products',
                {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ variants: variantsWithRelated }),
                  signal: timeout.signal,
                },
              );

              if (relatedResp.ok) {
                const result = await relatedResp.json();
                console.log(
                  'sync-related-products completed:',
                  JSON.stringify(result),
                );
                return (
                  'updated:' +
                  (result?.results?.updated || 0) +
                  ',drafts:' +
                  (result?.results?.drafts || 0)
                );
              }

              const errText = await relatedResp.text();
              console.error('sync-related-products failed:', errText);
              return 'failed:' + relatedResp.status;
            } catch (err) {
              if (err instanceof Error && err.name === 'AbortError') {
                console.log('sync-related-products timed out after 120s');
                return 'timeout';
              }
              console.error('sync-related-products error:', err);
              return (
                'error:' + (err instanceof Error ? err.message : String(err))
              );
            } finally {
              timeout.clear();
            }
          })()
        : Promise.resolve('not_triggered');

    const cpoPromise =
      cpoProducts.length > 0
        ? (async () => {
            const timeout = createTimeoutSignal(120000);
            try {
              console.log(
                'Starting cpo-product-sync with ' +
                  cpoProducts.length +
                  ' products',
              );

              const cpoResponse = await fetch(
                supabaseUrl + '/functions/v1/cpo-product-sync',
                {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    mode,
                    products: cpoProducts,
                  }),
                  signal: timeout.signal,
                },
              );

              const responseText = await cpoResponse.text();
              if (!cpoResponse.ok) {
                console.error('cpo-product-sync failed:', responseText);
                return {
                  error: `CPO sync failed: ${cpoResponse.status}`,
                  details: responseText,
                };
              }

              const result = JSON.parse(responseText);
              console.log(
                'cpo-product-sync completed:',
                JSON.stringify(result),
              );
              return result;
            } catch (err) {
              if (err instanceof Error && err.name === 'AbortError') {
                console.log('cpo-product-sync timed out after 120s');
                return { error: 'CPO sync timeout' };
              }

              console.error('cpo-product-sync error:', err);
              return {
                error: err instanceof Error ? err.message : String(err),
              };
            } finally {
              timeout.clear();
            }
          })()
        : Promise.resolve(undefined);

    const [pricesResult, relatedResult, cpoResult] = await Promise.all([
      pricesPromise,
      relatedPromise,
      cpoPromise,
    ]);

    // Prices dropped from the price list are cleared in Sanity by the full
    // reconcile inside sync-prices-to-sanity (v15+), which runs above and is
    // awaited. The previous fire-and-forget call to clear-sanity-pricing was
    // never actually executed: the isolate shuts down once this response is
    // returned, so unawaited work is killed. It also deleted editors' drafts and
    // could clear a product that merely lost one of its models.
    const deletedPriceKeys = data?.deleted_price_keys || [];

    // After the RPC and the Sanity sync have settled, so the web re-reads the
    // new Supabase prices. Awaited: the isolate shuts down once the response
    // is returned, so fire-and-forget work would be killed. Best effort — a
    // failure is reported in the response, never fails the run.
    const pricingCacheResult = await invalidatePricingCache();

    return jsonResponse({
      ok: true,
      supabase: {
        counts: {
          variants: data.variants,
          groups: data.groups,
          values: data.values,
          numeric: data.numeric,
        },
        deleted_products: deletedPriceKeys.length,
      },
      sanity: {
        prices: pricesResult,
        related_products: relatedResult || 'not_triggered',
        related_products_count: variantsWithRelated.length,
      },
      web: {
        pricing_cache: pricingCacheResult,
      },
      cpo: cpoResult,
    });
  } catch (e) {
    console.error('pricing-ingest error:', e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
