/**
 * A small in-memory dataset for evaluating the Presentation GROQ with
 * groq-js (`*.test.ts`). Shapes mirror the audiofast schema: full-path slugs,
 * `/kategoria/<x>/` sub-category slugs, page / pdf / external reviews,
 * internal / external CPO products.
 */
import { evaluate, parse } from 'groq-js';

export type Doc = { _id: string; _type: string } & Record<string, unknown>;

export const slug = (current: string) => ({ _type: 'slug', current });
export const ref = (id: string, key?: string) => ({
  _type: 'reference',
  _ref: id,
  ...(key ? { _key: key } : {}),
});

export const DATASET: Doc[] = [
  { _id: 'homePage', _type: 'homePage', slug: slug('/') },
  { _id: 'products', _type: 'products', slug: slug('/produkty/') },
  {
    _id: 'settings',
    _type: 'settings',
    contactPersons: [ref('team.anna', 'c1')],
  },
  { _id: 'footer', _type: 'footer', social: [ref('social.fb', 's1')] },

  // Brands: one visible, one hidden.
  {
    _id: 'brand.a',
    _type: 'brand',
    name: 'Accuphase',
    slug: slug('/marki/accuphase/'),
    stores: [ref('store.1', 'st1')],
  },
  {
    _id: 'brand.h',
    _type: 'brand',
    name: 'Hidden',
    slug: slug('/marki/hidden/'),
    doNotShowBrand: true,
  },

  // Categories.
  { _id: 'cat.p', _type: 'productCategoryParent', name: 'Elektronika' },
  {
    _id: 'cat.amp',
    _type: 'productCategorySub',
    name: 'Wzmacniacze',
    slug: slug('/kategoria/wzmacniacze/'),
    parentCategory: ref('cat.p'),
  },
  {
    _id: 'cat.dac',
    _type: 'productCategorySub',
    name: 'Przetworniki',
    slug: slug('/kategoria/przetworniki/'),
    parentCategory: ref('cat.p'),
  },

  // Products (orderRank drives the default listing order).
  ...Array.from({ length: 13 }, (_, i) => ({
    _id: `product.${i}`,
    _type: 'product',
    name: `P${i}`,
    orderRank: `0|a${String(i).padStart(3, '0')}:`,
    slug: slug(`/produkty/p${i}/`),
    brand: ref('brand.a'),
    categories: [ref('cat.amp', `k${i}`)],
    denormCategorySlugs: ['/kategoria/wzmacniacze/'],
    reviews: i === 0 ? [ref('review.page', 'r0'), ref('review.pdf', 'r1')] : [],
  })),
  {
    _id: 'product.two-cats',
    _type: 'product',
    name: 'Dwa',
    orderRank: '0|b000:',
    slug: slug('/produkty/dwa/'),
    brand: ref('brand.a'),
    categories: [ref('cat.dac', 'a'), ref('cat.amp', 'b')],
    denormCategorySlugs: [
      '/kategoria/przetworniki/',
      '/kategoria/wzmacniacze/',
    ],
  },
  {
    _id: 'product.archived',
    _type: 'product',
    name: 'Stary',
    orderRank: '0|c000:',
    slug: slug('/produkty/stary/'),
    brand: ref('brand.a'),
    isArchived: true,
    categories: [ref('cat.amp', 'a')],
    denormCategorySlugs: ['/kategoria/wzmacniacze/'],
  },
  {
    _id: 'product.hidden-brand',
    _type: 'product',
    name: 'Ukryty',
    orderRank: '0|d000:',
    slug: slug('/produkty/ukryty/'),
    brand: ref('brand.h'),
    categories: [ref('cat.amp', 'a')],
    denormCategorySlugs: ['/kategoria/wzmacniacze/'],
  },
  {
    _id: 'product.noslug',
    _type: 'product',
    name: 'Bez adresu',
    brand: ref('brand.a'),
  },

  // Reviews.
  {
    _id: 'review.page',
    _type: 'review',
    destinationType: 'page',
    slug: slug('/recenzje/test/'),
  },
  {
    _id: 'review.orphan',
    _type: 'review',
    destinationType: 'page',
    slug: slug('/recenzje/sierota/'),
  },
  {
    _id: 'review.pdf',
    _type: 'review',
    destinationType: 'pdf',
    pdfSlug: slug('/recenzje/pdf/plik/'),
  },
  { _id: 'review.external', _type: 'review', destinationType: 'external' },
  { _id: 'author.1', _type: 'reviewAuthor', name: 'Jan' },

  // Blog.
  {
    _id: 'blog-category.news',
    _type: 'blog-category',
    name: 'Nowości',
    slug: slug('/blog/kategoria/nowosci/'),
  },
  {
    _id: 'article.visible',
    _type: 'blog-article',
    name: 'Widoczny',
    slug: slug('/blog/widoczny/'),
    hideFromList: false,
    publishedDate: '2026-01-01',
    category: ref('blog-category.news'),
  },
  {
    _id: 'article.hidden',
    _type: 'blog-article',
    name: 'Ukryty',
    slug: slug('/blog/ukryty/'),
    hideFromList: true,
    publishedDate: '2026-02-01',
    category: ref('blog-category.news'),
  },

  // CPO.
  {
    _id: 'cpo.internal',
    _type: 'cpoProduct',
    name: 'Używany',
    brandName: 'Accuphase',
    productType: 'internal',
    slug: slug('/certyfikowany-sprzet-uzywany/uzywany/'),
    previewImage: { asset: ref('image-1') },
    publishedDate: '2026-03-01',
  },
  {
    _id: 'cpo.external',
    _type: 'cpoProduct',
    name: 'Zewnętrzny',
    productType: 'external',
    externalUrl: 'https://example.com',
    previewImage: { asset: ref('image-2') },
    publishedDate: '2026-02-01',
  },
  {
    _id: 'cpo.archived',
    _type: 'cpoProduct',
    name: 'Sprzedany',
    productType: 'internal',
    isArchived: true,
    slug: slug('/certyfikowany-sprzet-uzywany/sprzedany/'),
  },

  // Pages and referenced-only documents.
  {
    _id: 'page.o-nas',
    _type: 'page',
    name: 'O nas',
    slug: slug('/o-nas/'),
    pageBuilder: [
      {
        _type: 'teamSection',
        _key: 'b1',
        teamMembers: [ref('team.anna', 't1')],
      },
      { _type: 'faqSection', _key: 'b2', faqList: [ref('faq.1', 'f1')] },
    ],
  },
  {
    _id: 'page.kontakt',
    _type: 'page',
    name: 'Kontakt',
    slug: slug('/kontakt/'),
    pageBuilder: [
      { _type: 'faqSection', _key: 'b1', faqList: [ref('faq.1', 'f1')] },
    ],
  },
  { _id: 'team.anna', _type: 'teamMember', name: 'Anna' },
  { _id: 'team.bob', _type: 'teamMember', name: 'Bob' },
  { _id: 'faq.1', _type: 'faq' },
  { _id: 'faq.unused', _type: 'faq' },
  { _id: 'store.1', _type: 'store', name: 'Salon' },
  { _id: 'social.fb', _type: 'socialMedia', name: 'Facebook' },
  {
    _id: 'award.1',
    _type: 'award',
    name: 'Nagroda',
    products: [ref('product.1', 'a1'), ref('product.2', 'a2')],
  },
];

export async function query<T>(
  groq: string,
  params: Record<string, unknown> = {},
  dataset: Doc[] = DATASET,
): Promise<T> {
  const tree = parse(groq, { params });
  const result = await evaluate(tree, { dataset, params });
  return (await result.get()) as T;
}
