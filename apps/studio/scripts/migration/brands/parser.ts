/**
 * Brand Migration Parser
 * Parses ProducerPage, SiteTree, File, and Box records from SQL
 */

import type {
  BoxRecord,
  BrandBoxContent,
  BrandSourceData,
  FileRecord,
  ProducerPageRecord,
  SiteTreeRecord,
} from './types';

/**
 * Split CSV values handling quoted strings with commas
 */
function splitCSVValues(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === "'" && !inQuotes) {
      inQuotes = true;
      current += char;
    } else if (char === "'" && inQuotes) {
      // Check for escaped quote ''
      if (i + 1 < line.length && line[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inQuotes = false;
        current += char;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }

  if (current) {
    values.push(current.trim());
  }

  return values;
}

/**
 * Parse a value, handling NULL and quoted strings
 */
function parseValue(value: string | undefined): string | null {
  if (!value || value === 'NULL') {
    return null;
  }
  // Remove surrounding quotes and unescape (using [\s\S] instead of .+s flag)
  return value.replace(/^'([\s\S]*)'$/, '$1').replace(/''/g, "'");
}

/**
 * Parse ProducerPage records from SQL content
 */
export function parseProducerPagesFromSQL(
  sqlContent: string,
): Map<string, ProducerPageRecord> {
  const producerPages = new Map<string, ProducerPageRecord>();

  // Find the INSERT INTO ProducerPage statement (using [\s\S] instead of .+s flag)
  const insertMatch = sqlContent.match(
    /INSERT INTO `ProducerPage` VALUES\s*([\s\S]+?);\n/,
  );
  if (!insertMatch) {
    console.error('Could not find ProducerPage INSERT statement');
    return producerPages;
  }

  const valuesString = insertMatch[1];
  // Match individual records: (id,...)
  const recordRegex = /\((\d+),'a:[^']*',(\d+),(\d+),\d+,([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),(\d+),([^)]*)\)/g;

  let match;
  while ((match = recordRegex.exec(valuesString)) !== null) {
    try {
      const record: ProducerPageRecord = {
        ID: match[1],
        LogoID: match[2],
        Logo2ID: match[3],
        motto_pl_PL: parseValue(match[4]),
        motto: parseValue(match[8]),
        bOtherBrands: match[10],
        ProducerDescription: parseValue(match[11]),
      };
      producerPages.set(record.ID, record);
    } catch (error) {
      console.error(`Error parsing ProducerPage record:`, error);
    }
  }

  return producerPages;
}

/**
 * Parse SiteTree records for ProducerPage type from SQL content
 */
export function parseSiteTreeProducersFromSQL(
  sqlContent: string,
): Map<string, SiteTreeRecord> {
  const siteTreeRecords = new Map<string, SiteTreeRecord>();

  // Find the INSERT INTO SiteTree statement
  const insertMatch = sqlContent.match(
    /INSERT INTO `SiteTree` VALUES\s*([\s\S]+?);\n(?:UNLOCK|--)/,
  );
  if (!insertMatch) {
    console.error('Could not find SiteTree INSERT statement');
    return siteTreeRecords;
  }

  const valuesString = insertMatch[1];

  // Find all ProducerPage entries - simpler regex to extract individual records
  // Format: (ID,'ProducerPage',LastEdited,Created,'URLSegment','Title',...)
  const recordRegex =
    /\((\d+),'ProducerPage','[^']*','[^']*','([^']*)','([^']*)'[^)]*\)/g;

  let match;
  while ((match = recordRegex.exec(valuesString)) !== null) {
    try {
      const id = match[1];
      const urlSegment = match[2];
      const title = match[3].replace(/''/g, "'"); // Unescape quotes

      const record: SiteTreeRecord = {
        ID: id,
        ClassName: 'ProducerPage',
        URLSegment: urlSegment,
        Title: title,
        MetaTitle: null,
        MetaDescription: null,
      };
      siteTreeRecords.set(record.ID, record);
    } catch (error) {
      console.error(`Error parsing SiteTree ProducerPage record:`, error);
    }
  }

  return siteTreeRecords;
}

/**
 * Parse File records for logo images from SQL content
 */
