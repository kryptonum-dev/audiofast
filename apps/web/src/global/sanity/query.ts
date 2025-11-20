import { defineQuery } from 'next-sanity';

// ----------------------------------------
// Fragments
// ----------------------------------------

export const imageFragment = (name: string = 'image') => /* groq */ `
  ${name} {
    "id": asset._ref,
    "preview": asset->metadata.lqip,
    "alt": asset->altText,
    "naturalWidth": asset->metadata.dimensions.width,
    "naturalHeight": asset->metadata.dimensions.height,
    hotspot {
      x,
      y,
      width,
      height
    },
    crop {
      bottom,
      left,
      right,
      top
    }
  }
`;

const markDefsFragment = (name: string = 'markDefs[]') => /* groq */ `
  ${name}{
    ...,
    _type == "customLink" => {
    ...,
    customLink{
      type,
      openInNewTab,
      external,
      "href": select(
        type == "internal" => internal->slug.current,
        type == "external" => external,
        "#"
      ),
      "internalSlug": internal->slug.current
    }
  }
  }
`;

// Simple portable text fragment - only basic blocks, no custom components
// Used to prevent circular references (e.g., in product shortDescription)
const portableTextFragment = (name: string = 'portableText') => /* groq */ `
  ${name}[]{
    ...,
    _type == "block" => {
      ...,
      ${markDefsFragment()}
    },
  }
`;

// Portable text fragment that projects ALL possible custom components
// The Studio schema controls which components are available per field
// This fragment fetches everything that might exist, frontend renders what it knows
const portableTextFragmentExtended = (
  name: string = 'portableText'
) => /* groq */ `
  ${name}[]{
    ...,
    _type == "block" => {
      ...,
      ${markDefsFragment()}
    },
    _type == "ptImage" => {
      ...,
      ${imageFragment('image')},
      ${portableTextFragment('caption')},
      ${imageFragment('image1')},
      ${imageFragment('image2')},
    },
    _type == "ptMinimalImage" => {
      ...,
      ${imageFragment('image')},
    },
    _type == "ptArrowList" => {
      ...,
      items[]{
        _key,
        ${portableTextFragment('content')}
      }
    },
    _type == "ptCircleNumberedList" => {
      ...,
      items[]{
        _key,
        ${portableTextFragment('content')}
      }
    },
    _type == "ptCtaSection" => {
      ...,
      button{
        text,
        "href": select(
          url.type == "internal" => url.internal->slug.current,
          url.type == "external" => url.external,
          url.href
        ),
        "openInNewTab": url.openInNewTab
      },
      ${productFragment('products[]->')}
    },
    _type == "ptTwoColumnTable" => {
      ...,
      rows[]{
        _key,
        column1,
        ${portableTextFragment('column2')}
      }
    },
    _type == "ptFeaturedProducts" => {
      ...,
      ${productFragment('products[]->')}
    },
    _type == "ptQuote" => {
      ...,
      ${portableTextFragment('quote')},
    },
    _type == "ptButton" => {
      ...,
      ${buttonFragment('button')},
    },
    _type == "ptHeading" => {
      ...,
      level,
      "iconUrl": icon.asset->url,
      ${portableTextFragment('text')},
    },
    
  }
`;

const buttonFragment = (name: string = 'button') => /* groq */ `
${name}{
  text,
  variant,
  _key,
  _type,
  "openInNewTab": url.openInNewTab,
  "href": select(
    url.type == "internal" => url.internal->slug.current,
    url.type == "external" => url.external,
    url.href
  ),
}
`;

const publicationBlock = /* groq */ `
  _id,
  _type,
  _createdAt,
  name,
  ${portableTextFragment('title')},
  ${portableTextFragment('description')},
  ${imageFragment('image')},
  "publicationType": select(
    _type == "review" => "Recenzja",
    _type == "blog-article" => category->name,
    "Artykuł"
  ),
  "destinationType": select(
    _type == "review" => coalesce(destinationType, "page"),
    "page"
  ),
  "slug": select(
    _type == "review" && destinationType == "page" => slug.current,
    _type == "review" && destinationType == "pdf" => "/recenzje/pdf/" + string::split(lower(pdfFile.asset->originalFilename), ".pdf")[0],
    _type == "review" && destinationType == "external" => externalUrl,
    _type == "blog-article" => slug.current,
    slug.current
  ),
  "openInNewTab": select(
    _type == "review" && destinationType == "external" => true,
    _type == "review" && destinationType == "pdf" => true,
    false
  ),
`;

// Reusable publication fragment for both reviews and blog articles
const publicationFragment = (name: string = 'publication') => /* groq */ `
  ${name} {
  ${publicationBlock}
  }
`;

// Reusable brand fragment for brand listings
const brandFragment = (name: string = 'brand') => /* groq */ `
  ${name} {
  _id,
  _createdAt,
  "slug": slug.current,
  name,
  ${portableTextFragment('description')},
  ${imageFragment('logo')},
  }
`;
// Reusable product fragment for product listings
const productFragment = (name: string = 'product'): string => /* groq */ `
  ${name} {
  _id,
  _createdAt,
  "slug": slug.current,
  name,
  subtitle,
  basePriceCents,
  isArchived,
  categories[]->{
    _id,
    "slug": slug.current,
    name,
  },
  brand->{
    name,
    "slug": slug.current,
    ${imageFragment('logo')},
  },
  "mainImage": select(
    defined(previewImage) => ${imageFragment('previewImage')},
    ${imageFragment('imageGallery[0]')}
  ),
  ${portableTextFragment('shortDescription')},
  }
`;

