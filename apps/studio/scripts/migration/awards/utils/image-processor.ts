/**
 * Image Processing for Award Logos
 * Converts logo images to WebP format (no upscaling for logos)
 */

import * as fs from "node:fs";
import * as https from "node:https";
import * as path from "node:path";

import type { SanityClient } from "@sanity/client";
import sharp from "sharp";

import type { ImageCache, ImageUploadResult } from "../types";

// ============================================================================
// Configuration
// ============================================================================

const LEGACY_ASSETS_BASE_URL = "https://audiofast.pl/assets/";

// SSL bypass for legacy server with certificate issues
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Logo optimization settings (no upscaling, smaller max size)
const LOGO_CONFIG = {
  quality: 85,
  maxWidth: 800,
  maxHeight: 800,
};

// Cache file path
const CACHE_FILE_PATH = path.resolve(__dirname, "../image-cache.json");

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Load image cache from file
 */
export function loadImageCache(): ImageCache {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn("⚠️  Could not load image cache:", error);
  }
  return {};
}

/**
 * Save image cache to file
 */
export function saveImageCache(cache: ImageCache): void {
  try {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.warn("⚠️  Could not save image cache:", error);
  }
}

/**
 * Get full URL for a legacy asset
 */
export function getLegacyAssetUrl(filename: string): string {
  if (filename.startsWith("http")) return filename;
  return `${LEGACY_ASSETS_BASE_URL}${filename}`;
}

// ============================================================================
// Image Download
// ============================================================================

/**
 * Download image from URL with SSL bypass
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const handleResponse = (response: https.IncomingMessage) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        let redirectUrl = response.headers.location;
        if (!redirectUrl) {
          resolve(null);
          return;
        }
        // Handle relative redirects
        if (redirectUrl.startsWith("/")) {
          const urlObj = new URL(url);
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        https
          .get(redirectUrl, { agent: insecureAgent }, handleResponse)
          .on("error", () => resolve(null));
        return;
      }

      if (response.statusCode !== 200) {
        console.warn(
          `   ⚠️  Failed to fetch logo (HTTP ${response.statusCode}): ${url}`,
        );
        resolve(null);
        return;
      }

      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", () => resolve(null));
    };

    https
      .get(url, { agent: insecureAgent }, handleResponse)
      .on("error", () => resolve(null));
  });
}

// ============================================================================
// Image Optimization
// ============================================================================

/**
 * Optimize logo to WebP format (no upscaling)
 */
async function optimizeLogo(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({
      width: LOGO_CONFIG.maxWidth,
      height: LOGO_CONFIG.maxHeight,
      fit: "inside",
      withoutEnlargement: true, // Never upscale logos
    })
    .webp({
      quality: LOGO_CONFIG.quality,
      effort: 4,
      smartSubsample: true,
    })
    .toBuffer();
}

/**
 * Get optimized filename (change extension to .webp)
 */
function getOptimizedFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  return `${basename}.webp`;
}

// ============================================================================
// Main Upload Function
// ============================================================================

/**
 * Download, optimize, and upload a logo to Sanity
 * Returns the Sanity asset ID or null if failed
 */
export async function processAndUploadLogo(
  logoFilename: string,
  client: SanityClient,
  cache: ImageCache,
  verbose = false,
): Promise<ImageUploadResult | null> {
  const sourceUrl = getLegacyAssetUrl(logoFilename);

  // Check cache first
  if (cache[sourceUrl]) {
    if (verbose) {
      console.log(`   📦 Cached: ${logoFilename.split("/").pop()}`);
    }
    return {
      assetId: cache[sourceUrl].assetId,
      originalSize: cache[sourceUrl].originalSize,
      optimizedSize: cache[sourceUrl].optimizedSize,
      filename: logoFilename.split("/").pop() || "logo",
    };
  }

  try {
    // 1. Download image
    const originalBuffer = await downloadImage(sourceUrl);
    if (!originalBuffer || originalBuffer.length === 0) {
      console.warn(`   ⚠️  Failed to download logo: ${sourceUrl}`);
      return null;
    }

    const originalSize = originalBuffer.length;

    // 2. Optimize image
    const optimizedBuffer = await optimizeLogo(originalBuffer);
    const optimizedSize = optimizedBuffer.length;
    const filename = getOptimizedFilename(
      logoFilename.split("/").pop() || "logo.png",
    );

    // 3. Upload to Sanity
    const asset = await client.assets.upload("image", optimizedBuffer, {
      filename,
      contentType: "image/webp",
    });

    // 4. Cache the result
    cache[sourceUrl] = {
      assetId: asset._id,
      originalSize,
      optimizedSize,
      uploadedAt: new Date().toISOString(),
    };

    // Log result
    const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
    if (verbose) {
      console.log(
        `   ✓ ${filename}: ${formatBytes(originalSize)} → ${formatBytes(optimizedSize)} (-${reduction}%)`,
      );
    }

    return {
      assetId: asset._id,
      originalSize,
      optimizedSize,
      filename,
    };
  } catch (error) {
    console.error(`   ❌ Error processing logo ${logoFilename}:`, error);
    return null;
  }
}

/**
 * Process logo with fallback (try optimized first, then original)
 */
export async function processLogoWithFallback(
  logoFilename: string,
  client: SanityClient,
  cache: ImageCache,
  verbose = false,
): Promise<ImageUploadResult | null> {
  // Try optimized upload first
  let result = await processAndUploadLogo(logoFilename, client, cache, verbose);

  // If failed, try uploading original
  if (!result) {
    console.log(
      `   🔄 Retrying without optimization: ${logoFilename.split("/").pop()}`,
    );
    result = await uploadOriginalLogo(logoFilename, client, cache);
  }

  return result;
}

/**
 * Upload original logo without optimization (fallback)
 */
async function uploadOriginalLogo(
  logoFilename: string,
  client: SanityClient,
  cache: ImageCache,
): Promise<ImageUploadResult | null> {
  const sourceUrl = getLegacyAssetUrl(logoFilename);

  try {
    const buffer = await downloadImage(sourceUrl);
    if (!buffer || buffer.length === 0) {
      return null;
    }

    const filename = logoFilename.split("/").pop() || "logo.png";
    const asset = await client.assets.upload("image", buffer, { filename });

    cache[sourceUrl] = {
      assetId: asset._id,
      originalSize: buffer.length,
      optimizedSize: buffer.length,
      uploadedAt: new Date().toISOString(),
    };

    return {
      assetId: asset._id,
      originalSize: buffer.length,
      optimizedSize: buffer.length,
      filename,
    };
  } catch (error) {
    console.error(
      `   ❌ Error uploading original logo ${logoFilename}:`,
      error,
    );
    return null;
  }
}

/**
 * Dry run version - returns mock asset ID
 */
export function processLogoDryRun(logoFilename: string): ImageUploadResult {
  const filename = logoFilename.split("/").pop() || "logo.png";
  console.log(`   🧪 [DRY RUN] Would upload: ${filename}`);
  return {
    assetId: `image-dryrun-${Math.random().toString(36).slice(2, 10)}`,
    originalSize: 0,
    optimizedSize: 0,
    filename,
  };
}
