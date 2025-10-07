import { defineQuery } from 'next-sanity';

export const imageFields = /* groq */ `
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
`;
// Base fragments for reusable query parts
export const imageFragment = (name: string = 'image') => /* groq */ `
  ${name} {
    ${imageFields}
  }
`;

const customLinkFragment = /* groq */ `
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
`;

const markDefsFragment = /* groq */ `
  markDefs[]{
    ...,
    ${customLinkFragment}
  }
`;

const portableTextFragment = (name: string = 'portableText') => /* groq */ `
  ${name}[]{
    ...,
    _type == "block" => {
      ...,
      ${markDefsFragment}
    },

  }
`;

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

const buttonWithNoVariantFragment = (name: string = 'button') => /* groq */ `
${name}{
  text,
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

const heroBlock = /* groq */ `
  _type == "hero" => {
    ...,
    slides[]{
      ${imageFragment('image')},
      ${imageFragment('mobileImage')},
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

// Reusable publication fragment for both reviews and blog articles
const publicationFragment = /* groq */ `
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
`;

// Reusable brand fragment for brand listings
const brandFragment = /* groq */ `
  _id,
  _createdAt,
  "slug": slug.current,
  name,
  ${portableTextFragment('description')},
  ${imageFragment('logo')},
`;

// Reusable product fragment for product listings
const productFragment = /* groq */ `
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
  "mainImage": imageGallery[0] {
    ${imageFields}
  },
  ${portableTextFragment('shortDescription')},
`;

// Reusable FAQ fragment for FAQ documents
const faqFragment = /* groq */ `
  _id,
  _createdAt,
  question,
  ${portableTextFragment('answer')},
`;

// Reusable team member fragment for team listings
const teamMemberFragment = /* groq */ `
  _id,
  name,
  position,
  phoneNumber,
  ${imageFragment('image')},
  ${portableTextFragment('description')},
`;

const latestPublicationBlock = /* groq */ `
  _type == "latestPublication" => {
    ...,
    ${portableTextFragment('heading')},
    publication->{
      ${publicationFragment}
    }
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
    images[] {
      ${imageFields}
    }
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
    ${buttonWithNoVariantFragment('button')},
  }
`;

const featuredPublicationsBlock = /* groq */ `
  _type == "featuredPublications" => {
    ...,
    ${portableTextFragment('heading')},
    ${buttonFragment('button')},
    publications[]->{
      ${publicationFragment}
    }
  }
`;

const featuredProductsBlock = /* groq */ `
  _type == "featuredProducts" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    newProducts[]->{
      ${productFragment}
    },
    bestsellers[]->{
      ${productFragment}
    }
  }
`;

export const formStateFragment = /* groq */ `
  formState{
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

const brandsMarqueeBlock = /* groq */ `
  _type == "brandsMarquee" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    ${imageFragment('backgroundImage')},
    ${imageFragment('mobileImage')},
    topBrands[]->{
      ${brandFragment}
    },
    bottomBrands[]->{
      ${brandFragment}
    }
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
    faqList[]->{
      ${faqFragment}
    },
      contactPeople{
        ${portableTextFragment('heading')},
        contactPersons[]{
         ${contactPersonBlock}
        }
      },
      contactForm{
        ${portableTextFragment('heading')},
        buttonText,
        formState{
          ${formStateFragment}
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
      contactPersons[]{
        ${contactPersonBlock}
      }
    },
    accountList[]{
      ${portableTextFragment('heading')},
      accountDetails,
    },
    ${formStateFragment}
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
    teamMembers[]->{
      ${teamMemberFragment}
    },
    ${portableTextFragment('secondaryHeading')},
    ${portableTextFragment('secondaryDescription')},
    ${buttonWithNoVariantFragment('ctaButton')},
  }
`;

export const pageBuilderFragment = /* groq */ `
  pageBuilder[]{
    ...,
    _type,
      ${heroBlock},
      ${latestPublicationBlock},
      ${imageTextColumnsBlock},
      ${blurLinesTextImageBlock},
      ${imageWithVideoBlock},
      ${imageWithTextBoxesBlock},
      ${featuredPublicationsBlock},
      ${featuredProductsBlock},
      ${brandsMarqueeBlock},
      ${faqSectionBlock},
      ${contactFormBlock},
      ${contactMapBlock},
      ${teamSectionBlock},
      ${gallerySectionBlock}
  }
`;

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
    ${formStateFragment}
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
