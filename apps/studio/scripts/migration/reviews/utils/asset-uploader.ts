/**
 * Asset Uploader for Review Migration
 * Handles image and PDF file uploads to Sanity
 * Images are converted to WebP format for optimal performance
 */

import { existsSync,readFileSync, writeFileSync } from "node:fs";
import * as https from "node:https";
import * as path from "node:path";
import { resolve } from "node:path";

import type { SanityClient } from "@sanity/client";
import sharp from "sharp";

import type { ImageCache } from "../types";

// Legacy assets base URL
const LEGACY_ASSETS_BASE_URL = "https://www.audiofast.pl/assets/";

// Cache file path
const DEFAULT_CACHE_PATH = "apps/studio/scripts/migration/reviews/image-cache.json";

// Insecure agent for legacy site with SSL issues
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
});

// ============================================================================
// Image Optimization Config
// ============================================================================

interface ImageOptimizationConfig {
  quality: number;
  maxWidth: number;
  maxHeight: number;
}

const OPTIMIZATION_CONFIGS: Record<string, ImageOptimizationConfig> = {
  cover: { quality: 82, maxWidth: 1920, maxHeight: 1280 },   // Cover images
  content: { quality: 80, maxWidth: 1600, maxHeight: 1200 }, // Inline content images
};

// Threshold for upscaling small images
const UPSCALE_THRESHOLD = 1400;
const UPSCALE_FACTOR = 2;

// ============================================================================
// Cache Management
// ============================================================================

// In-memory cache
let imageCache: ImageCache = {};
let cacheLoaded = false;

/**
 * Load image cache from file
 */
export function loadImageCache(cachePath?: string): ImageCache {
  if (cacheLoaded) return imageCache;

  const filePath = resolve(process.cwd(), cachePath || DEFAULT_CACHE_PATH);

  if (existsSync(filePath)) {
    try {
      const data = readFileSync(filePath, "utf-8");
      imageCache = JSON.parse(data);
      console.log(`   📦 Loaded ${Object.keys(imageCache).length} cached assets`);
    } catch (err) {
      console.warn(`   ⚠️  Could not load cache: ${err}`);
      imageCache = {};
    }
  }

  cacheLoaded = true;
  return imageCache;
}

/**
 * Save image cache to file
 */
export function saveImageCache(cachePath?: string): void {
  const filePath = resolve(process.cwd(), cachePath || DEFAULT_CACHE_PATH);

  try {
    writeFileSync(filePath, JSON.stringify(imageCache, null, 2));
    console.log(`   💾 Saved ${Object.keys(imageCache).length} assets to cache`);
  } catch (err) {
    console.warn(`   ⚠️  Could not save cache: ${err}`);
  }
}

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
 * Get optimized filename (change extension to .webp)
 */
function getOptimizedFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  return `${basename}.webp`;
}

// ============================================================================
// Image Download
// ============================================================================

/**
 * Fetch file from URL (with SSL bypass for legacy site)
 */
async function downloadFile(url: string): Promise<Buffer | null> {
  return new Promise((resolvePromise) => {
    const handleResponse = (res: https.IncomingMessage) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl) {
          resolvePromise(null);
          return;
        }
        // Handle relative redirects
        if (redirectUrl.startsWith("/")) {
          const urlObj = new URL(url);
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        https
          .get(redirectUrl, { agent: insecureAgent }, handleResponse)
          .on("error", () => resolvePromise(null));
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        console.error(
          `   ✗ Failed to download ${url} (status ${res.statusCode})`,
        );
        resolvePromise(null);
        return;
      }

      const buffers: Buffer[] = [];
      res.on("data", (chunk) => buffers.push(chunk));
      res.on("end", () => resolvePromise(Buffer.concat(buffers)));
      res.on("error", (err) => {
        console.error(`   ✗ Error downloading ${url}:`, err);
        resolvePromise(null);
      });
    };

    https
      .get(url, { agent: insecureAgent }, handleResponse)
      .on("error", (err) => {
        console.error(`   ✗ Request error for ${url}:`, err);
        resolvePromise(null);
      });
  });
}

// ============================================================================
// Image Optimization
// ============================================================================

/**
 * Optimize image buffer to WebP format
 * - Small images (width < 1400px) are upscaled by 2x for better quality
 * - Large images are downscaled to fit within maxWidth/maxHeight
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

  if (!skipUpscaling && originalWidth < UPSCALE_THRESHOLD && originalWidth > 0) {
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

// ============================================================================
// Asset URL Resolution
// ============================================================================

/**
 * Resolve image source to full URL and filename
 */
export function resolveAssetUrl(
  src: string,
): { url: string; filename: string } | null {
  if (!src || src.toLowerCase() === "null") return null;
  let cleaned = src.replace(/&amp;/g, "&").trim();
  if (!cleaned || cleaned.toLowerCase() === "null") return null;

  // Build full URL if relative
  if (!/^https?:\/\//i.test(cleaned)) {
    let relative = cleaned.replace(/^\/+/, "");
    if (relative.toLowerCase().startsWith("assets/")) {
      relative = relative.slice("assets/".length);
    }
    cleaned = `${LEGACY_ASSETS_BASE_URL}${relative}`;
  } else if (/audiofast\.pl\/assets\//i.test(cleaned)) {
    cleaned = cleaned.replace(
      /(https?:\/\/(www\.)?audiofast\.pl\/assets\/)/i,
      LEGACY_ASSETS_BASE_URL,
    );
  }

  let filename = cleaned.split("/").pop() || "";
  filename = filename.split("?")[0];
  if (!filename) return null;

  return { url: cleaned, filename };
}

