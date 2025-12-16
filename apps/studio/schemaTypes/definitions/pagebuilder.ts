import { defineArrayMember, defineType } from "sanity";

import { pageBuilderBlocks } from "../blocks";

// All blocks EXCEPT productsListing (for regular pages)
const pageBuilderBlocksWithoutProductsListing = pageBuilderBlocks.filter(
  (block) => block.name !== "productsListing",
);

// All blocks INCLUDING productsListing (for CPO page only)
const pageBuilderBlocksWithProductsListing = pageBuilderBlocks;

export const pagebuilderBlockTypes =
  pageBuilderBlocksWithoutProductsListing.map(({ name }) => ({
    type: name,
  }));

export const pagebuilderBlockTypesWithProductsListing =
  pageBuilderBlocksWithProductsListing.map(({ name }) => ({
    type: name,
  }));

// Standard pageBuilder (without productsListing)
export const pageBuilder = defineType({
  name: "pageBuilder",
  type: "array",
  of: pagebuilderBlockTypes.map((block) => defineArrayMember(block)),
  options: {
    insertMenu: {
      filter: true,
      showIcons: true,
      views: [
        {
          name: "grid",
          previewImageUrl: (schemaTypeName) =>
            `/static/components/${schemaTypeName}.webp`,
        },
        { name: "list" },
      ],
    },
  },
});

// CPO-specific pageBuilder (with productsListing)
export const cpoPageBuilder = defineType({
  name: "cpoPageBuilder",
  type: "array",
  of: pagebuilderBlockTypesWithProductsListing.map((block) =>
    defineArrayMember(block),
  ),
  options: {
    insertMenu: {
      filter: true,
      showIcons: true,
      views: [
        {
          name: "grid",
          previewImageUrl: (schemaTypeName) =>
            `/static/components/${schemaTypeName}.webp`,
        },
        { name: "list" },
      ],
    },
  },
});
