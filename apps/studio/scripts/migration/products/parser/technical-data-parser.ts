/**
 * Technical Data Parser
 *
 * Parses HTML content containing technical specification tables and converts
 * them to Sanity's structured technical data format.
 *
 * Features:
 * - Extracts group titles from text elements (headings, paragraphs)
 * - Parses HTML tables to structured rows
 * - Handles multi-column tables (flattens all columns as variants)
 * - Handles colspan by duplicating values across columns
 * - Converts cell content to Portable Text blocks
 * - Skips non-technical content (videos, iframes, images)
 */

import { HTMLElement, parse as parseHtml, TextNode } from 'node-html-parser';

import type {
  PortableTextBlock,
  ProductTechnicalDataRow,
  TechnicalData,
  TechnicalDataCellValue,
  TechnicalDataGroup,
  TechnicalDataRow,
} from '../types';

// ============================================================================
// Helpers
// ============================================================================

function generateKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Clean text by removing extra whitespace and trimming
 * @param preserveNewlines - If true, only collapse horizontal whitespace
 */
function cleanText(text: string, preserveNewlines = false): string {
  if (preserveNewlines) {
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace only
      .replace(/\n[ \t]+/g, '\n') // Remove leading spaces after newlines
      .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces before newlines
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();
  }
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if text is meaningful (not just whitespace, dashes, etc.)
 */
function isMeaningfulText(text: string): boolean {
  const cleaned = cleanText(text);
  // Skip empty strings, single dashes, or just whitespace
  return cleaned.length > 0 && cleaned !== '-' && !/^[\s\-–—]+$/.test(cleaned);
}

/**
 * Extract plain text from HTML element, handling nested elements
 * Preserves line breaks from <br> tags
 */
function extractTextFromElement(
  element: HTMLElement,
  preserveLineBreaks = true
): string {
  let text = '';

  for (const child of element.childNodes) {
    if (child instanceof TextNode) {
      text += child.text;
    } else if (child instanceof HTMLElement) {
      const tag = child.tagName?.toLowerCase();

      // Skip script, style, iframe
      if (['script', 'style', 'iframe'].includes(tag)) {
        continue;
      }

      // Handle <br> tags - add newline
      if (tag === 'br') {
        text += preserveLineBreaks ? '\n' : ' ';
        continue;
      }

      text += extractTextFromElement(child, preserveLineBreaks);
    }
  }

  // Clean whitespace but preserve intentional newlines
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace only
    .replace(/\n\s*\n/g, '\n') // Collapse multiple newlines
    .trim();
}

/**
 * Check if element contains only an iframe or video
 * These should be skipped as they're not technical data
 */
function containsOnlyMediaContent(element: HTMLElement): boolean {
  const html = element.innerHTML.toLowerCase();
  // Check for iframe (YouTube, Vimeo, etc.)
  if (html.includes('<iframe')) {
    return true;
  }
  // Check for video elements
  if (html.includes('<video')) {
    return true;
  }
  return false;
}

// ============================================================================
// Portable Text Conversion
// ============================================================================

interface SpanChild {
  _type: 'span';
  _key: string;
  text: string;
  marks: string[];
}

/**
 * Extract spans with formatting marks from an HTML element
 * Handles nested strong, em, b, i tags
 * <br> and <p> tags create newline markers for block separation
 */
function extractSpansFromElement(
  element: HTMLElement | TextNode,
  currentMarks: string[] = [],
  isTopLevel = true
): SpanChild[] {
  const spans: SpanChild[] = [];

  if (element instanceof TextNode) {
    const text = element.text;
    if (text && text.trim()) {
      spans.push({
        _type: 'span',
        _key: generateKey(),
        text: text.replace(/&nbsp;/g, ' '),
        marks: [...currentMarks],
      });
    }
    return spans;
  }

  if (!(element instanceof HTMLElement)) {
    return spans;
  }

  const tagName = element.tagName?.toLowerCase();

  // Skip script, style, iframe
  if (['script', 'style', 'iframe'].includes(tagName)) {
    return spans;
  }

  // Handle <br> tags - add newline span (block separator)
  if (tagName === 'br') {
    spans.push({
      _type: 'span',
      _key: generateKey(),
      text: '\n',
      marks: [],
    });
    return spans;
  }

  // Handle <p> tags - they create new blocks (add newline before if not first)
  if (tagName === 'p' && !isTopLevel) {
    // Add newline before <p> content to separate from previous content
    spans.push({
      _type: 'span',
      _key: generateKey(),
      text: '\n',
      marks: [],
    });
  }

  // Determine marks for this element
  const newMarks = [...currentMarks];
  if (tagName === 'strong' || tagName === 'b') {
    if (!newMarks.includes('strong')) {
      newMarks.push('strong');
    }
  }
  if (tagName === 'em' || tagName === 'i') {
    if (!newMarks.includes('em')) {
      newMarks.push('em');
    }
  }

  // Process children
  for (const child of element.childNodes) {
    if (child instanceof TextNode) {
      const text = child.text;
      if (text) {
        // Handle text that might contain &nbsp;
        const cleanedText = text.replace(/&nbsp;/g, ' ');
        if (cleanedText.trim() || cleanedText === ' ') {
          spans.push({
            _type: 'span',
            _key: generateKey(),
            text: cleanedText,
            marks: [...newMarks],
          });
        }
      }
    } else if (child instanceof HTMLElement) {
      spans.push(...extractSpansFromElement(child, newMarks, false));
    }
  }

  return spans;
}

/**
 * Merge consecutive spans with the same marks
 * Keeps newline spans separate (they act as block separators)
 */
function mergeConsecutiveSpans(spans: SpanChild[]): SpanChild[] {
  if (spans.length <= 1) return spans;

  const merged: SpanChild[] = [];

  for (const span of spans) {
    const last = merged[merged.length - 1];

    // Keep newline spans separate - they mark block boundaries
    if (span.text === '\n') {
      merged.push({ ...span });
      continue;
    }

    // Check if we can merge with the previous span (same marks, and previous is not newline)
    if (
      last &&
      last.text !== '\n' &&
      JSON.stringify(last.marks.sort()) === JSON.stringify(span.marks.sort())
    ) {
      // Merge: append text to previous span
      last.text += span.text;
    } else {
      merged.push({ ...span });
    }
  }

  return merged;
}

/**
 * Convert HTML cell content to Portable Text blocks
 * Handles basic formatting: strong, em, br, lists
 * Line breaks (<br>, <p>) create separate blocks for proper display
 */
function cellContentToPortableText(html: string): PortableTextBlock[] {
  const cleaned = cleanText(html);
  if (!cleaned) {
    return [];
  }

  // Parse HTML to extract text and marks
  const root = parseHtml(html);
  const blocks: PortableTextBlock[] = [];

  // Check if there are list items
  const listItems = root.querySelectorAll('li');
  if (listItems.length > 0) {
    // Create list blocks with formatting
    for (const li of listItems) {
      const spans = extractSpansFromElement(li as HTMLElement);
      const mergedSpans = mergeConsecutiveSpans(spans);

      // Filter out newline spans for lists
      const filteredSpans = mergedSpans.filter((s) => s.text !== '\n');
      if (filteredSpans.length > 0) {
        blocks.push({
          _type: 'block',
          _key: generateKey(),
          style: 'normal',
          markDefs: [],
          children: filteredSpans,
          listItem: 'bullet',
          level: 1,
        });
      }
    }
    return blocks;
  }

  // Extract spans with formatting (newline spans mark block boundaries)
  const spans = extractSpansFromElement(root);
  const mergedSpans = mergeConsecutiveSpans(spans);

  if (mergedSpans.length === 0) {
    return [];
  }

  // Split spans at newline markers into separate blocks
  let currentBlockSpans: SpanChild[] = [];

  for (const span of mergedSpans) {
    if (span.text === '\n') {
      // Newline: flush current block and start a new one
      if (currentBlockSpans.length > 0) {
        // Trim whitespace from edges
        const trimmed = trimBlockSpans(currentBlockSpans);
        if (trimmed.length > 0) {
          blocks.push({
            _type: 'block',
            _key: generateKey(),
            style: 'normal',
            markDefs: [],
            children: trimmed,
          });
        }
        currentBlockSpans = [];
      }
    } else {
      currentBlockSpans.push(span);
    }
  }

  // Flush remaining spans
  if (currentBlockSpans.length > 0) {
    const trimmed = trimBlockSpans(currentBlockSpans);
    if (trimmed.length > 0) {
      blocks.push({
        _type: 'block',
        _key: generateKey(),
        style: 'normal',
        markDefs: [],
        children: trimmed,
      });
    }
  }

  return blocks;
}

/**
 * Trim leading/trailing whitespace from block spans
 */
function trimBlockSpans(spans: SpanChild[]): SpanChild[] {
  if (spans.length === 0) return [];

  return spans
    .map((span, idx) => {
      let text = span.text;
      if (idx === 0) text = text.trimStart();
      if (idx === spans.length - 1) text = text.trimEnd();
      return { ...span, text };
    })
    .filter((span) => span.text);
}

// ============================================================================
// Table Parsing
// ============================================================================

interface ParsedTableCell {
  text: string;
  html: string;
  colspan: number;
  rowspan: number;
  isHeader: boolean;
}

interface ParsedTableRow {
  cells: ParsedTableCell[];
}

interface ParsedTable {
  rows: ParsedTableRow[];
  hasVariants: boolean;
  variants: string[];
  headerRowsToSkip: number;
  extractedGroupTitle?: string; // Group title extracted from first cell of header row
}

/**
 * Parse an HTML table element into structured data
 * Handles grouped column headers by flattening and prepending group names to variants
 *
 * Handles complex header patterns like:
 * Row 1: [empty rowspan=2] [SR30 rowspan=2] [Foundation rowspan=2] [Atmosphere SX colspan=3]
 * Row 2: [Alive] [Excite] [Euphoria]
 * Result: ["SR30", "Foundation", "Atmosphere SX Alive", "Atmosphere SX Excite", "Atmosphere SX Euphoria"]
 */
function parseHtmlTable(tableElement: HTMLElement): ParsedTable {
  const rows: ParsedTableRow[] = [];
  const tableRows = tableElement.querySelectorAll('tr');

  for (const tr of tableRows) {
    const cells: ParsedTableCell[] = [];
    const tds = tr.querySelectorAll('td, th');

    for (const td of tds) {
      const colspan = parseInt(td.getAttribute('colspan') || '1', 10);
      const rowspan = parseInt(td.getAttribute('rowspan') || '1', 10);
      const text = extractTextFromElement(td as HTMLElement);
      const html = td.innerHTML;

      // Check if this is a header cell (contains <strong> or is <th>)
      const isHeader =
        td.tagName?.toLowerCase() === 'th' ||
        td.querySelector('strong') !== null;

      cells.push({
        text,
        html,
        colspan,
        rowspan,
        isHeader,
      });
    }

    if (cells.length > 0) {
      rows.push({ cells });
    }
  }

  // Detect variants from header rows
  let variants: string[] = [];
  let hasVariants = false;
  let headerRowsToSkip = 0;
  let extractedGroupTitle: string | undefined;

  if (rows.length > 0) {
    const firstRow = rows[0];

    // Check if we have a complex header with rowspan/colspan pattern
    // Pattern: some cells have rowspan > 1 (standalone variants), others have colspan > 1 (grouped variants)
    const hasRowspanCells = firstRow.cells.some(
      (c) => c.rowspan > 1 && c.text.trim()
    );
    const hasColspanCells = firstRow.cells.some(
      (c) => c.colspan > 1 && c.text.trim()
    );

    if (hasRowspanCells && hasColspanCells && rows.length > 1) {
      // Complex header pattern:
      // First row has: [empty rowspan=2] [Variant1 rowspan=2] [GroupName colspan=N]
      // Second row has: [SubVariant1] [SubVariant2] ...

      const resultVariants: string[] = [];
      const secondRow = rows[1];
      let secondRowIdx = 0;

      for (const cell of firstRow.cells) {
        const cellText = cell.text.trim();

        if (cell.rowspan > 1) {
          // This cell spans multiple rows - it's a standalone variant
          // Skip empty cells (usually the label column)
          if (cellText && cellText.length >= 2) {
            resultVariants.push(cellText);
          }
        } else if (cell.colspan > 1) {
          // This cell is a group header spanning multiple columns
          // Get sub-variants from second row
          for (
            let i = 0;
            i < cell.colspan && secondRowIdx < secondRow.cells.length;
            i++
          ) {
            const subCell = secondRow.cells[secondRowIdx];
            const subText = subCell?.text?.trim() || '';
            if (subText) {
              // Prepend group name to sub-variant
              resultVariants.push(`${cellText} ${subText}`.trim());
            }
            secondRowIdx++;
          }
        } else {
          // Single cell in first row, might be a variant
          if (cellText && cellText.length >= 2) {
            resultVariants.push(cellText);
          }
        }
      }

      hasVariants = resultVariants.length > 0;
      headerRowsToSkip = 2;
      variants = resultVariants;
    } else if (hasColspanCells && rows.length > 1) {
      // Grouped headers without rowspan
      // Build a map of column index -> group prefix
      const groupPrefixes: string[] = [];
      for (const cell of firstRow.cells) {
        const groupName = cell.text.trim();
        for (let i = 0; i < cell.colspan; i++) {
          groupPrefixes.push(groupName);
        }
      }

      // Get variant names from second row
      const secondRow = rows[1];
      const expandedVariants: string[] = [];
      let colIdx = 0;

      for (const cell of secondRow.cells) {
        for (let i = 0; i < cell.colspan; i++) {
          const variantName = cell.text.trim();
          const groupPrefix = groupPrefixes[colIdx] || '';

          if (groupPrefix && groupPrefix !== variantName) {
            expandedVariants.push(`${groupPrefix} ${variantName}`.trim());
          } else {
            expandedVariants.push(variantName);
          }
          colIdx++;
        }
      }

      const firstCellText = expandedVariants[0] || '';
      const skipFirst = !firstCellText || firstCellText.length < 2;
      variants = skipFirst ? expandedVariants.slice(1) : expandedVariants;
      variants = variants.filter(Boolean);
      hasVariants = variants.length > 0;
      headerRowsToSkip = 2;
    } else if (firstRow.cells.some((c) => c.colspan >= 3) && rows.length > 1) {
      // Title row pattern (single cell spanning many columns)
      const secondRow = rows[1];
      const potentialVariants = secondRow.cells.filter(
        (c) => c.isHeader || c.text.length > 0
      );

      if (potentialVariants.length >= 2) {
        hasVariants = true;
        headerRowsToSkip = 2;
        const firstCellText = secondRow.cells[0]?.text || '';
        const skipFirst = !firstCellText || firstCellText.length < 3;
        variants = (skipFirst ? secondRow.cells.slice(1) : secondRow.cells)
          .map((c) => c.text)
          .filter(Boolean);
      }
    } else {
      // Standard pattern: first row has variants directly
      // Check if first cell is NOT a header (group title) and remaining cells ARE headers (variants)
      const firstCell = firstRow.cells[0];
      const remainingCells = firstRow.cells.slice(1);
      const potentialVariants = remainingCells.filter((c) => c.isHeader);

      // If we have header cells after first column, treat them as variants
      if (potentialVariants.length > 0 && firstRow.cells.length > 2) {
        hasVariants = true;
        headerRowsToSkip = 1;
        variants = remainingCells.map((c) => c.text).filter(Boolean);

        // If first cell is NOT a header but has meaningful text, it's a group title
        const firstCellText = firstCell?.text?.trim() || '';
        if (firstCellText && !firstCell.isHeader && firstCellText.length >= 2) {
          extractedGroupTitle = firstCellText;
        }
      }
    }
  }

  return { rows, hasVariants, variants, headerRowsToSkip, extractedGroupTitle };
}

/**
 * Convert parsed table to TechnicalDataGroup
 */
function tableToTechnicalDataGroup(
  table: ParsedTable,
  groupTitle?: string
): TechnicalDataGroup | null {
  const { rows, hasVariants, variants, headerRowsToSkip, extractedGroupTitle } =
    table;

  if (rows.length === 0) {
    return null;
  }

  // Use external groupTitle, or extracted group title from table header
  const finalGroupTitle = groupTitle || extractedGroupTitle;

  const technicalRows: TechnicalDataRow[] = [];

  // Determine starting row index (skip header rows)
  const startIndex = headerRowsToSkip;

  // Determine number of value columns
  const numValueColumns = hasVariants ? variants.length : 1;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.cells.length === 0) continue;

    // First cell is the parameter name
    const parameterName = row.cells[0].text;
    if (!parameterName || !isMeaningfulText(parameterName)) {
      continue;
    }

    // Build values array
    const values: TechnicalDataCellValue[] = [];

    if (row.cells.length === 1) {
      // Only parameter name, no value - skip this row
      continue;
    }

    // Handle colspan - if a cell spans multiple columns, duplicate its value
    let colIndex = 0;
    for (
      let cellIdx = 1;
      cellIdx < row.cells.length && colIndex < numValueColumns;
      cellIdx++
    ) {
      const cell = row.cells[cellIdx];
      const cellContent = cellContentToPortableText(cell.html);

      // Add this cell's value for each column it spans
      for (
        let span = 0;
        span < cell.colspan && colIndex < numValueColumns;
        span++
      ) {
        values.push({
          _key: generateKey(),
          content:
            cellContent.length > 0
              ? cellContent
              : [
                  {
                    _type: 'block',
                    _key: generateKey(),
                    style: 'normal',
                    markDefs: [],
                    children: [
                      {
                        _type: 'span',
                        _key: generateKey(),
                        text: cell.text || '-',
                        marks: [],
                      },
                    ],
                  },
                ],
        });
        colIndex++;
      }
    }

    // Ensure we have the right number of values
    while (values.length < numValueColumns) {
      values.push({
        _key: generateKey(),
        content: [
          {
            _type: 'block',
            _key: generateKey(),
            style: 'normal',
            markDefs: [],
            children: [
              {
                _type: 'span',
                _key: generateKey(),
                text: '-',
                marks: [],
              },
            ],
          },
        ],
      });
    }

    technicalRows.push({
      _type: 'technicalDataRow',
      _key: generateKey(),
      title: parameterName,
      values,
    });
  }

  if (technicalRows.length === 0) {
    return null;
  }

  return {
    _type: 'technicalDataGroup',
    _key: generateKey(),
    title: finalGroupTitle || undefined,
    rows: technicalRows,
  };
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse HTML content from a technical data tab
 * Extracts group titles from text elements and tables
 */
