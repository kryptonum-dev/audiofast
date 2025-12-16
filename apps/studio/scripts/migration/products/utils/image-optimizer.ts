/**
 * Image Optimization Utilities
 * Converts images to WebP format using Sharp for optimal performance
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

// Image optimization settings
interface ImageOptimizationConfig {
  quality: number;
  maxWidth: number;
  maxHeight: number;
}

const OPTIMIZATION_CONFIGS: Record<string, ImageOptimizationConfig> = {
  preview: { quality: 82, maxWidth: 2400, maxHeight: 1600 },
  gallery: { quality: 80, maxWidth: 1920, maxHeight: 1280 },
  content: { quality: 80, maxWidth: 1600, maxHeight: 1200 },
  inline: { quality: 85, maxWidth: 300, maxHeight: 400 }, // Small inline images
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

/**
 * Get alternative URLs for a legacy asset
 * The CSV often has paths like "produkty/Brand/image.png" but actual files
 * may be at "produkty/image.png" (without the brand subfolder)
 */
export function getAlternativeUrls(sourceUrl: string): string[] {
  const urls: string[] = [sourceUrl];

  // If URL contains a brand subfolder pattern, try without it
  // Pattern: produkty/SomeBrand/filename.ext
  const produktyMatch = sourceUrl.match(/\/produkty\/[^/]+\/([^/]+)$/);
  if (produktyMatch) {
    const filename = produktyMatch[1];
    const altUrl = `${LEGACY_ASSETS_BASE_URL}produkty/${filename}`;
    if (altUrl !== sourceUrl) {
      urls.push(altUrl);
    }
  }

  return urls;
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
          `   ⚠️  Failed to fetch image (HTTP ${response.statusCode}): ${url}`,
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

// Threshold for upscaling small images
const UPSCALE_THRESHOLD = 1400; // If width < 1400px, upscale by 2x
const UPSCALE_FACTOR = 2;

/**
 * Optimize image buffer to WebP format
 * - Small images (width < 1400px) are upscaled by 2x for better quality (unless skipUpscaling is true)
 * - Large images are downscaled to fit within maxWidth/maxHeight
 * Returns { buffer, wasUpscaled, originalDimensions, targetDimensions }
 */
async function optimizeImage(
  buffer: Buffer,
  config: ImageOptimizationConfig,
  skipUpscaling = false,
): Promise<{
  buffer: Buffer;
  wasUpscaled: boolean;
  originalWidth: number;
  targetWidth: number;
}> {
  // Get original image dimensions
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  let targetWidth: number;
  let targetHeight: number;
  let wasUpscaled = false;

  if (
    !skipUpscaling &&
    originalWidth < UPSCALE_THRESHOLD &&
    originalWidth > 0
  ) {
    // Small image - upscale by 2x (but don't exceed maxWidth)
    targetWidth = Math.min(originalWidth * UPSCALE_FACTOR, config.maxWidth);
    targetHeight = Math.min(originalHeight * UPSCALE_FACTOR, config.maxHeight);
    wasUpscaled = true;
  } else {
    // Large image or skipUpscaling - use max dimensions (will downscale if needed)
    targetWidth = config.maxWidth;
    targetHeight = config.maxHeight;
  }

  const outputBuffer = await sharp(buffer)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "inside",
      withoutEnlargement: !wasUpscaled, // Only allow enlargement if we're upscaling
    })
    .webp({
      quality: config.quality,
      effort: 4,
      smartSubsample: true,
    })
    .toBuffer();

  return { buffer: outputBuffer, wasUpscaled, originalWidth, targetWidth };
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

export interface ProcessImageOptions {
  imageType?: "preview" | "gallery" | "content" | "inline";
  skipOptimization?: boolean;
  skipUpscaling?: boolean; // For inline images that should stay small
}

/**
 * Download, optimize, and upload an image to Sanity
 * Returns the Sanity asset ID or null if failed
 */
