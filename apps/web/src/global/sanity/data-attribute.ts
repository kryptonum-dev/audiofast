import { createDataAttribute } from 'next-sanity';

import { SANITY_STUDIO_URL } from '../constants';

// Public values only (the same pair `image.ts` reads), so this module is safe
// on either side of the RSC boundary. Client islands still never receive the
// factory: it is not serializable, so they get pre-built strings
// (`dataSanity(...)`).
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';

type GetDataAttributeArgs = {
  id: string | null | undefined;
  type: string | null | undefined;
  isDraft: boolean | undefined;
};

/**
 * Draft-gated `createDataAttribute` for one document.
 *
 * Returns `null` outside draft mode (or without an id/type), which is what
 * keeps `data-sanity` attributes out of published HTML entirely: callers gate
 * every annotation on the result rather than remembering the rule. `_id` and
 * `_type` are projected on every routed page query so this can address the
 * document that owns a clicked section.
 */
export function getDataAttribute({ id, type, isDraft }: GetDataAttributeArgs) {
  if (!isDraft || !id || !type || !projectId) return null;

  return createDataAttribute({
    baseUrl: SANITY_STUDIO_URL,
    projectId,
    dataset,
    id,
    type,
  });
}

export type DocumentDataAttribute = NonNullable<
  ReturnType<typeof getDataAttribute>
>;

/**
 * What a block or section receives: a factory the CALLER has already scoped
 * (to a `pageBuilder[_key=="…"]` path) or left at the document root, so a
 * component only appends its own path: `dataAttribute?.(['items', { _key }])`.
 */
export type ScopedDataAttribute =
  DocumentDataAttribute | ReturnType<DocumentDataAttribute['scope']>;

/** Path argument accepted by a (scoped) data-attribute factory. */
export type DataAttributePath = Parameters<DocumentDataAttribute>[0];

/**
 * The `data-sanity` string for an optional factory, or `undefined` so React
 * drops the attribute. Use this when passing an annotation into a client
 * island or onto an element: `data-sanity={dataSanity(attr, 'image')}`.
 * Omit `path` only for a factory that is already scoped; an unscoped document
 * factory needs a field path (Sanity rejects a path-less attribute).
 */
export function dataSanity(
  attribute: ScopedDataAttribute | null | undefined,
  path?: DataAttributePath,
): string | undefined {
  if (!attribute) return undefined;
  return path === undefined
    ? String(attribute)
    : (attribute as (path: DataAttributePath) => string)(path);
}

/**
 * Shorthand for a referenced document rendered inside another page (a FAQ, a
 * team member, a store, an award): the annotation opens THAT document.
 */
export function referencedDataSanity(
  doc: { _id?: string | null; _type?: string | null } | null | undefined,
  isDraft: boolean | undefined,
  path: DataAttributePath,
): string | undefined {
  return dataSanity(
    getDataAttribute({ id: doc?._id, type: doc?._type, isDraft }),
    path,
  );
}