export function parseTabContent(htmlContent: string): {
  variants: string[];
  groups: TechnicalDataGroup[];
} {
  if (!htmlContent || htmlContent.trim() === '') {
    return { variants: [], groups: [] };
  }

  const root = parseHtml(htmlContent);
  const groups: TechnicalDataGroup[] = [];
  let allVariants: string[] = [];

  // Track current group title (from text before a table)
  let currentGroupTitle: string | undefined;

  // Process all top-level elements
  const children = root.childNodes;

  for (const child of children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    const tagName = child.tagName?.toLowerCase();

    // Skip media content
    if (containsOnlyMediaContent(child)) {
      continue;
    }

    // Text elements (headings, paragraphs) - potential group titles
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tagName)) {
      const text = extractTextFromElement(child);
      if (isMeaningfulText(text)) {
        // Check if this paragraph only contains a table (nested)
        const nestedTable = child.querySelector('table');
        if (nestedTable) {
          // Parse the nested table
          const parsedTable = parseHtmlTable(nestedTable as HTMLElement);
          if (
            parsedTable.hasVariants &&
            parsedTable.variants.length > allVariants.length
          ) {
            allVariants = parsedTable.variants;
          }
          const group = tableToTechnicalDataGroup(
            parsedTable,
            currentGroupTitle
          );
          if (group) {
            groups.push(group);
          }
          currentGroupTitle = undefined;
        } else {
          // This is a group title for the next table
          // Clean common suffixes like ":" from titles
          currentGroupTitle = text.replace(/:$/, '').trim();
        }
      }
      continue;
    }

    // Table elements
    if (tagName === 'table') {
      const parsedTable = parseHtmlTable(child);

      // Update variants if this table has more columns
      if (
        parsedTable.hasVariants &&
        parsedTable.variants.length > allVariants.length
      ) {
        allVariants = parsedTable.variants;
      }

      const group = tableToTechnicalDataGroup(parsedTable, currentGroupTitle);
      if (group) {
        groups.push(group);
      }
      currentGroupTitle = undefined;
      continue;
    }

    // Divs or other containers might contain tables
    if (['div', 'section', 'article'].includes(tagName)) {
      const tables = child.querySelectorAll('table');
      for (const table of tables) {
        const parsedTable = parseHtmlTable(table as HTMLElement);
        if (
          parsedTable.hasVariants &&
          parsedTable.variants.length > allVariants.length
        ) {
          allVariants = parsedTable.variants;
        }
        const group = tableToTechnicalDataGroup(parsedTable, currentGroupTitle);
        if (group) {
          groups.push(group);
        }
        currentGroupTitle = undefined;
      }
    }
  }

  return { variants: allVariants, groups };
}

