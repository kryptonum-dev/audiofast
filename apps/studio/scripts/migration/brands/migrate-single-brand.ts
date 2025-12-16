#!/usr/bin/env bun
/**
 * Single Brand Migration Script
 *
 * Migrates one brand at a time for maximum accuracy and control.
 * Usage:
 *   bun run migrate-single-brand.ts --name="Bricasti"
 *   bun run migrate-single-brand.ts --id=58
 *   bun run migrate-single-brand.ts --name="Bricasti" --dry-run
 */

import * as https from "node:https";
import { Readable } from "node:stream";

import { createClient, type SanityClient } from "@sanity/client";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SQL_FILE_PATH = path.resolve(
  __dirname,
  "../../../../../20250528_audiofast.sql",
);

const PRIMALUNA_HERO_IMAGE_REF =
  "image-c19f5cd6588ad862e6597c9843b6d5f44b8cfe96-3494x1538-webp";

const LEGACY_ASSETS_BASE_URL = "https://audiofast.pl/assets/";

// Custom HTTPS agent that bypasses SSL verification for legacy assets
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// ============================================================================
// TYPES
// ============================================================================

interface BrandData {
  // From SiteTree
  id: string;
  name: string;
  urlSegment: string;

  // From ProducerPage
  logoFileId: string | null;
  logoFilename: string | null;
  motto: string | null;
  heroDescription: string | null; // ProducerDescription

  // From Box records
  boxes: BoxRecord[];

  // Parsed content from boxes
  bannerImageId: string | null;
  bannerImageFilename: string | null;
  detailedDescriptionTitle: string | null;
  detailedDescriptionContent: string | null;
  youtubeVideoIds: string[];
}

interface BoxRecord {
  id: string;
  boxType: string;
  title: string | null;
  content: string | null;
  bigPictureId: string | null;
}

interface PortableTextBlock {
  _key: string;
  _type: "block";
  children: Array<{
    _key: string;
    _type: "span";
    marks: string[];
    text: string;
  }>;
  markDefs: any[];
  style: string;
}

