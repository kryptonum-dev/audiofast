// Re-export types and helpers for convenience
export {
  createComparisonColumns,
  createComparisonRows,
  extractAllHeadings,
  getProductColumnCount,
  getProductVariants,
  processComparisonData,
  validateProductAddition,
} from './comparison-helpers';
export type {
  ComparatorCategoryConfig,
  ComparisonColumn,
  ComparisonCookie,
  ComparisonProduct,
  ComparisonTableData,
  EnabledParameter,
  TechnicalData,
  TechnicalDataGroup,
  TechnicalDataRow,
  TechnicalDataValue,
} from './types';