// Reusable FAQ fragment for FAQ documents
const faqFragment = (name: string = 'faq') => /* groq */ `
  ${name} {
  _id,
  _createdAt,
  question,
  ${portableTextFragment('answer')},
  }
`;

// Reusable team member fragment for team listings
const teamMemberFragment = (name: string = 'teamMember') => /* groq */ `
  ${name} {
  _id,
  name,
  position,
  phoneNumber,
  ${imageFragment('image')},
  ${portableTextFragment('description')},
  }
`;

const formStateFragment = (name: string = 'formState') => /* groq */ `
  ${name}{
    success{
      withIcon,
      ${portableTextFragment('heading')},
      ${portableTextFragment('paragraph')},
      refreshButton,
      refreshButtonText,
    },
    error{
      withIcon,
      ${portableTextFragment('heading')},
      ${portableTextFragment('paragraph')},
      refreshButton,
      refreshButtonText,
    },
  }
`;

// ----------------------------------------
// Page Builder Blocks
// ----------------------------------------

const heroCarouselBlock = /* groq */ `
  _type == "heroCarousel" => {
    ...,
    slides[]{
      ${imageFragment('image')},
      ${buttonFragment('button')},
      ${portableTextFragment('title')},
      ${portableTextFragment('description')},
    },
    brands[]->{
      name,
      "slug": slug.current,
      ${imageFragment('logo')},
    }
  }
`;

const heroStaticBlock = /* groq */ `
  _type == "heroStatic" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${imageFragment('image')},
    ${buttonFragment('button')},
    showBlocks,
    blocksHeading,
    blocks[]{
      _key,
      "iconUrl": icon.asset->url,
      ${portableTextFragment('heading')},
      ${portableTextFragment('description')}
    }
  }
`;

const latestPublicationBlock = /* groq */ `
  _type == "latestPublication" => {
    ...,
    ${portableTextFragment('heading')},
      ${publicationFragment('publication->')}
  }
`;

const imageTextColumnsBlock = /* groq */ `
  _type == "imageTextColumns" => {
    ...,
    ${imageFragment('image')},
    ${portableTextFragment('heading')},
    ${portableTextFragment('content')},
    ${buttonFragment('button')},
  }
`;

const blurLinesTextImageBlock = /* groq */ `
  _type == "blurLinesTextImage" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${imageFragment('image')},
  }
`;

const gallerySectionBlock = /* groq */ `
  _type == "gallerySection" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${imageFragment('images[]')}
  }
`;

const imageWithTextBoxesBlock = /* groq */ `
  _type == "imageWithTextBoxes" => {
    ...,
    ${portableTextFragment('heading')},
    ${imageFragment('image')},
    boxes[]{
      _key,
      "iconUrl": icon.asset->url,
      ${portableTextFragment('heading')},
      ${portableTextFragment('description')},
    },
    cta{
      showCta,
      ${portableTextFragment('ctaParagraph')},
      ${buttonFragment('ctaButton')},
    }
  }
`;

const imageWithVideoBlock = /* groq */ `
  _type == "imageWithVideo" => {
    ...,
    ${imageFragment('image')},
    youtubeId,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
  }
`;

const featuredPublicationsBlock = /* groq */ `
  _type == "featuredPublications" => {
    ...,
    ${portableTextFragment('heading')},
    ${buttonFragment('button')},
    ${publicationFragment('publications[]->')}
  }
`;

const featuredProductsBlock = /* groq */ `
  _type == "featuredProducts" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    ${productFragment('newProducts[]->')},
    ${productFragment('bestsellers[]->')},
  }
`;

const productsCarouselBlock = /* groq */ `
  _type == "productsCarousel" => {
    ...,
    ${portableTextFragment('heading')},
    ${productFragment('products[]->')}
  }
`;

const brandsMarqueeBlock = /* groq */ `
  _type == "brandsMarquee" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    ${imageFragment('backgroundImage')},
    ${brandFragment('topBrands[]->')},
    ${brandFragment('bottomBrands[]->')},
  }
`;

const brandsListBlock = /* groq */ `
  _type == "brandsList" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${portableTextFragment('ctaText')},
    "brands": select(
      brandsDisplayMode == "all" => ${brandFragment('*[_type == "brand" && !(_id in path("drafts.**"))] | order(orderRank)')},
      brandsDisplayMode == "cpoOnly" => ${brandFragment('*[_type == "brand" && !(_id in path("drafts.**")) && count(*[_type == "product" && isCPO == true && brand._ref == ^._id]) > 0] | order(orderRank)')},
      brandsDisplayMode == "manual" => ${brandFragment('selectedBrands[]->  | order(orderRank)')},
      ${brandFragment('*[_type == "brand" && !(_id in path("drafts.**"))] | order(orderRank)')}
    )
  }
`;

const productsListingBlock = /* groq */ `
  _type == "productsListing" => {
    ...,
    ${portableTextFragment('heading')},
    "categories": *[_type == "productCategorySub" && defined(slug.current)] {
      _id,
      name,
      description,
      "slug": slug.current,
      parentCategory->{
        _id,
        name,
        "slug": slug.current
      },
      "count": count(*[
        _type == "product" 
        && defined(slug.current)
        && (^.cpoOnly == false || isCPO == true)
        && count(categories) > 0
        && references(^._id)
      ])
    } [count > 0] | order(orderRank),
    "totalCount": count(*[
      _type == "product" 
      && defined(slug.current)
      && (^.cpoOnly == false || isCPO == true)
      && count(categories) > 0
    ])
  }
`;

