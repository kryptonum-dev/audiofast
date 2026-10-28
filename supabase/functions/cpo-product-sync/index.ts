import { createClient as createSanityClient } from 'https://esm.sh/@sanity/client@6.21.3';

// v12 - No Next.js revalidation call. Every change this function makes is a
// Sanity mutation on `cpoProduct` documents (createOrReplace, delete, archive
// patch), and every web read of CPO data goes through `defineLive`, so the
// `invalidate-sync-tags` Sanity Function already expires each affected page
// (listing, detail, sitemap) through `/api/revalidate-tags/` within seconds.
// The old POST of {tags:['cpoProduct','cpoPage'], paths} to `/api/revalidate`
// (NEXT_REVALIDATE_URL + NEXT_REVALIDATE_TOKEN) is gone with that route.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-excel-token, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

interface NormalizedCpoProduct {
  brand: string;
  name: string;
  key: string;
  price_cents: number;
  url: string;
  description: string;
  isSellableOnline: boolean;
  isReturnable: boolean;
}

interface ExistingCpoDoc {
  _id: string;
  _type: 'cpoProduct';
  isArchived?: boolean;
  slug?: { current?: string };
  [key: string]: unknown;
}

interface ExistingCpoPair {
  baseId: string;
  published?: ExistingCpoDoc;
  draft?: ExistingCpoDoc;
}

const requiredEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
};

const getSanityWriteToken = (): string => {
  const token = Deno.env.get('SANITY_WRITE_TOKEN') ?? Deno.env.get('SANITY_API_TOKEN');
  if (!token) throw new Error('Missing env: SANITY_WRITE_TOKEN or SANITY_API_TOKEN');
  return token;
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

const normalizeKey = (raw: string): string => {
  let key = raw.trim();
  key = key.replace(/^https?:\/\/[^/]+/i, '');
  key = key.replace(/^\/?certyfikowany-sprzet-uzywany\//i, '');
  key = key.replace(/^\/+|\/+$/g, '');
  return key;
};

const keyToSlug = (key: string): string => `/certyfikowany-sprzet-uzywany/${key}/`;
const keyToDocId = (key: string): string => `cpo-${key}`;
const baseDocId = (id: string): string => id.replace(/^drafts\./, '');
const isDraftId = (id: string): boolean => id.startsWith('drafts.');

const detectProductType = (url: string): 'external' | 'internal' => {
  const trimmed = url.trim();
  if (!trimmed) return 'internal';
  return /^https?:\/\//i.test(trimmed) ? 'external' : 'internal';
};

const extractProductSlug = (rawUrl: string): string | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null;

  const cleaned = trimmed.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
  const parts = cleaned.split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  return parts[parts.length - 1].toLowerCase();
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    return normalized === 'TAK' || normalized === 'TRUE';
  }
  return false;
};

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const hasImageAsset = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || !('asset' in value)) return false;
  const asset = (value as { asset?: unknown }).asset;
  return Boolean(
    asset &&
      typeof asset === 'object' &&
      '_ref' in asset &&
      typeof (asset as { _ref?: unknown })._ref === 'string' &&
      (asset as { _ref: string })._ref.trim(),
  );
};

const hasReference = (value: unknown): boolean =>
  Boolean(
    value &&
      typeof value === 'object' &&
      '_ref' in value &&
      typeof (value as { _ref?: unknown })._ref === 'string' &&
      (value as { _ref: string })._ref.trim(),
  );

const hasSeoObject = (value: unknown): boolean =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const hasShortDescription = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const opisExcelToShortDescription = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return [];

  return [
    {
      _type: 'block',
      style: 'normal',
      children: [{ _type: 'span', marks: [], text: normalized }],
      markDefs: [],
    },
  ];
};

const sanitizeDocumentForId = (
  source: ExistingCpoDoc | undefined,
  targetId: string,
): Record<string, unknown> => {
  const cloned = source ? deepClone(source) : {};
  delete (cloned as Record<string, unknown>)._id;
  delete (cloned as Record<string, unknown>)._rev;
  delete (cloned as Record<string, unknown>)._createdAt;
  delete (cloned as Record<string, unknown>)._updatedAt;
  delete (cloned as Record<string, unknown>)._originalId;

  return {
    ...cloned,
    _id: targetId,
    _type: 'cpoProduct',
  };
};

