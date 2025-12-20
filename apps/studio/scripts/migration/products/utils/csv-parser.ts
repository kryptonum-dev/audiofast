/**
 * CSV Parsing Utilities for Product Migration
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "csv-parse/sync";

import type {
  ProductArticleRow,
  ProductBoxRow,
  ProductCategoryRow,
  ProductGalleryRow,
  ProductMainRow,
  ProductReviewRow,
  ProductSourceData,
  ProductTechnicalDataRow,
} from "../types";

// ============================================================================
// CSV File Paths
// ============================================================================

const CSV_BASE_PATH = resolve(__dirname, "../../../../../../csv/products/december");

const CSV_FILES = {
  main: resolve(CSV_BASE_PATH, "products-main.csv"),
  categories: resolve(CSV_BASE_PATH, "products-categories.csv"),
  gallery: resolve(CSV_BASE_PATH, "products-gallery.csv"),
  boxes: resolve(CSV_BASE_PATH, "products-boxes.csv"),
  reviews: resolve(CSV_BASE_PATH, "products-reviews.csv"),
  technicalData: resolve(CSV_BASE_PATH, "products-technical-data.csv"),
  articles: resolve(CSV_BASE_PATH, "products-articles.csv"),
};

// ============================================================================
// Generic CSV Parser
// ============================================================================

function parseCsvFile<T>(csvPath: string): T[] {
  try {
    const resolved = resolve(process.cwd(), csvPath);
    const file = readFileSync(resolved, "utf-8");
    return parse(file, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      cast: (value: string) => {
        // Handle NULL values
        if (value === "NULL" || value === "null") return null;
        return value;
      },
    }) as T[];
  } catch (error) {
    console.error(`Error reading CSV file ${csvPath}:`, error);
    return [];
  }
}

// ============================================================================
// Load All CSV Files
// ============================================================================

export interface LoadedCsvData {
  mainProducts: ProductMainRow[];
  categories: ProductCategoryRow[];
  gallery: ProductGalleryRow[];
  boxes: ProductBoxRow[];
  reviews: ProductReviewRow[];
  technicalData: ProductTechnicalDataRow[];
  articles: ProductArticleRow[];
}

/**
 * Load all CSV files for product migration
 */
export function loadAllCsvData(): LoadedCsvData {
  console.log("📖 Loading CSV files...");

  const mainProducts = parseCsvFile<ProductMainRow>(CSV_FILES.main);
  console.log(`   ✓ products-main.csv: ${mainProducts.length} products`);

  const categories = parseCsvFile<ProductCategoryRow>(CSV_FILES.categories);
  console.log(`   ✓ products-categories.csv: ${categories.length} mappings`);

  const gallery = parseCsvFile<ProductGalleryRow>(CSV_FILES.gallery);
  console.log(`   ✓ products-gallery.csv: ${gallery.length} images`);

  const boxes = parseCsvFile<ProductBoxRow>(CSV_FILES.boxes);
  console.log(`   ✓ products-boxes.csv: ${boxes.length} content boxes`);

  const reviews = parseCsvFile<ProductReviewRow>(CSV_FILES.reviews);
  console.log(`   ✓ products-reviews.csv: ${reviews.length} review mappings`);

  const technicalData = parseCsvFile<ProductTechnicalDataRow>(
    CSV_FILES.technicalData,
  );
  console.log(
    `   ✓ products-technical-data.csv: ${technicalData.length} technical data tabs`,
  );

  const articles = parseCsvFile<ProductArticleRow>(CSV_FILES.articles);
  console.log(
    `   ✓ products-articles.csv: ${articles.length} article mappings`,
  );

  return { mainProducts, categories, gallery, boxes, reviews, technicalData, articles };
}

// ============================================================================
// Index Data by Product ID
// ============================================================================

export interface IndexedProductData {
  categoriesByProductId: Map<string, ProductCategoryRow[]>;
  galleryByProductId: Map<string, ProductGalleryRow[]>;
  boxesByProductId: Map<string, ProductBoxRow[]>;
  reviewsByProductId: Map<string, ProductReviewRow[]>;
  technicalDataByProductId: Map<string, ProductTechnicalDataRow[]>;
  articleByProductId: Map<string, ProductArticleRow>;
}

/**
 * Index all related data by ProductID for efficient lookup
 */
