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

export const PRODUCTS_ITEMS_PER_PAGE: number = 8;

/**
 * Sort options for product listings.
 * Note: 'relevance' is added dynamically when search is active
 * @constant
 * @type {Array<{value: string, label: string}>}
 */
export const PRODUCT_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'orderRank', label: 'Od najważniejszych' },
  { value: 'newest', label: 'Od najnowszych' },
  { value: 'oldest', label: 'Od najstarszych' },
  { value: 'priceAsc', label: 'Cena: od najniższej' },
  { value: 'priceDesc', label: 'Cena: od najwyższej' },
];

/**
 * Relevance sort option (only shown when search is active)
 * @constant
 * @type {{value: string, label: string}}
 */
export const RELEVANCE_SORT_OPTION: { value: string; label: string } = {
  value: 'relevance',
  label: 'Trafność',
};

/**
 * Fallback email address for form submissions when newsletter settings are not configured
 * @constant
 * @type {string}
 */
export const FALLBACK_SUPPORT_EMAIL: string =
  process.env.RESEND_FROM_EMAIL || 'noreply@audiofast.pl';

/**
 * Fallback email subject for confirmation emails when newsletter settings are not configured
 * @constant
 * @type {string}
 */
export const FALLBACK_EMAIL_SUBJECT: string = 'Dziękujemy za kontakt';

/**
 * Fallback email body text for confirmation emails when newsletter settings are not configured
 * @constant
 * @type {string}
 */
export const FALLBACK_EMAIL_BODY: string =
  '<p>Otrzymaliśmy Twoją wiadomość i skontaktujemy się z Tobą wkrótce.</p>';
