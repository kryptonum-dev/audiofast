import { award } from './collections/award';
import { blogArticle } from './collections/blog-article';
import { blogCategory } from './collections/blog-category';
import { brand } from './collections/brand';
import { faq } from './collections/faq';
import { page } from './collections/page';
import { product } from './collections/product';
import { productCategoryParent } from './collections/product-category-parent';
import { productCategorySub } from './collections/product-category-sub';
import { review } from './collections/review';
import { reviewAuthor } from './collections/review-author';
import socialMedia from './collections/social-media';
import { store } from './collections/store';
import { teamMember } from './collections/team-member';
import { blog } from './singletons/blog';
import { brands } from './singletons/brands';
import { comparatorConfig } from './singletons/comparator-config';
import { cpoPage } from './singletons/cpo-page';
import { footer } from './singletons/footer';
import { homePage } from './singletons/home-page';
import { navbar } from './singletons/navbar';
import { notFound } from './singletons/not-found';
import { privacyPolicy } from './singletons/privacy-policy';
import { products } from './singletons/products';
import redirects from './singletons/redirects';
import { settings } from './singletons/settings';
import { termsAndConditions } from './singletons/terms-and-conditions';

export const singletons = [
  homePage,
  settings,
  footer,
  navbar,
  redirects,
  privacyPolicy,
  termsAndConditions,
  notFound,
  blog,
  products,
  brands,
  cpoPage,
  comparatorConfig,
];

export const collection = [
  page,
  faq,
  socialMedia,
  blogArticle,
  blogCategory,
  review,
  reviewAuthor,
  product,
  productCategoryParent,
  productCategorySub,
  store,
  brand,
  teamMember,
  award,
];

export const documents = [...collection, ...singletons];
