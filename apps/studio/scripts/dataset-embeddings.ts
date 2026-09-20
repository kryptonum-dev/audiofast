import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import config from '../config/dataset-embeddings.json';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: 'string' },
    dataset: { type: 'string' },
    output: { type: 'string' },
    'expected-settings': { type: 'string' },
  },
});
const command = positionals[0];
const commands = ['status', 'check', 'apply', 'wait'];
const token = process.env.SANITY_AUTH_TOKEN;
const endpoint = `https://api.sanity.io/v${config.apiVersion}/projects/${config.projectId}/datasets/${config.dataset}/settings/embeddings`;
type Settings = { enabled: boolean; status: string; projection?: string };

async function request(method = 'GET', body?: unknown): Promise<Settings> {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      `Dataset settings ${method} failed: HTTP ${response.status}`,
    );
  if (method === 'PUT') return request();
  const data = (await response.json()) as Settings;
  if (typeof data.enabled !== 'boolean' || typeof data.status !== 'string')
    throw new Error('Unexpected dataset settings response');
  return {
    enabled: data.enabled,
    status: data.status,
    ...(typeof data.projection === 'string'
      ? { projection: data.projection }
      : {}),
  };
}

async function main() {
  if (!command || !commands.includes(command))
    throw new Error('Use status, check, apply or wait');
  if (!token)
    throw new Error('SANITY_AUTH_TOKEN is required for settings operations');
  if (
    (values.project && values.project !== config.projectId) ||
    (values.dataset && values.dataset !== config.dataset)
  )
    throw new Error('Target does not match versioned configuration');
  let settings = await request();
  const before = settings;
  if (command === 'check') {
    const mode = process.env.SANITY_BLOG_SEARCH_BACKEND;
    if (mode && !['legacy', 'dataset', 'lexical'].includes(mode))
      throw new Error('Invalid SANITY_BLOG_SEARCH_BACKEND');
    if (mode === 'dataset' && !process.env.SANITY_API_READ_TOKEN)
      throw new Error('Dataset mode requires SANITY_API_READ_TOKEN');
  }
  if (command === 'apply') {
    if (
      values.project !== config.projectId ||
      values.dataset !== config.dataset ||
      !values.output
    )
      throw new Error(
        'apply requires explicit --project, --dataset and --output',
      );
    // Compare against a fresh, previously inspected snapshot before modifying shared settings.
    if (!values['expected-settings'])
      throw new Error('apply requires --expected-settings from status');
    const expected = JSON.parse(
      await readFile(values['expected-settings'], 'utf8'),
    ) as { after: Settings };
    if (JSON.stringify(expected.after) !== JSON.stringify(settings))
      throw new Error(
        'Settings changed since snapshot; inspect a new status before applying',
      );
    await writeFile(
      values.output,
      JSON.stringify(
        { checkedAt: new Date().toISOString(), ...config, before },
        null,
        2,
      ) + '\n',
    );
    if (!settings.enabled || settings.projection !== config.projection)
      settings = await request('PUT', {
        enabled: true,
        projection: config.projection,
      });
  }
  if (command === 'wait') {
    const deadline = Date.now() + 600000;
    while (settings.status !== 'ready') {
      if (settings.status === 'error' || !settings.enabled)
        throw new Error(`Dataset embeddings status: ${settings.status}`);
      if (Date.now() >= deadline)
        throw new Error('Dataset readiness timed out after 10 minutes');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      settings = await request();
    }
    if (settings.projection !== config.projection)
      throw new Error(
        'Ready projection does not match versioned configuration',
      );
  }
  const evidence = {
    checkedAt: new Date().toISOString(),
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: config.apiVersion,
    before,
    after: settings,
  };
  if (values.output)
    await writeFile(values.output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Dataset settings operation failed',
  );
  process.exitCode = 1;
});
