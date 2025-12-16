/**
 * Sanity client configuration for migration scripts
 */

import { createClient, type SanityClient } from "@sanity/client";

// Environment variables should be set before running the script
const PROJECT_ID = process.env.SANITY_PROJECT_ID || "";
const DATASET = process.env.SANITY_DATASET || "production";
const API_TOKEN = process.env.SANITY_API_TOKEN || "";

/**
 * Create a Sanity client for migration operations
 */
export function createMigrationClient(): SanityClient {
  if (!PROJECT_ID) {
    throw new Error("SANITY_PROJECT_ID environment variable is required");
  }

  if (!API_TOKEN) {
    throw new Error("SANITY_API_TOKEN environment variable is required");
  }

  return createClient({
    projectId: PROJECT_ID,
    dataset: DATASET,
    apiVersion: "2024-01-01",
    token: API_TOKEN,
    useCdn: false, // We need fresh data for migrations
  });
}

/**
 * Get configuration info (for logging)
 */
export function getClientConfig(): { projectId: string; dataset: string } {
  return {
    projectId: PROJECT_ID,
    dataset: DATASET,
  };
}
