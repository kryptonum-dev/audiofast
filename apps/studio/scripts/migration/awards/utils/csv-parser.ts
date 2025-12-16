/**
 * CSV Parser for Award Migration
 * Parses award data from CSV files exported from phpMyAdmin
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { parse } from "csv-parse/sync";

import type {
  AwardMainRow,
  AwardProductRelationRow,
  AwardSourceData,
} from "../types";

// ============================================================================
// Constants
// ============================================================================

const CSV_BASE_PATH = path.resolve(__dirname, "../../../../../../csv/awards");

const CSV_FILES = {
  main: "awards-all.csv",
  relations: "awards-products-relations.csv",
};

// ============================================================================
// Generic CSV Parser
// ============================================================================

function parseCSV<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as T[];
}

// ============================================================================
// Load CSV Data
// ============================================================================

export interface LoadedCsvData {
  awards: AwardMainRow[];
  relations: AwardProductRelationRow[];
}

export function loadAllCsvData(): LoadedCsvData {
  console.log("📂 Loading CSV data...");

  const awardsPath = path.join(CSV_BASE_PATH, CSV_FILES.main);
  const relationsPath = path.join(CSV_BASE_PATH, CSV_FILES.relations);

  const awards = parseCSV<AwardMainRow>(awardsPath);
  console.log(`   ✓ Loaded ${awards.length} awards from ${CSV_FILES.main}`);

  const relations = parseCSV<AwardProductRelationRow>(relationsPath);
  console.log(
    `   ✓ Loaded ${relations.length} award-product relations from ${CSV_FILES.relations}`,
  );

  return { awards, relations };
}

// ============================================================================
// Index Data by Award ID
// ============================================================================

export interface IndexedAwardData {
  productsByAwardId: Map<string, string[]>;
}

export function indexDataByAwardId(data: LoadedCsvData): IndexedAwardData {
  // Group product IDs by award ID
  const productsByAwardId = new Map<string, string[]>();

  for (const relation of data.relations) {
    const awardId = relation.AwardID;
    const productId = relation.ProductID;

    if (!productsByAwardId.has(awardId)) {
      productsByAwardId.set(awardId, []);
    }
    productsByAwardId.get(awardId)!.push(productId);
  }

  console.log(
    `   ✓ Indexed relations for ${productsByAwardId.size} awards with products`,
  );

  return { productsByAwardId };
}

// ============================================================================
// Build Source Data
// ============================================================================

export function buildAwardSourceData(
  mainRow: AwardMainRow,
  indexed: IndexedAwardData,
): AwardSourceData {
  const productIds = indexed.productsByAwardId.get(mainRow.AwardID) || [];

  return {
    id: mainRow.AwardID,
    name: mainRow.AwardName.trim(),
    logoFilename: mainRow.LogoFilename || null,
    productIds,
  };
}

// ============================================================================
// Get Award Statistics
// ============================================================================

export function getAwardStats(data: LoadedCsvData): {
  totalAwards: number;
  awardsWithLogos: number;
  totalRelations: number;
  uniqueProducts: number;
  averageProductsPerAward: number;
} {
  const awardsWithLogos = data.awards.filter((a) => a.LogoFilename).length;
  const uniqueProducts = new Set(data.relations.map((r) => r.ProductID)).size;
  const averageProductsPerAward =
    data.awards.length > 0 ? data.relations.length / data.awards.length : 0;

  return {
    totalAwards: data.awards.length,
    awardsWithLogos,
    totalRelations: data.relations.length,
    uniqueProducts,
    averageProductsPerAward: Math.round(averageProductsPerAward * 10) / 10,
  };
}