const brandsByCategoriesSectionBlock = /* groq */ `
  _type == "brandsByCategoriesSection" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    "categoriesWithBrands": *[_type == "productCategoryParent" && !(_id in path("drafts.**"))] | order(orderRank) {
      _id,
      name,
      "brands": array::unique(
        *[
          _type == "product" && 
          !(_id in path("drafts.**")) && 
          ^._id in categories[]->parentCategory._ref
        ].brand->{_id, name, "slug": slug.current}
      )
    }[count(brands) > 0]
  }
`;

const faqSectionBlock = /* groq */ `
  _type == "faqSection" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    displayMode,
    ${faqFragment('faqList[]->')},
      contactPeople{
        ${portableTextFragment('heading')},
        ${teamMemberFragment('contactPersons[]->')}
      },
      contactForm{
        ${portableTextFragment('heading')},
        buttonText,
        ${formStateFragment('formState')}
      },
    "newsletterSettings": *[_type == "newsletterSettings"][0] {
      supportEmails,
      confirmationEmail {
        subject,
        ${portableTextFragmentExtended('content')}
      }
    }
  }
`;

const contactFormBlock = /* groq */ `
  _type == "contactForm" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    contactPeople{
      ${portableTextFragment('heading')},
      ${teamMemberFragment('contactPersons[]->')}
    },
    accountList[]{
      ${portableTextFragment('heading')},
      accountDetails,
    },
    ${formStateFragment('formState')},
    "newsletterSettings": *[_type == "newsletterSettings"][0] {
      supportEmails,
      confirmationEmail {
        subject,
        ${portableTextFragmentExtended('content')}
      }
    }
  }
`;

const contactMapBlock = /* groq */ `
  _type == "contactMap" => {
    ...,
    ${portableTextFragment('heading')},
    useCustomAddress,
    customAddress,
    customPhone,
    customEmail,
  }
`;

const teamSectionBlock = /* groq */ `
  _type == "teamSection" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    variant,
    ${teamMemberFragment('teamMembers[]->')},
    ${portableTextFragment('secondaryHeading')},
    ${portableTextFragment('secondaryDescription')},
    ${buttonFragment('ctaButton')},
  }
`;

const phoneImageCtaBlock = /* groq */ `
  _type == "phoneImageCta" => {
    ...,
    ${imageFragment('image')},
    ${portableTextFragment('primaryHeading')},
    ${portableTextFragment('primaryDescription')},
    ${buttonFragment('ctaButton')},
    ${portableTextFragment('secondaryHeading')},
    ${portableTextFragment('secondaryDescription')},
    phoneNumber,
  }
`;

const stepListBlock = /* groq */ `
  _type == "stepList" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('paragraph')},
    steps[]{
      _key,
      ${portableTextFragment('heading')},
      ${portableTextFragment('description')},
    }
  }
`;

export const pageBuilderFragment = /* groq */ `
  pageBuilder[]{
    ...,
    _type,
      ${heroCarouselBlock},
      ${heroStaticBlock},
      ${latestPublicationBlock},
      ${imageTextColumnsBlock},
      ${blurLinesTextImageBlock},
      ${imageWithVideoBlock},
      ${imageWithTextBoxesBlock},
      ${featuredPublicationsBlock},
      ${featuredProductsBlock},
      ${productsCarouselBlock},
      ${brandsMarqueeBlock},
      ${brandsListBlock},
      ${productsListingBlock},
      ${brandsByCategoriesSectionBlock},
      ${faqSectionBlock},
      ${contactFormBlock},
      ${contactMapBlock},
      ${teamSectionBlock},
      ${gallerySectionBlock},
      ${phoneImageCtaBlock},
      ${stepListBlock}
  }
`;

// ----------------------------------------
// Queries
// ----------------------------------------

export const queryDefaultOGImage = defineQuery(`*[_type == "settings"][0]{
  "defaultOGImage": seo.img.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100"
}`);

export const querySettings = defineQuery(`*[_type == "settings"][0]{
  address {
    streetAddress,
    postalCode,
    city,
    country
  },
  email,
  tel,
  analytics {
    gtm_id,
    ga4_id,
    googleAds_id,
    metaPixelId
  },
  structuredData {
    companyName,
    companyDescription,
    "logo": logo.asset->url,
    geo {
      latitude,
      longitude
    },
    priceRange,
  },
  "socialMedia": *[_type == "socialMedia" && defined(link)].link,
}`);

export const queryNavbar = defineQuery(`*[_type == "navbar"][0]{
  ${buttonFragment('buttons[]')}
}`);

export const queryFooter = defineQuery(`*[_type == "footer"][0]{
  highlightedSocialMedia[]->{
    name,
    link,
    iconString,
  },
  ${buttonFragment('links[]')},
  newsletter{
    label,
    buttonLabel,
    ${formStateFragment('formState')}
  }
}`);

export const queryHomePage =
  defineQuery(`*[_type == "homePage" && _id == "homePage"][0]{
    _id,
    _type,
    "slug": slug.current,
    name,
    seo,
    openGraph{
      title,
      description,
      "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
    },
    "firstBlockType": pageBuilder[0]._type,
    ${pageBuilderFragment}
  }`);

export const queryAllPageSlugs = defineQuery(`*[_type == "page"]{
  "slug": slug.current
}`);

export const queryPageBySlug =
  defineQuery(`*[_type == "page" && slug.current == $slug][0]{
  _id,
  _type,
  "slug": slug.current,
  name,
  seo,
  doNotIndex,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  },
  "firstBlockType": pageBuilder[0]._type,
  ${pageBuilderFragment}
}`);

