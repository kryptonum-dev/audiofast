import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {basename, dirname, join, resolve, sep} from 'node:path'
import process from 'node:process'

const ENV_FILES = ['.env', '.env.development', '.env.development.local', '.env.local']
const ENV_ALIASES = {
  projectId: [
    'SANITY_PROJECT_ID',
    'NEXT_PUBLIC_SANITY_PROJECT_ID',
    'PUBLIC_SANITY_PROJECT_ID',
    'VITE_SANITY_PROJECT_ID',
    'SANITY_STUDIO_PROJECT_ID',
  ],
  dataset: [
    'SANITY_DATASET',
    'NEXT_PUBLIC_SANITY_DATASET',
    'PUBLIC_SANITY_DATASET',
    'VITE_SANITY_DATASET',
    'SANITY_STUDIO_DATASET',
  ],
  apiVersion: [
    'SANITY_API_VERSION',
    'NEXT_PUBLIC_SANITY_API_VERSION',
    'PUBLIC_SANITY_API_VERSION',
    'VITE_SANITY_API_VERSION',
    'SANITY_CLI_QUERY_API_VERSION',
  ],
  token: [
    'SANITY_AUTH_TOKEN',
    'SANITY_API_TOKEN',
    'SANITY_API_WRITE_TOKEN',
    'SANITY_WRITE_TOKEN',
    'SANITY_SECRET_TOKEN',
    'SANITY_API_READ_TOKEN',
    'SANITY_READ_TOKEN',
  ],
}
const SANITY_ENV_KEYS = Object.values(ENV_ALIASES).flat()
const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
  'lerna.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
]
const SKIP_DIRS = new Set([
  '.git',
  '.next',
  '.nuxt',
  '.turbo',
  '.vercel',
  '.cache',
  '.output',
  'coverage',
  'dist',
  'build',
  'node_modules',
])
const MAX_DESCEND_DEPTH = 5

export function parseArgs(argv) {
  const args = {_: []}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (!arg.startsWith('--')) {
      args._.push(arg)
      continue
    }

    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s)
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())

    if (inlineValue !== undefined && inlineValue !== '') {
      args[key] = inlineValue
      continue
    }

    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }

    args[key] = next
    index += 1
  }

  return args
}

export function readJsonInput(value, filePath) {
  if (filePath) {
    return JSON.parse(readFileSync(resolve(filePath), 'utf8'))
  }

  if (!value) {
    return undefined
  }

  return JSON.parse(value)
}

export function loadSanityEnv(args = {}) {
  const cwd = resolve(args.cwd || process.cwd())
  const loadedFiles = []

  const explicitEnvFile = args.envFile ? [resolve(args.envFile)] : []
  const discoveredEnvFiles = explicitEnvFile.length > 0 ? [] : findEnvFiles(cwd)
  const fileEnv = {}

  for (const filePath of [...explicitEnvFile, ...discoveredEnvFiles]) {
    if (!existsSync(filePath)) {
      continue
    }

    Object.assign(fileEnv, parseEnvFile(filePath))
    loadedFiles.push(filePath)
  }

  const env = {...fileEnv, ...process.env}
  const projectId = getEnvValue(env, ENV_ALIASES.projectId)
  const dataset = getEnvValue(env, ENV_ALIASES.dataset)
  const apiVersion = getEnvValue(env, ENV_ALIASES.apiVersion)
  const token = getEnvValue(env, ENV_ALIASES.token)

  return {
    projectId: args.projectId || projectId.value,
    dataset: args.dataset || dataset.value,
    apiVersion: normalizeApiVersion(args.apiVersion || apiVersion.value),
    token: args.token || token.value,
    sources: {
      projectId: args.projectId ? '--project-id' : projectId.key,
      dataset: args.dataset ? '--dataset' : dataset.key,
      apiVersion: args.apiVersion ? '--api-version' : apiVersion.key,
      token: args.token ? '--token' : token.key,
    },
    loadedFiles,
    cwd,
  }
}

export function requireConfig(config, options = {}) {
  const missing = []

  if (!config.projectId) missing.push('SANITY_PROJECT_ID')
  if (!config.dataset) missing.push('SANITY_DATASET')
  if (!config.apiVersion) missing.push('SANITY_API_VERSION')
  if (!options.allowMissingToken && !config.token) missing.push('SANITY_AUTH_TOKEN')

  if (missing.length > 0) {
    throw new Error(`Missing required Sanity configuration: ${missing.join(', ')}`)
  }
}

export function queryUrl(config, query, params = {}) {
  const url = new URL(`https://${config.projectId}.api.sanity.io/${config.apiVersion}/data/query/${config.dataset}`)
  url.searchParams.set('query', query)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`$${key}`, JSON.stringify(value))
  }

  return url
}

export function docUrl(config, id) {
  return new URL(
    `https://${config.projectId}.api.sanity.io/${config.apiVersion}/data/doc/${config.dataset}/${encodeURIComponent(id)}`,
  )
}