export function parseFilesFromSQL(
  sqlContent: string,
  fileIds: Set<string>,
): Map<string, FileRecord> {
  const files = new Map<string, FileRecord>();

  // Find the INSERT INTO File statement
  const insertMatch = sqlContent.match(
    /INSERT INTO `File` VALUES\s*([\s\S]+?);\n(?:UNLOCK|--)/,
  );
  if (!insertMatch) {
    console.error('Could not find File INSERT statement');
    return files;
  }

  const valuesString = insertMatch[1];

  // For each file ID we need, search for it
  for (const fileId of fileIds) {
    const fileRegex = new RegExp(
      `\\(${fileId},'([^']*)',[^,]*,[^,]*,'([^']*)',[^,]*,'[^']*',([^,]*),\\d+,\\d+,\\d+,\\d+,'[^']*','[^']*',([^,]*),([^,]*)`,
    );
    const match = valuesString.match(fileRegex);

    if (match) {
      files.set(fileId, {
        ID: fileId,
        ClassName: match[1],
        Name: match[2],
        FileHash: parseValue(match[4]),
        FileFilename: parseValue(match[5]),
      });
    }
  }

  return files;
}

/**
 * Parse Box records linked to brand pages from SQL content
 * Box records contain page sections: text descriptions, images, YouTube videos
 */
export function parseBoxRecordsFromSQL(
  sqlContent: string,
  brandPageIds: Set<string>,
): Map<string, BoxRecord[]> {
  const boxesByPage = new Map<string, BoxRecord[]>();

  // Initialize empty arrays for each brand page
  for (const pageId of brandPageIds) {
    boxesByPage.set(pageId, []);
  }

  // Find the INSERT INTO Box statement
  const insertMatch = sqlContent.match(
    /INSERT INTO `Box` VALUES\s*([\s\S]+?);\n(?:UNLOCK|--)/,
  );
  if (!insertMatch) {
    console.error('Could not find Box INSERT statement');
    return boxesByPage;
  }

  const valuesString = insertMatch[1];

  // Split by ),( pattern to get individual records
  // Replace ),( with a delimiter, then split
  const records = valuesString.split(/\),\s*\(/);

  for (const record of records) {
    // Clean up the record string
    const cleanRecord = record.replace(/^\(/, '').replace(/\)$/, '');

    // Parse the record using CSV parsing
    const values = splitCSVValues(cleanRecord);

    if (values.length < 20) continue;

    // Box table columns:
    // 0: ID, 1: ClassName, 2: LastEdited, 3: Created, 4: Youtube, 5: box_type, 6: Content
    // 7: Publish, 8: Sort, 9: BoxedPageID, 10: HeaderImgID, 11: BigPictureID
    // ...16: BoxTitle_pl_PL, 17: BoxTitle_en_US, 18: Content_pl_PL

    const boxedPageID = parseValue(values[9]);
    if (!boxedPageID || !brandPageIds.has(boxedPageID)) continue;

    const boxType = parseValue(values[5]);
    // Only interested in 'text' and 'bigimg' types for brand descriptions
    if (boxType !== 'text' && boxType !== 'bigimg') continue;

    const boxRecord: BoxRecord = {
      ID: parseValue(values[0]) || '',
      boxType: boxType || '',
      content: parseValue(values[6]),
      contentPl: parseValue(values[19]), // Content_pl_PL is at index 19
      boxTitlePl: parseValue(values[17]), // BoxTitle_pl_PL is at index 17
      boxedPageID: boxedPageID,
      headerImgID: parseValue(values[10]) || '0',
      bigPictureID: parseValue(values[11]) || '0',
      youtubeEmbed: parseValue(values[4]),
    };

    const pageBoxes = boxesByPage.get(boxedPageID) || [];
    pageBoxes.push(boxRecord);
    boxesByPage.set(boxedPageID, pageBoxes);
  }

  return boxesByPage;
}

/**
 * Extract YouTube video ID from an embed URL or iframe HTML
 */
function extractYouTubeId(content: string | null): string | null {
  if (!content) return null;

  // Try to extract from iframe src attribute
  const iframeMatch = content.match(
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  );
  if (iframeMatch) {
    return iframeMatch[1];
  }

  // Try standard YouTube URL
  const urlMatch = content.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (urlMatch) {
    return urlMatch[1];
  }

  return null;
}

/**
 * Process Box records for a brand page and extract content
 */