export const queryNotFoundPage = defineQuery(`*[_type == "notFound"][0]{
  _id,
  _type,
  "slug": slug.current,
  name,
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  },
  ${imageFragment('backgroundImage')},
  ${portableTextFragment('heading')},
  ${portableTextFragment('description')},
  ${buttonFragment('buttons[]')}
}`);

export const queryPrivacyPolicy = defineQuery(`*[_type == "privacyPolicy"][0]{
  _id,
  _type,
  "slug": slug.current,
  name,
  ${portableTextFragment('description')},
  ${portableTextFragment('content')},
  "headings": content[length(style) == 2 && string::startsWith(style, "h")],
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  }
}`);

export const queryTermsAndConditions =
  defineQuery(`*[_type == "termsAndConditions"][0]{
  _id,
  _type,
  "slug": slug.current,
  name,
  ${portableTextFragment('description')},
  ${portableTextFragment('content')},
  "headings": content[length(style) == 2 && string::startsWith(style, "h")],
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  }
}`);

export const queryCpoPage = defineQuery(`*[_type == "cpoPage"][0]{
  _id,
  _type,
  "slug": slug.current,
  name,
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  },
  "firstBlockType": pageBuilder[0]._type,
  ${pageBuilderFragment}
}`);

export const queryAllBlogPostSlugs =
  defineQuery(`*[_type == "blog-article" && defined(slug.current) && !(_id in path("drafts.**"))]{
  "slug": slug.current
}`);

export const queryBlogPostBySlug =
  defineQuery(`*[_type == "blog-article" && slug.current == $slug][0]{
  _id,
  _type,
  _createdAt,
  _updatedAt,
  "slug": slug.current,
  name,
  ${portableTextFragment('title')},
  ${portableTextFragment('description')},
  ${imageFragment('image')},
  "category": category->{
    _id,
    name,
    "slug": slug.current,
  },
  "author": author->{
    _id,
    name,
    position,
    ${imageFragment('image')},
  },
  keywords,
  ${portableTextFragmentExtended('content')},
  "headings": content[length(style) == 2 && string::startsWith(style, "h")],
  ${pageBuilderFragment},
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  }
}`);

export const queryAllReviewSlugs =
  defineQuery(`*[_type == "review" && destinationType == "page" && defined(slug.current) && !(_id in path("drafts.**"))]{
  "slug": slug.current
}`);

export const queryReviewBySlug =
  defineQuery(`*[_type == "review" && destinationType == "page" && slug.current == $slug][0]{
  _id,
  _type,
  _createdAt,
  "slug": slug.current,
  name,
  ${portableTextFragment('title')},
  ${portableTextFragment('description')},
  ${imageFragment('image')},
  overrideGallery,
  ${imageFragment('imageGallery[]')},
  ${portableTextFragmentExtended('content')},
  "headings": content[length(style) == 2 && string::startsWith(style, "h")],
  "product": *[_type == "product" && references(^._id)][0]{
    _id,
    _createdAt,
    "slug": slug.current,
    name,
    subtitle,
    basePriceCents,
    isArchived,
    "brand": brand->{
      name,
      "slug": slug.current,
      ${imageFragment('logo')},
    },
    "mainImage": select(
      defined(previewImage) => ${imageFragment('previewImage')},
      ${imageFragment('imageGallery[0]')}
    ),
    ${imageFragment('imageGallery[]')},
    ${portableTextFragment('shortDescription')},
  },
  "gallery": select(
    overrideGallery == true && count(imageGallery) >= 4 => ${imageFragment('imageGallery[]')},
    ${imageFragment('*[_type == "product" && references(^._id)][0].imageGallery[]')}
  ),
  ${pageBuilderFragment},
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  }
}`);

export const queryPdfReviewBySlug =
  defineQuery(`*[_type == "review" && destinationType == "pdf" && string::split(lower(pdfFile.asset->originalFilename), ".pdf")[0] == $slug][0]{
  _id,
  name,
  ${portableTextFragment('title')},
  "pdfUrl": pdfFile.asset->url,
  "pdfFilename": pdfFile.asset->originalFilename,
  "pdfSize": pdfFile.asset->size,
  "pdfMimeType": pdfFile.asset->mimeType
}`);

// Query for blog page data (layout, categories, current category, SEO)
// Parameters:
// - $category: category slug (optional) - empty string "" for main blog page
export const queryBlogPageData = defineQuery(`
  *[_type == "blog"][0] {
    _id,
    _type,
    "slug": slug.current,
    name,
    ${portableTextFragment('title')},
    ${portableTextFragment('description')},
    ${imageFragment('heroImage')},
    ${pageBuilderFragment},
    seo,
    openGraph{
      title,
      description,
      "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
    },
    "selectedCategory": select(
      $category != "" => *[_type == "blog-category" && slug.current == $category][0]{
        _id,
        name,
        "slug": slug.current,
        ${portableTextFragment('title')},
        ${portableTextFragment('description')},
        seo,
        openGraph{
          title,
          description,
          "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        }
      },
      null
    ),
    "categories": *[_type == "blog-category" && defined(slug.current)] | order(orderRank){
      _id,
      name,
      "slug": slug.current,
      "count": count(*[_type == "blog-article" && category._ref == ^._id && !hideFromList])
    },
    "totalCount": count(*[_type == "blog-article" && defined(slug.current) && !hideFromList])
  }
`);

// Query for blog articles only (filtered and paginated)
// Parameters:
// - $category: category slug (optional) - empty string "" for all articles
// - $search: search term (optional) - empty string "" for no search
// - $offset: pagination offset (e.g., 0, 6, 12)
// - $limit: pagination limit (e.g., 6)
// - $embeddingResults: embeddings API results for semantic search (optional)
// - $sortBy: sort order - 'relevance' for embeddings score, 'newest' for date (default: 'newest')

