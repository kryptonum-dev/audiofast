import type { QueryHomePageResult } from './sanity/sanity.types';

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
