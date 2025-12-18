# Newsletter Generator V2 - Implementation Plan

## Overview

This document outlines the implementation plan for enhancing the Newsletter Generator tool with new features including collapsible sections, list enable/disable switches, product publication fields, and a customizable hero section.

---

## 1. Changes Summary

### 1.1 UI Enhancements (Newsletter Tool)

- Transform content lists into collapsible dropdowns (open by default)
- Reorder lists: Reviews → Blog Articles → Products
- Add switch to enable/disable entire lists (excludes from newsletter when off)

### 1.2 Sanity Schema Changes

- Add `publicationData` object to Product schema with:
  - `publicationImage` (optional image)
  - `publicationDescription` (optional portable text)

### 1.3 Publication Components Update

- Allow products with publication data in `FeaturedPublications` and `LatestPublication`

### 1.4 Newsletter Email Template

- Replace static hero with customizable content:
  - Hero image (required, 16/10 aspect ratio)
  - Hero text (optional, portable text)

---

## 2. Detailed Implementation

### Phase 1: Sanity Schema - Product Publication Fields

**Location**: `apps/studio/schemaTypes/documents/collections/product.ts`

#### 2.1.1 Create Publication Data Object

Add a new field after the existing `shortDescription` field:

```typescript
defineField({
  name: "publicationData",
  title: "Dane publikacji (Newsletter/Wyróżnione)",
  type: "object",
  description:
    "Opcjonalne dane używane gdy produkt jest wyświetlany jako publikacja w newsletterze lub sekcjach 'Wyróżnione publikacje'/'Najnowsza publikacja'. Jeśli nie wypełnione, produkt nie może być użyty jako publikacja.",
  group: GROUP.MAIN_CONTENT,
  fields: [
    defineField({
      name: "publicationImage",
      title: "Obraz publikacji",
      type: "image",
      description:
        "Obraz wyświetlany gdy produkt jest prezentowany jako publikacja. Zalecany format 16:10. Jeśli nie ustawiono, w newsletterze zostanie użyte zdjęcie główne produktu.",
      options: {
        hotspot: true,
      },
    }),
    customPortableText({
      name: "publicationDescription",
      title: "Opis publikacji",
      description:
        "Opis wyświetlany gdy produkt jest prezentowany jako publikacja (newsletter, karuzele publikacji).",
      optional: true,
      include: {
        styles: ["normal"],
        lists: ["bullet", "number"],
        decorators: ["strong", "em"],
        annotations: ["customLink"],
      },
    }),
  ],
}),
```

#### 2.1.2 Update Product Preview

No changes needed - preview already uses `previewImage`.

---

### Phase 2: Update Publication Schemas

**Locations**:

- `apps/studio/schemaTypes/blocks/featured-publications.ts`
- `apps/studio/schemaTypes/blocks/latest-publication.ts`

#### 2.2.1 Featured Publications Schema

Update the `publications` field to include products:

```typescript
defineField({
  name: "publications",
  title: "Wyróżnione publikacje",
  type: "array",
  description:
    "Wybierz publikacje do wyświetlenia w karuzeli (5-10 elementów). Produkty mogą być dodane tylko jeśli mają ustawiony obraz lub opis publikacji.",
  of: [
    {
      type: "reference",
      to: [{ type: "blog-article" }, { type: "review" }, { type: "product" }],
      options: {
        disableNew: true,
        filter: ({ parent }) => {
          const selectedIds =
            (parent as { _ref?: string }[])
              ?.filter((item) => item._ref)
              .map((item) => item._ref) || [];
          return {
            // Products must have publication image OR publication description
            filter: `!(_id in $selectedIds) && !(_id in path("drafts.**")) && (
              _type != "product" ||
              (defined(publicationData.publicationImage) || defined(publicationData.publicationDescription))
            )`,
            params: { selectedIds },
          };
        },
      },
    },
  ],
  // ... rest of validation
}),
```