const applyAvailableAvailability = (document: Record<string, unknown>) => {
  document.availabilityStatus = 'available';
  document.availabilityUpdatedAt = new Date().toISOString();
  delete document.holdUntil;
  delete document.holdOrderNumber;
  delete document.holdPaymentSessionId;
  delete document.soldOrderNumber;
};

const getPublishBlockingValidationErrors = (document: Record<string, unknown>): string[] => {
  const validationErrors: string[] = [];
  const productType = typeof document.productType === 'string' ? document.productType : null;
  const externalUrl = typeof document.externalUrl === 'string' ? document.externalUrl.trim() : '';
  const slugCurrent =
    document.slug &&
    typeof document.slug === 'object' &&
    'current' in document.slug &&
    typeof (document.slug as { current?: unknown }).current === 'string'
      ? (document.slug as { current: string }).current
      : '';
  const hasCatalogReference = hasReference(document.internalProduct);

  if (typeof document.brandName !== 'string' || !document.brandName.trim()) {
    validationErrors.push('Nazwa marki jest wymagana');
  }

  if (typeof document.name !== 'string' || !document.name.trim()) {
    validationErrors.push('Nazwa jest wymagana');
  }

  if (productType !== 'internal' && productType !== 'external') {
    validationErrors.push('Wybierz typ produktu (wewnętrzny lub zewnętrzny)');
  }

  if (!hasShortDescription(document.shortDescription)) {
    validationErrors.push('Krótki opis jest wymagany');
  }

  if (!hasSeoObject(document.seo)) {
    validationErrors.push('SEO jest wymagane');
  }

  if (
    typeof document.priceCents !== 'number' ||
    !Number.isInteger(document.priceCents) ||
    document.priceCents < 0
  ) {
    validationErrors.push('Cena musi być liczbą całkowitą większą lub równą 0');
  }

  if (productType === 'external') {
    if (!externalUrl) {
      validationErrors.push('Link zewnętrzny jest wymagany dla produktów zewnętrznych');
    }
    if (!hasImageAsset(document.previewImage)) {
      validationErrors.push('Zdjęcie główne jest wymagane dla produktów zewnętrznych');
    }
  }

  if (productType === 'internal') {
    if (!slugCurrent) {
      validationErrors.push('Slug jest wymagany dla produktów wewnętrznych');
    } else if (!slugCurrent.endsWith('/')) {
      validationErrors.push('Slug musi kończyć się ukośnikiem (/)');
    }

    if (!hasCatalogReference && !hasImageAsset(document.previewImage)) {
      validationErrors.push(
        'Zdjęcie główne jest wymagane, gdy nie ma powiązania z produktem z katalogu',
      );
    }
  }

  return validationErrors;
};

const buildSyncedDocument = (
  source: ExistingCpoDoc | undefined,
  targetId: string,
  product: NormalizedCpoProduct,
  catalogProductId: string | null,
  productType: 'external' | 'internal',
): Record<string, unknown> => {
  const key = normalizeKey(product.key);
  const normalizedDescription = product.description.trim();
  const document = sanitizeDocumentForId(source, targetId);

  document.slug = { _type: 'slug', current: keyToSlug(key) };
  document.name = product.name.trim();
  document.brandName = product.brand.trim();
  document.priceCents = Number.isFinite(product.price_cents)
    ? Math.max(0, Math.round(product.price_cents))
    : 0;
  document.shortDescription = opisExcelToShortDescription(normalizedDescription);
  document.productType = productType;
  document.isArchived = false;
  document.isSellableOnline = product.isSellableOnline;
  document.isReturnable = product.isReturnable;
  applyAvailableAvailability(document);

  if (catalogProductId) {
    document.transparentBackground = true;
    document.internalProduct = { _type: 'reference', _ref: catalogProductId };
  } else {
    delete document.internalProduct;
  }

  const seo =
    document.seo && typeof document.seo === 'object' && !Array.isArray(document.seo)
      ? { ...(document.seo as Record<string, unknown>) }
      : {};

  if (normalizedDescription) {
    seo.description = normalizedDescription;
  } else {
    delete seo.description;
  }
  document.seo = seo;

  if (document.useCustomGallery === undefined) {
    document.useCustomGallery = false;
  }

  if (productType === 'external' && product.url.trim()) {
    document.externalUrl = product.url.trim();
  } else {
    delete document.externalUrl;
  }

  return document;
};