export function indexDataByProductId(data: LoadedCsvData): IndexedProductData {
  console.log("\n📑 Indexing data by ProductID...");

  // Index categories
  const categoriesByProductId = new Map<string, ProductCategoryRow[]>();
  for (const row of data.categories) {
    const existing = categoriesByProductId.get(row.ProductID) || [];
    existing.push(row);
    categoriesByProductId.set(row.ProductID, existing);
  }

  // Index gallery images (sorted by SortOrder)
  const galleryByProductId = new Map<string, ProductGalleryRow[]>();
  for (const row of data.gallery) {
    const existing = galleryByProductId.get(row.ProductID) || [];
    existing.push(row);
    galleryByProductId.set(row.ProductID, existing);
  }
  // Sort each product's gallery by ImageSort
  for (const [productId, images] of galleryByProductId) {
    galleryByProductId.set(
      productId,
      images.sort(
        (a, b) => parseInt(a.ImageSort, 10) - parseInt(b.ImageSort, 10),
      ),
    );
  }

  // Index content boxes (sorted by BoxSort)
  const boxesByProductId = new Map<string, ProductBoxRow[]>();
  for (const row of data.boxes) {
    const existing = boxesByProductId.get(row.ProductID) || [];
    existing.push(row);
    boxesByProductId.set(row.ProductID, existing);
  }
  // Sort each product's boxes by BoxSort
  for (const [productId, boxes] of boxesByProductId) {
    boxesByProductId.set(
      productId,
      boxes.sort(
        (a, b) => parseInt(a.BoxSort, 10) - parseInt(b.BoxSort, 10),
      ),
    );
  }

  // Index reviews (sorted by SortOrder)
  const reviewsByProductId = new Map<string, ProductReviewRow[]>();
  for (const row of data.reviews) {
    const existing = reviewsByProductId.get(row.ProductID) || [];
    existing.push(row);
    reviewsByProductId.set(row.ProductID, existing);
  }
  // Sort each product's reviews by SortOrder
  for (const [productId, reviews] of reviewsByProductId) {
    reviewsByProductId.set(
      productId,
      reviews.sort(
        (a, b) => parseInt(a.SortOrder, 10) - parseInt(b.SortOrder, 10),
      ),
    );
  }

  // Index technical data (sorted by TabSort)
  const technicalDataByProductId = new Map<string, ProductTechnicalDataRow[]>();
  for (const row of data.technicalData) {
    const existing = technicalDataByProductId.get(row.ProductID) || [];
    existing.push(row);
    technicalDataByProductId.set(row.ProductID, existing);
  }
  // Sort each product's technical data by TabSort
  for (const [productId, techData] of technicalDataByProductId) {
    technicalDataByProductId.set(
      productId,
      techData.sort(
        (a, b) => parseInt(a.TabSort, 10) - parseInt(b.TabSort, 10),
      ),
    );
  }

  console.log(
    `   ✓ Categories indexed for ${categoriesByProductId.size} products`,
  );
  console.log(`   ✓ Gallery indexed for ${galleryByProductId.size} products`);
  console.log(`   ✓ Boxes indexed for ${boxesByProductId.size} products`);
  console.log(`   ✓ Reviews indexed for ${reviewsByProductId.size} products`);
  console.log(
    `   ✓ Technical data indexed for ${technicalDataByProductId.size} products`,
  );

  // Index articles (take first article per product if duplicates)
  const articleByProductId = new Map<string, ProductArticleRow>();
  for (const row of data.articles) {
    if (!articleByProductId.has(row.ProductID)) {
      articleByProductId.set(row.ProductID, row);
    }
  }
  console.log(
    `   ✓ Articles indexed for ${articleByProductId.size} products`,
  );

  return {
    categoriesByProductId,
    galleryByProductId,
    boxesByProductId,
    reviewsByProductId,
    technicalDataByProductId,
    articleByProductId,
  };
}

// ============================================================================
// Build Product Source Data
// ============================================================================

/**
 * Build complete product source data from main row and indexed data
 */
export function buildProductSourceData(
  mainRow: ProductMainRow,
  indexed: IndexedProductData,
): ProductSourceData {
  const productId = mainRow.ProductID;

  // Get category slugs
  const categoryRows = indexed.categoriesByProductId.get(productId) || [];
  const categorySlugsByProduct = categoryRows.map((c) => c.CategorySlug);

  // Get gallery images
  const galleryImages = indexed.galleryByProductId.get(productId) || [];

  // Get content boxes
  const contentBoxes = indexed.boxesByProductId.get(productId) || [];

  // Get review rows (contains both ReviewID and ReviewSlug for flexible resolution)
  const reviewRows = indexed.reviewsByProductId.get(productId) || [];

  // Get technical data rows
  const technicalDataRows =
    indexed.technicalDataByProductId.get(productId) || [];

  // Get article data (for shortDescription and publicationImage)
  const articleData = indexed.articleByProductId.get(productId) || null;

  return {
    id: productId,
    name: mainRow.ProductName,
    subtitle: mainRow.Subtitle,
    slug: mainRow.ProductSlug,
    isArchived: mainRow.IsArchived === "1",
    isPublished: mainRow.IsPublished === "1",
    isHidden: mainRow.IsHidden === "1",
    mainImageFilename: mainRow.MainImageFilename,
    brandSlug: mainRow.BrandSlug,
    brandName: mainRow.BrandName,
    categorySlugsByProduct,
    galleryImages,
    contentBoxes,
    reviewRows,
    technicalDataRows,
    articleData,
  };
}

/**
 * Get a single product's source data by ProductID
 */
export function getProductById(
  productId: string,
  mainProducts: ProductMainRow[],
  indexed: IndexedProductData,
): ProductSourceData | null {
  const mainRow = mainProducts.find((p) => p.ProductID === productId);
  if (!mainRow) return null;
  return buildProductSourceData(mainRow, indexed);
}