#### 2.2.2 Latest Publication Schema

Update the `publication` field similarly:

```typescript
defineField({
  name: "publication",
  title: "Wybierz publikację",
  type: "reference",
  description:
    "Wybierz najnowszą publikację - może być to artykuł blogowy, recenzja lub produkt (z danymi publikacji)",
  to: [{ type: "blog-article" }, { type: "review" }, { type: "product" }],
  options: {
    filter: `!(_id in path("drafts.**")) && (
      _type != "product" ||
      (defined(publicationData.publicationImage) || defined(publicationData.publicationDescription))
    )`,
  },
  validation: (Rule) => Rule.required().error("Publikacja jest wymagana"),
}),
```

---

### Phase 3: Update Publication Query Fragment

**Location**: `apps/web/src/global/sanity/query.ts`

#### 2.3.1 Update Publication Block

Update the `publicationBlock` fragment to handle products:

```groq
export const publicationBlock = /* groq */ `
  _id,
  _type,
  _createdAt,
  "publishDate": select(
    _type == "review" => coalesce(publishedDate, _createdAt),
    _type == "blog-article" => coalesce(publishedDate, _createdAt),
    _type == "product" => coalesce(publishedDate, _createdAt),
    _createdAt
  ),
  "name": select(
    _type == "review" => pt::text(title),
    _type == "product" => name,
    name
  ),
  ${portableTextFragment('title')},
  "description": select(
    _type == "review" && count(description) > 0 => description,
    _type == "review" => content[_type == "block"][0...3],
    _type == "product" && defined(publicationData.publicationDescription) => publicationData.publicationDescription,
    ${portableTextFragment('description')}
  ),
  "image": select(
    _type == "product" && defined(publicationData.publicationImage) => publicationData.publicationImage,
    _type == "product" => previewImage,
    ${imageFragment('image')}
  ),
  "publicationType": select(
    _type == "review" => "Recenzja",
    _type == "blog-article" => category->name,
    _type == "product" => "Produkt",
    "Artykuł"
  ),
  "destinationType": select(
    _type == "review" => coalesce(destinationType, "page"),
    "page"
  ),
  "slug": select(
    _type == "review" && destinationType == "page" => slug.current,
    _type == "review" && destinationType == "pdf" => pdfSlug.current,
    _type == "review" && destinationType == "external" => externalUrl,
    _type == "blog-article" => slug.current,
    _type == "product" => slug.current,
    slug.current
  ),
  "openInNewTab": select(
    _type == "review" && destinationType == "external" => true,
    _type == "review" && destinationType == "pdf" => true,
    false
  ),
  "author": select(
    _type == "review" => author->{
      name,
      ${imageFragment('image')}
    },
    null
  ),
`;
```

---

### Phase 4: Newsletter Tool UI Updates

**Location**: `apps/studio/tools/newsletter/index.tsx`

#### 2.4.1 New State Variables

```typescript
// List visibility/enabled state
const [listsEnabled, setListsEnabled] = useState<Record<string, boolean>>({
  reviews: true,
  articles: true,
  products: true,
});

// Collapsed/expanded state for dropdowns
const [listsExpanded, setListsExpanded] = useState<Record<string, boolean>>({
  reviews: true,
  articles: true,
  products: true,
});

// Hero configuration
const [heroImage, setHeroImage] = useState<{
  _type: 'image';
  asset: { _ref: string; _type: 'reference' };
} | null>(null);
const [heroText, setHeroText] = useState<PortableTextBlock[] | null>(null);
```

#### 2.4.2 List Toggle Handler

```typescript
const toggleListEnabled = (listKey: string) => {
  setListsEnabled((prev) => {
    const newEnabled = !prev[listKey];

    // If disabling, collapse the list
    if (!newEnabled) {
      setListsExpanded((prevExpanded) => ({
        ...prevExpanded,
        [listKey]: false,
      }));
    }

    return { ...prev, [listKey]: newEnabled };
  });
};

const toggleListExpanded = (listKey: string) => {
  // Only allow expanding if the list is enabled
  if (!listsEnabled[listKey]) return;

  setListsExpanded((prev) => ({
    ...prev,
    [listKey]: !prev[listKey],
  }));
};
```

