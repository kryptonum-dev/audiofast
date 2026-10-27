import { defineQuery } from 'next-sanity';

// ----------------------------------------
// Fragments
// ----------------------------------------

// Reference arrays are always dereferenced WITH the reference item's `_key`:
//   refs[defined(@->)]{ _key, ...@->{ … } }
// A bare array deref returns the same documents but drops `_key`, and without
// it Presentation cannot address the array item (no click-to-edit on the item,
// no drag-to-reorder). `defined(@->)` drops dangling or unpublished references
// instead of leaving `null` holes in the array. (Written out inline: typegen
// cannot resolve a GROQ helper called with identifier arguments.)

// Hidden brands, resolved once per query instead of one `brand->` deref per
// product: `brand._ref` is matched against the (small) set of hidden brand ids.
// Same semantics as `brand->doNotShowBrand != true`: a product with no brand or
// a dangling brand reference stays listed.
const visibleBrandCondition = /* groq */ `!(brand._ref in *[_type == "brand" && doNotShowBrand == true]._id)`;

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

// Lightweight image fragment for listings (fill mode, no naturalWidth/Height needed)
// Reduces payload size while keeping essential image data for proper rendering
export const imageFragmentLite = (name: string = 'image') => /* groq */ `
  ${name} {
    "id": asset._ref,
    "preview": asset->metadata.lqip,
    "alt": asset->altText,
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
  name: string = 'portableText',
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
    _type == "ptInlineImage" => {
      ...,
      ${imageFragment('image')},
      width,
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
      products[defined(@->)]{
        _key,
        ...@->{
          ${productCardFields}
        }
      }
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
      products[defined(@->)]{
        _key,
        ...@->{
          ${productCardFields}
        }
      }
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
    _type == "ptYoutubeVideo" => {
      ...,
      youtubeId,
      title,
      ${imageFragment('thumbnail')},
    },
    _type == "ptVimeoVideo" => {
      ...,
      vimeoId,
      title,
      ${imageFragment('thumbnail')},
    },
    _type == "ptPageBreak" => {
      ...,
    },
    _type == "ptTwoColumnLine" => {
      ...,
    },
    _type == "ptImageSlider" => {
      ...,
      ${imageFragment('images[]')}
    },
    _type == "ptReviewEmbed" => {
      ...,
      review->{
        _id,
        ${portableTextFragment('title')},
        "destinationType": coalesce(destinationType, "page"),
        "slug": select(
          coalesce(destinationType, "page") == "page" => slug.current,
          destinationType == "pdf" => pdfSlug.current,
          destinationType == "external" => externalUrl,
          slug.current
        ),
        "openInNewTab": select(
          destinationType == "external" => true,
          destinationType == "pdf" => true,
          false
        ),
        ${imageFragment('image')},
        ${portableTextFragment('description')}
      }
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

// Content blocks fragment for brand detail pages
// Projects an array of content blocks (text, youtube, horizontal line)
const brandContentBlocksFragment = (
  name: string = 'brandContentBlocks',
) => /* groq */ `
  ${name}[]{
    _type,
    _key,
    _type == "contentBlockText" => {
      ${portableTextFragmentExtended('content')}
    },
    _type == "contentBlockYoutube" => {
      youtubeId,
      title,
      ${imageFragment('thumbnail')}
    },
    _type == "contentBlockVimeo" => {
      vimeoId,
      title,
      ${imageFragment('thumbnail')}
    },
    _type == "contentBlockHorizontalLine" => {
      // No additional fields needed - just pass through
    },
    _type == "ptReviewEmbed" => {
      ...,
      review->{
        _id,
        ${portableTextFragment('title')},
        "destinationType": coalesce(destinationType, "page"),
        "slug": select(
          coalesce(destinationType, "page") == "page" => slug.current,
          destinationType == "pdf" => pdfSlug.current,
          destinationType == "external" => externalUrl,
          slug.current
        ),
        "openInNewTab": select(
          destinationType == "external" => true,
          destinationType == "pdf" => true,
          false
        ),
        ${imageFragment('image')},
        ${portableTextFragment('description')},
      }
    },
  }
`;

const publicationBlock = /* groq */ `
  _id,
  _type,
  _createdAt,
  "publishDate": select(
    _type == "review" => coalesce(publishedDate, _createdAt),
    _type == "blog-article" => coalesce(publishedDate, _createdAt),
    _type == "product" => coalesce(publishedDate, _createdAt),
    _type == "youtubeVideo" => coalesce(publishedDate, _createdAt),
    _createdAt
  ),
  "name": select(
    _type == "review" => pt::text(title),
    _type == "product" => name,
    name
  ),
  "title": select(
    _type in ["product", "youtubeVideo"] => null,
    ${portableTextFragment('title')}
  ),
  // Every Portable Text branch must resolve markDefs (customLink -> href),
  // otherwise links render with the stored placeholder href "#".
  "description": select(
    _type == "review" && count(description) > 0 => ${portableTextFragment('description')},
    _type == "review" => content[_type == "block"][0...3]{
      ...,
      ${markDefsFragment()}
    },
    _type == "product" => ${portableTextFragment('shortDescription')},
    ${portableTextFragment('description')}
  ),
  "image": select(
    _type == "product" && defined(publicationImage) => {
      ${imageFragment('"image": publicationImage')}
    }.image,
    _type == "product" => {
      ${imageFragment('"image": previewImage')}
    }.image,
    ${imageFragment('image')}
  ),
  "publicationType": select(
    _type == "youtubeVideo" => "YouTube",
    _type == "review" => "Recenzja",
    _type == "blog-article" => category->name,
    _type == "product" => "Produkt",
    "Artykuł"
  ),
  "destinationType": select(
    _type == "youtubeVideo" => "external",
    _type == "review" => coalesce(destinationType, "page"),
    "page"
  ),
  "slug": select(
    _type == "youtubeVideo" => videoUrl,
    _type == "review" && destinationType == "page" => slug.current,
    _type == "review" && destinationType == "pdf" => pdfSlug.current,
    _type == "review" && destinationType == "external" => externalUrl,
    _type == "blog-article" => slug.current,
    _type == "product" => slug.current,
    slug.current
  ),
  "openInNewTab": select(
    _type == "youtubeVideo" => true,
    _type == "review" && destinationType == "external" => true,
    _type == "review" && destinationType == "pdf" => true,
    false
  ),
  "author": select(
    _type == "review" => author->{
      _id,
      _type,
      name,
      ${imageFragment('image')}
    },
    null
  ),
