/**
 * Gate 0.9: dataset hygiene. A read-only scan of every string in the Content
 * Lake for stega marker runs (four or more marker characters in a row).
 *
 * Copy-pasting text out of a Presentation iframe used to carry the invisible
 * markers into a field (before `@sanity/visual-editing` 5.5 / Studio 6.6
 * cleaned the clipboard). Such a value is then stega-encoded in published
 * mode too, and no render-site gate can tell it apart. `sanity migrations`
 * has no named strip-stega migration, so this is lsse-www's equivalent scan
 * (research/03 §3.2): it streams the dataset export (published documents and
 * drafts), walks every string, and reports each contaminated one by id and
 * path. It never writes.
 *
 *   bun apps/web/scripts/scan-dataset-stega.ts [--dataset production]
 *
 * Exit code: 0 clean; 1 when any string carries a marker run; 2 on a setup
 * error (no project id, no read token, export failed).
 */
import { findToken, lakeEnv } from './lib/lake-env';
import { MARKERS } from './lib/stega-crawl';

const READ_TOKENS = ['SANITY_API_READ_TOKEN', 'SANITY_AUTH_TOKEN'] as const;

type Hit = { id: string; type: string; path: string; preview: string };

function walk(
  value: unknown,
  path: string,
  visit: (text: string, path: string) => void,
): void {
  if (typeof value === 'string') visit(value, path);
  else if (Array.isArray(value))
    value.forEach((item, index) => {
      const key =
        item && typeof item === 'object' && '_key' in item
          ? `[_key=="${String((item as { _key: unknown })._key)}"]`
          : `[${index}]`;
      walk(item, `${path}${key}`, visit);
    });
  else if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value))
      walk(item, path ? `${path}.${key}` : key, visit);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const datasetFlag = args.indexOf('--dataset');
  const env = await lakeEnv();
  const dataset =
    datasetFlag !== -1 && args[datasetFlag + 1]
      ? args[datasetFlag + 1]!
      : env.dataset;
  const reader = await findToken(READ_TOKENS);
  if (!reader) {
    console.error(`No read token: none of ${READ_TOKENS.join(', ')} is set.`);
    process.exit(2);
  }

  const url = `https://${env.projectId}.api.sanity.io/v2021-06-07/data/export/${dataset}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${reader.token}` },
  });
  if (!response.ok || !response.body) {
    console.error(`Export of ${dataset} answered ${response.status}`);
    process.exit(2);
  }

  let documents = 0;
  let drafts = 0;
  let strings = 0;
  const hits: Hit[] = [];
  const decoder = new TextDecoder();
  let pending = '';

  const handleLine = (line: string): void => {
    if (!line.trim()) return;
    const doc = JSON.parse(line) as { _id: string; _type: string };
    documents += 1;
    if (doc._id.startsWith('drafts.')) drafts += 1;
    walk(doc, '', (text, path) => {
      strings += 1;
      MARKERS.lastIndex = 0;
      if (MARKERS.test(text))
        hits.push({
          id: doc._id,
          type: doc._type,
          path,
          preview: text.replace(MARKERS, '⟨stega⟩').slice(0, 80),
        });
    });
  };

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    pending += decoder.decode(chunk, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) handleLine(line);
  }
  handleLine(pending + decoder.decode());

  console.log(
    `dataset ${dataset} (read token: ${reader.name}): ${documents} documents (${drafts} drafts), ${strings} strings, ${hits.length} with a stega marker run`,
  );
  for (const hit of hits.slice(0, 50))
    console.log(`  ${hit.id} (${hit.type}) ${hit.path}: “${hit.preview}”`);
  if (hits.length > 50) console.log(`  … +${hits.length - 50}`);
  process.exit(hits.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('[scan-dataset-stega] crashed:', error);
  process.exit(2);
});