#### 2.4.3 Updated ContentGroup Component

```tsx
function ContentGroup({
  title,
  listKey,
  items,
  selectedIds,
  onToggle,
  isEnabled,
  isExpanded,
  onToggleEnabled,
  onToggleExpanded,
}: {
  title: string;
  listKey: string;
  items: ContentItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  isEnabled: boolean;
  isExpanded: boolean;
  onToggleEnabled: () => void;
  onToggleExpanded: () => void;
}) {
  return (
    <Stack space={3}>
      <Flex align='center' justify='space-between'>
        <Flex align='center' gap={3}>
          <Switch checked={isEnabled} onChange={onToggleEnabled} />
          <Heading
            size={1}
            style={{
              opacity: isEnabled ? 1 : 0.5,
              cursor: isEnabled ? 'pointer' : 'default',
            }}
            onClick={onToggleExpanded}>
            {title} ({items.length})
          </Heading>
        </Flex>
        {isEnabled && (
          <Button
            icon={isExpanded ? ChevronUpIcon : ChevronDownIcon}
            mode='bleed'
            onClick={onToggleExpanded}
          />
        )}
      </Flex>

      {isEnabled && isExpanded && (
        <Card border radius={2}>
          {items.map((item, index) => (
            <Flex
              key={item._id}
              align='center'
              padding={3}
              style={{
                borderBottom:
                  index < items.length - 1 ? '1px solid #e6e8eb' : 'none',
              }}
              gap={3}>
              <Checkbox
                checked={selectedIds.has(item._id)}
                onChange={() => onToggle(item._id)}
              />
              <Box flex={1}>
                <Text
                  weight='semibold'
                  size={1}
                  style={{ marginBottom: '0.75rem' }}>
                  {item.title || item.name}
                </Text>
                <Text size={1} muted textOverflow='ellipsis'>
                  {new Date(item.publishDate).toLocaleDateString('pl-PL')} •{' '}
                  {item.shortDescription ||
                    item.description?.substring(0, 60) ||
                    'Brak opisu'}
                  ...
                </Text>
              </Box>
              {item.image && (
                <img
                  src={item.image}
                  alt=''
                  style={{
                    width: 40,
                    height: 40,
                    objectFit:
                      item.imageSource === 'preview' ? 'contain' : 'cover',
                    borderRadius: 4,
                  }}
                />
              )}
            </Flex>
          ))}
        </Card>
      )}
    </Stack>
  );
}
```

#### 2.4.4 Hero Section Configuration UI

Add before the content lists:

```tsx
{
  /* Hero Configuration */
}
<Card padding={4} tone='transparent' radius={2} border>
  <Stack space={4}>
    <Heading size={1}>Konfiguracja nagłówka newslettera</Heading>

    {/* Hero Image - Required */}
    <Stack space={2}>
      <Label>Obraz nagłówka (wymagany, 16:10)</Label>
      <ImageInput
        value={heroImage}
        onChange={(image) => setHeroImage(image)}
        // Using Sanity's asset source
      />
      {!heroImage && (
        <Text size={1} muted>
          Wybierz obraz z biblioteki mediów. Zalecany format 16:10.
        </Text>
      )}
    </Stack>

    {/* Hero Text - Optional */}
    <Stack space={2}>
      <Label>Tekst nagłówka (opcjonalny)</Label>
      <PortableTextInput
        value={heroText}
        onChange={(text) => setHeroText(text)}
        // Simplified portable text with heading, normal, bold, italic
      />
      <Text size={1} muted>
        Opcjonalny tekst wyświetlany pod obrazem nagłówka.
      </Text>
    </Stack>
  </Stack>
</Card>;
```

