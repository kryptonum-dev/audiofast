#!/usr/bin/env bun
/**
 * Fix products that reference draft brands instead of published brands
 * This script updates brand._ref from "drafts.brand-X" to "brand-X"
 */

import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "fsw3likv",
  dataset: "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

async function fixDraftBrandReferences() {
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║      FIX DRAFT BRAND REFERENCES IN PRODUCTS                    ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  if (!process.env.SANITY_API_TOKEN) {
    console.error("❌ SANITY_API_TOKEN is required");
    process.exit(1);
  }

  // Find all products that reference draft brands
  const productsWithDraftRefs = await client.fetch<
    Array<{ _id: string; name: string; brandRef: string }>
  >(`*[_type == "product" && brand._ref match "drafts.*"]{_id, name, "brandRef": brand._ref}`);

  console.log(`📊 Found ${productsWithDraftRefs.length} products with draft brand references\n`);

  if (productsWithDraftRefs.length === 0) {
    console.log("✅ No products need fixing!");
    return;
  }

  // Group by brand for reporting
  const byBrand = new Map<string, Array<{ _id: string; name: string }>>();
  for (const product of productsWithDraftRefs) {
    const brandRef = product.brandRef;
    if (!byBrand.has(brandRef)) {
      byBrand.set(brandRef, []);
    }
    byBrand.get(brandRef)!.push({ _id: product._id, name: product.name });
  }

  console.log("📋 Products by draft brand:");
  for (const [brandRef, products] of byBrand) {
    const publishedId = brandRef.replace("drafts.", "");
    console.log(`\n   ${brandRef} → ${publishedId} (${products.length} products)`);
    for (const p of products.slice(0, 3)) {
      console.log(`      - [${p._id}] ${p.name}`);
    }
    if (products.length > 3) {
      console.log(`      ... and ${products.length - 3} more`);
    }
  }

  console.log("\n🔧 Fixing references...\n");

  let fixed = 0;
  let failed = 0;

  for (const product of productsWithDraftRefs) {
    const oldRef = product.brandRef;
    const newRef = oldRef.replace("drafts.", "");

    try {
      await client
        .patch(product._id)
        .set({
          brand: {
            _type: "reference",
            _ref: newRef,
          },
        })
        .commit();

      console.log(`   ✅ [${product._id}] ${product.name}: ${oldRef} → ${newRef}`);
      fixed++;
    } catch (error) {
      console.error(`   ❌ [${product._id}] ${product.name}: ${error}`);
      failed++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                         SUMMARY                                ");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log("\n✅ Done.\n");
  console.log("ℹ️  You should now be able to publish the brands:");
  console.log("   - Symposium");
  console.log("   - Grimm Audio");
  console.log("   - Dutch & Dutch");
  console.log("   - Stealth Audio");
  console.log("");
}

fixDraftBrandReferences().catch(console.error);