// ============================================================================
// Image Upload Functions
// ============================================================================

export interface ProcessImageOptions {
  imageType?: "cover" | "content";
  skipOptimization?: boolean;
  skipUpscaling?: boolean;
}

/**
 * Process and upload an image to Sanity
 * Downloads, converts to WebP, and uploads
 */
async function processAndUploadImage(
  sourceUrl: string,
  client: SanityClient,
  options: ProcessImageOptions = {},
): Promise<{ assetId: string; originalSize: number; optimizedSize: number } | null> {
  const {
    imageType = "content",
    skipOptimization = false,
    skipUpscaling = false,
  } = options;

  const config = OPTIMIZATION_CONFIGS[imageType];

  // Check cache first
  const cacheKey = `image:${sourceUrl}`;
  if (imageCache[cacheKey]) {
    return {
      assetId: imageCache[cacheKey].assetId,
      originalSize: 0,
      optimizedSize: 0,
    };
  }

  try {
    // 1. Download image
    const originalBuffer = await downloadFile(sourceUrl);
    if (!originalBuffer || originalBuffer.length === 0) {
      console.warn(`   ⚠️  Failed to download: ${sourceUrl.split("/").pop()}`);
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
      // 2. Optimize image to WebP
      const result = await optimizeImage(originalBuffer, config, skipUpscaling);
      uploadBuffer = result.buffer;
      wasUpscaled = result.wasUpscaled;
      originalWidth = result.originalWidth;
      targetWidth = result.targetWidth;
      filename = getOptimizedFilename(sourceUrl.split("/").pop() || "image.jpg");
    }

    const optimizedSize = uploadBuffer.length;

    // 3. Upload to Sanity
    const asset = await client.assets.upload("image", uploadBuffer, {
      filename,
      contentType: skipOptimization ? undefined : "image/webp",
    });

    // 4. Cache the result
    imageCache[cacheKey] = {
      assetId: asset._id,
      uploadedAt: new Date().toISOString(),
    };

    // Log result
    const reduction = originalSize > 0 ? ((1 - optimizedSize / originalSize) * 100).toFixed(1) : "0";
    const upscaleInfo = wasUpscaled ? ` [↑2x: ${originalWidth}→${targetWidth}px]` : "";
    console.log(
      `   ✓ ${filename}: ${formatBytes(originalSize)} → ${formatBytes(optimizedSize)} (-${reduction}%)${upscaleInfo}`,
    );

    return {
      assetId: asset._id,
      originalSize,
      optimizedSize,
    };
  } catch (error) {
    console.error(`   ❌ Error processing image ${sourceUrl}:`, error);
    return null;
  }
}

/**
 * Upload cover image for a review (optimized to WebP)
 */
export async function uploadCoverImage(
  client: SanityClient | null,
  coverFilename: string | null,
  dryRun: boolean,
): Promise<string | null> {
  if (!coverFilename || coverFilename.toLowerCase() === "null") return null;

  const resolved = resolveAssetUrl(coverFilename);
  if (!resolved) return null;

  if (dryRun) {
    console.log(`   🧪 [DRY RUN] Would upload cover: ${resolved.filename} → WebP`);
    return `image-dryrun-${resolved.filename.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
  }

  if (!client) return null;

  const result = await processAndUploadImage(resolved.url, client, {
    imageType: "cover",
    skipUpscaling: false,
  });

  return result?.assetId || null;
}

/**
 * Upload inline image from content HTML (optimized to WebP)
 */
export async function uploadInlineImage(
  client: SanityClient | null,
  src: string,
  dryRun: boolean,
): Promise<string | null> {
  const resolved = resolveAssetUrl(src);
  if (!resolved) return null;

  if (dryRun) {
    console.log(`   🧪 [DRY RUN] Would upload inline: ${resolved.filename} → WebP`);
    return `image-dryrun-${resolved.filename.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
  }

  if (!client) return null;

  const result = await processAndUploadImage(resolved.url, client, {
    imageType: "content",
    skipUpscaling: true, // Keep inline images smaller
  });

  return result?.assetId || null;
}

/**
 * Upload PDF file for a review (no optimization, just upload)
 */
export async function uploadPdfFile(
  client: SanityClient | null,
  pdfFilename: string | null,
  dryRun: boolean,
): Promise<string | null> {
  if (!pdfFilename) return null;

  const resolved = resolveAssetUrl(pdfFilename);
  if (!resolved) return null;

  if (dryRun) {
    console.log(`   🧪 [DRY RUN] Would upload PDF: ${resolved.filename}`);
    return `file-dryrun-${resolved.filename.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
  }

  if (!client) return null;

  // Check cache
  const cacheKey = `file:${resolved.url}`;
  if (imageCache[cacheKey]) {
    return imageCache[cacheKey].assetId;
  }

  try {
    const buffer = await downloadFile(resolved.url);
    if (!buffer || buffer.length === 0) {
      console.warn(`   ⚠️  Failed to download PDF: ${resolved.filename}`);
      return null;
    }

    const asset = await client.assets.upload("file", buffer, {
      filename: resolved.filename,
    });

    // Cache the result
    imageCache[cacheKey] = {
      assetId: asset._id,
      uploadedAt: new Date().toISOString(),
    };

    console.log(`   ✓ PDF: ${resolved.filename} (${formatBytes(buffer.length)})`);
    return asset._id;
  } catch (error) {
    console.error(`   ❌ Error uploading PDF ${resolved.filename}:`, error);
    return null;
  }
}
