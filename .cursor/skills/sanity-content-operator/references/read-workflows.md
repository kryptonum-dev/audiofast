# Read Workflows

Sanity reads normally use GROQ. Keep reads narrow, include only the fields needed for the task, and use params instead of interpolating user-provided values into queries.

## Type Discovery

Do not assume natural-language labels map directly to Sanity `_type` values. Before migrations or broad queries for "posts", "pages", "products", "settings", or similar categories, discover the actual type names.

Useful discovery queries:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-query.mjs \
  'array::unique(*[]._type) | order(@ asc)'
```

Count by candidate type:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-query.mjs \
  '{"blogArticle": count(*[_type == "blog-article"]), "post": count(*[_type == "post"]), "page": count(*[_type == "page"])}'
```

Sample a candidate:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-query.mjs \
  '*[_type == "blog-article"][0..2]{_id,_type,title,slug,_updatedAt}'
```

Also inspect local schema/query files when useful. If dataset evidence and schema/code disagree, say so and ask before mutating.

## Direct HTTP Query

The helper script uses Sanity's HTTP query endpoint:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-query.mjs '*[_type == "post"][0..4]{_id,title}'
```

With params:

```bash
node .cursor/skills/sanity-content-operator/scripts/sanity-query.mjs \
  '*[_type == $type][0..4]{_id,title}' \
  --params '{"type":"post"}'
```

## JavaScript Client Pattern

Use this pattern inside project code:

```ts
import {createClient} from '@sanity/client'

export const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  apiVersion: process.env.SANITY_API_VERSION!,
  useCdn: false,
  token: process.env.SANITY_AUTH_TOKEN,
})
```

Use `useCdn: true` only for public, cacheable app reads where stale data is acceptable. Use `useCdn: false` for fresh reads, draft access, private datasets, and any workflow coupled to mutations.

## Query Hygiene

- Prefer projections: `{_id, _type, title}` instead of fetching whole documents.
- Add limits to exploratory queries.
- Use query params for variable values.
- Fetch `_rev` when a later patch should use optimistic locking.
- Avoid dumping tokens, secrets, or large document bodies into the chat transcript.
- Report which env file/source was selected for the query, but never print token values.
