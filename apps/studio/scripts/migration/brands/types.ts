/**
 * Brand Migration Types
 * Interfaces for parsing ProducerPage records from SQL and transforming to Sanity brand documents
 */

export interface ProducerPageRecord {
  ID: string;
  LogoID: string;
  Logo2ID: string;
  motto: string | null;
  motto_pl_PL: string | null;
  ProducerDescription: string | null;
  bOtherBrands: string;
}

export interface SiteTreeRecord {
  ID: string;
  ClassName: string;
  URLSegment: string;
  Title: string;
  MetaTitle: string | null;
  MetaDescription: string | null;
}

export interface FileRecord {
  ID: string;
  ClassName: string;
  Name: string;
  FileFilename: string | null;
  FileHash: string | null;
}

/**
 * Box record from SQL - represents page sections (image, text, video)
 * Linked to brand pages via BoxedPageID
 */
export interface BoxRecord {
  ID: string;
  boxType: string;
  content: string | null;
  contentPl: string | null;
  boxTitlePl: string | null;
  boxedPageID: string;
  headerImgID: string;
  bigPictureID: string;
  youtubeEmbed: string | null;
}

/**
 * Extended brand content from Box table
 */
export interface BrandBoxContent {
  /** Full description title (e.g., "Brand - firma, która nigdy nie idzie na skróty") */
  descriptionTitle: string | null;
  /** Full description HTML content */
  descriptionContent: string | null;
  /** Banner image file ID */
  bannerImageId: string | null;
  /** Banner image filename */
  bannerImageFilename: string | null;
  /** YouTube video ID extracted from embed */
  youtubeVideoId: string | null;
}

export interface BrandSourceData {
  id: string;
  name: string;
  slug: string;
  logoFileId: string;
  logoFilename: string | null;
  motto: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Extended content from Box table */
  boxContent: BrandBoxContent | null;
}

export interface PortableTextBlock {
  _key: string;
  _type: "block";
  children: Array<{
    _key: string;
    _type: "span";
    marks: string[];
    text: string;
  }>;
  markDefs: any[];
  style: string;
}

export interface PortableTextYouTubeBlock {
  _key: string;
  _type: "ptYoutubeVideo";
  youtubeId: string;
  title?: string;
}

export interface Brand {
  _id: string;
  _type: "brand";
  name: string;
  slug: {
    _type: "slug";
    current: string;
  };
  logo?: {
    _type: "image";
    asset: {
      _type: "reference";
      _ref: string;
    };
  };
  description: PortableTextBlock[];
  heroImage: {
    _type: "image";
    asset: {
      _type: "reference";
      _ref: string;
    };
  };
  bannerImage?: {
    _type: "image";
    asset: {
      _type: "reference";
      _ref: string;
    };
  };
  brandDescriptionHeading: PortableTextBlock[];
  brandDescription: (PortableTextBlock | PortableTextYouTubeBlock)[];
  seo: {
    title: string;
    description: string;
  };
  doNotIndex: boolean;
  hideFromList: boolean;
}

export interface ExistingBrand {
  _id: string;
  name: string;
  hasLogo: boolean;
  hasDescription: boolean;
  hasBrandDescription: boolean;
  hasHeroImage: boolean;
  hasBannerImage: boolean;
  hasSeoTitle: boolean;
  hasSeoDescription: boolean;
  slug: {
    current: string;
  };
}

export interface MigrationResult {
  created: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{
    brandName: string;
    error: string;
  }>;
}

export interface ValidationError {
  recordId: string;
  field: string;
  message: string;
}