interface PortableTextYouTubeBlock {
  _key: string;
  _type: "ptYoutubeVideo";
  youtubeId: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateKey(): string {
  return uuidv4().replace(/-/g, "").substring(0, 12);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function textToPortableText(text: string): PortableTextBlock[] {
  if (!text) return [];
  return [
    {
      _key: generateKey(),
      _type: "block",
      children: [
        {
          _key: generateKey(),
          _type: "span",
          marks: [],
          text: text.trim(),
        },
      ],
      markDefs: [],
      style: "normal",
    },
  ];
}

function htmlToPortableText(html: string | null): PortableTextBlock[] {
  if (!html) return [];

  const paragraphs: string[] = [];
  const normalizedHtml = html.replace(/\n/g, "___NEWLINE___");
  const pRegex = /<p[^>]*>(.*?)<\/p>/g;
  let match;

  while ((match = pRegex.exec(normalizedHtml)) !== null) {
    const content = stripHtml(match[1].replace(/___NEWLINE___/g, "\n"));
    if (content) {
      paragraphs.push(content);
    }
  }

  if (paragraphs.length === 0) {
    const content = stripHtml(normalizedHtml.replace(/___NEWLINE___/g, "\n"));
    if (content) {
      paragraphs.push(content);
    }
  }

  return paragraphs.map((text) => ({
    _key: generateKey(),
    _type: "block" as const,
    children: [
      {
        _key: generateKey(),
        _type: "span" as const,
        marks: [],
        text,
      },
    ],
    markDefs: [],
    style: "normal",
  }));
}

function extractYouTubeId(content: string): string | null {
  // Match YouTube embed URLs
  const youtubeMatch = content.match(
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  );
  return youtubeMatch ? youtubeMatch[1] : null;
}

function generateSeoDescription(
  brandName: string,
  motto: string | null,
  description: string | null,
): string {
  const sourceText = motto || (description ? stripHtml(description) : "");

  if (sourceText) {
    if (sourceText.length <= 140 && sourceText.length >= 110) {
      return sourceText;
    }
    if (sourceText.length < 110) {
      return `${sourceText} Sprawdź ofertę ${brandName} w Audiofast.`.substring(
        0,
        140,
      );
    }
    let truncated = sourceText.substring(0, 137);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 100) {
      truncated = truncated.substring(0, lastSpace);
    }
    return truncated + "...";
  }

  return `Odkryj produkty marki ${brandName} w ofercie Audiofast. Sprzęt audio klasy high-end dla wymagających.`;
}

// ============================================================================
// SQL PARSING FUNCTIONS - IMPROVED VERSION
// ============================================================================

/**
 * Parse a CSV-style value, handling quoted strings
 */
function parseCSVValue(value: string): string | null {
  if (!value || value === "NULL") return null;
  // Remove surrounding quotes and unescape
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function parseSiteTreeBrand(
  sqlContent: string,
  brandId: string,
): { name: string; urlSegment: string } | null {
  // Use grep-style matching on the raw SQL
  const regex = new RegExp(
    `\\(${brandId},'ProducerPage','[^']*','[^']*','([^']+)','([^']+)'`,
    "g",
  );
  const match = regex.exec(sqlContent);

  if (match) {
    return {
      urlSegment: match[1],
      name: match[2],
    };
  }

  return null;
}

function findBrandIdByName(
  sqlContent: string,
  brandName: string,
): string | null {
  const normalizedName = brandName.toLowerCase().trim();
  const regex = /\((\d+),'ProducerPage','[^']*','[^']*','([^']+)','([^']+)'/g;
  let match;

  while ((match = regex.exec(sqlContent)) !== null) {
    const name = match[3];
    if (name.toLowerCase().trim() === normalizedName) {
      return match[1];
    }
  }

  return null;
}

function parseProducerPage(
  sqlContent: string,
  brandId: string,
): {
  logoFileId: string | null;
  motto: string | null;
  heroDescription: string | null;
} | null {
  // Direct search in the SQL content for the ProducerPage record
  // Format: (ID,'productLinks',LogoID,Logo2ID,bOtherBrands,pageContent,pageContent_pl_PL,SidebarContent,SidebarContent_pl_PL,'motto','motto_pl_PL',bLinkBar,'ProducerDescription')

  // Search for the specific brand's ProducerPage record
  const searchRegex = new RegExp(
    `\\(${brandId},'[^']*',(\\d+),(\\d+|NULL),(\\d+),[^,]*,[^,]*,[^,]*,[^,]*,'([^']*)',([^,]*),(\\d+),'([^']*)'\\)`,
  );

  const match = sqlContent.match(searchRegex);
  if (match) {
    return {
      logoFileId: match[1] !== "0" ? match[1] : null,
      motto: match[4] || null,
      heroDescription: match[7] || null,
    };
  }

  // Alternative: Search line by line in ProducerPage INSERT
  const lines = sqlContent.split("\n");
  for (const line of lines) {
    if (
      line.includes("INSERT INTO `ProducerPage`") ||
      line.includes(`(${brandId},'a:`)
    ) {
      // Try to find our brand in this line
      const brandMatch = line.match(
        new RegExp(`\\(${brandId},'[^']*',(\\d+),`),
      );
      if (brandMatch) {
        // Extract the full record
        const recordStart = line.indexOf(`(${brandId},`);
        if (recordStart >= 0) {
          // Find motto and description
          const mottoMatch = line.match(/'([^']*)','([^']*)',NULL,\d+,'<p>/);
          const descMatch = line.match(/,\d+,'(<p>[^']*<\/p>)'\)/);

          return {
            logoFileId: brandMatch[1] !== "0" ? brandMatch[1] : null,
            motto: mottoMatch ? mottoMatch[1] || mottoMatch[2] : null,
            heroDescription: descMatch ? descMatch[1] : null,
          };
        }
      }
    }
  }

  return null;
}

function parseFileRecord(sqlContent: string, fileId: string): string | null {
  if (!fileId || fileId === "NULL" || fileId === "0") return null;

  // Direct search for file record
  // Format: (ID,'ClassName','LastEdited','Created','Name','Title',...,'FileHash','FileFilename',...)
  const fileRegex = new RegExp(
    `\\(${fileId},'[^']*','[^']*','[^']*','([^']+)','[^']*',[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,'[^']*','[^']*','[^']*','([^']+)'`,
  );

  const match = sqlContent.match(fileRegex);
  if (match) {
    return match[2]; // FileFilename is the second capture group
  }

  return null;
}

function parseBoxRecords(sqlContent: string, brandId: string): BoxRecord[] {
  const boxes: BoxRecord[] = [];

  // Use a more robust approach - search the entire SQL content
  // Box format: (ID,'Box','LastEdited','Created',Title,'box_type','Content',isPublished,Sort,BoxedPageID,...)
  // We need to find all boxes where BoxedPageID = brandId

  // First, let's find all potential Box records
  const boxLineRegex =
    /\((\d+),'Box','[^']*','[^']*',([^,]*),'([^']+)','([^']*)',(\d+),(\d+),(\d+),/g;
  let match;

  while ((match = boxLineRegex.exec(sqlContent)) !== null) {
    const boxedPageId = match[7];
    if (boxedPageId === brandId) {
      const boxId = match[1];
      const titleRaw = match[2];
      const boxType = match[3];
      const content = match[4];

      // Parse title (could be NULL or 'string')
      let title: string | null = null;
      if (titleRaw && titleRaw !== "NULL") {
        title = titleRaw.replace(/^'|'$/g, "");
      }

      boxes.push({
        id: boxId,
        boxType,
        title,
        content: content || null,
        bigPictureId: null, // Will be parsed separately
      });
    }
  }

  // If basic regex didn't work, try alternative approach
  if (boxes.length === 0) {
    // Search for Box records containing our brandId in the BoxedPageID position
    const altRegex = new RegExp(
      `\\((\\d+),'Box',[^)]*,${brandId},\\d+,(\\d+|NULL)`,
      "g",
    );

    while ((match = altRegex.exec(sqlContent)) !== null) {
      const boxId = match[1];
      const bigPictureId = match[2] !== "NULL" ? match[2] : null;

      // Get more details about this box
      const detailRegex = new RegExp(
        `\\(${boxId},'Box','[^']*','[^']*',([^,]*),'([^']+)','([^']*)'`,
      );
      const detailMatch = sqlContent.match(detailRegex);

      if (detailMatch) {
        let title: string | null = null;
        if (detailMatch[1] && detailMatch[1] !== "NULL") {
          title = detailMatch[1].replace(/^'|'$/g, "");
        }

        boxes.push({
          id: boxId,
          boxType: detailMatch[2],
          title,
          content: detailMatch[3] || null,
          bigPictureId,
        });
      }
    }
  }

  return boxes;
}

/**
 * Alternative parsing using grep-style search
 */
function parseProducerPageAlt(
  sqlContent: string,
  brandId: string,
): {
  logoFileId: string | null;
  motto: string | null;
  heroDescription: string | null;
} | null {
  // Search for the brand's record using a simpler pattern
  const searchPattern = `(${brandId},'a:`;
  const startIdx = sqlContent.indexOf(searchPattern);

  if (startIdx === -1) return null;

  // Find the end of this record (next record starts with ),()
  let endIdx = sqlContent.indexOf("),(", startIdx);
  if (endIdx === -1) endIdx = sqlContent.indexOf(");", startIdx);

  const record = sqlContent.substring(startIdx, endIdx + 1);

  // Extract LogoID (third field after ID and productLinks)
  const logoMatch = record.match(/^[^,]*,'[^']*',(\d+),/);
  const logoFileId = logoMatch && logoMatch[1] !== "0" ? logoMatch[1] : null;

  // Extract motto (look for the motto pattern)
  const mottoMatch = record.match(/'([^']{1,200})','[^']*',NULL,\d+,'/);
  const motto = mottoMatch ? mottoMatch[1] : null;

  // Extract heroDescription (last field before closing paren)
  const descMatch = record.match(/,'(<p>[^']+<\/p>)'\)$/);
  const heroDescription = descMatch ? descMatch[1] : null;

  return { logoFileId, motto, heroDescription };
}

// ============================================================================
// BRAND DATA EXTRACTION
// ============================================================================

/**
 * Direct extraction of ProducerPage data using raw SQL grep
 */
function extractProducerPageDirect(
  sqlContent: string,
  brandId: string,
): {
  logoFileId: string | null;
  motto: string | null;
  heroDescription: string | null;
} {
  // Find the ProducerPage record line
  const lines = sqlContent.split("\n");
  let producerPageLine = "";

  for (const line of lines) {
    if (line.includes("INSERT INTO `ProducerPage`")) {
      producerPageLine = line;
      break;
    }
  }

  if (!producerPageLine) {
    return { logoFileId: null, motto: null, heroDescription: null };
  }

  // Split by ),( to find our brand's record
  const records = producerPageLine.split("),(");

  for (const record of records) {
    // Check if this record starts with our brand ID
    if (
      record.match(new RegExp(`^\\(?${brandId},'`)) ||
      record.match(new RegExp(`^${brandId},'`))
    ) {
      // Extract LogoID (third comma-separated value after ID and productLinks)
      const parts = record.split(",");

      // Find LogoID (should be after ID and 'a:...' productLinks string)
      let logoFileId: string | null = null;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].match(/^\d+$/) && i > 1) {
          logoFileId = parts[i] !== "0" ? parts[i] : null;
          break;
        }
      }

      // Find motto - look for pattern ,'motto text',
      const mottoMatch = record.match(/'([^']{5,150})','[^']*',NULL,\d+,'/);
      const motto = mottoMatch ? mottoMatch[1] : null;

      // Find heroDescription - it's the HTML paragraph at the end
      const descMatch = record.match(/,'(<p>[^']+<\/p>)'\)?$/);
      const heroDescription = descMatch ? descMatch[1] : null;

      return { logoFileId, motto, heroDescription };
    }
  }

  return { logoFileId: null, motto: null, heroDescription: null };
}