#### 2.4.5 Updated handleAction Function

Update the payload to include:

1. Only enabled lists
2. Hero configuration

```typescript
const handleAction = async (action: "download-html" | "create-mailchimp-draft") => {
  // Validate hero image
  if (!heroImage) {
    toast.push({
      status: "warning",
      title: "Brak obrazu nagłówka",
      description: "Wybierz obraz nagłówka przed generowaniem newslettera.",
    });
    return;
  }

  setIsGenerating(true);

  // Filter content based on selection AND enabled lists
  const payloadContent = {
    articles: listsEnabled.articles
      ? content.articles.filter((i) => selectedIds.has(i._id))
      : [],
    reviews: listsEnabled.reviews
      ? content.reviews.filter((i) => selectedIds.has(i._id))
      : [],
    products: listsEnabled.products
      ? content.products.filter((i) => selectedIds.has(i._id))
      : [],
  };

  // ... validation ...

  try {
    const response = await fetch(NEWSLETTER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        startDate,
        endDate,
        content: payloadContent,
        hero: {
          image: heroImage,
          text: heroText,
        },
      }),
    });
    // ... rest of handler
  }
};
```

#### 2.4.6 Reordered Content Lists Rendering

```tsx
{/* Content List - Reordered: Reviews, Articles, Products */}
{hasItems ? (
  <Stack space={5}>
    {/* Reviews - First */}
    {content.reviews.length > 0 && (
      <ContentGroup
        title="Recenzje"
        listKey="reviews"
        items={content.reviews}
        selectedIds={selectedIds}
        onToggle={toggleItem}
        isEnabled={listsEnabled.reviews}
        isExpanded={listsExpanded.reviews}
        onToggleEnabled={() => toggleListEnabled("reviews")}
        onToggleExpanded={() => toggleListExpanded("reviews")}
      />
    )}

    {/* Blog Articles - Second */}
    {content.articles.length > 0 && (
      <ContentGroup
        title="Artykuły Blogowe"
        listKey="articles"
        items={content.articles}
        selectedIds={selectedIds}
        onToggle={toggleItem}
        isEnabled={listsEnabled.articles}
        isExpanded={listsExpanded.articles}
        onToggleEnabled={() => toggleListEnabled("articles")}
        onToggleExpanded={() => toggleListExpanded("articles")}
      />
    )}

    {/* Products - Third */}
    {content.products.length > 0 && (
      <ContentGroup
        title="Produkty"
        listKey="products"
        items={content.products}
        selectedIds={selectedIds}
        onToggle={toggleItem}
        isEnabled={listsEnabled.products}
        isExpanded={listsExpanded.products}
        onToggleEnabled={() => toggleListEnabled("products")}
        onToggleExpanded={() => toggleListExpanded("products")}
      />
    )}
    {/* Actions */}
    {/* ... existing action buttons ... */}
  </Stack>
) : (
  // ... empty state ...
)}
```

---

### Phase 5: Update Newsletter GROQ Query

**Location**: `apps/studio/tools/newsletter/index.tsx`

Update the fetchContent query to include product publication data:

```groq
const query = `*[_type in ["blog-article", "review", "product"] && !(_id in path("drafts.**")) && coalesce(publishedDate, _createdAt) >= $startDate && coalesce(publishedDate, _createdAt) <= $endDate + "T23:59:59Z"] | order(coalesce(publishedDate, _createdAt) desc) {
  _id,
  _type,
  "title": pt::text(title),
  name,
  "description": select(
    _type == "product" && defined(publicationData.publicationDescription) => pt::text(publicationData.publicationDescription),
    pt::text(description)
  ),
  "shortDescription": pt::text(shortDescription),
  "image": select(
    _type == "product" && defined(publicationData.publicationImage) => publicationData.publicationImage.asset->url,
    _type == "product" && defined(previewImage) => previewImage.asset->url,
    _type == "product" => imageGallery[0].asset->url,
    image.asset->url
  ),
  "imageSource": select(
    _type == "product" && defined(publicationData.publicationImage) => "publication",
    _type == "product" && defined(previewImage) => "preview",
    _type == "product" => "gallery",
    "default"
  ),
  "slug": select(
    _type == "review" && destinationType == "page" => slug.current,
    _type == "review" && destinationType == "pdf" => "/recenzje/pdf/" + string::split(lower(pdfFile.asset->originalFilename), ".pdf")[0],
    _type == "review" && destinationType == "external" => externalUrl,
    slug.current
  ),
  "destinationType": select(
    _type == "review" => coalesce(destinationType, "page"),
    null
  ),
  "openInNewTab": select(
    _type == "review" && destinationType == "external" => true,
    _type == "review" && destinationType == "pdf" => true,
    false
  ),
  _createdAt,
  publishedDate,
  "publishDate": coalesce(publishedDate, _createdAt),
  "brandName": select(
    _type == "product" => brand->name,
    null
  ),
  "hasPublicationData": select(
    _type == "product" => defined(publicationData.publicationImage) || defined(publicationData.publicationDescription),
    true
  )
}`;
```

---

### Phase 6: Newsletter Email Template Updates

**Location**: `apps/web/src/emails/newsletter-template.tsx`

#### 2.6.1 Update Props Interface

```typescript
export interface NewsletterContent {
  articles: Array<{
    _id: string;
    title: string;
    description?: string;
    image?: string;
    slug: string;
    _createdAt: string;
  }>;
  reviews: Array<{
    _id: string;
    title: string;
    name: string;
    description?: string;
    image?: string;
    slug: string;
    destinationType?: 'page' | 'pdf' | 'external';
    openInNewTab?: boolean;
    _createdAt: string;
    authorName?: string;
  }>;
  products: Array<{
    _id: string;
    name: string;
    subtitle?: string;
    shortDescription?: string;
    description?: string; // NEW: from publicationDescription
    image?: string;
    slug: string;
    _createdAt: string;
    brandName?: string;
  }>;
}

interface HeroConfig {
  image: string; // URL from Sanity asset
  text?: PortableTextBlock[]; // Optional portable text
}

interface NewsletterTemplateProps {
  content: NewsletterContent;
  dateRange?: string;
  hero: HeroConfig; // Required hero configuration
}
```

#### 2.6.2 Update Hero Section

Replace the existing header section:

```tsx
{
  /* Hero Section */
}
<Section style={heroSection}>
  <Img
    src={hero.image}
    width='600'
    height='auto'
    alt='Audiofast Newsletter'
    style={heroImage}
  />
  {hero.text && hero.text.length > 0 && (
    <Section style={heroTextSection}>
      {/* Render portable text to HTML */}
      {renderHeroText(hero.text)}
    </Section>
  )}
</Section>;
```

#### 2.6.3 Add Hero Text Renderer

```typescript
// Helper to render portable text for email
function renderHeroText(blocks: PortableTextBlock[]): React.ReactNode {
  return blocks.map((block, index) => {
    if (block._type !== 'block') return null;

    const style = block.style || 'normal';
    const children = block.children?.map((child, childIndex) => {
      let text = child.text || '';

      // Apply marks (bold, italic)
      if (child.marks?.includes('strong')) {
        text = `<strong>${text}</strong>`;
      }
      if (child.marks?.includes('em')) {
        text = `<em>${text}</em>`;
      }

      return text;
    }).join('');

    if (style === 'h1' || style === 'h2') {
      return (
        <Heading key={index} style={heroHeading}>
          <span dangerouslySetInnerHTML={{ __html: children }} />
        </Heading>
      );
    }

    return (
      <Text key={index} style={heroText}>
        <span dangerouslySetInnerHTML={{ __html: children }} />
      </Text>
    );
  });
}
```

#### 2.6.4 Update Products Section

Update to use publication description when available:

