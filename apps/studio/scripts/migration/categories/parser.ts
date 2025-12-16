/**
 * SQL Parser for ProductType (subcategories) migration
 * Extracts ProductType records from SiteTree and DeviceTypeItem mappings
 */

import type {
  ProductTypeRecord,
  DeviceTypeItemMapping,
  DeviceTypeRecord,
} from "./types";

/**
 * Parse a single CSV value, handling quoted strings and NULL
 */
function parseValue(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "NULL") return null;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    // Remove quotes and unescape doubled quotes
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

/**
 * Split a CSV record string into individual values, respecting quotes
 */
function splitCSVValues(recordStr: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < recordStr.length; i++) {
    const char = recordStr[i];
    const nextChar = i + 1 < recordStr.length ? recordStr[i + 1] : "";

    if (!inQuotes && char === "'") {
      inQuotes = true;
      current += char;
      continue;
    }

    if (inQuotes && char === "'") {
      if (nextChar === "'") {
        // Escaped quote
        current += "''";
        i++;
        continue;
      }
      inQuotes = false;
      current += char;
      continue;
    }

    if (!inQuotes && char === ",") {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    values.push(current.trim());
  }

  return values;
}

/**
 * Split records from VALUES string, handling nested parentheses in data
 */
function splitRecords(valuesStr: string): string[] {
  const records: string[] = [];
  let current = "";
  let depth = 0;
  let inQuotes = false;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    const nextChar = i + 1 < valuesStr.length ? valuesStr[i + 1] : "";

    if (!inQuotes && char === "'") {
      inQuotes = true;
      current += char;
      continue;
    }

    if (inQuotes && char === "'") {
      if (nextChar === "'") {
        current += "''";
        i++;
        continue;
      }
      inQuotes = false;
      current += char;
      continue;
    }

    if (!inQuotes) {
      if (char === "(") {
        if (depth === 0) {
          depth++;
          continue;
        }
        depth++;
      } else if (char === ")") {
        depth--;
        if (depth === 0) {
          if (current.trim()) {
            records.push(current.trim());
          }
          current = "";
          continue;
        }
      }
    }

    if (depth > 0) {
      current += char;
    }
  }

  if (current.trim()) {
    records.push(current.trim());
  }

  return records;
}

/**
 * Parse ProductType records from SiteTree INSERT statement
 * Uses regex pattern matching for more reliable extraction
 */
export function parseProductTypesFromSQL(
  sqlContent: string,
): ProductTypeRecord[] {
  const productTypes: ProductTypeRecord[] = [];

  // Use regex to find all ProductType entries
  // Format: (ID,'ProductType','LastEdited','Created','urlSegment','title',...)
  const pattern =
    /\((\d+),'ProductType','([^']+)','([^']+)','([^']*)','([^']*)'(?:,'([^']*)')?(?:,([^,)]*))?,(?:'([^']*)'|NULL)/g;

  let match;
  while ((match = pattern.exec(sqlContent)) !== null) {
    try {
      const id = parseInt(match[1]);
      const urlSegment = match[4];
      const title = match[5];

      if (!urlSegment || !title) {
        console.warn(`Skipping ProductType ${id}: missing urlSegment or title`);
        continue;
      }

      const record: ProductTypeRecord = {
        id,
        className: "ProductType",
        lastEdited: match[2] || "",
        created: match[3] || "",
        urlSegment,
        title,
        menuTitle: match[6] || null,
        content: null,
        metaDescription: match[8] || null,
        showInMenus: 1,
        showInSearch: 1,
        sort: 0,
        hasEmbeddedObjects: 0,
        reportClass: 0,
        canViewType: null,
        canEditType: "Inherit",
        version: 0,
        parentID: 0,
      };

      productTypes.push(record);
    } catch (error) {
      console.error("Error parsing ProductType record:", error);
    }
  }

  // Deduplicate by ID (keep first occurrence)
  const seen = new Set<number>();
  const unique = productTypes.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });

  return unique;
}

/**
 * Parse DeviceTypeItem mappings (ProductType → DeviceType relationships)
 */
export function parseDeviceTypeItemsFromSQL(
  sqlContent: string,
): DeviceTypeItemMapping[] {
  const mappings: DeviceTypeItemMapping[] = [];

  const insertMatch = sqlContent.match(
    /INSERT INTO `DeviceTypeItem` VALUES\s*([\s\S]*?);[\r\n]/,
  );

  if (!insertMatch) {
    console.error("Could not find DeviceTypeItem INSERT statement");
    return mappings;
  }

  const valuesStr = insertMatch[1];
  const records = splitRecords(valuesStr);

  for (const recordStr of records) {
    try {
      const values = splitCSVValues(recordStr);

      // Format: (ID, ClassName, LastEdited, Created, Sort, DeviceTypeID, PageID)
      const className = parseValue(values[1]);
      if (className !== "DeviceTypeItem") continue;

      const mapping: DeviceTypeItemMapping = {
        id: parseInt(parseValue(values[0]) || "0"),
        sort: parseInt(parseValue(values[4]) || "0"),
        deviceTypeId: parseInt(parseValue(values[5]) || "0"),
        pageId: parseInt(parseValue(values[6]) || "0"),
      };

      // Only include valid mappings (DeviceTypeID 1-6 are the real parent categories)
      if (mapping.deviceTypeId >= 1 && mapping.deviceTypeId <= 6) {
        mappings.push(mapping);
      }
    } catch (error) {
      console.error("Error parsing DeviceTypeItem record:", error);
    }
  }

  return mappings;
}

/**
 * Parse DeviceType records (parent categories in SQL)
 */
export function parseDeviceTypesFromSQL(
  sqlContent: string,
): DeviceTypeRecord[] {
  const deviceTypes: DeviceTypeRecord[] = [];

  const insertMatch = sqlContent.match(
    /INSERT INTO `DeviceType` VALUES\s*([\s\S]*?);[\r\n]/,
  );

  if (!insertMatch) {
    console.error("Could not find DeviceType INSERT statement");
    return deviceTypes;
  }

  const valuesStr = insertMatch[1];
  const records = splitRecords(valuesStr);

  for (const recordStr of records) {
    try {
      const values = splitCSVValues(recordStr);

      // Format: (ID, ClassName, LastEdited, Created, Name, Icon, Sort)
      const className = parseValue(values[1]);
      if (className !== "DeviceType") continue;

      const deviceType: DeviceTypeRecord = {
        id: parseInt(parseValue(values[0]) || "0"),
        className: className || "",
        name: parseValue(values[4]) || "",
        icon: parseValue(values[5]) || "",
        sort: parseInt(parseValue(values[6]) || "0"),
      };

      deviceTypes.push(deviceType);
    } catch (error) {
      console.error("Error parsing DeviceType record:", error);
    }
  }

  return deviceTypes;
}

/**
 * Build a mapping of ProductType page IDs to their parent DeviceType ID
 */
export function buildParentCategoryMap(
  mappings: DeviceTypeItemMapping[],
): Map<number, number> {
  const map = new Map<number, number>();

  for (const mapping of mappings) {
    map.set(mapping.pageId, mapping.deviceTypeId);
  }

  return map;
}