/**
 * Direct extraction of File record using raw SQL grep
 * File structure: (FileID,'ClassName','LastEdited','Created','Filename','Title',...,'FileFilename',...)
 */
function extractFilenameDirect(
  sqlContent: string,
  fileId: string,
): string | null {
  if (!fileId || fileId === "0") return null;

  // Find the File INSERT statement and search for our file ID
  const lines = sqlContent.split("\n");
  let fileLine = "";

  for (const line of lines) {
    if (line.includes("INSERT INTO `File`")) {
      fileLine = line;
      break;
    }
  }

  if (!fileLine) return null;

  // Split by ),( to find our record
  const records = fileLine.split("),(");

  for (const record of records) {
    // Check if this record starts with our file ID
    if (
      record.match(new RegExp(`^\\(?${fileId},'`)) ||
      record.match(new RegExp(`^${fileId},'`))
    ) {
      // Extract FileFilename - it's typically in format 'folder/filename.ext'
      // Look for pattern like 'producer-logo/Bricasti-250-v5.png' or 'bigpicture/...'
      const filenameMatch = record.match(
        /'([a-z-]+\/[^']+\.(png|jpg|jpeg|gif|webp))'/i,
      );
      if (filenameMatch) {
        return filenameMatch[1];
      }

      // Alternative: look for any path with slash
      const altMatch = record.match(/'([^']+\/[^']+\.[a-z]+)'/i);
      if (altMatch) {
        return altMatch[1];
      }
    }
  }

  return null;
}

