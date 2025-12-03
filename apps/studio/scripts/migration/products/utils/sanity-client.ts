/**
 * Sanity client configuration for product migration
 */

import { createClient, type SanityClient } from '@sanity/client';

// Default configuration
const DEFAULT_PROJECT_ID = 'fsw3likv';
const DEFAULT_DATASET = 'production';
const API_VERSION = '2024-01-01';

/**
 * Create a Sanity client for migration operations
 */
export function createMigrationClient(options?: {
  projectId?: string;
  dataset?: string;
  token?: string;
}): SanityClient {
  const projectId = options?.projectId || process.env.SANITY_PROJECT_ID || DEFAULT_PROJECT_ID;
  const dataset = options?.dataset || process.env.SANITY_DATASET || DEFAULT_DATASET;
  const token = options?.token || process.env.SANITY_API_TOKEN;

  if (!token) {
    throw new Error('SANITY_API_TOKEN environment variable is required');
  }

  return createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    token,
    useCdn: false, // We need fresh data for migrations
  });
}

/**
 * Create a dry-run client that doesn't require a token
 */
export function createDryRunClient(options?: {
  projectId?: string;
  dataset?: string;
}): SanityClient {
  const projectId = options?.projectId || process.env.SANITY_PROJECT_ID || DEFAULT_PROJECT_ID;
  const dataset = options?.dataset || process.env.SANITY_DATASET || DEFAULT_DATASET;

  return createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    useCdn: false,
  });
}

/**
 * Get configuration info (for logging)
 */
export function getClientConfig(): { projectId: string; dataset: string } {
  return {
    projectId: process.env.SANITY_PROJECT_ID || DEFAULT_PROJECT_ID,
    dataset: process.env.SANITY_DATASET || DEFAULT_DATASET,
  };
}

export { type SanityClient };