// ----------------------------------------
// Shared fragments for blog articles listing
// ----------------------------------------

// Shared filter conditions for blog articles (used in both query and count)
const blogArticlesFilterConditions = /* groq */ `
  _type == "blog-article" 
  && defined(slug.current)
  && !hideFromList
  && ($category == "" || category->slug.current == $category)
  && ($search == "" || count($embeddingResults) > 0 || [name, pt::text(title)] match $search)
  && (count($embeddingResults) == 0 || _id in $embeddingResults[].value.documentId)
`;

// Shared projection fields for blog articles (the {...} block)
const blogArticlesProjection = /* groq */ `
  ${publicationBlock}
  "_score": select(
    count($embeddingResults) > 0 => $embeddingResults[value.documentId == ^._id][0].score,
    0
  )
`;

// Shared inline score calculation for relevance sorting
const blogArticlesRelevanceScore = /* groq */ `
  select(
    count($embeddingResults) > 0 => $embeddingResults[value.documentId == ^._id][0].score,
    0
  )
`;

// Helper function to create blog articles query with different sort orders
const blogArticlesFragment = (orderClause: string) => /* groq */ `
  {
    "articles": *[${blogArticlesFilterConditions}] | order(${orderClause}) [$offset...$limit] {
      ${blogArticlesProjection}
    },
    "totalCount": count(*[${blogArticlesFilterConditions}])
  }
`;

// Blog articles query sorted by date (newest first)
export const queryBlogArticlesNewest = defineQuery(
  blogArticlesFragment('_createdAt desc')
);

// Special query for blog relevance sorting that calculates score inline
const blogArticlesRelevanceFragment = /* groq */ `
  {
    "articles": *[${blogArticlesFilterConditions}] | order(${blogArticlesRelevanceScore} desc) [$offset...$limit] {
      ${blogArticlesProjection}
    },
    "totalCount": count(*[${blogArticlesFilterConditions}])
  }
`;

// Blog articles query sorted by relevance score (for semantic search)
export const queryBlogArticlesRelevance = defineQuery(
  blogArticlesRelevanceFragment
);

// Helper function to get the correct blog query based on sortBy parameter
export function getBlogArticlesQuery(sortBy: string = 'newest') {
  switch (sortBy) {
    case 'relevance':
      return queryBlogArticlesRelevance;
    case 'newest':
    default:
      return queryBlogArticlesNewest;
  }
}

// Default export for backward compatibility (newest first)
export const queryBlogArticles = queryBlogArticlesNewest;

// ----------------------------------------
// Products Queries
// ----------------------------------------

// ----------------------------------------
// Products Filter Metadata Fragment
// ----------------------------------------
// Reusable fragment for filter metadata (categories, brands, price ranges, counts)
// Used in both products page and brand pages to avoid duplication
// Parameters:
// - $category: category slug filter
// - $brands: array of brand slugs filter
// - $minPrice: minimum price filter
// - $maxPrice: maximum price filter
// - $customFilters: array of custom filter objects
const productsFilterMetadataFragment = () => /* groq */ `
  "categories": *[_type == "productCategorySub" && defined(slug.current)] {
    _id,
    name,
    description,
    "slug": slug.current,
    parentCategory->{
      _id,
      name,
      "slug": slug.current
    },
    "count": count(*[
      _type == "product" 
      && defined(slug.current)
      && count(categories) > 0
      && references(^._id)
      && ($category == "" || $category in categories[]->slug.current)
      && (count($brands) == 0 || string::split(brand->slug.current, "/")[2] in $brands)
      && (
        ($minPrice == 0 && $maxPrice == 999999999) ||
        (defined(basePriceCents) && basePriceCents >= $minPrice && basePriceCents <= $maxPrice)
      )
      && (
        count($customFilters) == 0 ||
        count($customFilters) <= count(customFilterValues[
          select(
            count($customFilters[filterName == ^.filterName && value == ^.value]) > 0 => true,
            false
          )
        ])
      )
    ])
  } [count > 0] | order(orderRank),
  "categoriesAll": *[_type == "productCategorySub" && defined(slug.current)] {
    _id,
    name,
    description,
    "slug": slug.current,
    parentCategory->{
      _id,
      name,
      "slug": slug.current
    },
    "count": count(*[
      _type == "product" 
      && defined(slug.current)
      && count(categories) > 0
      && references(^._id)
      && (count($brands) == 0 || string::split(brand->slug.current, "/")[2] in $brands)
      && (
        ($minPrice == 0 && $maxPrice == 999999999) ||
        (defined(basePriceCents) && basePriceCents >= $minPrice && basePriceCents <= $maxPrice)
      )
    ])
  } [count > 0] | order(orderRank),
  "brands": *[_type == "brand" && defined(slug.current)] {
    _id,
    name,
    "slug": slug.current,
    ${imageFragment('logo')},
    "count": count(*[
      _type == "product" 
      && defined(slug.current)
      && count(categories) > 0
      && brand._ref == ^._id
      && ($category == "" || $category in categories[]->slug.current)
      && (
        ($minPrice == 0 && $maxPrice == 999999999) ||
        (defined(basePriceCents) && basePriceCents >= $minPrice && basePriceCents <= $maxPrice)
      )
      && (
        count($customFilters) == 0 ||
        count($customFilters) <= count(customFilterValues[
          select(
            count($customFilters[filterName == ^.filterName && value == ^.value]) > 0 => true,
            false
          )
        ])
      )
    ])
  } [count > 0] | order(orderRank),
  "totalCount": count(*[
    _type == "product" 
    && defined(slug.current)
    && count(categories) > 0
    && ($category == "" || $category in categories[]->slug.current)
    && (count($brands) == 0 || string::split(brand->slug.current, "/")[2] in $brands)
    && (
      ($minPrice == 0 && $maxPrice == 999999999) ||
      (defined(basePriceCents) && basePriceCents >= $minPrice && basePriceCents <= $maxPrice)
    )
    && (
      count($customFilters) == 0 ||
      count($customFilters) <= count(customFilterValues[
        select(
          count($customFilters[filterName == ^.filterName && value == ^.value]) > 0 => true,
          false
        )
      ])
    )
  ]),
  "totalCountAll": count(*[
    _type == "product" 
    && defined(slug.current)
    && count(categories) > 0
    && (count($brands) == 0 || string::split(brand->slug.current, "/")[2] in $brands)
    && (
      ($minPrice == 0 && $maxPrice == 999999999) ||
      (defined(basePriceCents) && basePriceCents >= $minPrice && basePriceCents <= $maxPrice)
    )
  ]),
  "maxPrice": math::max(*[
    _type == "product" 
    && defined(slug.current)
    && count(categories) > 0
    && defined(basePriceCents)
    && ($category == "" || $category in categories[]->slug.current)
    && (count($brands) == 0 || string::split(brand->slug.current, "/")[2] in $brands)
    && (
      count($customFilters) == 0 ||
      count($customFilters) <= count(customFilterValues[
        select(
          count($customFilters[filterName == ^.filterName && value == ^.value]) > 0 => true,
          false
        )
      ])
    )
  ].basePriceCents),
  "minPrice": math::min(*[
    _type == "product" 
    && defined(slug.current)
    && count(categories) > 0
    && defined(basePriceCents)
    && ($category == "" || $category in categories[]->slug.current)
    && (count($brands) == 0 || string::split(brand->slug.current, "/")[2] in $brands)
    && (
      count($customFilters) == 0 ||
      count($customFilters) <= count(customFilterValues[
        select(
          count($customFilters[filterName == ^.filterName && value == ^.value]) > 0 => true,
          false
        )
      ])
    )
  ].basePriceCents)
`;