/**
 * Simple extraction of Box records by grepping for brandId in BoxedPageID position
 * Box structure from grep:
 *   733,'Box','2025-01-17 16:10:40','2017-06-06 14:17:21',NULL,'bigimg',NULL,1,671,58,0,10757,...
 */
function extractBoxesDirect(sqlContent: string, brandId: string): BoxRecord[] {
  const boxes: BoxRecord[] = [];

  // Find the Box INSERT statement
  const lines = sqlContent.split("\n");
  let boxLine = "";

  for (const line of lines) {
    if (line.includes("INSERT INTO `Box`")) {
      boxLine = line;
      break;
    }
  }

  if (!boxLine) {
    console.log("  [DEBUG] Box INSERT statement not found");
    return boxes;
  }

  console.log(`  [DEBUG] Box line length: ${boxLine.length} chars`);

  // For bigimg boxes: ID,'Box','timestamp','timestamp',NULL,'bigimg',NULL,isPublished,Sort,BrandID,?,BigPicID
  // Example: 733,'Box','2025-01-17 16:10:40','2017-06-06 14:17:21',NULL,'bigimg',NULL,1,671,58,0,10757
  const bigimgPattern = `(\\d+),'Box','[^']+','[^']+',NULL,'bigimg',NULL,(\\d+),(\\d+),${brandId},(\\d+),(\\d+)`;
  console.log(`  [DEBUG] bigimg pattern: ${bigimgPattern}`);

  const bigimgRegex = new RegExp(bigimgPattern, "g");

  let match;
  while ((match = bigimgRegex.exec(boxLine)) !== null) {
    console.log(
      `  [DEBUG] Found bigimg box: ${match[1]}, BigPicID: ${match[5]}`,
    );
    const bigPictureId = match[5] !== "0" ? match[5] : null;
    boxes.push({
      id: match[1],
      boxType: "bigimg",
      title: null,
      content: null,
      bigPictureId,
    });
  }

  // For text boxes - simpler pattern: ID,'Box',...,'text','<content>',isPublished,Sort,brandId
  // We need to match the brandId in position after Sort
  // Text content can be very long, so we'll search differently

  // Find all text boxes first, then filter by brandId
  // Pattern: boxId,'Box','ts','ts',Title,'text','content...',isPublished,Sort,brandId,
  const textSimplePattern = `(\\d+),'Box','[^']+','[^']+',(NULL|'[^']*'),'text','`;
  const textStartRegex = new RegExp(textSimplePattern, "g");

  while ((match = textStartRegex.exec(boxLine)) !== null) {
    const boxId = match[1];
    const startIdx = match.index + match[0].length;

    // Find the end of the content (look for ',isPublished,Sort,brandId,)
    // The content ends when we see pattern: ',digit,digit,brandId,
    const afterContent = boxLine.substring(startIdx);
    const endPattern = new RegExp(`',([01]),(\\d+),${brandId},(\\d+),(\\d+),`);
    const endMatch = afterContent.match(endPattern);

    if (endMatch) {
      const content = afterContent.substring(
        0,
        afterContent.indexOf(endMatch[0]),
      );
      console.log(
        `  [DEBUG] Found text box: ${boxId}, content length: ${content.length}`,
      );
      boxes.push({
        id: boxId,
        boxType: "text",
        title: null,
        content: content,
        bigPictureId: null,
      });
    }
  }

  return boxes;
}

