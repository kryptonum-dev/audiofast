/**
 * Global declaration of the base url for the application.
 * This constant is used for constructing full URLs and determining external links.
 * @constant
 * @type {string}
 */
export const BASE_URL: string =
  process.env.VERCEL_ENV === 'production'
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_ENV === 'preview'
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

/**
 * Global declaration of the site title for the application.
 * This constant is used for constructing full URLs and determining external links.
 * @constant
 * @type {string}
 */
export const SITE_TITLE: string = 'Audiofast';

/**
 * Global declaration of the site description for the application.
 * This constant is used for constructing full URLs and determining external links.
 * @constant
 * @type {string}
 */
export const SITE_DESCRIPTION: string =
  'Jesteśmy dystrybutorem sprzętu audio klasy premium. Oferujemy wyłącznie starannie wyselekcjonowane marki, które łączą technologiczną precyzję z zapewnieniem doskonałego dźwięku.';

/**
 * Global environment detection for production deployment.
 * True when running in production environment on Vercel production deployment.
 * @constant
 * @type {boolean}
 */
export const IS_PRODUCTION_DEPLOYMENT: boolean =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production';

/**
 * Global declaration of regex.
 * @constant
 * @type {Object}
 */
export const REGEX: { email: RegExp; phone: RegExp; string: RegExp } = {
  email: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  phone:
    /^(?:\+(?:\d{1,3}))?(?:[ -]?\(?\d{1,4}\)?[ -]?\d{1,5}[ -]?\d{1,5}[ -]?\d{1,6})$/,
  string: /^(?!\s+$)(.*?)\s*$/,
};

/**
 * Global declaration of the number of items per page for the blog.
 * @constant
 * @type {number}
 */

export const BLOG_ITEMS_PER_PAGE: number = 12;

/**
 * Global declaration of the number of items per page for the products listing.
 * @constant
 * @type {number}
 */

export const PRODUCTS_ITEMS_PER_PAGE: number = 4;

/**
 * Sort options for product listings.
 * @constant
 * @type {Array<{value: string, label: string}>}
 */
export const PRODUCT_SORT_OPTIONS = [
  { value: 'orderRank', label: 'Od najważniejszych' },
  { value: 'newest', label: 'Od najnowszych' },
  { value: 'oldest', label: 'Od najstarszych' },
  { value: 'priceAsc', label: 'Cena: od najniższej' },
  { value: 'priceDesc', label: 'Cena: od najwyższej' },
];
