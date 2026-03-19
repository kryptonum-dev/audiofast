import { defineArrayMember, defineType } from "sanity";

import { pageBuilderBlocks } from "../blocks";

// All blocks EXCEPT cpoProductsListing (for regular pages — CPO listing only on CPO page)
const pageBuilderBlocksWithoutCpoProductsListing = pageBuilderBlocks.filter(
  (block) => block.name !== "cpoProductsListing",
);

// All blocks INCLUDING cpoProductsListing (for CPO page only)
const pageBuilderBlocksWithCpoProductsListing = pageBuilderBlocks;

export const pagebuilderBlockTypes =
  pageBuilderBlocksWithoutCpoProductsListing.map(({ name }) => ({
    type: name,
  }));

export const pagebuilderBlockTypesWithCpoProductsListing =
  pageBuilderBlocksWithCpoProductsListing.map(({ name }) => ({
    type: name,
  }));

// Standard pageBuilder (without cpoProductsListing)
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

// CPO-specific pageBuilder (with cpoProductsListing)
export const cpoPageBuilder = defineType({
  name: "cpoPageBuilder",
  type: "array",
  of: pagebuilderBlockTypesWithCpoProductsListing.map((block) =>
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