function extractBrandData(
  sqlContent: string,
  brandId: string,
): BrandData | null {
  console.log(`\n📦 Extracting data for brand ID: ${brandId}\n`);

  // 1. Get SiteTree data
  const siteTree = parseSiteTreeBrand(sqlContent, brandId);
  if (!siteTree) {
    console.error(`Could not find SiteTree record for brand ID ${brandId}`);
    return null;
  }
  console.log(`✓ SiteTree: ${siteTree.name} (${siteTree.urlSegment})`);

  // 2. Get ProducerPage data - use direct extraction
  const producerPage = extractProducerPageDirect(sqlContent, brandId);
  console.log(
    `✓ ProducerPage: Logo=${producerPage.logoFileId}, Motto=${producerPage.motto ? "Yes" : "No"}, Desc=${producerPage.heroDescription ? "Yes" : "No"}`,
  );

  // 3. Get logo filename
  let logoFilename: string | null = null;
  if (producerPage.logoFileId) {
    logoFilename = extractFilenameDirect(sqlContent, producerPage.logoFileId);
    console.log(`✓ Logo file: ${logoFilename || "Not found"}`);
  }

  // 4. Get Box records - use direct extraction
  const boxes = extractBoxesDirect(sqlContent, brandId);
  console.log(`✓ Found ${boxes.length} Box records`);

  // 5. Process boxes to extract content
  let bannerImageId: string | null = null;
  let bannerImageFilename: string | null = null;
  let detailedDescriptionTitle: string | null = null;
  let detailedDescriptionContent: string | null = null;
  const youtubeVideoIds: string[] = [];

  for (const box of boxes) {
    console.log(`  - Box ${box.id}: type=${box.boxType}`);

    if (box.boxType === "bigimg" && box.bigPictureId) {
      bannerImageId = box.bigPictureId;
      bannerImageFilename = extractFilenameDirect(sqlContent, box.bigPictureId);
      console.log(`    → Banner image: ${bannerImageFilename || "Not found"}`);
    }

    if (box.boxType === "text" && box.content) {
      // Check for YouTube embeds (skip Vimeo for now)
      const youtubeId = extractYouTubeId(box.content);
      if (youtubeId) {
        youtubeVideoIds.push(youtubeId);
        console.log(`    → YouTube video: ${youtubeId}`);
      } else if (
        !box.content.includes("vimeo.com") &&
        !box.content.includes("player.vimeo")
      ) {
        // This is a text description block (not video)
        if (!detailedDescriptionContent) {
          detailedDescriptionTitle = box.title;
          detailedDescriptionContent = box.content;
          console.log(
            `    → Detailed description (${box.content.length} chars)`,
          );
        } else {
          // Append to existing description
          detailedDescriptionContent += box.content;
          console.log(
            `    → Additional description (${box.content.length} chars)`,
          );
        }
      } else {
        console.log(`    → Vimeo video (skipped)`);
      }
    }
  }

  return {
    id: brandId,
    name: siteTree.name,
    urlSegment: siteTree.urlSegment,
    logoFileId: producerPage.logoFileId,
    logoFilename,
    motto: producerPage.motto,
    heroDescription: producerPage.heroDescription,
    boxes,
    bannerImageId,
    bannerImageFilename,
    detailedDescriptionTitle,
    detailedDescriptionContent,
    youtubeVideoIds,
  };
}