export async function processAndUploadImage(
  sourceUrl: string,
  client: SanityClient,
  cache: ImageCache,
  options: ProcessImageOptions = {},
): Promise<ImageUploadResult | null> {
  const {
    imageType = "gallery",
    skipOptimization = false,
    skipUpscaling,
  } = options;
  const config = OPTIMIZATION_CONFIGS[imageType];
  // For inline images, skip upscaling by default (keep them small)
  const shouldSkipUpscaling = skipUpscaling ?? imageType === "inline";

  // Check cache first
  if (cache[sourceUrl]) {
    console.log(`   📦 Cached: ${sourceUrl.split("/").pop()}`);
    return {
      assetId: cache[sourceUrl].assetId,
      originalSize: cache[sourceUrl].originalSize,
      optimizedSize: cache[sourceUrl].optimizedSize,
      filename: sourceUrl.split("/").pop() || "image",
    };
  }

  try {
    // 1. Download image - try primary URL first, then alternatives
    const urlsToTry = getAlternativeUrls(sourceUrl);
    let originalBuffer: Buffer | null = null;
    let successUrl = sourceUrl;

    for (const url of urlsToTry) {
      originalBuffer = await downloadImage(url);
      if (originalBuffer && originalBuffer.length > 0) {
        successUrl = url;
        if (url !== sourceUrl) {
          console.log(
            `   📍 Found at alternative URL: ${url.split("/").pop()}`,
          );
        }
        break;
      }
    }

    if (!originalBuffer || originalBuffer.length === 0) {
      const triedUrls = urlsToTry.map((u) => u.split("/").pop()).join(", ");
      console.warn(`   ⚠️  Failed to download (tried: ${triedUrls})`);
      return null;
    }

    const originalSize = originalBuffer.length;
    let uploadBuffer: Buffer;
    let filename: string;

    let wasUpscaled = false;
    let originalWidth = 0;
    let targetWidth = 0;

    if (skipOptimization) {
      // Upload original without optimization
      uploadBuffer = originalBuffer;
      filename = sourceUrl.split("/").pop() || "image.jpg";
    } else {
      // 2. Optimize image
      const result = await optimizeImage(
        originalBuffer,
        config,
        shouldSkipUpscaling,
      );
      uploadBuffer = result.buffer;
      wasUpscaled = result.wasUpscaled;
      originalWidth = result.originalWidth;
      targetWidth = result.targetWidth;
      filename = getOptimizedFilename(
        sourceUrl.split("/").pop() || "image.jpg",
      );
    }

    const optimizedSize = uploadBuffer.length;

    // 3. Upload to Sanity
    const asset = await client.assets.upload("image", uploadBuffer, {
      filename,
      contentType: skipOptimization ? undefined : "image/webp",
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
    const upscaleInfo = wasUpscaled
      ? ` [↑2x: ${originalWidth}→${targetWidth}px]`
      : "";
    console.log(
      `   ✓ ${filename}: ${formatBytes(originalSize)} → ${formatBytes(optimizedSize)} (-${reduction}%)${upscaleInfo}`,
    );

    return {
      assetId: asset._id,
      originalSize,
      optimizedSize,
      filename,
    };
  } catch (error) {
    console.error(`   ❌ Error processing image ${sourceUrl}:`, error);
    return null;
  }
}

/**
 * Process image with fallback (try optimized first, then original)
 */
export async function processImageWithFallback(
  sourceUrl: string,
  client: SanityClient,
  cache: ImageCache,
  options: ProcessImageOptions = {},
): Promise<ImageUploadResult | null> {
  // Try optimized upload first
  let result = await processAndUploadImage(sourceUrl, client, cache, options);

  // If failed, try uploading original
  if (!result) {
    console.log(
      `   🔄 Retrying without optimization: ${sourceUrl.split("/").pop()}`,
    );
    result = await processAndUploadImage(sourceUrl, client, cache, {
      ...options,
      skipOptimization: true,
    });
  }

  return result;
}

/**
 * Dry run version - returns mock asset ID
 */
export function processImageDryRun(sourceUrl: string): ImageUploadResult {
  const filename = sourceUrl.split("/").pop() || "image.jpg";
  console.log(`   🧪 [DRY RUN] Would upload: ${filename}`);
  return {
    assetId: `image-dryrun-${Math.random().toString(36).slice(2, 10)}`,
    originalSize: 0,
    optimizedSize: 0,
    filename,
  };
}
