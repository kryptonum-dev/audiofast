import type {
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