// ============================================================================
// IMAGE UPLOAD FUNCTIONS
// ============================================================================

async function fetchImageInsecure(imageUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const url = new URL(imageUrl);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: "GET",
      agent: insecureAgent,
      headers: {
        "User-Agent": "Sanity-Migration-Script/1.0",
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Failed to fetch: ${imageUrl} (${res.statusCode})`);
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", () => resolve(null));
    });

    req.on("error", () => resolve(null));
    req.end();
  });
}

async function uploadImage(
  client: SanityClient,
  imageUrl: string,
  filename: string,
): Promise<string | null> {
  try {
    console.log(`  Uploading: ${filename}...`);
    const imageBuffer = await fetchImageInsecure(imageUrl);

    if (!imageBuffer || imageBuffer.length === 0) {
      console.error(`  Failed to fetch image: ${imageUrl}`);
      return null;
    }

    const readable = new Readable();
    readable.push(imageBuffer);
    readable.push(null);

    const asset = await client.assets.upload("image", readable, {
      filename,
      source: {
        id: imageUrl,
        name: "SilverStripe",
        url: imageUrl,
      },
    });

    console.log(`  ✓ Uploaded: ${asset._id}`);
    return asset._id;
  } catch (error) {
    console.error(`  Error uploading ${filename}:`, error);
    return null;
  }
}

async function findExistingAsset(
  client: SanityClient,
  sourceUrl: string,
): Promise<string | null> {
  try {
    const result = await client.fetch<{ _id: string } | null>(
      `*[_type == "sanity.imageAsset" && source.url == $url][0]{_id}`,
      { url: sourceUrl },
    );
    return result?._id || null;
  } catch {
    return null;
  }
}

// ============================================================================
// SANITY DOCUMENT CREATION
// ============================================================================

async function createBrandDocument(
  brandData: BrandData,
  client: SanityClient,
  dryRun: boolean,
): Promise<void> {
  console.log(`\n🔨 Building Sanity document for: ${brandData.name}\n`);

  // 1. Hero description (from ProducerPage.ProducerDescription)
  const heroDescription = brandData.heroDescription
    ? htmlToPortableText(brandData.heroDescription)
    : textToPortableText(
        `Odkryj produkty marki ${brandData.name} w ofercie Audiofast.`,
      );

  console.log(`✓ Hero description: ${heroDescription.length} blocks`);

  // 2. Brand description heading
  const brandDescriptionHeading = brandData.detailedDescriptionTitle
    ? textToPortableText(brandData.detailedDescriptionTitle)
    : textToPortableText(`O ${brandData.name}`);

  console.log(
    `✓ Description heading: "${brandData.detailedDescriptionTitle || `O ${brandData.name}`}"`,
  );

  // 3. Brand description content
  let brandDescriptionContent: (
    | PortableTextBlock
    | PortableTextYouTubeBlock
  )[] = [];

  if (brandData.detailedDescriptionContent) {
    brandDescriptionContent = htmlToPortableText(
      brandData.detailedDescriptionContent,
    );
    console.log(
      `✓ Detailed description: ${brandDescriptionContent.length} blocks`,
    );
  } else if (brandData.heroDescription) {
    brandDescriptionContent = htmlToPortableText(brandData.heroDescription);
    console.log(`✓ Using hero description as detailed description`);
  } else {
    brandDescriptionContent = textToPortableText(
      `${brandData.name} to renomowana marka oferująca sprzęt audio najwyższej klasy.`,
    );
  }

  // 4. Add YouTube videos (only YouTube, not Vimeo)
  for (const videoId of brandData.youtubeVideoIds) {
    brandDescriptionContent.push({
      _key: generateKey(),
      _type: "ptYoutubeVideo",
      youtubeId: videoId,
    });
    console.log(`✓ Added YouTube video: ${videoId}`);
  }

  // 5. SEO
  const seoTitle = brandData.name;
  const seoDescription = generateSeoDescription(
    brandData.name,
    brandData.motto,
    brandData.detailedDescriptionContent || brandData.heroDescription,
  );

  console.log(`✓ SEO title: "${seoTitle}"`);
  console.log(
    `✓ SEO description: "${seoDescription}" (${seoDescription.length} chars)`,
  );

  // 6. Upload/find assets
  let logoRef: string | null = null;
  let bannerRef: string | null = null;

  if (!dryRun) {
    // Logo
    if (brandData.logoFilename) {
      const logoUrl = `${LEGACY_ASSETS_BASE_URL}${brandData.logoFilename}`;
      logoRef = await findExistingAsset(client, logoUrl);
      if (!logoRef) {
        logoRef = await uploadImage(
          client,
          logoUrl,
          brandData.logoFilename.split("/").pop() || "logo.png",
        );
      } else {
        console.log(`✓ Logo already exists in Sanity`);
      }
    }

    // Banner
    if (brandData.bannerImageFilename) {
      const bannerUrl = `${LEGACY_ASSETS_BASE_URL}${brandData.bannerImageFilename}`;
      bannerRef = await findExistingAsset(client, bannerUrl);
      if (!bannerRef) {
        bannerRef = await uploadImage(
          client,
          bannerUrl,
          brandData.bannerImageFilename.split("/").pop() || "banner.jpg",
        );
      } else {
        console.log(`✓ Banner already exists in Sanity`);
      }
    }
  } else {
    console.log(`  [DRY RUN] Would upload logo: ${brandData.logoFilename}`);
    console.log(
      `  [DRY RUN] Would upload banner: ${brandData.bannerImageFilename}`,
    );
  }

  // 7. Build document
  const document: any = {
    _id: `brand-${brandData.id}`,
    _type: "brand",
    name: brandData.name,
    slug: {
      _type: "slug",
      current: `/marki/${brandData.urlSegment}/`,
    },
    description: heroDescription,
    heroImage: {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: PRIMALUNA_HERO_IMAGE_REF,
      },
    },
    brandDescriptionHeading,
    brandDescription: brandDescriptionContent,
    seo: {
      title: seoTitle,
      description: seoDescription,
    },
    doNotIndex: false,
    hideFromList: false,
  };

  if (logoRef) {
    document.logo = {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: logoRef,
      },
    };
  }

  if (bannerRef) {
    document.bannerImage = {
      _type: "image",
      asset: {
        _type: "reference",
        _ref: bannerRef,
      },
    };
  }

  // 8. Create/update in Sanity
  console.log(`\n📤 Document preview:\n`);
  console.log(JSON.stringify(document, null, 2));

  if (!dryRun) {
    console.log(`\n💾 Creating/updating document in Sanity...`);
    await client.createOrReplace(document);
    console.log(`\n✅ Successfully migrated: ${brandData.name}`);
  } else {
    console.log(`\n🔍 [DRY RUN] Would create/update document in Sanity`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  // Parse arguments
  const args = process.argv.slice(2);
  let brandName: string | null = null;
  let brandId: string | null = null;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith("--name=")) {
      brandName = arg.replace("--name=", "");
    } else if (arg.startsWith("--id=")) {
      brandId = arg.replace("--id=", "");
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  if (!brandName && !brandId) {
    console.log(`
Usage:
  bun run migrate-single-brand.ts --name="Bricasti"
  bun run migrate-single-brand.ts --id=58
  bun run migrate-single-brand.ts --name="Bricasti" --dry-run

Options:
  --name=<name>   Brand name to migrate
  --id=<id>       Brand ID (SiteTree ID) to migrate
  --dry-run       Preview without making changes
    `);
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  SINGLE BRAND MIGRATION SCRIPT`);
  console.log(`${"=".repeat(60)}\n`);

  if (dryRun) {
    console.log(`🔍 DRY RUN MODE - No changes will be made\n`);
  }

  // Read SQL file
  console.log(`📂 Reading SQL file: ${SQL_FILE_PATH}\n`);
  const sqlContent = fs.readFileSync(SQL_FILE_PATH, "utf-8");

  // Find brand ID if name provided
  if (brandName && !brandId) {
    brandId = findBrandIdByName(sqlContent, brandName);
    if (!brandId) {
      console.error(`❌ Could not find brand with name: ${brandName}`);
      process.exit(1);
    }
    console.log(`✓ Found brand ID: ${brandId} for "${brandName}"`);
  }

  // Extract brand data
  const brandData = extractBrandData(sqlContent, brandId!);
  if (!brandData) {
    console.error(`❌ Could not extract data for brand ID: ${brandId}`);
    process.exit(1);
  }

  // Display summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  BRAND DATA SUMMARY`);
  console.log(`${"=".repeat(60)}\n`);
  console.log(`Name:           ${brandData.name}`);
  console.log(`ID:             ${brandData.id}`);
  console.log(`Slug:           /marki/${brandData.urlSegment}/`);
  console.log(`Logo:           ${brandData.logoFilename || "None"}`);
  console.log(`Banner:         ${brandData.bannerImageFilename || "None"}`);
  console.log(`Motto:          ${brandData.motto || "None"}`);
  console.log(`Hero Desc:      ${brandData.heroDescription ? "Yes" : "No"}`);
  console.log(
    `Detailed Title: ${brandData.detailedDescriptionTitle || "None"}`,
  );
  console.log(
    `Detailed Desc:  ${brandData.detailedDescriptionContent ? "Yes" : "No"}`,
  );
  console.log(`YouTube Videos: ${brandData.youtubeVideoIds.length}`);
  console.log(`Total Boxes:    ${brandData.boxes.length}`);

  // Create Sanity client
  const projectId = process.env.SANITY_PROJECT_ID || "fsw3likv";
  const dataset = process.env.SANITY_DATASET || "production";
  const token = process.env.SANITY_API_TOKEN;

  if (!token && !dryRun) {
    console.error(
      `\n❌ SANITY_API_TOKEN environment variable required for migration`,
    );
    process.exit(1);
  }

  const client = createClient({
    projectId,
    dataset,
    token: token || "dummy-token-for-dry-run",
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  // Create/update brand document
  await createBrandDocument(brandData, client, dryRun);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
