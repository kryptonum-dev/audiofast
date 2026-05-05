#!/usr/bin/env node
import process from 'node:process'
import {
  authHeaders,
  docUrl,
  loadSanityEnv,
  parseArgs,
  printJson,
  readJsonInput,
  redact,
  requireConfig,
} from './sanity-common.mjs'

const args = parseArgs(process.argv.slice(2))
const id = args.id || args._[0]
const input = readJsonInput(args.patchJson, args.patchFile)

if (!id || !input) {
  process.stderr.write('Usage: sanity-diff-preview.mjs --id documentId --patch-file patch.json\n')
  process.exit(1)
}

const patch = input.patch || input
const config = loadSanityEnv(args)

try {
  requireConfig(config, {allowMissingToken: Boolean(args.anonymous)})

  const response = await fetch(docUrl(config, id), {
    headers: authHeaders(config, {anonymous: Boolean(args.anonymous)}),
  })
  const body = await response.json().catch(async () => ({raw: await response.text()}))

  if (!response.ok) {
    throw new Error(`Sanity document fetch failed (${response.status}): ${redact(JSON.stringify(body))}`)
  }

  const before = body.documents?.[0]

  if (!before) {
    throw new Error(`Document not found: ${id}`)
  }

  const after = structuredClone(before)
  const changes = []

  if (patch.set) {
    for (const [path, value] of Object.entries(patch.set)) {
      changes.push({operation: 'set', path, before: getPath(before, path), after: value})
      setPath(after, path, value)
    }
  }

  if (patch.setIfMissing) {
    for (const [path, value] of Object.entries(patch.setIfMissing)) {
      const current = getPath(before, path)
      changes.push({operation: 'setIfMissing', path, before: current, after: current === undefined ? value : current})
      if (current === undefined) {
        setPath(after, path, value)
      }
    }
  }

  if (patch.unset) {
    for (const path of patch.unset) {
      changes.push({operation: 'unset', path, before: getPath(before, path), after: undefined})
      unsetPath(after, path)
    }
  }

  printJson({
    dryRun: true,
    id,
    revision: before._rev,
    supportedPreviewOperations: ['set', 'setIfMissing', 'unset'],
    changes,
    after,
  })
} catch (error) {
  process.stderr.write(`${redact(error.message)}\n`)
  process.exit(1)
}

function getPath(object, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object)
}

function setPath(object, path, value) {
  const parts = path.split('.')
  const last = parts.pop()
  let current = object

  for (const part of parts) {
    current[part] = current[part] && typeof current[part] === 'object' ? current[part] : {}
    current = current[part]
  }

  current[last] = value
}

function unsetPath(object, path) {
  const parts = path.split('.')
  const last = parts.pop()
  const parent = parts.reduce((value, key) => (value == null ? undefined : value[key]), object)

  if (parent && typeof parent === 'object') {
    delete parent[last]
  }
}
