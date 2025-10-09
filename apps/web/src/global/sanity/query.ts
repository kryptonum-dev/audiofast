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

const portableTextFragment = (name: string = 'portableText') => /* groq */ `
  ${name}[]{
    ...,
    _type == "block" => {
      ...,
      ${markDefsFragment()}
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

// Reusable publication fragment for both reviews and blog articles
const publicationFragment = (name: string = 'publication') => /* groq */ `
  ${name} {
  _id,
  _createdAt,
  "slug": slug.current,
  ${portableTextFragment('name')},
  ${portableTextFragment('description')},
  ${imageFragment('image')},
  "publicationType": select(
    _type == "review" => "Recenzja",
    _type == "blog-article" => category->name,
    "Artykuł"
  ),
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
const productFragment = (name: string = 'product') => /* groq */ `
  ${name} {
  _id,
  _createdAt,
  "slug": slug.current,
  name,
  subtitle,
  price,
  isArchived,
  brand->{
    name,
    "slug": slug.current,
    ${imageFragment('logo')},
  },
  "mainImage": ${imageFragment('imageGallery[0]')},
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
    "brands": ${brandFragment('*[_type == "brand" && !(_id in path("drafts.**"))] | order(orderRank)')}
  }
`;

const contactPersonBlock = /* groq */ `
    _type == "contactPerson" => {
    ${imageFragment('image')},
    name,
    phoneNumber,
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
        contactPersons[]{
         ${contactPersonBlock}
        }
      },
      contactForm{
        ${portableTextFragment('heading')},
        buttonText,
        ${formStateFragment('formState')}
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
      contactPersons[]{
        ${contactPersonBlock}
      }
    },
    accountList[]{
      ${portableTextFragment('heading')},
      accountDetails,
    },
    ${formStateFragment('formState')}
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
      ${brandsMarqueeBlock},
      ${brandsListBlock},
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
