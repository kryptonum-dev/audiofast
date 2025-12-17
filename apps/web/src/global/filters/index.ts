// Filter computation utilities for PPR client-side filter updates
// This module enables instant filter updates without server round-trips

export { computeAvailableFilters } from './computeFilters';
export type {
  ActiveFilters,
  ActiveRangeFilter,
  BrandMetadata,
  BrandWithCount,
  CategoryMetadata,
  CategoryWithCount,
  ComputedFilters,
  CustomFilterDefinition,
  CustomFilterValue,
  ProductFilterMetadata,
} from './types';
