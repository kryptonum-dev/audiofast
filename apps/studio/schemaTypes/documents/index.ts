import { faq } from './collections/faq';
import { page } from './collections/page';
import socialMedia from './collections/social-media';
import { footer } from './singletons/footer';
import { homePage } from './singletons/home-page';
import { navbar } from './singletons/navbar';
import { notFound } from './singletons/not-found';
import { privacyPolicy } from './singletons/privacy-policy';
import redirects from './singletons/redirects';
import { settings } from './singletons/settings';
import { termsAndConditions } from './singletons/terms-and-conditions';
import { blogArticle } from './collections/blog-article';
import { blog } from './singletons/blog';

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
];

export const collection = [page, faq, socialMedia, blogArticle];

export const documents = [...collection, ...singletons];