```tsx
{
  /* Products */
}
{
  products.length > 0 && (
    <Section style={section}>
      <Heading style={h2}>Nowości Produktowe</Heading>
      {products.map((item) => (
        <Section key={item._id} style={itemContainer}>
          {item.image && (
            <Img
              src={item.image}
              alt={item.name}
              style={itemImage}
              width='600'
              height='auto'
            />
          )}
          <Text style={metaText}>{item.brandName || 'Audiofast'}</Text>
          <Heading style={h3}>
            <Link href={`${baseUrl}${item.slug}`} style={linkTitle}>
              {item.name}
            </Link>
          </Heading>
          {item.subtitle && <Text style={subtitleText}>{item.subtitle}</Text>}
          {/* Use description (publication) or shortDescription, or nothing */}
          {(item.description || item.shortDescription) && (
            <Text style={itemDescription}>
              {item.description || item.shortDescription}
            </Text>
          )}
          <Button href={`${baseUrl}${item.slug}`} style={button}>
            Zobacz produkt
          </Button>
        </Section>
      ))}
    </Section>
  );
}
```

#### 2.6.5 Add New Styles

```typescript
const heroSection = {
  marginBottom: '32px',
};

const heroImageStyle = {
  width: '100%',
  height: 'auto',
  display: 'block',
};

const heroTextSection = {
  padding: '24px 20px',
  textAlign: 'center' as const,
};

const heroHeading = {
  color: '#303030',
  fontSize: '24px',
  fontWeight: '500',
  lineHeight: '1.3',
  margin: '0 0 16px',
  fontFamily: 'Arial, Helvetica, sans-serif',
};

const heroTextStyle = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#5b5a5a',
  margin: '0 0 12px',
};
```

---

### Phase 7: API Route Updates

**Location**: `apps/web/src/app/api/newsletter/generate/route.ts`

#### 2.7.1 Update Payload Interface

```typescript
interface GeneratePayload {
  action: 'download-html' | 'create-mailchimp-draft';
  startDate?: string;
  endDate?: string;
  content: NewsletterContent;
  hero: {
    image: string; // Sanity asset URL
    text?: any[]; // Portable text blocks
  };
  subject?: string;
}
```

#### 2.7.2 Update Template Rendering

```typescript
// Validate hero image
if (!body.hero?.image) {
  return NextResponse.json(
    { error: 'Hero image is required' },
    { status: 400, headers: corsHeaders }
  );
}

// Generate the HTML email with hero config
const emailHtml = await render(
  NewsletterTemplate({
    content,
    dateRange: dateRangeDisplay,
    hero: body.hero,
  })
);
```

---

## 3. Frontend Component Updates

### 3.1 LatestPublication Component

**Location**: `apps/web/src/components/pageBuilder/LatestPublication/index.tsx`

Update to handle product type:

```tsx
export default function LatestPublication({
  heading,
  publication,
  index,
}: LatestPublicationProps) {
  const {
    _type,
    _createdAt,
    publishDate,
    slug,
    title,
    description,
    image,
    publicationType,
    openInNewTab,
  } = publication!;

  // Determine button text based on publication type
  const buttonText =
    _type === 'product' ? 'Zobacz produkt' : 'Przeczytaj recenzję';

  return (
    <section className={`${styles.latestPublication} max-width`}>
      {/* ... existing code ... */}
      <Button href={slug} text={buttonText} openInNewTab={openInNewTab} />
    </section>
  );
}
```

### 3.2 PublicationCard Component

**Location**: `apps/web/src/components/ui/PublicationCard/index.tsx`

Update button text logic:

```tsx
{
  layout === 'vertical' && (
    <Button
      tabIndex={-1}
      text={
        publication._type === 'product' ? 'Zobacz produkt' : 'Czytaj artykuł'
      }
      variant='primary'
    />
  );
}
```

---

## 4. Asset Picker for Hero Image