`;

// Reusable brand fragment for brand listings
// NOTE: This fragment does NOT filter by doNotShowBrand - callers must filter beforehand
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
// Commerce fields shared by every projection that feeds ProductCard: the price
// (with the "od" prefix flag) and the online-sale flag that gates the tile's
// add-to-cart button. Keep the four card projections in sync through this one
// constant (productFragment, productProjection, productsProjection and the
// review's inline product).
const productCardCommerceFields = /* groq */ `
  basePriceCents,
  hasMultiplePrices,
  isSellableOnline
`;

// Category summary for product cards and the product page: keyed deref of
// the product's `categories[]` references.
const productCategoriesField = /* groq */ `
  "categories": categories[defined(@->)]{
    _key,
    ...@->{
      _id,
      "slug": slug.current,
      name,
    }
  }
`;

// Product card fields (ProductCard) — the body shared by every product card
// projection below.
const productCardFields = /* groq */ `
  _id,
  _createdAt,
  "publishDate": coalesce(publishedDate, _createdAt),
  "slug": slug.current,
  name,
  subtitle,
  ${productCardCommerceFields},
  isArchived,
  ${productCategoriesField},
  brand->{
    name,
    "slug": slug.current,
    ${imageFragment('logo')},
  },
  ${imageFragment('"mainImage": previewImage')},
  ${portableTextFragment('shortDescription')},
`;

// Reusable CPO product fragment for listing cards (brandName from Excel; optional inherit images)
const cpoProductFragment = /* groq */ `
  _id,
  _createdAt,
  "publishDate": coalesce(publishedDate, _createdAt),
  "slug": slug.current,
  name,
  priceCents,
  isArchived,
  productType,
  brandName,
  externalUrl,
  transparentBackground,
  useCustomGallery,
  internalProduct,
  ${imageFragment('"mainImage": select(defined(previewImage.asset) => previewImage, internalProduct->previewImage)')},
  ${portableTextFragment('shortDescription')},
`;

// Listing filters + filter metadata: must match cpoProductFragment mainImage resolution
const cpoListablePreviewImageCondition = /* groq */ `(
  defined(previewImage.asset)
  || (defined(internalProduct) && defined(internalProduct->previewImage.asset))
)`;

// Reusable FAQ fields (keyed-deref'd from `faq` reference arrays)
const faqFields = /* groq */ `
  _id,
  _type,
  _createdAt,
  question,
  ${portableTextFragment('answer')},
`;

// Reusable team member fields (keyed-deref'd from `teamMember` reference arrays)
const teamMemberFields = /* groq */ `
  _id,
  _type,
  name,
  position,
  phoneNumber,
  ${imageFragment('image')},
  ${portableTextFragment('description')},
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
    slides[]{
      ${imageFragment('image')},
      ${buttonFragment('button')},
      ${portableTextFragment('title')},
      ${portableTextFragment('description')},
    },
    "brands": brands[defined(@->)]{
      _key,
      ...@->{
        name,
        "slug": slug.current,
        ${imageFragment('logo')},
      }
    }
  }
`;

const heroStaticBlock = /* groq */ `
  _type == "heroStatic" => {
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
    ${portableTextFragment('heading')},
    selectionMode,
    "publication": select(
      // Manual selection: filter out drafts and archived products
      selectionMode == "manual" => (
        [publication->][!(_id in path("drafts.**")) && (_type != "product" || isArchived != true)][0]{
          ${publicationBlock}
        }
      ),
      // Default: fetch the latest publication automatically
      *[
        _type in ["blog-article", "review", "product", "youtubeVideo"] &&
        (_type != "youtubeVideo" || (defined(videoUrl) && defined(name))) &&
        !(_id in path("drafts.**")) &&
        // Products must be published with required fields and not archived
        (
          _type != "product" ||
          (defined(publicationImage) && defined(shortDescription) && isArchived != true)
        ) &&
        // Reviews must have their required fields based on destinationType
        (
          _type != "review" ||
          (
            (coalesce(destinationType, "page") == "page" && defined(slug.current)) ||
            (destinationType == "pdf" && defined(pdfSlug.current) && defined(pdfFile)) ||
            (destinationType == "external" && defined(externalUrl))
          )
        )
      ] | order(coalesce(publishedDate, _createdAt) desc)[0]{
        ${publicationBlock}
      }
    )
  }
`;

const imageTextColumnsBlock = /* groq */ `
  _type == "imageTextColumns" => {
    ${imageFragment('image')},
    ${portableTextFragment('heading')},
    ${portableTextFragment('content')},
    ${buttonFragment('button')},
  }
`;

const blurLinesTextImageBlock = /* groq */ `
  _type == "blurLinesTextImage" => {
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${imageFragment('image')},
  }
