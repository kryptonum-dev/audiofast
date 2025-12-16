#!/usr/bin/env bun
/**
 * Update Existing Brands Script
 *
 * Updates brands that were created before CSV migration with data from CSV.
 * Usage:
 *   SANITY_API_TOKEN="xxx" bun run update-existing-brands.ts
 *   SANITY_API_TOKEN="xxx" bun run update-existing-brands.ts --dry-run
 */

import * as https from "node:https";
import { Readable } from "node:stream";

import { createClient, type SanityClient } from "@sanity/client";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CSV_FILE_PATH = path.resolve(__dirname, "../../../../../brandsall.csv");

const PRIMALUNA_HERO_IMAGE_REF =
  "image-c19f5cd6588ad862e6597c9843b6d5f44b8cfe96-3494x1538-webp";

const LEGACY_ASSETS_BASE_URL = "https://audiofast.pl/assets/";

// SSL bypass agent for legacy assets
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Mapping of existing Sanity IDs to CSV IDs
const BRAND_MAPPING: Record<
  string,
  { sanityId: string; csvId: string; name: string }
> = {
  weiss: {
    sanityId: "bfad2cf6-37cc-4d0d-ab1d-71c298831e3d",
    csvId: "2049",
    name: "Weiss Engineering",
  },
  synergistic: {
    sanityId: "440dafbd-9f7d-4f29-a290-6fd01964378c",
    csvId: "65",
    name: "Synergistic Research",
  },
  aurender: {
    sanityId: "c7f14a8e-dd41-4c93-86b1-2c6bc651afc8",
    csvId: "232",
    name: "Aurender",
  },
  ayre: {
    sanityId: "988e9213-ff50-4a8b-a87b-3e3478126485",
    csvId: "1982",
    name: "Ayre Acoustics",
  },
  "audio-research": {
    sanityId: "audio-research-brand-001",
    csvId: "73",
    name: "Audio Research",
  },
  dcs: {
    sanityId: "dcs-brand-001",
    csvId: "52",
    name: "dCS",
  },
  gryphon: {
    sanityId: "gryphon-brand-001",
    csvId: "71",
    name: "Gryphon Audio Designs",
  },
  usher: {
    sanityId: "usher-brand-001",
    csvId: "242",
    name: "Usher Audio Technology",
  },
  "dan-dagostino": {
    sanityId: "dan-dagostino-brand-001",
    csvId: "56",
    name: "Dan D'Agostino Master Audio Systems",
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface CSVRow {
  ID: string;
  Name: string;
  Slug: string;
  LogoID: string;
  LogoFilename: string | null;
  HeroDescription: string | null;
  BannerBoxID: string | null;
  BigPictureID: string | null;
  BannerImageFilename: string | null;
  TextBoxID: string | null;
  TextBoxContent: string | null;
}

interface BrandData {
  id: string;
  name: string;
  slug: string;
  logoFilename: string | null;
  heroDescription: string | null;
  bannerImageFilename: string | null;
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

// ============================================================================
// HELPERS
// ============================================================================

function generateKey(): string {
  return uuidv4().slice(0, 8);
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

  const blocks: PortableTextBlock[] = [];
  const normalized = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split(/<\/?(?:p|h[1-6]|div|blockquote)[^>]*>/gi);

  for (const part of parts) {
    const text = stripHtml(part);
    if (text.length > 0) {
      blocks.push({
        _key: generateKey(),
        _type: "block",
        children: [
          {
            _key: generateKey(),
            _type: "span",
            marks: [],
            text: text,
          },
        ],
        markDefs: [],
        style: "normal",
      });
    }
  }

  return blocks;
}

function generateSeoDescription(
  brandName: string,
  heroDescription: string | null,
): string {
  if (heroDescription) {
    const plainText = stripHtml(heroDescription);
    const firstSentence = plainText.split(/[.!?]/)[0];
    if (
      firstSentence &&
      firstSentence.length >= 80 &&
      firstSentence.length <= 140
    ) {
      return firstSentence.trim() + ".";
    }
    if (plainText.length >= 110) {
      const truncated = plainText.slice(0, 137).trim();
      return truncated + "...";
    }
  }
  return `${brandName} - poznaj wysokiej klasy sprzęt audio w ofercie Audiofast. Produkty premium dla wymagających audiofilów.`;
}

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(filePath: string): CSVRow[] {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  return parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as CSVRow[];
}

function findBrandInCSV(rows: CSVRow[], csvId: string): BrandData | null {
  const brandRows = rows.filter((row) => row.ID === csvId);
  if (brandRows.length === 0) return null;

  const firstRow = brandRows[0];
  return {
    id: firstRow.ID,
    name: firstRow.Name,
    slug: firstRow.Slug,
    logoFilename: firstRow.LogoFilename || null,
    heroDescription: firstRow.HeroDescription || null,
    bannerImageFilename:
      brandRows.find((r) => r.BannerImageFilename)?.BannerImageFilename || null,
  };
}

// ============================================================================
// ASSET UPLOAD
// ============================================================================

async function fetchImageInsecure(imageUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const request = https.get(
      imageUrl,
      { agent: insecureAgent },
      (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            fetchImageInsecure(redirectUrl).then(resolve);
            return;
          }
        }

        if (response.statusCode !== 200) {
          console.error(`  ✗ Failed to fetch image: ${response.statusCode}`);
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", () => resolve(null));
      },
    );

    request.on("error", () => resolve(null));
  });
}

