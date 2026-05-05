#!/usr/bin/env node
import process from 'node:process'
import {
  authHeaders,
  loadSanityEnv,
  parseArgs,
  printJson,
  queryUrl,
  readJsonInput,
  redact,
  requireConfig,
} from './sanity-common.mjs'

const args = parseArgs(process.argv.slice(2))
const query = args._[0] || args.query

if (!query) {
  process.stderr.write('Usage: sanity-query.mjs <groq-query> [--params JSON] [--params-file file] [--anonymous]\n')
  process.exit(1)
}

const config = loadSanityEnv(args)
const params = readJsonInput(args.params, args.paramsFile) || {}

try {
  requireConfig(config, {allowMissingToken: Boolean(args.anonymous)})

  const response = await fetch(queryUrl(config, query, params), {
    headers: authHeaders(config, {anonymous: Boolean(args.anonymous)}),
  })

  const body = await response.json().catch(async () => ({raw: await response.text()}))

  if (!response.ok) {
    throw new Error(`Sanity query failed (${response.status}): ${redact(JSON.stringify(body))}`)
  }

  printJson(args.raw ? body : body.result)
} catch (error) {
  process.stderr.write(`${redact(error.message)}\n`)
  process.exit(1)
}
