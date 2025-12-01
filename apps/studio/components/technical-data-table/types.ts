import type { PortableTextBlock } from 'sanity';

/**
 * A single cell value containing Portable Text content
 */
export type TechnicalDataCellValue = {
  _key: string;
  content: PortableTextBlock[];
};

/**
 * A row in the technical data table
 */
export type TechnicalDataRow = {
  _key: string;
  title: string;
  values: TechnicalDataCellValue[];
};

/**
 * A group/section of technical data rows
 */
export type TechnicalDataGroup = {
  _key: string;
  title?: string | null; // Optional section title (e.g., "Specyfikacja techniczna")
  rows: TechnicalDataRow[];
};

/**
 * The complete technical data structure
 */
export type TechnicalDataValue = {
  variants?: string[] | null;
  groups?: TechnicalDataGroup[];
} | null;

/**
 * Props for the TechnicalDataTableInput component
 */
export type TechnicalDataTableInputProps = {
  value: TechnicalDataValue;
  onChange: (value: TechnicalDataValue) => void;
  readOnly?: boolean;
};

/**
 * State for the cell editor modal
 */
export type CellEditorState = {
  isOpen: boolean;
  groupIndex: number;
  rowIndex: number;
  valueIndex: number;
  content: PortableTextBlock[];
} | null;

/**
 * Generate a unique key for Sanity documents
 */
export function generateKey(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Create an empty cell value
 */
export function createEmptyCellValue(): TechnicalDataCellValue {
  return {
    _key: generateKey(),
    content: [],
  };
}

/**
 * Create an empty row with the specified number of values
 */
export function createEmptyRow(valueCount: number = 1): TechnicalDataRow {
  return {
    _key: generateKey(),
    title: '',
    values: Array.from({ length: valueCount }, () => createEmptyCellValue()),
  };
}

/**
 * Create an empty group with one empty row
 */
export function createEmptyGroup(
  valueCount: number = 1,
  title?: string
): TechnicalDataGroup {
  return {
    _key: generateKey(),
    title: title || null,
    rows: [createEmptyRow(valueCount)],
  };
}

/**
 * Extract plain text from Portable Text blocks for preview
 */
export function extractPlainTextFromBlocks(
  blocks: PortableTextBlock[]
): string {
  if (!blocks || !Array.isArray(blocks)) return '';

  return blocks
    .map((block) => {
      if (block._type !== 'block' || !block.children) return '';
      return (block.children as Array<{ text?: string }>)
        .map((child) => child.text || '')
        .join('');
    })
    .join('\n')
    .trim();
}