function processBoxContent(
  boxes: BoxRecord[],
  files: Map<string, FileRecord>,
): BrandBoxContent {
  let descriptionTitle: string | null = null;
  let descriptionContent: string | null = null;
  let bannerImageId: string | null = null;
  let bannerImageFilename: string | null = null;
  let youtubeVideoId: string | null = null;

  for (const box of boxes) {
    if (box.boxType === 'text') {
      // Check for description title and content
      if (box.boxTitlePl && !descriptionTitle) {
        descriptionTitle = box.boxTitlePl;
      }
      if (box.contentPl && !descriptionContent) {
        // Check if this is just a YouTube embed
        const ytId = extractYouTubeId(box.contentPl);
        if (ytId && box.contentPl.includes('<iframe')) {
          // This is primarily a YouTube embed box
          if (!youtubeVideoId) {
            youtubeVideoId = ytId;
          }
        } else if (box.contentPl.length > 100) {
          // This is actual content (not just an embed)
          descriptionContent = box.contentPl;
        }
      }
      // Also check the content field (non-localized)
      if (!youtubeVideoId) {
        youtubeVideoId = extractYouTubeId(box.content);
      }
    }

    if (box.boxType === 'bigimg') {
      // Extract banner image
      const imgId = box.bigPictureID !== '0' ? box.bigPictureID : box.headerImgID;
      if (imgId && imgId !== '0' && !bannerImageId) {
        bannerImageId = imgId;
        const file = files.get(imgId);
        if (file) {
          bannerImageFilename = file.FileFilename;
        }
      }
    }
  }

  return {
    descriptionTitle,
    descriptionContent,
    bannerImageId,
    bannerImageFilename,
    youtubeVideoId,
  };
}

/**
 * Combine data from ProducerPage, SiteTree, File, and Box tables into BrandSourceData
 */
export function combineBrandData(
  producerPages: Map<string, ProducerPageRecord>,
  siteTree: Map<string, SiteTreeRecord>,
  files: Map<string, FileRecord>,
  boxesByPage?: Map<string, BoxRecord[]>,
): BrandSourceData[] {
  const brands: BrandSourceData[] = [];

  for (const [id, producer] of producerPages) {
    const siteTreeRecord = siteTree.get(id);
    if (!siteTreeRecord) {
      console.warn(`No SiteTree record found for ProducerPage ID ${id}`);
      continue;
    }

    const logoFile = files.get(producer.LogoID);

    // Process Box content if available
    let boxContent: BrandBoxContent | null = null;
    if (boxesByPage) {
      const boxes = boxesByPage.get(id) || [];
      if (boxes.length > 0) {
        boxContent = processBoxContent(boxes, files);
      }
    }

    brands.push({
      id,
      name: siteTreeRecord.Title,
      slug: siteTreeRecord.URLSegment,
      logoFileId: producer.LogoID,
      logoFilename: logoFile?.FileFilename || null,
      motto: producer.motto || producer.motto_pl_PL,
      description: producer.ProducerDescription,
      metaTitle: siteTreeRecord.MetaTitle,
      metaDescription: siteTreeRecord.MetaDescription,
      boxContent,
    });
  }

  return brands;
}

/**
 * Main parsing function - parses all brand data from SQL file
 */
export function parseBrandsFromSQL(sqlContent: string): BrandSourceData[] {
  console.log('Parsing ProducerPage records...');
  const producerPages = parseProducerPagesFromSQL(sqlContent);
  console.log(`Found ${producerPages.size} ProducerPage records`);

  console.log('Parsing SiteTree ProducerPage records...');
  const siteTree = parseSiteTreeProducersFromSQL(sqlContent);
  console.log(`Found ${siteTree.size} SiteTree ProducerPage records`);

  // Collect all brand page IDs for Box parsing
  const brandPageIds = new Set<string>(producerPages.keys());

  // Parse Box records for brand pages (page sections with descriptions, images, videos)
  console.log('Parsing Box records for brand page sections...');
  const boxesByPage = parseBoxRecordsFromSQL(sqlContent, brandPageIds);
  let totalBoxes = 0;
  for (const boxes of boxesByPage.values()) {
    totalBoxes += boxes.length;
  }
  console.log(`Found ${totalBoxes} Box records across ${boxesByPage.size} brand pages`);

  // Collect all file IDs we need (logos + banner images)
  const fileIds = new Set<string>();
  for (const producer of producerPages.values()) {
    if (producer.LogoID && producer.LogoID !== '0') {
      fileIds.add(producer.LogoID);
    }
  }
  // Add banner image IDs from Box records
  for (const boxes of boxesByPage.values()) {
    for (const box of boxes) {
      if (box.headerImgID && box.headerImgID !== '0') {
        fileIds.add(box.headerImgID);
      }
      if (box.bigPictureID && box.bigPictureID !== '0') {
        fileIds.add(box.bigPictureID);
      }
    }
  }

  console.log('Parsing File records...');
  const files = parseFilesFromSQL(sqlContent, fileIds);
  console.log(`Found ${files.size} File records`);

  console.log('Combining brand data...');
  const brands = combineBrandData(producerPages, siteTree, files, boxesByPage);
  console.log(`Combined ${brands.length} brand records`);

  return brands;
}