// Query for brands page data (layout, SEO)
export const queryBrandsPageData = defineQuery(`
  *[_type == "brands"][0] {
    _id,
    _type,
    "slug": slug.current,
    name,
    ${pageBuilderFragment},
    seo,
    openGraph{
      title,
      description,
      "seoImage": select(
        defined(openGraph.image) => openGraph.image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        null
      ),
    }
  }
`);

// Query for products page data (layout, categories, current category, SEO)
// Now includes filter-aware counts for categories, brands, and price range
// Parameters:
// - $category: category slug (optional) - empty string "" for main products page
// - $search: search term (optional) - empty string "" for no search
// - $brands: array of brand slugs (optional) - empty array [] for all brands
// - $minPrice: minimum price (optional) - 0 for no minimum
// - $maxPrice: maximum price (optional) - 999999999 for no maximum
// - $customFilters: array of custom filter objects (optional) - empty array [] for no custom filters
export const queryProductsPageData = defineQuery(`
  *[_type == "products"][0] {
    _id,
    _type,
    "slug": slug.current,
    name,
    ${portableTextFragment('title')},
    ${portableTextFragment('description')},
    ${imageFragment('heroImage')},
    ${pageBuilderFragment},
    seo,
    openGraph{
      title,
      description,
      "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
    },
    "selectedCategory": select(
      $category != "" => *[_type == "productCategorySub" && slug.current == $category][0]{
        _id,
        name,
        "slug": slug.current,
        ${portableTextFragment('title')},
        ${portableTextFragment('description')},
        ${imageFragment('heroImage')},
        customFilters,
        "productsWithFilters": *[
          _type == "product" 
          && defined(slug.current)
          && count(categories) > 0
          && $category in categories[]->slug.current
          && defined(customFilterValues)
          && (count($brands) == 0 || string::split(brand->slug.current, "/")[2] in $brands)
          && (
            ($minPrice == 0 && $maxPrice == 999999999) ||
            (defined(basePriceCents) && basePriceCents >= $minPrice && basePriceCents <= $maxPrice)
          )
        ]{
          _id,
          customFilterValues
        },
        ${pageBuilderFragment},
        seo,
        openGraph{
          title,
          description,
          "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        },
        parentCategory->{
          _id,
          name,
          "slug": slug.current
        }
      },
      null
    ),
    ${productsFilterMetadataFragment()}
  }
`);

// ----------------------------------------
// Shared fragments for products listing
// ----------------------------------------

// Shared filter conditions for products (used in both query and count)
const productsFilterConditions = /* groq */ `
  _type == "product" 
  && defined(slug.current)
  && count(categories) > 0
  && ($category == "" || $category in categories[]->slug.current)
  && ($search == "" || count($embeddingResults) > 0 || [name, subtitle, brand->name, pt::text(shortDescription)] match $search)
  && (count($brands) == 0 || string::split(brand->slug.current, "/")[2] in $brands)
  && (
    ($minPrice == 0 && $maxPrice == 999999999) ||
    (defined(basePriceCents) && basePriceCents >= $minPrice && basePriceCents <= $maxPrice)
  )
  && (
    count($customFilters) == 0 ||
    count($customFilters) <= count(customFilterValues[
      select(
        count($customFilters[filterName == ^.filterName && value == ^.value]) > 0 => true,
        false
      )
    ])
  )
  && ($isCPO == false || isCPO == true)
  && (count($embeddingResults) == 0 || _id in $embeddingResults[].value.documentId)
`;

