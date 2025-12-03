"use server";

import type { EmbeddingsResponse } from "@/src/global/types";

/**
 * Server Action to fetch embedding results from the Sanity Embeddings Index API
 * Can be called from both Server and Client Components
 * @param searchQuery - The search query string
 * @param type - The type of content to search ('products' or 'blog')
 * @returns Array of embedding results with scores and document IDs, or null if no query or error
 * @example
 * const results = await fetchEmbeddings('wireless headphones', 'products');
 * // Returns: [{ score: 0.92, value: { documentId: 'abc123', type: 'product' } }, ...]
 */
export async function fetchEmbeddings(
  searchQuery: string,
  type: "products" | "blog",
): Promise<EmbeddingsResponse | null> {
  if (!searchQuery || !searchQuery.trim()) {
    return null;
  }

  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
    const bearerToken = process.env.EMBEDDINGS_INDEX_BEARER_TOKEN;

    if (!projectId || !bearerToken) {
      console.error("Missing required environment variables for embeddings");
      return null;
    }

    const indexName = type === "products" ? "products" : "blog";
    const typeFilter = type === "products" ? "product" : "blog-article";

    const embeddingsUrl = `https://${projectId}.api.sanity.io/vX/embeddings-index/query/${dataset}/${indexName}`;

    const response = await fetch(embeddingsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        query: searchQuery.trim(),
        maxResults: 50,
        filter: {
          _type: [typeFilter],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Embeddings API error (${response.status}):`, errorText);
      return null;
    }

    const data: EmbeddingsResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching embeddings:", error);
    return null;
  }
}
