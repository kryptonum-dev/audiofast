#!/usr/bin/env node
import process from 'node:process'
import {loadSanityEnv, parseArgs, printJson, requireConfig} from './sanity-common.mjs'

const args = parseArgs(process.argv.slice(2))
const config = loadSanityEnv(args)

try {
  requireConfig(config, {allowMissingToken: Boolean(args.allowMissingToken)})
} catch (error) {
  printJson({
    ok: false,
    error: error.message,
    loadedEnvFiles: config.loadedFiles,
    projectIdPresent: Boolean(config.projectId),
    datasetPresent: Boolean(config.dataset),
    apiVersionPresent: Boolean(config.apiVersion),
    tokenPresent: Boolean(config.token),
    sources: config.sources,
  })
  process.exitCode = 1
  process.exit()
}

printJson({
  ok: true,
  loadedEnvFiles: config.loadedFiles,
  projectId: config.projectId,
  dataset: config.dataset,
  apiVersion: config.apiVersion,
  sources: {
    projectId: config.sources.projectId,
    dataset: config.sources.dataset,
    apiVersion: config.sources.apiVersion,
    token: config.sources.token,
  },
  tokenPresent: Boolean(config.token),
  tokenPreview: config.token ? '[REDACTED]' : undefined,
})