/**
 * Parse all technical data rows for a product and combine into TechnicalData
 */
export function parseTechnicalData(
  rows: ProductTechnicalDataRow[]
): TechnicalData | null {
  if (!rows || rows.length === 0) {
    return null;
  }

  let allVariants: string[] = [];
  const allGroups: TechnicalDataGroup[] = [];

  for (const row of rows) {
    if (!row.TabContent) {
      continue;
    }

    const { variants, groups } = parseTabContent(row.TabContent);

    // Use variants from the table with most columns
    if (variants.length > allVariants.length) {
      allVariants = variants;
    }

    // If TabTitle is set and first group has no title, use TabTitle
    if (row.TabTitle && groups.length > 0 && !groups[0].title) {
      groups[0].title = row.TabTitle;
    }

    allGroups.push(...groups);
  }

  if (allGroups.length === 0) {
    return null;
  }

  // If we have variants, ensure all groups have the same number of values per row
  if (allVariants.length > 0) {
    for (const group of allGroups) {
      for (const row of group.rows) {
        // Pad values array if needed
        while (row.values.length < allVariants.length) {
          row.values.push({
            _key: generateKey(),
            content: [
              {
                _type: 'block',
                _key: generateKey(),
                style: 'normal',
                markDefs: [],
                children: [
                  {
                    _type: 'span',
                    _key: generateKey(),
                    text: '-',
                    marks: [],
                  },
                ],
              },
            ],
          });
        }
        // Trim extra values if needed
        if (row.values.length > allVariants.length) {
          row.values = row.values.slice(0, allVariants.length);
        }
      }
    }
  }

  return {
    variants: allVariants.length > 0 ? allVariants : undefined,
    groups: allGroups,
  };
}