async function uploadImageToSanity(
  client: SanityClient,
  imageUrl: string,
  filename: string,
): Promise<string | null> {
  console.log(`  ↓ Downloading: ${filename}`);

  const imageBuffer = await fetchImageInsecure(imageUrl);
  if (!imageBuffer) return null;

  console.log(`  ↑ Uploading to Sanity...`);

  try {
    const asset = await client.assets.upload(
      "image",
      Readable.from(imageBuffer),
      {
        filename: filename,
      },
    );
    console.log(`  ✓ Uploaded: ${asset._id}`);
    return asset._id;
  } catch (error) {
    console.error(`  ✗ Upload failed:`, error);
    return null;
  }
}

// ============================================================================
// SANITY CLIENT
// ============================================================================

function createMigrationClient(): SanityClient {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) {
    throw new Error("SANITY_API_TOKEN environment variable is required");
  }

  return createClient({
    projectId: "fsw3likv",
    dataset: "production",
    apiVersion: "2024-01-01",
    token,
    useCdn: false,
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║         UPDATE EXISTING BRANDS                                 ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);

  // Check CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`\n✗ CSV file not found: ${CSV_FILE_PATH}`);
    process.exit(1);
  }

  // Parse CSV
  console.log(`\n📄 Reading CSV: ${CSV_FILE_PATH}`);
  const rows = parseCSV(CSV_FILE_PATH);
  console.log(`  Found ${rows.length} rows`);

  // Create Sanity client
  let client: SanityClient | null = null;
  if (!dryRun) {
    try {
      client = createMigrationClient();
      console.log("\n✓ Sanity client initialized");
    } catch (error) {
      console.error("\n✗ Failed to create Sanity client:", error);
      process.exit(1);
    }
  }

  const results = { success: [] as string[], failed: [] as string[] };
  const brandKeys = Object.keys(BRAND_MAPPING);

  for (let i = 0; i < brandKeys.length; i++) {
    const key = brandKeys[i];
    const mapping = BRAND_MAPPING[key];

    console.log(
      "\n═══════════════════════════════════════════════════════════════════",
    );
    console.log(`🏷️  [${i + 1}/${brandKeys.length}] ${mapping.name}`);
    console.log(
      "═══════════════════════════════════════════════════════════════════",
    );
    console.log(`  Sanity ID: ${mapping.sanityId}`);
    console.log(`  CSV ID: ${mapping.csvId}`);

    // Find brand in CSV
    const csvData = findBrandInCSV(rows, mapping.csvId);
    if (!csvData) {
      console.error(`  ✗ Brand not found in CSV with ID: ${mapping.csvId}`);
      results.failed.push(mapping.name);
      continue;
    }

    console.log(`  Logo: ${csvData.logoFilename || "None"}`);
    console.log(`  Banner: ${csvData.bannerImageFilename || "None"}`);
    console.log(
      `  Hero Description: ${csvData.heroDescription ? "Yes" : "No"}`,
    );

    try {
      // Prepare update data
      const heroDescription = htmlToPortableText(csvData.heroDescription);
      const brandDescriptionHeading = textToPortableText(`O ${mapping.name}`);
      const brandDescription = textToPortableText(
        `${mapping.name} to renomowana marka oferująca sprzęt audio najwyższej klasy.`,
      );
      const seoTitle = mapping.name;
      const seoDescription = generateSeoDescription(
        mapping.name,
        csvData.heroDescription,
      );

      // Upload banner if available and not in dry-run
      let bannerImageRef: string | null = null;
      if (csvData.bannerImageFilename && client && !dryRun) {
        const bannerUrl = `${LEGACY_ASSETS_BASE_URL}${csvData.bannerImageFilename}`;
        const filename =
          csvData.bannerImageFilename.split("/").pop() || "banner.jpg";
        bannerImageRef = await uploadImageToSanity(client, bannerUrl, filename);
      } else if (csvData.bannerImageFilename) {
        console.log(
          `  Banner: ${csvData.bannerImageFilename} (dry-run, not uploading)`,
        );
      }

      // Build patch data
      const patchData: Record<string, any> = {
        description:
          heroDescription.length > 0
            ? heroDescription
            : textToPortableText(
                `Odkryj produkty marki ${mapping.name} w ofercie Audiofast.`,
              ),
        heroImage: {
          _type: "image",
          asset: {
            _type: "reference",
            _ref: PRIMALUNA_HERO_IMAGE_REF,
          },
        },
        brandDescriptionHeading: brandDescriptionHeading,
        brandDescription: brandDescription,
        seo: {
          title: seoTitle,
          description: seoDescription,
        },
      };

      // Add banner if uploaded
      if (bannerImageRef) {
        patchData.bannerImage = {
          _type: "image",
          asset: {
            _type: "reference",
            _ref: bannerImageRef,
          },
        };
      }

      console.log(`\n  Updates to apply:`);
      console.log(`    - Hero Description: ${heroDescription.length} blocks`);
      console.log(`    - Hero Image: PrimaLuna reference`);
      console.log(`    - Description Heading: "O ${mapping.name}"`);
      console.log(`    - Detailed Description: Default text`);
      console.log(`    - SEO Title: ${seoTitle}`);
      console.log(`    - SEO Description: ${seoDescription.length} chars`);
      if (bannerImageRef) {
        console.log(`    - Banner Image: Uploaded`);
      }

      if (!dryRun && client) {
        console.log("\n📤 Patching document in Sanity...");
        await client.patch(mapping.sanityId).set(patchData).commit();
        console.log(`\n✅ SUCCESS: ${mapping.name} updated!`);
        results.success.push(mapping.name);
      } else {
        console.log("\n📋 DRY RUN - Would update document");
        results.success.push(mapping.name);
      }
    } catch (error) {
      console.error(`\n✗ Failed to update ${mapping.name}:`, error);
      results.failed.push(mapping.name);
    }
  }

  // Print summary
  console.log(
    "\n════════════════════════════════════════════════════════════════════",
  );
  console.log("📊 UPDATE SUMMARY");
  console.log(
    "════════════════════════════════════════════════════════════════════",
  );
  console.log(`✅ Successful: ${results.success.length}`);
  if (results.success.length > 0) {
    results.success.forEach((name) => console.log(`   - ${name}`));
  }
  console.log(`❌ Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    results.failed.forEach((name) => console.log(`   - ${name}`));
  }
  console.log("\nUpdate complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
