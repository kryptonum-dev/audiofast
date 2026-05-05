#!/usr/bin/env node
import process from 'node:process'
import {
  authHeaders,
  loadSanityEnv,
  mutateUrl,
  parseArgs,
  printJson,
  readJsonInput,
  redact,
  requireConfig,
} from './sanity-common.mjs'

const args = parseArgs(process.argv.slice(2))
const payload = readJsonInput(args.mutationJson, args.mutationFile)

if (!payload) {
  process.stderr.write('Usage: sanity-mutate.mjs --mutation-file mutation.json [--execute] [--visibility sync|async|deferred]\n')
  process.exit(1)
}

if (!Array.isArray(payload.mutations)) {
  process.stderr.write('Mutation payload must contain a top-level "mutations" array.\n')
  process.exit(1)
}

const config = loadSanityEnv(args)

try {
  requireConfig(config)

  const url = mutateUrl(config, {visibility: args.visibility})

  if (!args.execute) {
    printJson({
      dryRun: true,
      message: 'No mutation was submitted. Re-run with --execute to commit.',
      endpoint: url.toString(),
      mutationCount: payload.mutations.length,
      payload,
    })
    process.exit()
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify(payload),
  })

  const body = await response.json().catch(async () => ({raw: await response.text()}))

  if (!response.ok) {
    throw new Error(`Sanity mutation failed (${response.status}): ${redact(JSON.stringify(body))}`)
  }

  printJson({
    ok: true,
    mutationCount: payload.mutations.length,
    result: body,
  })
} catch (error) {
  process.stderr.write(`${redact(error.message)}\n`)
  process.exit(1)
}
