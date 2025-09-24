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
  ...customLink{
    openInNewTab,
    "href": select(
      type == "internal" => internal->slug.current,
      type == "external" => external,
      "#"
    ),
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

export const pageBuilderFragment = /* groq */ `
  pageBuilder[]{
    ...,
    _type,
      ${heroBlock}
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
    ${pageBuilderFragment}
  }`);
