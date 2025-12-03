import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { type QueryParams } from "next-sanity";

import { client } from "./client";

/**
 * Enhanced fetch function with correct Next.js caching strategy
 * - Development: uses "use cache" with cacheLife('seconds') to mimic fresh data while satisfying Static Shell
 * - Production: uses "use cache" with standard lifetime and tags for ISR
 */
export async function sanityFetch<QueryResponse>({
  query,
  params = {},
  tags = [],
}: {
  query: string;
  params?: QueryParams;
  tags?: string[];
}): Promise<QueryResponse> {
  "use cache";

  if (tags.length > 0) {
    cacheTag(...tags);
  }

  if (process.env.NODE_ENV === "development") {
    cacheLife("seconds");
  } else {
    cacheLife("weeks");
  }

  return await client.fetch<QueryResponse>(query, params);
}
