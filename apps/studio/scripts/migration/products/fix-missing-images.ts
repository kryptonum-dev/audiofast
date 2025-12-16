#!/usr/bin/env bun
/**
 * Fix missing preview images for products
 * Tries both direct URL and brand subfolder URL patterns
 */

import { createClient } from "@sanity/client";
import sharp from "sharp";

// Disable SSL verification for legacy server
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const client = createClient({
  projectId: "fsw3likv",
  dataset: "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

interface MissingImage {
  productId: string;
  csvPath: string; // Path as it appears in CSV (may include brand subfolder)
  productName: string;
}

// All products with missing images and their CSV paths
const missingImages: MissingImage[] = [
  // Aurender (2)
  {
    productId: "product-306",
    csvPath: "produkty/Aurender/577aurender-UT100.png",
    productName: "UT100 USB/Toslink",
  },
  {
    productId: "product-318",
    csvPath: "produkty/Aurender/577aurender-UC100-1.png",
    productName: "UC100",
  },

  // Bricasti (2) - Note: CSV says "MSB" subfolder but brand is Bricasti
  {
    productId: "product-335",
    csvPath: "produkty/MSB/577x470-Select-Transport-Front-2.png",
    productName: "Select Transport",
  },
  {
    productId: "product-336",
    csvPath: "produkty/MSB/577x470-Reference-Transport-Front-900px-1.png",
    productName: "Reference Transport",
  },

  // Dan D'Agostino (1) - No image in CSV (NULL)
  { productId: "product-84", csvPath: "", productName: "Classic Stereo" },

  // Grand Prix Audio (2)
  {
    productId: "product-312",
    csvPath: "produkty/GrandPrixAudio/577x470-GPA-Parabolica-ok.png",
    productName: "Parabolica",
  },
  {
    productId: "product-313",
    csvPath: "produkty/GrandPrixAudio/577x470-grandprix-monaco-20-4.png",
    productName: "Monaco v 2.0",
  },

  // Keces Audio (4)
  {
    productId: "product-486",
    csvPath: "produkty/Keces/577x470-S126.png",
    productName: "S125",
  },
  {
    productId: "product-492",
    csvPath: "produkty/Keces/577x470-P9.png",
    productName: "P8",
  },
  {
    productId: "product-493",
    csvPath: "produkty/Keces/577x470-p4.png",
    productName: "P3",
  },
  {
    productId: "product-574",
    csvPath: "produkty/Keces/577x470-Sphono2.png",
    productName: "Sphono + Sphono Power",
  },

  // Rogue Audio (6)
  {
    productId: "product-115",
    csvPath: "produkty/Rogue-Audio/577x470-ATLAS2SILVERMED.png",
    productName: "Atlas Magnum",
  },
  {
    productId: "product-117",
    csvPath: "produkty/Rogue-Audio/577x470Rogue-Stereo100-1.png",
    productName: "Stereo 100",
  },
  {
    productId: "product-118",
    csvPath: "produkty/Rogue-Audio/577x470-m-181-new-002-2.png",
    productName: "M-180",
  },
  {
    productId: "product-120",
    csvPath: "produkty/Rogue-Audio/577x470-Rogue-Apollo-Dark-1.png",
    productName: "Apollo Dark",
  },
  {
    productId: "product-123",
    csvPath: "produkty/Rogue-Audio/577x470-Ares-1-2.png",
    productName: "Ares",
  },
  {
    productId: "product-526",
    csvPath: "produkty/Rogue-Audio/577x470-RP-9blackmedium2.png",
    productName: "RP-9",
  },

  // Soundsmith (11)
  {
    productId: "product-156",
    csvPath: "produkty/Soundsmith/577x470-Soundsmith-Hyperion.png",
    productName: "Hyperion / Helios",
  },
  {
    productId: "product-157",
    csvPath: "produkty/Soundsmith/577x470-Soundsmith-Mezzo.png",
    productName: "Sussurro MkII / Mezzo",
  },
  {
    productId: "product-158",
    csvPath: "produkty/Soundsmith/577x470-SoundSmith-PAUA.png",
    productName: "Paua MkII / Nautilus",
  },
  {
    productId: "product-159",
    csvPath: "produkty/Soundsmith/577x470-Soundsmith-Voice.png",
    productName: "The Voice / Sotto Voce",
  },
  {
    productId: "product-160",
    csvPath: "produkty/Soundsmith/577x470-Soundsmith-Aida.png",
    productName: "Aida / Norma",
  },
  {
    productId: "product-161",
    csvPath: "produkty/Soundsmith/577x470-SoundSmith-Zephyr2.png",
    productName: "Zephyr MIMC Star",
  },
  {
    productId: "product-162",
    csvPath: "produkty/Soundsmith/577x470-WebZephyr-MKIII.png",
    productName: "Zephyr MkIII",
  },
  {
    productId: "product-163",
    csvPath: "produkty/Soundsmith/577x470-Soundsmith-Carmen.png",
    productName: "Carmen MkII",
  },
  {
    productId: "product-164",
    csvPath: "produkty/Soundsmith/577x470-Soundsmith-UltimateX-1.png",
    productName: "Irox Ultimate",
  },
  {
    productId: "product-165",
    csvPath: "produkty/Soundsmith/577x470-Soundsmith-Blue-X.png",
    productName: "Irox Blue",
  },
  {
    productId: "product-166",
    csvPath: "produkty/Soundsmith/577x470-mmp4-2.png",
    productName: "MMP 4 MkII/ MMP 3 MkII / MCP 2 MkII",
  },

  // Spiral Groove (3)
  {
    productId: "product-305",
    csvPath: "produkty/Spiral-Groove/577x470-Spiral-Groove-SG1.png",
    productName: "Spiral Groove SG1.2",
  },
  {
    productId: "product-383",
    csvPath: "produkty/Spiral-Groove/577x470-centroid.png",
    productName: "Ramię Centroid",
  },
  {
    productId: "product-384",
    csvPath: "produkty/Spiral-Groove/577x470-universal2.png",
    productName: "Centroid Universal",
  },

  // Symposium (20)
  {
    productId: "product-174",
    csvPath: "produkty/Symposium/577x470-Quantum-Head-On-copy.png",
    productName: "Quantum Signature",
  },
  {
    productId: "product-175",
    csvPath: "produkty/Symposium/577x470-Symposium-Segue-1.png",
    productName: "Segue",
  },
  {
    productId: "product-176",
    csvPath: "produkty/Symposium/577x470-SegueISOLG.png",
    productName: "Segue ISO",
  },
  {
    productId: "product-177",
    csvPath: "produkty/Symposium/577x470-Svelte.png",
    productName: "Svelte",
  },
  {
    productId: "product-178",
    csvPath: "produkty/Symposium/577x470-Svelte-Plus.png",
    productName: "Svelte Plus",
  },
  {
    productId: "product-179",
    csvPath: "produkty/Symposium/577x470-Ultra-platform.png",
    productName: "Ultra",
  },
  {
    productId: "product-180",
    csvPath: "produkty/Symposium/577x470-RollerblockJR-Set.jpg",
    productName: "Rollerblock JR",
  },
  {
    productId: "product-181",
    csvPath: "produkty/Symposium/577x470-RBJRHDSE-Pair-W-Ball.jpg",
    productName: "Rollerblock HDSE",
  },
  {
    productId: "product-182",
    csvPath: "produkty/Symposium/577x470-Rollerblocks-Silo-Large.png",
    productName: "Rollerblock Series 2+",
  },
  {
    productId: "product-183",
    csvPath: "produkty/Synergistic/577x470-PrecisionCouplers.jpg",
    productName: "Precision Coupler",
  },
  {
    productId: "product-184",
    csvPath: "produkty/Symposium/577x470-SuperCouplers.jpg",
    productName: "Precision SuperCoupler",
  },
  {
    productId: "product-185",
    csvPath: "produkty/Symposium/577x470-UltraPad.png",
    productName: "Ultra Padz",
  },
  {
    productId: "product-186",
    csvPath: "produkty/Symposium/577x470-FatPadBanded.png",
    productName: "Fat Padz",
  },
  {
    productId: "product-187",
    csvPath: "produkty/Symposium/577x470-PointPodJFK.png",
    productName: "Point Pods",
  },
  {
    productId: "product-188",
    csvPath: "produkty/Symposium/577x470-QuantumSignatureProAmpstand.png",
    productName: "Quantum Signature Pro Ampstand",
  },
  {
    productId: "product-189",
    csvPath: "produkty/Symposium/577x470-UltraStealthAmpstand2.png",
    productName: "Ultra Ampstand",
  },
  {
    productId: "product-190",
    csvPath: "produkty/Symposium/577x470-IsisRackSilverOverhead.png",
    productName: "Isis Rack System",
  },
  {
    productId: "product-444",
    csvPath: "produkty/Symposium/577x470-FoundationStandardMED.png",
    productName: "Foundation Rack",
  },
  {
    productId: "product-445",
    csvPath: "produkty/Symposium/577x470-Osiris2.png",
    productName: "Osiris Rack System",
  },
  {
    productId: "product-446",
    csvPath: "produkty/Symposium/577x470-superseguebbg2.png",
    productName: "Super Segue ISO",
  },

  // Thixar (5)
  {
    productId: "product-547",
    csvPath: "produkty/Thixar/577x470-silencer2.png",
    productName: "Silence",
  },
  {
    productId: "product-550",
    csvPath: "produkty/Thixar/577x470-smd-ambitious2.png",
    productName: "SMD Ambitious MkII",
  },
  {
    productId: "product-551",
    csvPath: "produkty/Thixar/577x470-thixar-spike-set-2.png",
    productName: "Spike-Set",
  },
  {
    productId: "product-553",
    csvPath: "produkty/Thixar/577x470-silent-feet-basic2.png",
    productName: "Silent Feet Basic",
  },
  {
    productId: "product-554",
    csvPath: "produkty/Thixar/577x470-thixar-smd-ultimate2.png",
    productName: "SMD Ultimate",
  },

  // Vandersteen (11)
  {
    productId: "product-191",
    csvPath: "produkty/Vandersteen/577x470-1ci-vandersteen-png.png",
    productName: "1Ci",
  },
  {
    productId: "product-192",
    csvPath: "produkty/Vandersteen/577x470-1ci-vandersteen-png2.png",
    productName: "2Ce Signature II",
  },
  {
    productId: "product-193",
    csvPath: "produkty/Vandersteen/577x470-vandersteen-3ASignature-1.png",
    productName: "3A Signature",
  },
  {
    productId: "product-194",
    csvPath: "produkty/Vandersteen/577x470-TREO.png",
    productName: "Treo",
  },
  {
    productId: "product-195",
    csvPath: "produkty/Vandersteen/577x470-QuatroCT-2.png",
    productName: "Quatro",
  },
  {
    productId: "product-196",
    csvPath: "produkty/Vandersteen/577x470-5ACarbon-1.png",
    productName: "5A Carbon",
  },
  {
    productId: "product-197",
    csvPath: "produkty/Vandersteen/577x470-Model-Seven-Mk-II-1136.png",
    productName: "Seven",
  },
  {
    productId: "product-198",
    csvPath: "produkty/Vandersteen/577x470-VLR-0676-1-1.png",
    productName: "VLR",
  },
  {
    productId: "product-199",
    csvPath: "produkty/Vandersteen/577x470-VSM-1.png",
    productName: "VSM",
  },
  {
    productId: "product-200",
    csvPath: "produkty/Vandersteen/577x470-VCC2-0803-1.png",
    productName: "VCC-2",
  },
  {
    productId: "product-580",
    csvPath: "produkty/Vandersteen/577x479-nine-2.png",
    productName: "System NINE",
  },

  // Vibrapod (2)
  {
    productId: "product-127",
    csvPath: "produkty/Vibrapod/577x470-vibtripod.png",
    productName: "Vibrapod Izolator",
  },
  {
    productId: "product-128",
    csvPath: "produkty/Vibrapod/577x470-cone-isolator.png",
    productName: "Vibrapod Stożek",
  },
];

const BASE_URL = "https://www.audiofast.pl/assets/";

/**
 * Generate possible URLs for an image
 * Tries: 1) Full path with brand subfolder, 2) Direct path without subfolder
 */
function getPossibleUrls(csvPath: string): string[] {
  if (!csvPath) return [];

  const urls: string[] = [];

  // Try the full path as specified in CSV
  urls.push(`${BASE_URL}${csvPath}`);

  // Try without the brand subfolder (just the filename in produkty/)
  const filename = csvPath.split("/").pop();
  if (filename) {
    urls.push(`${BASE_URL}produkty/${filename}`);
  }

  return urls;
}

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

async function tryDownloadImage(
  possibleUrls: string[],
): Promise<{ buffer: Buffer; url: string } | null> {
  for (const url of possibleUrls) {
    const buffer = await downloadImage(url);
    if (buffer && buffer.length > 0) {
      return { buffer, url };
    }
  }
  return null;
}

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width || 0;

  // Upscale small images (< 1400px) by 2x
  let targetWidth = width;
  if (width < 1400) {
    targetWidth = Math.min(width * 2, 2400);
  }

  return image
    .resize(targetWidth, undefined, { withoutEnlargement: false })
    .webp({ quality: 82 })
    .toBuffer();
}

async function fixMissingImages() {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║          FIX MISSING PREVIEW IMAGES                           ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n",
  );

  if (!process.env.SANITY_API_TOKEN) {
    console.error("❌ SANITY_API_TOKEN is required");
    process.exit(1);
  }

  // First, query Sanity to see which products ACTUALLY need fixing
  console.log("📋 Checking which products still need images...\n");

  const productIds = missingImages.map((m) => m.productId);
  const existingProducts = await client.fetch<
    { _id: string; hasImage: boolean }[]
  >(
    `*[_type == "product" && _id in $ids]{_id, "hasImage": defined(previewImage)}`,
    { ids: productIds },
  );

  const existingMap = new Map(existingProducts.map((p) => [p._id, p.hasImage]));

  // Filter to only products that exist and don't have images
  const toFix = missingImages.filter((m) => {
    const exists = existingMap.has(m.productId);
    const hasImage = existingMap.get(m.productId) ?? false;
    return exists && !hasImage && m.csvPath; // Must exist, no image, and have a CSV path
  });

  console.log(`📊 Found ${toFix.length} products that need images\n`);

  if (toFix.length === 0) {
    console.log("✅ All products already have images!");
    return;
  }

  let fixed = 0;
  let failed = 0;
  const failedProducts: { id: string; name: string; reason: string }[] = [];

  for (const item of toFix) {
    console.log(
      `\n📷 [${fixed + failed + 1}/${toFix.length}] Processing ${item.productName}...`,
    );

    const possibleUrls = getPossibleUrls(item.csvPath);

    if (possibleUrls.length === 0) {
      console.error(`   ❌ No CSV path available`);
      failed++;
      failedProducts.push({
        id: item.productId,
        name: item.productName,
        reason: "No CSV path",
      });
      continue;
    }

    // Try all possible URLs
    const result = await tryDownloadImage(possibleUrls);

    if (!result) {
      console.error(`   ❌ Failed to download from any URL:`);
      possibleUrls.forEach((url) => console.error(`      - ${url}`));
      failed++;
      failedProducts.push({
        id: item.productId,
        name: item.productName,
        reason: "Download failed",
      });
      continue;
    }

    console.log(
      `   ✓ Downloaded from ${result.url} (${(result.buffer.length / 1024).toFixed(1)} KB)`,
    );

    // Optimize image
    const optimizedBuffer = await optimizeImage(result.buffer);
    console.log(
      `   ✓ Optimized to WebP (${(optimizedBuffer.length / 1024).toFixed(1)} KB)`,
    );

    // Generate filename
    const originalName = item.csvPath.split("/").pop() || "image";
    const filename = originalName.replace(/\.[^.]+$/, ".webp");

    // Upload to Sanity
    try {
      const asset = await client.assets.upload("image", optimizedBuffer, {
        filename,
      });
      console.log(`   ✓ Uploaded to Sanity: ${asset._id}`);

      // Update product document
      await client
        .patch(item.productId)
        .set({
          previewImage: {
            _type: "image",
            asset: {
              _type: "reference",
              _ref: asset._id,
            },
          },
        })
        .commit();
      console.log(`   ✅ Updated ${item.productId}`);
      fixed++;
    } catch (error) {
      console.error(`   ❌ Sanity upload error: ${error}`);
      failed++;
      failedProducts.push({
        id: item.productId,
        name: item.productName,
        reason: `Upload error: ${error}`,
      });
    }
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════════",
  );
  console.log(
    "                         SUMMARY                                ",
  );
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failedProducts.length > 0) {
    console.log("\n   Failed products:");
    failedProducts.forEach((p) => {
      console.log(`   - ${p.id} (${p.name}): ${p.reason}`);
    });
  }

  console.log("\n✅ Done.\n");
}

fixMissingImages().catch(console.error);
