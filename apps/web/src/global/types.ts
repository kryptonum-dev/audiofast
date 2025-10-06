import type { QueryHomePageResult } from './sanity/sanity.types';

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

export type ContactPersonType = NonNullable<
  NonNullable<PagebuilderType<'faqSection'>['contactPeople']>['contactPersons']
>[number];

// Sanity Portable Text helper union used across the app
export type PortableTextValue = object | object[] | null | undefined;