`;

const gallerySectionBlock = /* groq */ `
  _type == "gallerySection" => {
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    // Spelled out (not imageFragment) to keep each item _key: the gallery
    // is draggable in Presentation (Phase 9).
    images[]{
      _key,
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
  }
`;

const imageWithTextBoxesBlock = /* groq */ `
  _type == "imageWithTextBoxes" => {
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
    ${imageFragment('image')},
    youtubeId,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
  }
`;

const featuredPublicationsBlock = /* groq */ `
  _type == "featuredPublications" => {
    ${portableTextFragment('heading')},
    selectionMode,
    "publications": select(
      // Manual selection: filter out drafts and archived products
      selectionMode == "manual" => publications[
        defined(@->)
        && !(@->_id in path("drafts.**"))
        && (@->_type != "product" || @->isArchived != true)
      ]{
        _key,
        ...@->{
          ${publicationBlock}
        }
      },
      // Automatic modes: fetch latest publications sorted by publishedDate (or _createdAt as fallback)
      selectionMode == "latest" => *[
        _type in ["blog-article", "review", "product", "youtubeVideo"] &&
        (_type != "youtubeVideo" || (defined(videoUrl) && defined(name))) &&
        !(_id in path("drafts.**")) &&
        // Products must be published with required fields and not archived
        (
          _type != "product" ||
          (defined(publicationImage) && defined(shortDescription) && isArchived != true)
        ) &&
        (
          _type != "review" ||
          (
            (coalesce(destinationType, "page") == "page" && defined(slug.current)) ||
            (destinationType == "pdf" && defined(pdfSlug.current) && defined(pdfFile)) ||
            (destinationType == "external" && defined(externalUrl))
          )
        )
      ] | order(coalesce(publishedDate, _createdAt) desc)[0...20]{
        ${publicationBlock}
      },
      // Default: secondLatest - skip the first publication, show next 20
      *[
        _type in ["blog-article", "review", "product", "youtubeVideo"] &&
        (_type != "youtubeVideo" || (defined(videoUrl) && defined(name))) &&
        !(_id in path("drafts.**")) &&
        // Products must be published with required fields and not archived
        (
          _type != "product" ||
          (defined(publicationImage) && defined(shortDescription) && isArchived != true)
        ) &&
        (
          _type != "review" ||
          (
            (coalesce(destinationType, "page") == "page" && defined(slug.current)) ||
            (destinationType == "pdf" && defined(pdfSlug.current) && defined(pdfFile)) ||
            (destinationType == "external" && defined(externalUrl))
          )
        )
      ] | order(coalesce(publishedDate, _createdAt) desc)[1...21]{
        ${publicationBlock}
      }
    )
  }
`;

// Product projection for reuse in automatic queries (without the wrapper)
const productProjection = /* groq */ `
  _id,
  _createdAt,
  "publishDate": coalesce(publishedDate, _createdAt),
  "slug": slug.current,
  name,
  subtitle,
  ${productCardCommerceFields},
  isArchived,
  ${productCategoriesField},
  brand->{
    name,
    "slug": slug.current,
    ${imageFragment('logo')},
  },
  ${imageFragment('"mainImage": previewImage')},
  ${portableTextFragment('shortDescription')}
`;

const featuredProductsBlock = /* groq */ `
  _type == "featuredProducts" => {
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    newProductsMode,
    "newProducts": select(
      newProductsMode == "manual" => newProducts[defined(@->)]{
        _key,
        ...@->{
          ${productProjection}
        }
      },
      // Default: automatic - fetch 10 newest products
      *[
        _type == "product" &&
        !(_id in path("drafts.**")) &&
        isArchived != true
      ] | order(coalesce(publishedDate, _createdAt) desc)[0...10]{
        ${productProjection}
      }
    ),
    bestsellers[defined(@->)]{
      _key,
      ...@->{
        ${productCardFields}
      }
    },
  }
`;

const productsCarouselBlock = /* groq */ `
  _type == "productsCarousel" => {
    ${portableTextFragment('heading')},
    products[defined(@->)]{
      _key,
      ...@->{
        ${productCardFields}
      }
    }
  }
`;

// Brand card fields for the marquee and the manual brands list
const marqueeBrandFields = /* groq */ `
  _id,
  _createdAt,
  "slug": slug.current,
  name,
  ${portableTextFragment('description')},
  ${imageFragment('logo')},
`;

const brandsMarqueeBlock = /* groq */ `
  _type == "brandsMarquee" => {
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    ${imageFragment('backgroundImage')},
    "topBrands": topBrands[defined(@->)]{
      _key,
      ...@->{
        ${marqueeBrandFields}
      }
    },
    "bottomBrands": bottomBrands[defined(@->)]{
      _key,
      ...@->{
        ${marqueeBrandFields}
      }
    },
  }
`;

const brandsListBlock = /* groq */ `
  _type == "brandsList" => {
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${portableTextFragment('ctaText')},
    "brands": select(
      brandsDisplayMode == "all" => ${brandFragment('*[_type == "brand" && !(_id in path("drafts.**")) && doNotShowBrand != true] | order(orderRank)')},
      brandsDisplayMode == "manual" => selectedBrands[defined(@->)] | order(@->orderRank) {
        _key,
        ...@->{
          ${marqueeBrandFields}
        }
      },
      ${brandFragment('*[_type == "brand" && !(_id in path("drafts.**")) && doNotShowBrand != true] | order(orderRank)')}
    )
  }
`;

// The listing itself (products, count, filters) is fetched by the block's
// own components; the block carries only its heading.
const cpoProductsListingBlock = /* groq */ `
  _type == "cpoProductsListing" => {
    ${portableTextFragment('heading')},
  }
`;

const brandsByCategoriesSectionBlock = /* groq */ `
  _type == "brandsByCategoriesSection" => {
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    // Per parent category: its sub-category slugs first, then the brands of
    // the visible products whose denormalized category slugs intersect them
    // (no per-product category or brand deref in the scan).
    "categoriesWithBrands": *[_type == "productCategoryParent" && !(_id in path("drafts.**"))] | order(orderRank) {
      _id,
      name,
      "subCategorySlugs": *[
        _type == "productCategorySub"
        && parentCategory._ref == ^._id
        && defined(slug.current)
      ].slug.current
    }{
      _id,
      name,
      "brands": array::unique(
        *[
          _type == "product"
          && !(_id in path("drafts.**"))
          && isArchived != true
          && ${visibleBrandCondition}
          && array::intersects(denormCategorySlugs, ^.subCategorySlugs)
        ].brand->{_id, name, "slug": slug.current}
      )
    }[count(brands) > 0]
  }
`;

const faqSectionBlock = /* groq */ `
  _type == "faqSection" => {
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    displayMode,
    faqList[defined(@->)]{
      _key,
      ...@->{
        ${faqFields}
      }
    },
      contactPeople{
        ${portableTextFragment('heading')},
        contactPersons[defined(@->)]{
          _key,
          ...@->{
            ${teamMemberFields}
          }
        }
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
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    contactPeople{
      ${portableTextFragment('heading')},
      contactPersons[defined(@->)]{
        _key,
        ...@->{
          ${teamMemberFields}
        }
      }
    },
    accountList[]{
      _key,
      ${portableTextFragment('heading')},
      accountDetails,
    },
    "companyRegistration": *[_type == "settings"][0].companyRegistration {
      companyName,
      krs,
      nip,
      regon,
      registryCourt,
      shareCapital
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
    ${portableTextFragment('heading')},
    useCustomAddress,
    customAddress,
    customPhone,
    customEmail,
    // Folded in so the block renders without its own settings fetch (and
    // follows the page's perspective in draft mode).
    "settingsContact": *[_type == "settings"][0]{
      address { streetAddress, postalCode, city, country },
      tel,
      email
    },
  }
`;

const teamSectionBlock = /* groq */ `
  _type == "teamSection" => {
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    variant,
    teamMembers[defined(@->)]{
      _key,
      ...@->{
        ${teamMemberFields}
      }
    },
    ${portableTextFragment('secondaryHeading')},
    ${portableTextFragment('secondaryDescription')},
    ${buttonFragment('ctaButton')},
  }
`;

const phoneImageCtaBlock = /* groq */ `
  _type == "phoneImageCta" => {
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
    ${portableTextFragment('heading')},
    ${portableTextFragment('paragraph')},
    steps[]{
      _key,
      ${portableTextFragment('heading')},
      ${portableTextFragment('description')},
    }
  }
`;

// Every block projects its fields explicitly: no `...` spread, so the raw
// reference arrays and unused fields never ship, and every field a block
// renders is visible in its fragment (and in the generated types).
export const pageBuilderFragment = /* groq */ `
  pageBuilder[]{
    _key,
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
      ${cpoProductsListingBlock},
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

// Query for home page SEO description (used as fallback for pages without meta description)
export const queryHomePageSeoDescription =
  defineQuery(`*[_type == "homePage" && _id == "homePage"][0]{
  "description": seo.description
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
  _id,
  _type,
  ${buttonFragment('buttons[]')}
}`);

export const queryFooter = defineQuery(`*[_type == "footer"][0]{
  _id,
  _type,
  highlightedSocialMedia[defined(@->)]{
    _key,
    ...@->{
      _id,
      _type,
      name,
      link,
      iconString,
    }
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
  doNotIndex,
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  },
  "firstBlockType": pageBuilder[0]._type,
  ${pageBuilderFragment}
}`);

// Shared filter conditions for CPO product listing queries
const cpoFilterConditions = /* groq */ `
  _type == "cpoProduct"
  && isArchived != true
  && ${cpoListablePreviewImageCondition}
  && (
    $search == "" || name match $search + "*"
  )
  && (
    count($brands) == 0
    || lower(brandName) in $brands
  )
  && ($minPrice == 0 || priceCents >= $minPrice)
  && ($maxPrice == 0 || priceCents <= $maxPrice)
`;

// Reusable fragment for CPO listing — swap in different order clauses. The
// page of products and the total count travel in one request (like the
// product listing), so a CPO listing render costs one Sanity round trip.
const cpoListingFragment = (orderClause: string) => /* groq */ `
  {
    "products": *[${cpoFilterConditions}] | order(${orderClause}) [$offset...$limit] {
      ${cpoProductFragment}
    },
    "totalCount": count(*[${cpoFilterConditions}])
  }
`;

// Static queries per sort order (required for typegen)
export const queryCpoProductsListingNewest = defineQuery(
  cpoListingFragment('coalesce(publishedDate, _createdAt) desc'),
);

export const queryCpoProductsListingOldest = defineQuery(
  cpoListingFragment('coalesce(publishedDate, _createdAt) asc'),
);

export const queryCpoProductsListingPriceAsc = defineQuery(
  cpoListingFragment('coalesce(priceCents, 999999999) asc'),
);

export const queryCpoProductsListingPriceDesc = defineQuery(
  cpoListingFragment('coalesce(priceCents, -1) desc'),
);

// Helper function to pick the right query based on sortBy param
export function getCpoProductsListingQuery(sortBy: string = 'newest') {
  switch (sortBy) {
    case 'oldest':
      return queryCpoProductsListingOldest;
    case 'priceAsc':
      return queryCpoProductsListingPriceAsc;
    case 'priceDesc':
      return queryCpoProductsListingPriceDesc;
    case 'newest':
    default:
      return queryCpoProductsListingNewest;
  }
}

// CPO filter sidebar data: one scan of the listable CPO products. The brand
// list and the price bounds are derived from these rows in JS
// (`deriveCpoFilterMetadata`), not by three more scans of the same filter.
export const queryCpoProductsFilterMetadata = defineQuery(`
  *[
    _type == "cpoProduct"
    && isArchived != true
    && defined(brandName)
    && ${cpoListablePreviewImageCondition}
  ] {
    _id,
    name,
    "brandSlug": lower(brandName),
    "brandName": brandName,
    "basePriceCents": priceCents,
    "categorySlug": null,
    "allCategorySlugs": [],
    "customFilterValues": []
  }
`);

export const queryCpoProductBySlug =
  defineQuery(`*[_type == "cpoProduct" && slug.current == $slug && productType == "internal" && isArchived != true][0] {
  _id,
  _type,
  "slug": slug.current,
  name,
  priceCents,
  isSellableOnline,
  isReturnable,
  isArchived,
  availabilityStatus,
  transparentBackground,
  productType,
  brandName,
  useCustomGallery,
  internalProduct->{
    _id,
    name,
    "slug": slug.current,
    brand->{
      name,
      "slug": slug.current,
    },
    ${imageFragment('previewImage')},
    ${imageFragment('imageGallery[]')},
    ${portableTextFragment('shortDescription')},
  },
  ${imageFragment('"resolvedPreviewImage": select(defined(previewImage.asset) => previewImage, internalProduct->previewImage)')},
  ${imageFragment('previewImage')},
  imageGallery[]{
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
  },
  ${portableTextFragment('shortDescription')},
  "details": select(
    defined(details.productDetailContent[0]) => details{
      ${portableTextFragment('heading')},
      ${brandContentBlocksFragment('content')},
      ${portableTextFragmentExtended('productDetailContent')}
    },
    internalProduct->details{
      ${portableTextFragment('heading')},
      ${brandContentBlocksFragment('content')},
      ${portableTextFragmentExtended('productDetailContent')}
    }
  ),
  "technicalData": select(
    count(technicalData.groups[].rows[
      coalesce(title, "") != "" || count(values[defined(content[0])]) > 0
    ]) > 0 => technicalData {
      variants,
      groups[] {
        _key,
        title,
        rows[] {
          _key,
          title,
          values[] {
            _key,
            ${portableTextFragment('content')}
          }
        }
      }
    },
    internalProduct->technicalData {
      variants,
      groups[] {
        _key,
        title,
        rows[] {
          _key,
          title,
          values[] {
            _key,
            ${portableTextFragment('content')}
          }
        }
      }
    }
  ),
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  },
}`);

// Static params for /produkty/kategoria/[category]/: every sub-category with a
// slug (the same set the filter metadata's `categories` lists).
export const queryAllProductCategorySlugs = defineQuery(`*[
  _type == "productCategorySub"
  && defined(slug.current)
] | order(orderRank) {
  "slug": slug.current
}`);

export const queryAllCpoProductSlugs = defineQuery(`*[
  _type == "cpoProduct"
  && defined(slug.current)
  && productType == "internal"
  && isArchived != true
] {
  "slug": slug.current
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
  publishedDate,
  "publishDate": coalesce(publishedDate, _createdAt),
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
  authorType,
  "author": select(
    authorType == "external" => { "name": customAuthor },
    author->{
      _id,
      _type,
      name,
      position,
      ${imageFragment('image')},
    }
  ),
  keywords,
  ${portableTextFragmentExtended('content')},
  "headings": content[length(style) == 2 && string::startsWith(style, "h")],
  ${pageBuilderFragment},
  doNotIndex,
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
  "publishDate": coalesce(publishedDate, _createdAt),
  "slug": slug.current,
  "name": pt::text(title),
  ${portableTextFragment('title')},
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
    ${productCardCommerceFields},
    isArchived,
    "brand": brand->{
      name,
      "slug": slug.current,
      ${imageFragment('logo')},
    },
    ${imageFragment('"mainImage": previewImage')},
    ${imageFragment('imageGallery[]')},
    ${portableTextFragment('shortDescription')},
  },
  "gallery": select(
    overrideGallery == true && count(imageGallery) >= 4 => ${imageFragment('imageGallery[]')},
    ${imageFragment('*[_type == "product" && references(^._id)][0].imageGallery[]')}
  ),
  ${pageBuilderFragment},
  doNotIndex,
  seo,
  openGraph{
    title,
    description,
    "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
  }
}`);

export const queryPdfReviewBySlug =
  defineQuery(`*[_type == "review" && destinationType == "pdf" && pdfSlug.current == $slug][0]{
  _id,
  "slug": pdfSlug.current,
  "name": pt::text(title),
  ${portableTextFragment('title')},
  "pdfUrl": pdfFile.asset->url,
  "pdfFilename": pdfFile.asset->originalFilename,
  "pdfSize": pdfFile.asset->size,
  "pdfMimeType": pdfFile.asset->mimeType
}`);

// Query for fetching a specific PDF from a product by slug and PDF key
// Used by /produkty/[slug]/pliki/[pdfKey] route handler
export const queryProductPdfBySlugAndKey = defineQuery(`
  *[_type == "product" && slug.current == $slug][0]{
    "pdf": downloadablePdfs[_key == $pdfKey][0]{
      _key,
      title,
      description,
      "fileUrl": file.asset->url,
      "fileName": file.asset->originalFilename,
      "mimeType": file.asset->mimeType
    }
  }.pdf
`);

// Query for blog page static content - handles both /blog and /blog/kategoria/[category]
// Uses GROQ select() to conditionally fetch category-specific or default content
// Parameters:
// - $category: category slug (e.g., "/blog/kategoria/recenzje/") or empty string "" for main page
// This query is designed to be cached with "use cache" for PPR static shell
export const queryBlogPageContent = defineQuery(`
  {
    // Main blog page data (always fetched for fallback content)
    "defaultContent": *[_type == "blog"][0] {
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
      }
    },
    // Category-specific data (null if $category is empty)
    "categoryContent": select(
      $category != "" => *[_type == "blog-category" && slug.current == $category][0]{
        _id,
        _type,
        name,
        "slug": slug.current,
        doNotIndex,
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
    // Categories with counts (static, doesn't change with filters)
    "categories": *[_type == "blog-category" && defined(slug.current)] | order(orderRank){
      _id,
      name,
      "slug": slug.current,
      "count": count(*[_type == "blog-article" && category._ref == ^._id && !hideFromList])
    },
    // Total count of all articles
    "totalCount": count(*[_type == "blog-article" && defined(slug.current) && !hideFromList]),
    // Available years (for year filter UI)
    "availableYears": array::unique(
      *[_type == "blog-article" && defined(slug.current) && !hideFromList]{
        "year": string::split(coalesce(publishedDate, _createdAt), "-")[0]
      }.year
    ) | order(@ desc)
  }
`);

// Query for blog articles only (filtered and paginated)
// Parameters:
// - $category: category slug (optional) - empty string "" for all articles
// - $search: search term (optional) - empty string "" for no search
// - $year: year filter (optional) - empty string "" for all years
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
  && hideFromList == false
  && ($category == "" || category._ref in *[_type == "blog-category" && slug.current == $category]._id)
  && ($year == "" || string::split(coalesce(publishedDate, _createdAt), "-")[0] == $year)
  && ($search == "" || count($embeddingResults) > 0 || [name, pt::text(title)] match $search)
  && (count($embeddingResults) == 0 || _id in $embeddingResults[].value.documentId)
`;

// Filter before semantic scoring; all counts/pages derive from this bounded array.
const blogSearchEligibility = /* groq */ `
  _type == "blog-article"
  && !(_id in path("drafts.**")) && !(_id in path("versions.**"))
  && defined(slug.current) && hideFromList == false
  && ($category == "" || category._ref in *[_type == "blog-category" && slug.current == $category]._id)
  && ($year == "" || string::split(coalesce(publishedDate, _createdAt), "-")[0] == $year)
`;

export const queryBlogSemanticSearch = defineQuery(`
  *[${blogSearchEligibility}]
  | score(text::semanticSimilarity($search))
  | order(_score desc, _id asc)[0...50] {
    ${publicationBlock}
    _score
  }
`);

export const queryBlogLexicalSearch = defineQuery(`
  *[${blogSearchEligibility} && [name, pt::text(title)] match $search]
  | order(coalesce(publishedDate, _createdAt) desc, _id asc)[0...50] {
    ${publicationBlock}
    "_score": 0
  }
`);

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
  blogArticlesFragment('coalesce(publishedDate, _createdAt) desc'),
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
  blogArticlesRelevanceFragment,
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

// ----------------------------------------
// Products Queries
// ----------------------------------------

// ----------------------------------------
// PPR Static Queries (for Partial Pre-rendering)
// ----------------------------------------

// Query for page content - handles both /produkty and /produkty/kategoria/[category]
// Uses GROQ select() to conditionally fetch category-specific or default content
// Parameters:
// - $category: category slug (e.g., "/kategoria/streamery/") or empty string "" for main page
// This query is designed to be cached with "use cache" for PPR static shell
export const queryProductsPageContent = defineQuery(`
  {
    "defaultContent": *[_type == "products"][0] {
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
      }
    },
    "categoryContent": select(
      $category != "" => *[_type == "productCategorySub" && slug.current == $category][0]{
        _id,
        _type,
        name,
        "slug": slug.current,
        doNotIndex,
        ${portableTextFragment('title')},
        ${portableTextFragment('description')},
        ${imageFragment('heroImage')},
        customFilters[]{
          _key,
          name,
          filterType,
          unit
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
    )
  }
`);

// Query for all products filter metadata (lightweight)
// Uses denormalized fields (no per-product dereferencing) and is read with
// stega off. Used for client-side filter computation in the listing shells.
// - products: the listable catalogue (same base set as productsFilterConditions)
// - categories / brands: sidebar lists; the brand logo is not projected (no
//   filter UI renders it)
// The global price bounds are computed in JS from `products`
// (getProductsFilterMetadata) instead of two more catalogue scans.
// Parameters: none (fetches all data)
export const queryAllProductsFilterMetadata = defineQuery(`
  {
    "products": *[
      _type == "product" 
      && defined(slug.current)
      && isArchived != true
      && defined(denormCategorySlugs)
      && count(denormCategorySlugs) > 0
      && ${visibleBrandCondition}
    ] {
      _id,
      name,
      "brandSlug": denormBrandSlug,
      "brandName": denormBrandName,
      "categorySlug": denormCategorySlugs[0],
      "allCategorySlugs": denormCategorySlugs,
      basePriceCents,
      customFilterValues[]{
        filterName,
        value,
        numericValue
      }
    },
    "categories": *[_type == "productCategorySub" && defined(slug.current)] | order(orderRank) {
      _id,
      name,
      "slug": slug.current,
      parentCategory->{
        _id,
        name,
        "slug": slug.current
      }
    },
    "brands": *[_type == "brand" && defined(slug.current) && doNotShowBrand != true] | order(orderRank) {
      _id,
      name,
      "slug": slug.current
    }
  }
`);

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
      // Already scoped inside openGraph{}, so image resolves relative to it.
      // Referencing openGraph.image here looked for openGraph.openGraph.image
      // and always yielded null.
      "seoImage": select(
        defined(image) => image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        null
      ),
    }
  }
`);

// ----------------------------------------
// Shared fragments for products listing
// ----------------------------------------

// Shared filter conditions for products (used in both query and count)
// OPTIMIZED: Uses denormalized fields for faster queries (no dereferencing)
// - Category/Brand filtering uses denormalized fields (major perf win)
// - Custom filters use original customFilterValues (rarely used, minimal impact)
// The GROQ below is kept free of comments: it is sent twice per listing request
// and the URL-encoded query plus params must stay under @sanity/client's GET
// limit (~11k chars) or the request falls back to POST.
// Conditions, in order:
// - base listing set (same as queryAllProductsFilterMetadata), excluding
//   products from hidden brands (doNotShowBrand == true)
// - $category: denormalized denormCategorySlugs
// - $search / $searchTiers: text search is matched in JS (global/filters/productSearch.ts,
//   brand + product name, any word order, fragments). ProductsListing passes the
//   matching ids grouped into PRODUCT_SEARCH_TIER_COUNT (4) relevance tiers;
//   $search is "" when there is no search.
// - $brands: denormalized denormBrandSlug
// - $minPrice/$maxPrice: basePriceCents
// - $customFilters: array of {filterName, value} for dropdown filters (ALL must match)
// - $rangeFilters: array of {filterName, minValue, maxValue} for range filters
//   (minValue/maxValue can be null to indicate "no limit"); not denormalized,
//   as they require dynamic min/max comparison
const productsFilterConditions = /* groq */ `
  _type == "product"
  && defined(slug.current)
  && isArchived != true
  && defined(denormCategorySlugs)
  && count(denormCategorySlugs) > 0
  && ${visibleBrandCondition}
  && ($category == "" || $category in denormCategorySlugs)
  && (
    $search == ""
    || _id in $searchTiers[0]
    || _id in $searchTiers[1]
    || _id in $searchTiers[2]
    || _id in $searchTiers[3]
  )
  && (count($brands) == 0 || denormBrandSlug in $brands)
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
  && (
    count($rangeFilters) == 0 ||
    count($rangeFilters) <= count(customFilterValues[
      select(
        count($rangeFilters[
          filterName == ^.filterName 
          && (minValue == null || ^.numericValue >= minValue)
          && (maxValue == null || ^.numericValue <= maxValue)
        ]) > 0 => true,
        false
      )
    ])
  )
`;

// Shared projection fields for products (the {...} block)
// OPTIMIZED: Removed unused fields for ProductCard rendering:
// - _createdAt, publishedDate, publishDate (not displayed in cards)
// - isArchived (already filtered in query conditions)
// - shortDescription (not shown in listing cards)
// - _score (not needed except for relevance sort ordering)
// - categories[]._id (only slug and name needed for comparison button)
// - Main image uses lite fragment (fill mode doesn't need dimensions)
// - Brand logo keeps full fragment (needs dimensions for non-fill rendering)
//
// NOTE: project the FULL categories array (not just the first one). A product can
// belong to multiple categories, and the comparison button needs all of them to
// validate the category intersection — otherwise a product whose first category
// differs from the comparison's shared category is wrongly rejected.
const productsProjection = /* groq */ `
  _id,
  name,
  subtitle,
  "slug": slug.current,
  ${productCardCommerceFields},
  "categories": categories[defined(@->)]{
    _key,
    ...@->{
      name,
      "slug": slug.current
    }
  },
  brand->{
    name,
    "slug": slug.current,
    ${imageFragment('logo')}
  },
  ${imageFragmentLite('"mainImage": previewImage')}
`;

// Relevance sorting: search tier first (0 = best, see productSearch.ts),
// editorial order within a tier. Without a search every product lands in the
// fallback tier, so the order is plain orderRank.
const productsRelevanceOrder = /* groq */ `
  select(
    _id in $searchTiers[0] => 0,
    _id in $searchTiers[1] => 1,
    _id in $searchTiers[2] => 2,
    3
  ) asc,
  orderRank asc
`;

// Reusable fragment for products listing logic
// This avoids code duplication across different sort queries
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
// - $search: normalized search term (optional) - empty string "" for no search
// - $searchTiers: 4 arrays of matching product ids, best tier first (see productSearch.ts)
// - $offset: pagination offset (e.g., 0, 12, 24)
// - $limit: pagination limit (e.g., 12)
// - $brands: array of brand names/slugs (optional) - empty array [] for all brands
//   Note: Brand filtering checks both brand name and slug (without /marki/ prefix)
// - $minPrice: minimum price (optional) - 0 for no minimum
// - $maxPrice: maximum price (optional) - 999999999 for no maximum
// - $customFilters: array of custom filter objects (optional) - empty array [] for no custom filters
//   Format: [{filterName: "Długość kabla", value: "2m"}, ...]
//   Note: ALL custom filters must match (AND logic)
// - $rangeFilters: array of range filter objects (optional) - empty array [] for no range filters
//   Format: [{filterName: "Impedancja", minValue: 4, maxValue: 12}, ...]
//   Note: minValue/maxValue can be null for "no limit"
// Static queries for each sort type (required for typegen)
export const queryProductsListingNewest = defineQuery(
  productsListingFragment('coalesce(publishedDate, _createdAt) desc'),
);

export const queryProductsListingOldest = defineQuery(
  productsListingFragment('coalesce(publishedDate, _createdAt) asc'),
);

export const queryProductsListingPriceAsc = defineQuery(
  productsListingFragment('coalesce(basePriceCents, 999999999) asc'),
);

export const queryProductsListingPriceDesc = defineQuery(
  productsListingFragment('coalesce(basePriceCents, -1) desc'),
);

export const queryProductsListingOrderRank = defineQuery(
  productsListingFragment('orderRank asc'),
);

// Special query for relevance sorting that calculates score inline
const productsListingRelevanceFragment = /* groq */ `
  {
    "products": *[${productsFilterConditions}] | order(${productsRelevanceOrder}) [$offset...$limit] {
      ${productsProjection}
    },
    "totalCount": count(*[${productsFilterConditions}])
  }
`;

export const queryProductsListingRelevance = defineQuery(
  productsListingRelevanceFragment,
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

// ----------------------------------------
// Brand Queries
// ----------------------------------------

// Dealer ("Gdzie kupić") fields shared by the brand and product store lists
const storeFields = /* groq */ `
  _id,
  _type,
  name,
  "slug": slug.current,
  address { postalCode, city, street },
  phone,
  website
`;

// Brand detail query (content only - no filter metadata)
// NOTE: the filter sidebar on /marki/[slug] is built from queryAllProductsFilterMetadata;
// no per-brand filter metadata is projected here.
// Parameters:
// - $slug: brand slug (e.g., "/marki/yamaha/")
export const queryBrandBySlug = defineQuery(/* groq */ `
  *[_type == "brand" && slug.current == $slug][0] {
    _id,
    _type,
    name,
    "slug": slug.current,
    doNotIndex,
    ${imageFragment('logo')},
    ${portableTextFragmentExtended('description')},
    ${imageFragment('heroImage')},
    ${imageFragment('bannerImage')},
    distributionYear {
      year,
      ${imageFragment('backgroundImage')},
    },
    ${brandContentBlocksFragment('brandContentBlocks')},
    ${portableTextFragmentExtended('brandDetailContent')},
    ${imageFragment('imageGallery[]')},
    featuredReviews[defined(@->)]{
      _key,
      ...@->{
        ${publicationBlock}
      }
    },
    stores[defined(@->)]{
      _key,
      ...@->{
        ${storeFields}
      }
    },
    seo {
      title,
      description
    },
    openGraph {
      title,
      description,
      "seoImage": image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100"
    }
  }
`);

// Get all brand slugs for static generation
// NOTE: Includes all brands (even doNotShowBrand) since brand pages should still be accessible via direct URL
export const queryAllBrandSlugs = defineQuery(/* groq */ `
  *[_type == "brand" && defined(slug.current) && !(_id in path("drafts.**"))] {
    "slug": slug.current
  }
`);

// ----------------------------------------
// Product Detail Queries
// ----------------------------------------

// Brand dealer list ("Gdzie kupić") shown on product pages that have no own
// `availableInStores`. Kept separate from queryProductBySlug so it can be
// cached under `brand-stores:<brandId>` and invalidated on brand/store publish
// without touching the product page's own cache entry.
export const queryBrandStoresById = defineQuery(/* groq */ `
  *[_type == "brand" && _id == $brandId][0].stores[defined(@->)]{
    _key,
    ...@->{
      ${storeFields}
    }
  }
`);

// Product detail query.
// The brand's dealer list ("Gdzie kupić") is deliberately NOT embedded in
// brand->{} here: it comes from queryBrandStoresById under its own
// `brand-stores:<brandId>` cache tag, so a brand/store publish refreshes every
// product page that inherits the list (see /api/revalidate).
export const queryProductBySlug = defineQuery(/* groq */ `
  *[_type == "product" && slug.current == $slug][0] {
    _id,
    _type,
    name,
    subtitle,
    headingOverride { upper, lower },
    "slug": slug.current,
    doNotIndex,
    // Metadata title fallback (stale ref / pipeline lag safe).
    "brandName": coalesce(brand->name, denormBrandName),
    basePriceCents,
    isSellableOnline,
    isReturnable,
    isArchived,
    ${imageFragment('previewImage')},
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
      _type,
      name,
      ${imageFragment('logo')}
    },
    details{
      ${portableTextFragment('heading')},
      ${brandContentBlocksFragment('content')},
      ${portableTextFragmentExtended('productDetailContent')}
    },
    technicalData {
      variants,
      groups[] {
        _key,
        title,
        rows[] {
          _key,
          title,
          values[] {
            _key,
            ${portableTextFragment('content')}
          }
        }
      }
    },
    availableInStores[defined(@->)]{
      _key,
      ...@->{
        ${storeFields}
      }
    },
    ${productCategoriesField},
    reviews[defined(@->)]{
      _key,
      ...@->{
        ${publicationBlock}
      }
    },
    relatedProducts[defined(@->)]{
      _key,
      ...@->{
        ${productCardFields}
      }
    },
    downloadablePdfs[]{
      _key,
      title,
      description,
      "fileUrl": file.asset->url,
      "fileName": file.asset->originalFilename
    },
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
      // Scoped inside openGraph{}: image is relative to it, while previewImage
      // is a document-level field and needs a caret to hop back out. Both paths
      // were previously resolved against openGraph and always yielded null.
      "seoImage": select(
        defined(image) => image.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        defined(^.previewImage) => ^.previewImage.asset->url + "?w=1200&h=630&dpr=3&fit=max&q=100",
        null
      )
    }
  }
`);

// Minimal product data for the tile's quick add-to-cart (server action
// loadProductQuickAdd). Same image/brand fragments as queryProductBySlug so the
// cart line snapshot matches one added on the product page. $slug is the full
// route slug ("/produkty/<slug>/"), cached under the product page's tags.
export const queryProductQuickAddBySlug = defineQuery(/* groq */ `
  *[_type == "product" && slug.current == $slug][0] {
    _id,
    name,
    isSellableOnline,
    isReturnable,
    isArchived,
    brand->{
      name,
      ${imageFragment('logo')}
    },
    ${imageFragment('previewImage')}
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
    ${imageFragment('"mainImage": previewImage')},
    brand->{
      _id,
      name,
      "slug": slug.current,
      ${imageFragment('logo')}
    },
    "categories": categories[defined(@->)]{
      _key,
      ...@->{
        "slug": slug.current,
        name
      }
    }
  }
`);

// Query 2: Get ALL Products AND Comparator Config for a Category (COMBINED)
// Single query that fetches both products and comparator config
// Parameters:
// - $categorySlugs: shared category slugs of the comparison. A product is
//   included if it belongs to ANY of these categories (set intersection),
//   so products sharing a common category can be compared even when they
//   each also belong to other categories.
export const queryComparisonPageData = defineQuery(/* groq */ `{
  "products": *[_type == "product" && !(_id in path("drafts.**")) && isArchived != true && count(denormCategorySlugs[@ in $categorySlugs]) > 0] | order(name asc) {
    _id,
    name,
    "slug": slug.current,
    subtitle,
    basePriceCents,
    ${imageFragment('"mainImage": previewImage')},
    brand->{
      _id,
      name,
      "slug": slug.current,
      ${imageFragment('logo')}
    },
    technicalData {
      variants,
      groups[] {
        _key,
        title,
        rows[] {
          _key,
          title,
          values[] {
            _key,
            ${portableTextFragment('content')}
          }
        }
      }
    },
    "categories": categories[defined(@->)]{
      _key,
      ...@->{
        "slug": slug.current,
        name
      }
    }
  },
  "categoryConfigs": *[_type == "comparatorConfig"][0].categoryConfigs[category->slug.current in $categorySlugs] {
    "categorySlug": category->slug.current,
    "enabledParameters": enabledParameters[] {
      name,
      displayName
    }
  }
}`);

export const queryContactSettings = defineQuery(/* groq */ `
  *[_type == "settings"][0].contactSettings {
    supportEmails,
    confirmationEmail {
      subject,
      ${portableTextFragment('content')}
    }
  } 
`);

export const queryB2cTransactionalEmailCopyRecipients = defineQuery(/* groq */ `
  *[_type == "settings"][0].b2cTransactionalEmailCopyRecipients
`);

export const queryB2cWithdrawalForm = defineQuery(/* groq */ `
  *[_type == "settings"][0] {
    "assetUrl": coalesce(
      b2cWithdrawalForm.asset->url,
      b2cLegalDocuments.withdrawalForm.file.asset->url
    ),
    "originalFilename": coalesce(
      b2cWithdrawalForm.asset->originalFilename,
      b2cLegalDocuments.withdrawalForm.file.asset->originalFilename
    ),
    "mimeType": coalesce(
      b2cWithdrawalForm.asset->mimeType,
      b2cLegalDocuments.withdrawalForm.file.asset->mimeType
    )
  }
`);

export const queryB2cReturnInstructionsEmail = defineQuery(/* groq */ `
  *[_type == "settings"][0] {
    ${portableTextFragment('b2cReturnInstructionsEmail')}
  }
`);

export const queryCartSupportCard = defineQuery(/* groq */ `
  *[_type == "settings"][0].cartSupportCard {
    paragraph,
    phoneNumber,
    ${imageFragment('image')}
  }
`);

export const queryCartEmptyState = defineQuery(/* groq */ `
  *[_type == "settings"][0].cartEmptyState {
    heading,
    description,
    buttonText
  }
`);

export const queryMailchimpSettings = defineQuery(/* groq */ `
  *[_type == "settings"][0].mailchimpAudienceId
`);

// CTA shown instead of "Zapytaj o produkt" on archived products without a price
export const queryArchivedProductCta = defineQuery(/* groq */ `
  *[_type == "settings"][0].archivedProductCta {
    text,
    "openInNewTab": url.openInNewTab,
    "href": select(
      url.type == "internal" => url.internal->slug.current,
      url.type == "external" => url.external,
      url.href
    )
  }
`);

export const queryProductInquiryFormState = defineQuery(/* groq */ `
  *[_type == "settings"][0].productInquiryFormState {
    success {
      withIcon,
      ${portableTextFragment('heading')},
      ${portableTextFragment('paragraph')},
      refreshButton,
      refreshButtonText
    },
    error {
      withIcon,
      ${portableTextFragment('heading')},
      ${portableTextFragment('paragraph')},
      refreshButton,
      refreshButtonText
    }
  }
`);

// ----------------------------------------
// Sitemap Queries
// ----------------------------------------

export const queryAllPageSlugsForSitemap = defineQuery(`
  *[_type == "page" && defined(slug.current) && !(_id in path("drafts.**")) && doNotIndex != true] {
    "slug": slug.current,
    _updatedAt
  }
`);

export const queryAllBlogPostSlugsForSitemap = defineQuery(`
  *[_type == "blog-article" && defined(slug.current) && !(_id in path("drafts.**")) && doNotIndex != true] {
    "slug": slug.current,
    _updatedAt
  }
`);

// NOTE: Excludes hidden brands from sitemap - they should not be indexed
export const queryAllBrandSlugsForSitemap = defineQuery(`
  *[_type == "brand" && defined(slug.current) && !(_id in path("drafts.**")) && doNotShowBrand != true && doNotIndex != true] {
    "slug": slug.current,
    _updatedAt
  }
`);

export const queryAllProductSlugsForSitemap = defineQuery(`
  *[_type == "product" && defined(slug.current) && !(_id in path("drafts.**")) && isArchived != true && doNotIndex != true] {
    "slug": slug.current,
    _updatedAt
  }
`);

export const queryAllCpoProductSlugsForSitemap = defineQuery(`
  *[_type == "cpoProduct" && defined(slug.current) && !(_id in path("drafts.**")) && productType == "internal" && isArchived != true] {
    "slug": slug.current,
    _updatedAt
  }
`);

export const queryAllReviewSlugsForSitemap = defineQuery(`
  *[_type == "review" && destinationType == "page" && defined(slug.current) && !(_id in path("drafts.**")) && doNotIndex != true] {
    "slug": slug.current,
    _updatedAt
  }
`);

export const queryAllBlogCategorySlugsForSitemap = defineQuery(`
  *[_type == "blog-category" && defined(slug.current) && !(_id in path("drafts.**")) && doNotIndex != true] {
    "slug": slug.current,
    _updatedAt
  }
`);

// Only include categories that have at least one visible product (not archived, not from hidden brand)
export const queryAllProductCategorySlugsForSitemap = defineQuery(`
  *[_type == "productCategorySub" && defined(slug.current) && !(_id in path("drafts.**")) && doNotIndex != true && count(*[
    _type == "product"
    && defined(slug.current)
    && isArchived != true
    && ${visibleBrandCondition}
    && ^._id in categories[]._ref
  ]) > 0] {
    "slug": slug.current,
    _updatedAt
  }
`);

// Query for archived/hidden products (for /produkty/archiwalne/ page)
// Includes: archived products OR products from hidden brands (doNotShowBrand)
// This ensures all products in sitemap have at least one internal link (SEO)
export const queryArchivedProducts = defineQuery(`
  *[_type == "product" && defined(slug.current) && !(_id in path("drafts.**")) && (isArchived == true || !${visibleBrandCondition})] | order(name asc) {
    "slug": slug.current,
    name
  }
`);

// Query for orphan reviews (for /recenzje/archiwalne/ page)
// Includes reviews that are NOT linked from any visible product (products that are not archived and not from hidden brands)
// This ensures all reviews in sitemap have at least one internal link (SEO)
export const queryOrphanReviews = defineQuery(`
  *[_type == "review" && destinationType == "page" && defined(slug.current) && !(_id in path("drafts.**")) && count(*[
    _type == "product"
    && defined(slug.current)
    && isArchived != true
    && ${visibleBrandCondition}
    && ^._id in reviews[]._ref
  ]) == 0] | order(pt::text(title) asc) {
    "slug": slug.current,
    "name": pt::text(title)
  }
`);
