import type {
  CustomUrl,
  QueryBlogPostBySlugResult,
  QueryHomePageResult,
} from './sanity/sanity.types';

export type PageBuilderBlockTypes = NonNullable<
  NonNullable<QueryHomePageResult>['pageBuilder']
>[number]['_type'];

export type PagebuilderType<T extends PageBuilderBlockTypes> = Extract<
  NonNullable<NonNullable<QueryHomePageResult>['pageBuilder']>[number],
  { _type: T }
>;

export type PublicationType = NonNullable<
  PagebuilderType<'featuredPublications'>['publications']
>[number];

export type ProductType = NonNullable<
  PagebuilderType<'featuredProducts'>['newProducts']
>[number];

export type TeamMemberType = NonNullable<
  PagebuilderType<'teamSection'>['teamMembers']
>[number];

export type ContactPersonType = NonNullable<
  NonNullable<PagebuilderType<'faqSection'>['contactPeople']>['contactPersons']
>[number];

export type PortableTextProps =
  NonNullable<QueryBlogPostBySlugResult>['content'];

export type PortableTextPropsBlock = Extract<
  NonNullable<NonNullable<PortableTextProps>[number]>,
  { _type: 'block' }
>;

// Hand-written since the dead `queryProductsPageData` (their old source) was
// removed; the shapes are unchanged.
export type ProductCategoryType = {
  _id: string;
  name: string | null;
  description: Array<{
    children?: Array<{
      marks?: Array<string>;
      text?: string;
      _type: 'span';
      _key: string;
    }>;
    style?: 'h2' | 'normal';
    listItem?: 'bullet' | 'number';
    markDefs?: Array<{
      customLink?: CustomUrl;
      _type: 'customLink';
      _key: string;
    }>;
    level?: number;
    _type: 'block';
    _key: string;
  }> | null;
  slug: string | null;
  parentCategory: {
    _id: string;
    name: string | null;
    slug: null;
  } | null;
  count: number;
};

type ImageCropHotspot = {
  hotspot: {
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
  } | null;
  crop: {
    bottom: number | null;
    left: number | null;
    right: number | null;
    top: number | null;
  } | null;
};

export type BrandType = {
  _id: string;
  name: string | null;
  slug: string | null;
  logo:
    | ({
        id: string | null;
        preview: string | null;
        alt: string | null;
        naturalWidth: number | null;
        naturalHeight: number | null;
      } & ImageCropHotspot)
    | null;
  count: number;
};

// Embeddings API types
export type EmbeddingResult = {
  score: number;
  value: {
    documentId: string;
    type: string;
  };
};

export type EmbeddingsResponse = EmbeddingResult[];
export type SearchType = 'products' | 'blog';
