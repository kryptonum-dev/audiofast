import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { client } from "@/src/global/sanity/client";

type WebhookDocument = {
  _id?: string;
  _type?: string;
  slug?: string | null;
};

const TAG_DENYLIST = new Set(["sanity.imageAsset", "sanity.fileAsset"]);

export async function POST(request: NextRequest) {
  const revalidateToken = process.env.NEXT_REVALIDATE_TOKEN;

  if (!revalidateToken) {
    console.error("Missing NEXT_REVALIDATE_TOKEN environment variable.");
    return NextResponse.json(
      { revalidated: false, message: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const authorizationHeader = request.headers.get("authorization");

  if (authorizationHeader !== `Bearer ${revalidateToken}`) {
    return NextResponse.json(
      { revalidated: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  let payload: WebhookDocument | WebhookDocument[];

  try {
    payload = (await request.json()) as WebhookDocument | WebhookDocument[];
  } catch (error) {
    console.error("Invalid webhook payload", error);
    return NextResponse.json(
      { revalidated: false, message: "Invalid payload" },
      { status: 400 },
    );
  }

  const documents = Array.isArray(payload) ? payload : [payload];

  if (documents.length === 0) {
    return NextResponse.json(
      { revalidated: false, message: "No documents received" },
      { status: 400 },
    );
  }

  const tags = new Set<string>();
  const referenceMap = new Map<string, string[]>();

  for (const doc of documents) {
    if (!doc?._type) {
      continue;
    }

    addTag(tags, doc._type);

    if (!doc._id) {
      continue;
    }

    const referencingTypes = await getReferencingDocumentTypes(doc._id);

    if (referencingTypes.length > 0) {
      referenceMap.set(doc._id, referencingTypes);
      referencingTypes.forEach((type) => addTag(tags, type));
    }
  }

  if (tags.size === 0) {
    return NextResponse.json(
      { revalidated: false, message: "No tags to revalidate" },
      { status: 400 },
    );
  }

  const revalidatedTags: string[] = [];

  for (const tag of tags) {
    revalidateTag(tag, "max");
    revalidatedTags.push(tag);
  }

  return NextResponse.json({
    revalidated: true,
    tags: revalidatedTags,
    references: Object.fromEntries(referenceMap),
    timestamp: Date.now(),
  });
}

function addTag(tagSet: Set<string>, tag?: string | null) {
  if (!tag || TAG_DENYLIST.has(tag)) {
    return;
  }

  const trimmed = tag.trim();

  if (trimmed.length === 0 || trimmed.length > 256) {
    return;
  }

  tagSet.add(trimmed);
}

async function getReferencingDocumentTypes(documentId: string) {
  const query = /* groq */ `
    array::unique(
      *[
        references($documentId)
        && !(_type match "sanity\\\\..*")
      ]._type
    )
  `;

  try {
    const result =
      (await client.fetch<string[] | null>(query, { documentId })) ?? [];
    return result.filter((type) => !!type && !TAG_DENYLIST.has(type));
  } catch (error) {
    console.error("Failed to fetch referencing document types", error);
    return [];
  }
}
