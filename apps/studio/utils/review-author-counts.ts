type MinimalSanityClient = {
  fetch: <T>(
    query: string,
    params?: Record<string, unknown>,
  ) => Promise<T>;
};

type ReviewRow = {
  _id: string;
  authorId?: string;
};

type ReviewAuthorCountRow = {
  _id: string;
  reviewCount: number;
};

const ALL_REVIEW_AUTHOR_IDS_QUERY = `
  *[_type == "reviewAuthor" && !(_id in path("drafts.**"))]._id
`;

const SELECTED_REVIEW_AUTHOR_IDS_QUERY = `
  *[_type == "reviewAuthor" && _id in $authorIds]._id
`;

const REVIEWS_WITH_AUTHORS_QUERY = `
  *[_type == "review"]{
    _id,
    "authorId": author._ref
  }
`;

function toBaseId(documentId: string): string {
  return documentId.startsWith("drafts.") ? documentId.slice(7) : documentId;
}

function isDraftId(documentId: string): boolean {
  return documentId.startsWith("drafts.");
}

function computeCounts(rows: ReviewRow[]): Map<string, number> {
  const byBaseId = new Map<
    string,
    { draftAuthorId?: string; publishedAuthorId?: string }
  >();

  for (const row of rows) {
    const baseId = toBaseId(row._id);
    const current = byBaseId.get(baseId) ?? {};

    if (isDraftId(row._id)) current.draftAuthorId = row.authorId;
    else current.publishedAuthorId = row.authorId;

    byBaseId.set(baseId, current);
  }

  const counts = new Map<string, number>();
  for (const entry of byBaseId.values()) {
    const effectiveAuthorId = entry.draftAuthorId ?? entry.publishedAuthorId;
    if (!effectiveAuthorId) continue;
    counts.set(effectiveAuthorId, (counts.get(effectiveAuthorId) ?? 0) + 1);
  }

  return counts;
}

export async function fetchReviewAuthorCounts(
  client: MinimalSanityClient,
  authorIds?: string[],
): Promise<ReviewAuthorCountRow[]> {
  const scopedIds = Array.from(new Set((authorIds ?? []).filter(Boolean)));

  const [rows, ids] = await Promise.all([
    client.fetch<ReviewRow[]>(REVIEWS_WITH_AUTHORS_QUERY),
    scopedIds.length
      ? client.fetch<string[]>(SELECTED_REVIEW_AUTHOR_IDS_QUERY, {
          authorIds: scopedIds,
        })
      : client.fetch<string[]>(ALL_REVIEW_AUTHOR_IDS_QUERY),
  ]);

  const countMap = computeCounts(rows ?? []);
  return (ids ?? []).map((authorId) => ({
    _id: authorId,
    reviewCount: countMap.get(authorId) ?? 0,
  }));
}
