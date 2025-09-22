import type {
  PortableText as SanityPortableText,
  PortableTextHeading as SanityPortableTextHeading,
  QueryHomePageResult,
} from './sanity/sanity.types';

export type Maybe<T> = T | null | undefined;

// Shared Page Builder helpers derived from the shared pageBuilder fragment
export type PageBuilderBlock = NonNullable<
  NonNullable<QueryHomePageResult>['pageBuilder']
>[number];

export type PageBuilderBlockType = PageBuilderBlock['_type'];

export type BlockOf<T extends PageBuilderBlockType> = Extract<
  PageBuilderBlock,
  { _type: T }
>;

// Sanity Portable Text helper union used across the app
export type PortableTextValue =
  | SanityPortableText
  | SanityPortableTextHeading
  | object[];