// Shared projection fields for products (the {...} block)
const productsProjection = /* groq */ `
  _id,
  _createdAt,
  name,
  subtitle,
  "slug": slug.current,
  basePriceCents,
  isArchived,
  "categories": categories[]->{
    _id,
    name,
    "slug": slug.current
  },
  brand->{
    name,
    "slug": slug.current,
    ${imageFragment('logo')}
  },
  "mainImage": select(
    defined(previewImage) => ${imageFragment('previewImage')},
    ${imageFragment('imageGallery[0]')}
  ),
  ${portableTextFragment('shortDescription')},
  "_score": select(
    count($embeddingResults) > 0 => $embeddingResults[value.documentId == ^._id][0].score,
    0
  )
`;

// Shared inline score calculation for relevance sorting
const productsRelevanceScore = /* groq */ `
  select(
    count($embeddingResults) > 0 => $embeddingResults[value.documentId == ^._id][0].score,
    0
  )
`;

// Reusable fragment for products listing logic
// This avoids code duplication across different sort queries
// NEW: Added support for embeddings-based semantic search via $embeddingResults parameter
const productsListingFragment = (orderClause: string) => /* groq */ `
  {
    "products": *[${productsFilterConditions}] | order(${orderClause}) [$offset...$limit] {
      ${productsProjection}
    },
    "totalCount": count(*[${productsFilterConditions}])
  }
`;

// Query for products listing (filtered and paginated)
// Parameters:
// - $category: category slug (optional) - empty string "" for all products
// - $search: search term (optional) - empty string "" for no search
// - $offset: pagination offset (e.g., 0, 12, 24)
// - $limit: pagination limit (e.g., 12)
// - $brands: array of brand names/slugs (optional) - empty array [] for all brands
//   Note: Brand filtering checks both brand name and slug (without /marki/ prefix)
// - $minPrice: minimum price (optional) - 0 for no minimum
// - $maxPrice: maximum price (optional) - 999999999 for no maximum
// - $customFilters: array of custom filter objects (optional) - empty array [] for no custom filters
//   Format: [{filterName: "Długość kabla", value: "2m"}, ...]
//   Note: ALL custom filters must match (AND logic)
// - $isCPO: boolean to filter CPO products only (optional) - false for all products

// Static queries for each sort type (required for typegen)
export const queryProductsListingNewest = defineQuery(
  productsListingFragment('_createdAt desc')
);

export const queryProductsListingOldest = defineQuery(
  productsListingFragment('_createdAt asc')
);

export const queryProductsListingPriceAsc = defineQuery(
  productsListingFragment('coalesce(basePriceCents, 999999999) asc')
);

export const queryProductsListingPriceDesc = defineQuery(
  productsListingFragment('coalesce(basePriceCents, -1) desc')
);

export const queryProductsListingOrderRank = defineQuery(
  productsListingFragment('orderRank asc')
);

// Special query for relevance sorting that calculates score inline
const productsListingRelevanceFragment = /* groq */ `
  {
    "products": *[${productsFilterConditions}] | order(${productsRelevanceScore} desc) [$offset...$limit] {
      ${productsProjection}
    },
    "totalCount": count(*[${productsFilterConditions}])
  }
`;

export const queryProductsListingRelevance = defineQuery(
  productsListingRelevanceFragment
);

// Helper function to get the correct query based on sortBy parameter
export function getProductsListingQuery(sortBy: string = 'newest') {
  switch (sortBy) {
    case 'relevance':
      return queryProductsListingRelevance;
    case 'oldest':
      return queryProductsListingOldest;
    case 'priceAsc':
      return queryProductsListingPriceAsc;
    case 'priceDesc':
      return queryProductsListingPriceDesc;
    case 'orderRank':
      return queryProductsListingOrderRank;
    case 'newest':
    default:
      return queryProductsListingNewest;
  }
}

// Default export for backward compatibility (newest first)
export const queryProductsListing = queryProductsListingNewest;

// Lightweight query for category metadata only
// Used to validate custom filters before main query
export const queryCategoryMetadata = defineQuery(`
  *[_type == "productCategorySub" && slug.current == $category][0]{
    _id,
    name,
    "slug": slug.current,
    customFilters
  }
`);

// ----------------------------------------
// Brand Queries
// ----------------------------------------

// Brand detail query with products filter metadata
// Fetches both brand data AND filter metadata in a single API call
// NOTE: Metadata does NOT filter by search/embeddings - it shows ALL products
// Parameters:
// - $slug: brand slug (e.g., "/marki/yamaha/")
// - $category: category slug filter (optional) - empty string "" for all categories
// - $brands: array of brand slugs filter (optional) - empty array [] for all brands
// - $minPrice: minimum price filter (optional) - 0 for no minimum
// - $maxPrice: maximum price filter (optional) - 999999999 for no maximum
// - $customFilters: array of custom filter objects (optional) - empty array [] for no custom filters
export const queryBrandBySlug = defineQuery(/* groq */ `
  *[_type == "brand" && slug.current == $slug][0] {
    _id,
    name,
    "slug": slug.current,
    ${imageFragment('logo')},
    ${portableTextFragmentExtended('description')},
    ${imageFragment('heroImage')},
    ${imageFragment('bannerImage')},
    distributionYear {
      year,
      ${imageFragment('backgroundImage')},
    },
    ${portableTextFragment('brandDescriptionHeading')},
    ${portableTextFragmentExtended('brandDescription')},
    ${imageFragment('imageGallery[]')},
    ${publicationFragment('featuredReviews[]->')},
    "stores": array::unique(
      *[
        _type == "product" && 
        !(_id in path("drafts.**")) && 
        brand._ref == ^._id &&
        defined(availableInStores)
      ].availableInStores[]->{_id, name, "slug": slug.current, address{postalCode, city, street}, phone, website}
    ),
    seo {
      title,
      description,
      ${imageFragment('ogImage')}
    },
    openGraph {
      title,
      description,
      "seoImage": ogImage.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100"
    },
    ${productsFilterMetadataFragment()}
  }
`);