The hero image picker in the Newsletter Tool needs to use Sanity's asset source. Options:

### Option A: Use FormBuilder with Image Input (Recommended)

```tsx
import { FormBuilder, useFormBuilder } from 'sanity';

// In the tool component
const [heroImageAsset, setHeroImageAsset] = useState(null);

// Use Sanity's built-in image input
<ImageInput
  elementProps={{}}
  value={heroImageAsset}
  onChange={(event) => setHeroImageAsset(event.value)}
  schemaType={{
    name: 'image',
    type: 'image',
    options: { hotspot: true },
  }}
/>;
```

### Option B: Use Asset Source Dialog

```tsx
import { useClient } from 'sanity';

// Open asset browser programmatically
const openAssetBrowser = () => {
  // Implementation using Sanity's asset source API
};
```

---

## 5. Testing Checklist

### 5.1 Sanity Schema

- [ ] Product publication fields appear in Studio
- [ ] Optional fields work correctly (none, image only, description only, both)
- [ ] Products with publication data appear in FeaturedPublications reference picker
- [ ] Products without publication data are filtered out from publication pickers

### 5.2 Newsletter Tool

- [ ] Lists appear in correct order: Reviews, Articles, Products
- [ ] Dropdown collapse/expand works
- [ ] Switch disables entire list and collapses dropdown
- [ ] Disabled list items not included in newsletter
- [ ] Hero image picker opens Sanity media library
- [ ] Hero text input works with portable text
- [ ] Validation prevents generation without hero image

### 5.3 Email Template

- [ ] Hero image displays at 16:10 ratio
- [ ] Hero text renders with formatting (bold, italic, headings)
- [ ] Products show publication description when available
- [ ] Products fallback to shortDescription when no publication description
- [ ] Products fallback to preview image when no publication image

### 5.4 Frontend Components

- [ ] LatestPublication works with products
- [ ] FeaturedPublications works with products
- [ ] Correct button text for products vs articles

---

## 6. Migration Notes

### 6.1 Existing Products

No migration needed - `publicationData` is optional. Products without it will:

- Not appear in publication pickers
- Continue to work in newsletter using preview image and no description

### 6.2 Backward Compatibility

- Newsletter tool will work with existing data
- Products without publication data still appear in newsletter product section
- Frontend components gracefully handle missing publication data

---

## 7. File Changes Summary

| File                                                              | Change Type                       |
| ----------------------------------------------------------------- | --------------------------------- |
| `apps/studio/schemaTypes/documents/collections/product.ts`        | Add `publicationData` object      |
| `apps/studio/schemaTypes/blocks/featured-publications.ts`         | Add product reference with filter |
| `apps/studio/schemaTypes/blocks/latest-publication.ts`            | Add product reference with filter |
| `apps/studio/tools/newsletter/index.tsx`                          | Major UI updates                  |
| `apps/web/src/global/sanity/query.ts`                             | Update publication fragment       |
| `apps/web/src/emails/newsletter-template.tsx`                     | Update hero, product handling     |
| `apps/web/src/app/api/newsletter/generate/route.ts`               | Update payload handling           |
| `apps/web/src/components/pageBuilder/LatestPublication/index.tsx` | Handle product type               |
| `apps/web/src/components/ui/PublicationCard/index.tsx`            | Handle product type               |

---

## 8. Estimated Effort

| Phase                        | Estimated Time |
| ---------------------------- | -------------- |
| Phase 1: Product Schema      | 30 min         |
| Phase 2: Publication Schemas | 30 min         |
| Phase 3: Query Fragment      | 45 min         |
| Phase 4: Newsletter Tool UI  | 2-3 hours      |
| Phase 5: Newsletter Query    | 30 min         |
| Phase 6: Email Template      | 1-2 hours      |
| Phase 7: API Route           | 30 min         |
| Phase 8: Frontend Components | 30 min         |
| Testing & Polish             | 1-2 hours      |
| **Total**                    | **7-10 hours** |
