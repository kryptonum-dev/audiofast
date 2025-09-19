import { defineQuery } from 'next-sanity';

const pageBuilderFragment = /* groq */ `
  pageBuilder[]{
    ...,
    _type,

  }
`;
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

export const queryDefaultOGImage = defineQuery(`*[_type == "settings"][0]{
    "defaultOGImage": seo.img.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100"
  }`);

const buttonsFragment = /* groq */ `
buttons[]{
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