// Get all brand slugs for static generation
export const queryAllBrandSlugs = defineQuery(/* groq */ `
  *[_type == "brand" && defined(slug.current) && !(_id in path("drafts.**"))] {
    "slug": slug.current
  }
`);

// ----------------------------------------
// Product Detail Queries
// ----------------------------------------

// Product detail query
export const queryProductBySlug = defineQuery(/* groq */ `
  *[_type == "product" && slug.current == $slug][0] {
    _id,
    name,
    subtitle,
    "slug": slug.current,
    basePriceCents,
    isArchived,
    ${imageFragment('imageGallery[]')},
    ${portableTextFragment('shortDescription')},
    brand->{
      _id,
      name,
      "slug": slug.current,
      ${imageFragment('logo')}
    },
    "awards": *[_type == "award" && references(^._id)]{
      _id,
      name,
      ${imageFragment('logo')}
    },
    details{
      ${portableTextFragment('heading')},
      ${portableTextFragmentExtended('content')}
    },
    technicalData[]{
      title,
      ${portableTextFragment('value')}
    },
    availableInStores[]->{
      _id,
      name,
      "slug": slug.current,
      address{
        postalCode,
        city,
        street
      },
      phone,
      website
    },
    "categories": categories[]->{
      _id,
      name,
      "slug": slug.current
    },
    reviews[]->{
      ${publicationBlock}
    },
    ${productFragment('relatedProducts[]->')},
    ${pageBuilderFragment},
        seo {
      title,
      description
    },
    openGraph {
      title,
      description,
      image{
        ${imageFragment()}
      },
      "seoImage": select(
        defined(openGraph.image) => openGraph.image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        defined(imageGallery[0]) => imageGallery[0].asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        null
      )
    }
  }
`);

// Get all product slugs for static generation
export const queryAllProductSlugs = defineQuery(/* groq */ `
  *[_type == "product" && defined(slug.current) && !(_id in path("drafts.**"))] {
    "slug": slug.current
  }
`);

// ----------------------------------------
// Comparison Queries
// ----------------------------------------

// Query 1: Get Products for Comparison (Minimal Data)
// Used for FloatingComparisonBox - minimal data for fast loading
// Parameters:
// - $productIds: array of product IDs to fetch
export const queryComparisonProductsMinimal = defineQuery(/* groq */ `
  *[_type == "product" && _id in $productIds] {
    _id,
    name,
    "slug": slug.current,
    subtitle,
    basePriceCents,
    "mainImage": select(
      defined(previewImage) => ${imageFragment('previewImage')},
      ${imageFragment('imageGallery[0]')}
    ),
    brand->{
      _id,
      name,
      "slug": slug.current,
      ${imageFragment('logo')}
    },
    "categories": categories[]->{
      "slug": slug.current
    }
  }
`);

// Query 2: Get Full Product Details for Comparison Page
// Used for Comparison Page - includes full technical data
// Parameters:
// - $productIds: array of product IDs to fetch
export const queryComparisonProductsFull = defineQuery(/* groq */ `
  *[_type == "product" && _id in $productIds] {
    _id,
    name,
    "slug": slug.current,
    subtitle,
    basePriceCents,
    "mainImage": select(
      defined(previewImage) => ${imageFragment('previewImage')},
      ${imageFragment('imageGallery[0]')}
    ),
    "imageSource": select(
      defined(previewImage) => "preview",
      "gallery"
    ),
    brand->{
      _id,
      name,
      "slug": slug.current,
      ${imageFragment('logo')}
    },
    technicalData[] {
      title,
      ${portableTextFragment('value')}
    },
    "categories": categories[]->{
      "slug": slug.current
    }
  }
`);

// Query 3: Get ALL Products from Category for Comparison (FULL DATA)
// Used for comparison page - fetches ALL products with FULL technical data
// This enables instant add/remove with zero loading time
// Parameters:
// - $categorySlug: category slug to filter by
export const queryAllCategoryProductsForComparison = defineQuery(/* groq */ `
  *[_type == "product" && !(_id in path("drafts.**")) && $categorySlug in categories[]->slug.current] | order(name asc) {
    _id,
    name,
    "slug": slug.current,
    subtitle,
    basePriceCents,
    "mainImage": select(
      defined(previewImage) => ${imageFragment('previewImage')},
      ${imageFragment('imageGallery[0]')}
    ),
    "imageSource": select(
      defined(previewImage) => "preview",
      "gallery"
    ),
    brand->{
      _id,
      name,
      "slug": slug.current,
      ${imageFragment('logo')}
    },
    technicalData[] {
      title,
      ${portableTextFragment('value')}
    },
    "categories": categories[]->{
      "slug": slug.current
    }
  }
`);

export const queryContactSettings = defineQuery(/* groq */ `
  *[_type == "settings"][0].contactSettings {
    supportEmails,
    confirmationEmail {
      subject,
      ${portableTextFragment('content')}
    }
  } 
`);

export const queryMailchimpSettings = defineQuery(/* groq */ `
  *[_type == "settings"][0].mailchimpAudienceId
`);
