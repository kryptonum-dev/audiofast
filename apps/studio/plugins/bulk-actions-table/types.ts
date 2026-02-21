import { ComponentType } from 'react';
import { ConfigContext } from 'sanity';
import { StructureBuilder } from 'sanity/structure';

/**
 * A single option within a filter dropdown
 */
export interface FilterOption {
  /** Display label for this option */
  label: string;
  /** GROQ filter clause (e.g., 'isArchived != true') or null for "no filter" */
  value: string | null;
}

/**
 * Configuration for a single filter dropdown in the table toolbar
 */
export interface FilterConfig {
  /** Unique identifier for this filter (used for state management) */
  field: string;
  /** Display label shown next to the dropdown */
  label: string;
  /** Available filter options */
  options: FilterOption[];
  /** Index of the default selected option (defaults to 0) */
  defaultIndex?: number;
}

/**
 * Configuration for a multi-select reference filter.
 * Fetches documents of a given type and allows selecting multiple
 * to filter the main table by reference field.
 */
export interface ReferenceFilterConfig {
  /** The reference field path on the main document (e.g., 'brand._ref') */
  referenceField: string;
  /** The document type to fetch options from (e.g., 'brand') */
  referenceType: string;
  /** Display label shown next to the filter button */
  label: string;
  /** GROQ projection for fetching options. Must include _id, name, and optionally imageUrl */
  groqProjection?: string;
  /** Additional GROQ filter clause to narrow down which reference options are shown (e.g., 'doNotShowBrand != true') */
  groqFilter?: string;
}

/**
 * Configuration options for creating a bulk actions table in Sanity Studio
 * @public
 */
export interface CreateBulkActionsTableConfig {
  /**
   * Unique list item id for Structure Builder navigation.
   * Use this when you render multiple table panes for related schema types.
   * Defaults to the `type` value.
   */
  id?: string;

  /**
   * The document schema type to display in the table
   * @example 'post', 'page', 'product'
   */
  type: string;

  /**
   * Custom title for the table view in Studio navigation
   * If not provided, will use the document type name
   * @example 'Blog Posts', 'Product Catalog'
   */
  title?: string;

  /**
   * Custom icon component for the navigation item
   * Can be null, undefined, or a React component
   * If not provided, will use the default table icon
   * @example DocumentIcon, FolderIcon
   */
  icon?: ComponentType | null | undefined;

  /**
   * Sanity configuration context containing client and schema
   * Automatically provided by the structure resolver
   */
  context: ConfigContext;

  /**
   * Sanity Structure Builder instance
   * Automatically provided by the structure resolver
   */
  S: StructureBuilder;

  /**
   * API version for GROQ queries
   * If not provided, will use the version from your Sanity client configuration
   * Defaults to using client's configured API version
   * @example '2024-03-12', '2023-05-03'
   */
  apiVersion?: string;

  /**
   * Optional filter dropdowns shown in the table toolbar.
   * Each filter adds a dropdown that appends a GROQ clause to all queries.
   * @example
   * filters: [{
   *   field: 'isArchived',
   *   label: 'Status',
   *   options: [
   *     { label: 'All', value: null },
   *     { label: 'Active', value: 'isArchived != true' },
   *     { label: 'Archived', value: 'isArchived == true' },
   *   ],
   *   defaultIndex: 1,
   * }]
   */
  filters?: FilterConfig[];

  /**
   * Optional multi-select reference filters shown in the table toolbar.
   * Each reference filter fetches documents of the specified type and allows
   * selecting multiple to filter the main table by reference.
   * @example
   * referenceFilters: [{
   *   referenceField: 'brand._ref',
   *   referenceType: 'brand',
   *   label: 'Marka',
   *   groqProjection: '{ _id, name, "imageUrl": logo.asset->url }',
   * }]
   */
  referenceFilters?: ReferenceFilterConfig[];
}
