/**
 * SQL Parser for Dealer table
 * Extracts dealer records from SQL INSERT statements
 */

import type { DealerRecord } from './types';

/**
 * Split the VALUES string into individual record strings
 * Handles parentheses inside quoted strings correctly
 */
function splitRecords(valuesStr: string): string[] {
  const records: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    const nextChar = i + 1 < valuesStr.length ? valuesStr[i + 1] : '';

    // Handle quote state
    if (!inQuotes && (char === "'" || char === '"')) {
      inQuotes = true;
      quoteChar = char;
      current += char;
      continue;
    }

    if (inQuotes && char === quoteChar) {
      // Check for escaped quote (doubled)
      if (nextChar === quoteChar) {
        current += char + nextChar;
        i++; // Skip next char
        continue;
      }
      inQuotes = false;
      current += char;
      continue;
    }

    // Track parentheses depth (only when not in quotes)
    if (!inQuotes) {
      if (char === '(') {
        if (depth === 0) {
          // Starting a new record, don't include the opening paren
          depth++;
          continue;
        }
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          // End of record
          if (current.trim()) {
            records.push(current.trim());
          }
          current = '';
          continue;
        }
      }
    }

    // Only add characters when inside a record
    if (depth > 0) {
      current += char;
    }
  }

  // Handle last record if not properly closed
  if (current.trim()) {
    records.push(current.trim());
  }

  return records;
}

/**
 * Parse SQL file content and extract Dealer records
 */
export function parseDealersFromSQL(sqlContent: string): DealerRecord[] {
  const dealers: DealerRecord[] = [];

  // Find the INSERT INTO `Dealer` VALUES statement
  // Using multiline approach to avoid ES2018 's' flag
  const insertRegex = /INSERT INTO `Dealer` VALUES\s*/g;
  const startMatch = insertRegex.exec(sqlContent);

  if (!startMatch) {
    console.error('Could not find Dealer INSERT statement in SQL file');
    return dealers;
  }

  // Find the end of the VALUES clause (ends with semicolon followed by newline or end of section)
  const startIndex = startMatch.index + startMatch[0].length;
  let endIndex = sqlContent.indexOf(';\n', startIndex);
  if (endIndex === -1) {
    endIndex = sqlContent.indexOf(';', startIndex);
  }

  const valuesStr = sqlContent.substring(startIndex, endIndex);

  // Parse individual records more carefully
  // Records are separated by ),( pattern
  // Split by "),(" but keep track of quotes to avoid splitting inside strings
  const records = splitRecords(valuesStr);

  for (const recordStr of records) {
    try {
      const record = parseRecordValues(recordStr);
      if (record) {
        dealers.push(record);
      }
    } catch (error) {
      console.error('Error parsing record:', error);
    }
  }

  return dealers;
}

/**
 * Parse a single record's values string into a DealerRecord
 */
function parseRecordValues(valuesString: string): DealerRecord | null {
  // Split by comma, but respect quoted strings
  const values = splitCSVValues(valuesString);

  if (values.length < 15) {
    console.warn(`Record has insufficient fields (${values.length}): ${valuesString.substring(0, 100)}...`);
    return null;
  }

  return {
    ID: parseInt(values[0], 10),
    ClassName: cleanStringValue(values[1]),
    LastEdited: cleanStringValue(values[2]),
    Created: cleanStringValue(values[3]),
    Sort: parseInt(values[4], 10),
    Name: cleanStringValue(values[5]),
    City: cleanStringValue(values[6]),
    Address: parseNullableString(values[7]),
    Phone: cleanStringValue(values[8]),
    DealerPageID: parseInt(values[9], 10),
    Street: cleanStringValue(values[10]),
    Publish: parseInt(values[11], 10),
    Email: parseNullableString(values[12]),
    WWW: parseNullableString(values[13]),
    LastEditMemberID: parseInt(values[14], 10),
  };
}

/**
 * Split CSV values while respecting quoted strings
 */
function splitCSVValues(input: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!inQuotes && (char === "'" || char === '"')) {
      inQuotes = true;
      quoteChar = char;
      continue;
    }

    if (inQuotes && char === quoteChar) {
      // Check for escaped quote
      if (i + 1 < input.length && input[i + 1] === quoteChar) {
        current += char;
        i++; // Skip the escaped quote
        continue;
      }
      inQuotes = false;
      continue;
    }

    if (!inQuotes && char === ',') {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  // Don't forget the last value
  values.push(current.trim());

  return values;
}

/**
 * Clean a string value by removing quotes
 */
function cleanStringValue(value: string): string {
  if (!value) return '';
  
  // Remove surrounding quotes if present
  let cleaned = value.trim();
  if ((cleaned.startsWith("'") && cleaned.endsWith("'")) ||
      (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Handle escaped quotes
  cleaned = cleaned.replace(/''/g, "'").replace(/""/g, '"');
  
  return cleaned;
}

/**
 * Parse a nullable string value (handle NULL)
 */
function parseNullableString(value: string): string | null {
  const cleaned = value.trim().toUpperCase();
  if (cleaned === 'NULL' || cleaned === '') {
    return null;
  }
  return cleanStringValue(value);
}

