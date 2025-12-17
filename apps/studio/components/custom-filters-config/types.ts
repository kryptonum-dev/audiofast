/**
 * Filter configuration item with sortable key
 */
export type FilterConfigItem = {
  _key: string;
  name: string;
  filterType: "dropdown" | "range";
  unit?: string;
};

/**
 * Product with filter values summary
 */
export type ProductFilterSummary = {
  productId: string;
  productName: string;
  value?: string;
  numericValue?: number;
};

/**
 * Range filter statistics
 */
export type RangeFilterStats = {
  filterName: string;
  min: number;
  max: number;
  productCount: number;
};