export function mutateUrl(config, options = {}) {
  const url = new URL(`https://${config.projectId}.api.sanity.io/${config.apiVersion}/data/mutate/${config.dataset}`)
  url.searchParams.set('returnIds', 'true')
  url.searchParams.set('returnDocuments', 'true')
  url.searchParams.set('visibility', options.visibility || 'sync')
  return url
}

export function authHeaders(config, options = {}) {
  const headers = {'content-type': 'application/json'}

  if (!options.anonymous && config.token) {
    headers.authorization = `Bearer ${config.token}`
  }

  return headers
}

export function redact(value) {
  if (!value) {
    return value
  }

  return String(value)
    .replace(/Bearer\s+[-._~+/=A-Za-z0-9]+/g, 'Bearer [REDACTED]')
    .replace(/("token"\s*:\s*")([^"]+)(")/g, '$1[REDACTED]$3')
    .replace(/(SANITY_AUTH_TOKEN=)(\S+)/g, '$1[REDACTED]')
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function findEnvFiles(startDir) {
  const upwardFiles = findUpwardEnvFiles(startDir)
  const root = findNearestProjectRoot(startDir)
  const downwardFiles = root ? findDownwardEnvFiles(root) : []
  const bestDownwardFiles = selectBestDownwardEnvFiles(downwardFiles, startDir)

  return unique([...upwardFiles, ...bestDownwardFiles])
}

function findUpwardEnvFiles(startDir) {
  const directories = []
  let current = startDir

  for (let depth = 0; depth < 4; depth += 1) {
    directories.push(current)

    const parent = dirname(current)
    if (parent === current) {
      break
    }

    current = parent
  }

  return directories
    .reverse()
    .flatMap((directory) => ENV_FILES.map((fileName) => join(directory, fileName)))
}

function findDownwardEnvFiles(rootDir) {
  const files = []

  walk(rootDir, 0)
  return files

  function walk(directory, depth) {
    if (depth > MAX_DESCEND_DEPTH || SKIP_DIRS.has(basename(directory))) {
      return
    }

    for (const fileName of ENV_FILES) {
      const filePath = join(directory, fileName)
      if (existsSync(filePath)) {
        files.push(filePath)
      }
    }

    let entries = []
    try {
      entries = readdirSync(directory, {withFileTypes: true})
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
        continue
      }

      walk(join(directory, entry.name), depth + 1)
    }
  }
}

function findNearestProjectRoot(startDir) {
  let current = startDir

  while (true) {
    if (PROJECT_MARKERS.some((marker) => existsSync(join(current, marker)))) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return startDir
    }

    current = parent
  }
}

function selectBestDownwardEnvFiles(files, startDir) {
  const groups = new Map()

  for (const filePath of files) {
    const directory = dirname(filePath)
    const group = groups.get(directory) || []
    group.push(filePath)
    groups.set(directory, group)
  }

  const rankedGroups = [...groups.entries()]
    .map(([directory, groupFiles]) => ({
      directory,
      files: sortEnvFiles(groupFiles),
      score: scoreEnvDirectory(directory, groupFiles, startDir),
    }))
    .filter(({score}) => score > 0)
    .sort((a, b) => a.score - b.score || a.directory.localeCompare(b.directory))

  return rankedGroups.at(-1)?.files || []
}

function scoreEnvDirectory(directory, files, startDir) {
  const merged = {}

  for (const filePath of sortEnvFiles(files)) {
    Object.assign(merged, parseEnvFile(filePath))
  }

  const sanityKeyCount = SANITY_ENV_KEYS.filter((key) => merged[key]).length

  if (sanityKeyCount === 0) {
    return 0
  }

  const isContextCandidate = isSameOrChild(startDir, directory)
  const localFileBonus = files.some((filePath) => basename(filePath) === '.env.local') ? 2 : 0
  const contextScore = isContextCandidate ? 100 : 0

  return contextScore + sanityKeyCount * 10 + localFileBonus
}

function sortEnvFiles(files) {
  return [...files].sort((a, b) => {
    const orderDiff = ENV_FILES.indexOf(basename(a)) - ENV_FILES.indexOf(basename(b))
    return orderDiff || a.localeCompare(b)
  })
}

function isSameOrChild(childPath, parentPath) {
  return childPath === parentPath || childPath.startsWith(`${parentPath}${sep}`)
}

function unique(values) {
  return [...new Set(values)]
}

function getEnvValue(env, names) {
  for (const name of names) {
    if (env[name]) {
      return {key: name, value: env[name]}
    }
  }

  return {key: undefined, value: undefined}
}

function parseEnvFile(filePath) {
  const parsed = {}
  const body = readFileSync(filePath, 'utf8')

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) {
      continue
    }

    const [, key, rawValue] = match
    parsed[key] = stripQuotes(rawValue.trim())
  }

  return parsed
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function normalizeApiVersion(apiVersion) {
  if (!apiVersion) {
    return undefined
  }

  return apiVersion.startsWith('v') ? apiVersion : `v${apiVersion}`
}