const fetchSanityQuery = async <T>(
  projectId: string,
  dataset: string,
  token: string,
  query: string,
): Promise<T> => {
  const url = new URL(`https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}`);
  url.searchParams.set('query', query);
  url.searchParams.set('perspective', 'raw');

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`Sanity query failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { result: T };
  return data.result;
};

const getCatalogProductMap = async (
  projectId: string,
  dataset: string,
  token: string,
): Promise<Map<string, string>> => {
  const products = await fetchSanityQuery<{ _id: string; slug?: string }[]>(
    projectId,
    dataset,
    token,
    '*[_type == "product" && defined(slug.current) && !(_id in path("versions.**"))]{_id, "slug": slug.current}',
  );

  const map = new Map<string, string>();
  for (const product of products) {
    if (isDraftId(product._id) || !product.slug) continue;
    const normalizedSlug = product.slug.replace(/^\/produkty\//, '').replace(/\/$/, '').toLowerCase();
    if (normalizedSlug) map.set(normalizedSlug, product._id);
  }

  return map;
};

const getExistingCpoPairs = async (
  projectId: string,
  dataset: string,
  token: string,
): Promise<Map<string, ExistingCpoPair>> => {
  const docs = await fetchSanityQuery<ExistingCpoDoc[]>(
    projectId,
    dataset,
    token,
    '*[_type == "cpoProduct" && !(_id in path("versions.**"))]',
  );

  const pairs = new Map<string, ExistingCpoPair>();
  for (const doc of docs) {
    const baseId = baseDocId(doc._id);
    const pair = pairs.get(baseId) ?? { baseId };

    if (isDraftId(doc._id)) {
      pair.draft = doc;
    } else {
      pair.published = doc;
    }

    pairs.set(baseId, pair);
  }

  return pairs;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const auth = req.headers.get('authorization') || '';
    const tokenHeader = req.headers.get('x-excel-token');
    const expectedToken = requiredEnv('EXCEL_PUBLISH_TOKEN');

    if (!auth.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Missing Bearer token' }, 401);
    }

    if (tokenHeader !== expectedToken) {
      return jsonResponse({ error: 'Invalid X-Excel-Token' }, 401);
    }

    let body: { mode?: 'replace' | 'merge'; products?: CpoProductInput[] };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    const mode = body.mode ?? 'replace';
    if (mode !== 'replace' && mode !== 'merge') {
      return jsonResponse({ error: 'mode must be replace or merge' }, 422);
    }

    const products = body.products ?? [];
    if (!Array.isArray(products)) {
      return jsonResponse({ error: 'products must be an array' }, 422);
    }

    const normalizedKeyCounts = new Map<string, number>();
    for (const product of products) {
      const key = normalizeKey(String(product?.key ?? ''));
      if (!key) continue;
      normalizedKeyCounts.set(key, (normalizedKeyCounts.get(key) ?? 0) + 1);
    }

    const duplicateKeys = Array.from(normalizedKeyCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => key);

    if (duplicateKeys.length > 0) {
      return jsonResponse({ error: 'Duplicate CPO keys detected', keys: duplicateKeys }, 422);
    }

    const sanityProjectId = requiredEnv('SANITY_PROJECT_ID');
    const sanityDataset = requiredEnv('SANITY_DATASET');
    const sanityToken = getSanityWriteToken();
    const sanity = createSanityClient({
      projectId: sanityProjectId,
      dataset: sanityDataset,
      token: sanityToken,
      apiVersion: '2024-01-01',
      useCdn: false,
    });

    const [catalogProductMap, existingPairs] = await Promise.all([
      getCatalogProductMap(sanityProjectId, sanityDataset, sanityToken),
      getExistingCpoPairs(sanityProjectId, sanityDataset, sanityToken),
    ]);

    let created = 0;
    let updated = 0;
    let archived = 0;
    let unarchived = 0;
    let drafts = 0;
    const errors: string[] = [];
    const validationErrors: Array<{ key: string; messages: string[] }> = [];
    const seenBaseIds = new Set<string>();

    for (const rawProduct of products) {
      const product: NormalizedCpoProduct = {
        brand: String(rawProduct?.brand ?? '').trim(),
        name: String(rawProduct?.name ?? '').trim(),
        key: String(rawProduct?.key ?? '').trim(),
        price_cents: Number(rawProduct?.price_cents ?? 0),
        url: String(rawProduct?.url ?? '').trim(),
        description: String(rawProduct?.description ?? ''),
        isSellableOnline: parseBoolean(rawProduct?.isSellableOnline ?? rawProduct?.is_sellable_online),
        isReturnable: parseBoolean(rawProduct?.isReturnable ?? rawProduct?.is_returnable),
      };

      const normalizedKey = normalizeKey(product.key);
      if (!product.brand || !product.name || !normalizedKey) {
        errors.push(`Invalid product row: missing brand, name, or key (${product.key || 'no-key'})`);
        continue;
      }

      const docId = keyToDocId(normalizedKey);
      const pair = existingPairs.get(docId);
      const sourceDoc = pair?.draft ?? pair?.published;
      const productType = detectProductType(product.url);
      const catalogProductId =
        productType === 'internal'
          ? catalogProductMap.get(extractProductSlug(product.url) ?? '') ?? null
          : null;
      const publishedDocument = buildSyncedDocument(
        sourceDoc,
        docId,
        product,
        catalogProductId,
        productType,
      );
      const publishValidationErrors = getPublishBlockingValidationErrors(publishedDocument);
      const shouldPublish = publishValidationErrors.length === 0;

      try {
        let transaction = sanity.transaction();
        const hadExistingDoc = Boolean(pair?.published || pair?.draft);
        const hadArchivedDoc = Boolean(pair?.published?.isArchived || pair?.draft?.isArchived);

        if (shouldPublish) {
          transaction = transaction.createOrReplace(publishedDocument);
          if (pair?.draft) transaction = transaction.delete(`drafts.${docId}`);
        } else {
          validationErrors.push({ key: normalizedKey, messages: publishValidationErrors });
          transaction = transaction.createOrReplace({ ...publishedDocument, _id: `drafts.${docId}` });
          if (pair?.published) transaction = transaction.delete(docId);
        }

        await transaction.commit({ autoGenerateArrayKeys: true });

        if (hadExistingDoc) updated += 1;
        else created += 1;
        if (hadArchivedDoc) unarchived += 1;
        if (!shouldPublish) drafts += 1;
        seenBaseIds.add(docId);
      } catch (error) {
        errors.push(`${normalizedKey}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (mode === 'replace') {
      const archiveTargets: string[] = [];

      for (const [baseId, pair] of existingPairs.entries()) {
        if (seenBaseIds.has(baseId)) continue;
        const hasActiveDoc = Boolean(
          (pair.published && pair.published.isArchived !== true) ||
            (pair.draft && pair.draft.isArchived !== true),
        );

        if (hasActiveDoc) {
          archiveTargets.push(baseId);
        }
      }

      for (let i = 0; i < archiveTargets.length; i += 50) {
        const batch = archiveTargets.slice(i, i + 50);
        let transaction = sanity.transaction();

        for (const baseId of batch) {
          const pair = existingPairs.get(baseId);
          if (pair?.published && pair.published.isArchived !== true) {
            transaction = transaction.patch(baseId, (patch) => patch.set({ isArchived: true }));
          }
          if (pair?.draft && pair.draft.isArchived !== true) {
            transaction = transaction.patch(`drafts.${baseId}`, (patch) => patch.set({ isArchived: true }));
          }
        }

        try {
          await transaction.commit();
          archived += batch.length;
        } catch (error) {
          errors.push(`archive batch ${i / 50 + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return jsonResponse({
      ok: errors.length === 0,
      created,
      updated,
      archived,
      unarchived,
      drafts,
      validationErrors,
      errors,
    });
  } catch (error) {
    console.error('cpo-product-sync error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
