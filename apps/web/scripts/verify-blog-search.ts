/** Run with: bun --conditions=react-server --env-file=apps/web/.env.local apps/web/scripts/verify-blog-search.ts */
import { createClient } from '@sanity/client';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import projection from '../../studio/config/dataset-embeddings.json';
import { searchBlogArticles } from '../src/global/sanity/blog-search';
import { getBlogSearchClientConfig } from '../src/global/sanity/blog-search-config';
import { queryBlogSemanticSearch } from '../src/global/sanity/query';
import type { QueryBlogSemanticSearchResult } from '../src/global/sanity/sanity.types';

async function main() {
  const folder = new URL(
    '../../../context/changes/sanity-dataset-embeddings-migration/',
    import.meta.url,
  );
  type Baseline = {
    results: {
      query: string;
      expectedId: string | null;
      expectedInTop5: boolean | null;
    }[];
  };
  const baseline = JSON.parse(
    await readFile(new URL('legacy-query-baseline.json', folder), 'utf8'),
  ) as Baseline;
  const config = getBlogSearchClientConfig();
  if (
    config.projectId !== projection.projectId ||
    config.dataset !== projection.dataset
  )
    throw new Error('Verification target does not match migration');
  if (baseline.results.length > 30)
    throw new Error('Baseline exceeds verification request budget');
  const client = createClient(config);
  const corpus = await client.fetch<
    { _id: string; category: string | null; year: string }[]
  >(
    `*[_type == "blog-article" && defined(slug.current) && hideFromList == false]{_id, "category": category->slug.current, "year": string::split(coalesce(publishedDate,_createdAt), "-")[0]}`,
  );
  const eligible = new Set(corpus.map((a) => a._id));
  const results = [];
  let requests = 0;
  for (const fixture of baseline.results) {
    const started = Date.now();
    const cards = await client.fetch<QueryBlogSemanticSearchResult>(
      queryBlogSemanticSearch,
      { search: fixture.query, category: '', year: '' },
      { cache: 'no-store', signal: AbortSignal.timeout(3000) },
    );
    requests++;
    if (
      !Array.isArray(cards) ||
      cards.length > 50 ||
      cards.some((a) => !eligible.has(a._id)) ||
      new Set(cards.map((a) => a._id)).size !== cards.length
    )
      throw new Error('Eligibility or response validation failed');
    if (cards.length !== Math.min(50, corpus.length))
      throw new Error('Unexpected semantic candidate count');
    results.push({
      query: fixture.query,
      expectedId: fixture.expectedId,
      oldExpectedInTop5: fixture.expectedInTop5,
      expectedInTop5: fixture.expectedId
        ? cards.slice(0, 5).some((a) => a._id === fixture.expectedId)
        : null,
      elapsedMs: Date.now() - started,
      totalCount: cards.length,
      top5: cards.slice(0, 5).map((a) => ({ id: a._id, name: a.name })),
    });
  }
  const selected = corpus.find((a) => a.category);
  if (!selected) throw new Error('No category fixture available');
  const filters = [];
  for (const params of [
    { category: selected.category!, year: '' },
    { category: '', year: selected.year },
    { category: selected.category!, year: selected.year },
    { category: selected.category!, year: '1900' },
  ]) {
    const cards = await client.fetch<QueryBlogSemanticSearchResult>(
      queryBlogSemanticSearch,
      { search: 'audio', ...params },
      { cache: 'no-store', signal: AbortSignal.timeout(3000) },
    );
    requests++;
    const expected = corpus.filter(
      (a) =>
        (!params.category || a.category === params.category) &&
        (!params.year || a.year === params.year),
    );
    if (
      cards.length !== Math.min(50, expected.length) ||
      cards.some((a) => !expected.some((e) => e._id === a._id))
    )
      throw new Error('Category/year validation failed');
    filters.push({ ...params, count: cards.length });
  }
  const recovery = [];
  for (const backend of ['legacy', 'lexical', 'dataset']) {
    process.env.SANITY_BLOG_SEARCH_BACKEND = backend;
    const response = await searchBlogArticles({ search: 'Grimm Audio MU2' });
    if (response.backend !== backend || !response.totalCount)
      throw new Error(`${backend} service verification failed`);
    recovery.push({
      backend: response.backend,
      outcome: response.outcome,
      count: response.totalCount,
    });
    if (backend === 'dataset') requests++;
  }
  const regressions = results.filter(
    (r) => r.oldExpectedInTop5 && !r.expectedInTop5,
  );
  const evidence = {
    checkedAt: new Date().toISOString(),
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: config.apiVersion,
    projection: projection.projection,
    projectionSha256: createHash('sha256')
      .update(projection.projection)
      .digest('hex'),
    source:
      'Curated title/concept baseline; not analytics or human relevance acceptance',
    semanticRequests: requests,
    results,
    filters,
    recovery,
    regressions,
  };
  await writeFile(
    new URL('dataset-query-results.json', folder),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(
    JSON.stringify(
      {
        output: fileURLToPath(new URL('dataset-query-results.json', folder)),
        semanticRequests: requests,
        expectedTop5: results.filter((r) => r.expectedInTop5).length,
        regressions,
        filters,
        recovery,
      },
      null,
      2,
    ),
  );
  if (regressions.length) process.exitCode = 2;
}
main().catch(() => {
  console.error(
    'Live blog search verification failed; inspect readiness and sanitized API status before cutover.',
  );
  process.exitCode = 1;
});
