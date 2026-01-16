# Portable Text Array Unification Plan

## Problem Description

### Current Issue

We have an **array of arrays** structure in Sanity that causes duplication issues when moving custom components:

- `brandContentBlocks` (array) → contains `contentBlockText` (object) → contains `content` (portable text array)
- `product.details.content` (array) → contains `contentBlockText` (object) → contains `content` (portable text array)

This **nested array structure** is a known Sanity anti-pattern that leads to:

1. Duplication of custom components when reordering
2. Unstable `_key` generation
3. Complex migration and data handling

### Visual Representation

**Current Structure (problematic):**

```
brandContentBlocks: [
  {
    _type: "contentBlockText",
    content: [  // ← portable text (array inside array = problem)
      { _type: "block", children: [...] },
      { _type: "ptPageBreak" },  // column divider
      { _type: "block", children: [...] }
    ]
  },
  {
    _type: "contentBlockText",
    content: [...]  // another portable text block - single column
  },
  {
    _type: "contentBlockYoutube",
    youtubeId: "..."
  }
]
```

**Target Structure (unified):**

```
brandDetailContent: [  // single flat portable text array
  { _type: "block", children: [...] },
  { _type: "ptPageBreak" },  // start two columns
  { _type: "block", children: [...] },
  { _type: "ptColumnEnd" },  // NEW: end two columns, back to single
  { _type: "block", children: [...] },
  { _type: "ptYoutubeVideo", youtubeId: "..." },
  { _type: "ptPageBreak" },  // start new two columns section
  { _type: "block", children: [...] }
  // no end = two columns until end of content
]
```

### Column Divider Logic

The new unified structure requires a **Column End** component to handle multiple layout sections:

| Scenario                                  | Behavior                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `ptPageBreak` only                        | Two columns from break to end of content                                               |
| `ptPageBreak` → content → `ptColumnEnd`   | Two columns section, then back to single column                                        |
| `ptPageBreak` → content → `ptPageBreak`   | Continuous two columns (first break starts, second is ignored or treated as separator) |
| `ptColumnEnd` without prior `ptPageBreak` | Ignored (no-op)                                                                        |

---

## Implementation Phases

### Phase 1: Schema Changes (Brand Only)

**Goal:** Add new unified portable text field to brand schema alongside existing field.

#### Step 1.1: Create `ptColumnEnd` component

Create a new portable text component for ending column layout:

**File:** `apps/studio/schemaTypes/portableText/column-end.ts`

```typescript
import { ColumnsIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const ptColumnEnd = defineType({
  name: 'ptColumnEnd',
  type: 'object',
  title: 'Koniec kolumn',
  icon: ColumnsIcon,
  description:
    "Kończy układ dwukolumnowy i wraca do pojedynczej kolumny. Użyj po 'Podział kolumn' aby zamknąć sekcję dwukolumnową.",
  fields: [
    defineField({
      name: 'style',
      title: 'Styl',
      type: 'string',
      initialValue: 'columnEnd',
      hidden: true,
      readOnly: true,
    }),
  ],
  preview: {
    prepare: () => ({
      title: 'Koniec kolumn',
      subtitle: 'Powrót do układu jednokolumnowego',
      media: ColumnsIcon,
    }),
  },
});
```

#### Step 1.2: Register component in portable text registry

**File:** `apps/studio/schemaTypes/portableText/index.ts`

Add to `ALL_CUSTOM_COMPONENTS`:

```typescript
{ name: "ptColumnEnd", type: "ptColumnEnd" },
```

Export the schema:

```typescript
export { ptColumnEnd } from './column-end';
```

#### Step 1.3: Add new field to brand schema

**File:** `apps/studio/schemaTypes/documents/collections/brand.ts`

Add new field right after existing `brandContentBlocks`:

```typescript
customPortableText({
  name: "brandDetailContent",
  title: "Szczegółowy opis (nowy format)",
  description:
    "Zunifikowana treść marki. Użyj 'Podział kolumn' i 'Koniec kolumn' do tworzenia sekcji dwukolumnowych.",
  group: GROUP.MAIN_CONTENT,
  include: {
    styles: ["normal", "h3"],
    lists: ["bullet", "number"],
    decorators: ["strong", "em"],
    annotations: ["customLink"],
  },
  components: [
    "ptMinimalImage",
    "ptInlineImage",
    "ptHeading",
    "ptYoutubeVideo",
    "ptVimeoVideo",
    "ptPageBreak",      // column divider start
    "ptColumnEnd",      // NEW: column divider end
    "ptHorizontalLine",
    "ptReviewEmbed",
  ],
  optional: true,
}),
```

---

### Phase 2: Frontend Updates with Fallback

**Goal:** Update frontend to read new field first, fallback to old field if empty.

#### Step 2.1: Create `ptColumnEnd` frontend component

**File:** `apps/web/src/components/portableText/ColumnEnd/index.tsx`

```tsx
import styles from './styles.module.scss';

/**
 * ColumnEnd component for portable text
 * Indicates the end of a two-column section, returning to single column
 */
export function ColumnEndComponent() {
  return (
    <div className={styles.columnEnd} role='separator' aria-hidden='true' />
  );
}
```

**File:** `apps/web/src/components/portableText/ColumnEnd/styles.module.scss`

```scss
.columnEnd {
  // Marker element - actual layout logic is handled by parent container
  display: block;
  width: 100%;
  height: 0;
}
```

#### Step 2.2: Register component in portable text renderer

**File:** `apps/web/src/components/portableText/index.tsx`

Add to types:

```typescript
ptColumnEnd: () => {
  return <ColumnEndComponent />;
},
```

#### Step 2.3: Create unified content renderer

**File:** `apps/web/src/components/ui/UnifiedContentBlocks/index.tsx`

New component that handles the unified portable text with column sections:

```tsx
import type { PortableTextProps } from '@/src/global/types';
import PortableText from '../../portableText';
import styles from './styles.module.scss';

interface UnifiedContentBlocksProps {
  content: PortableTextProps;
  className?: string;
}

type ContentSection = {
  type: 'single' | 'two-column';
  content: PortableTextProps;
  leftContent?: PortableTextProps;
  rightContent?: PortableTextProps;
};

/**
 * Split content into sections based on ptPageBreak and ptColumnEnd markers
 */
function splitIntoSections(content: PortableTextProps): ContentSection[] {
  if (!content || !Array.isArray(content)) return [];

  const sections: ContentSection[] = [];
  let currentContent: any[] = [];
  let inTwoColumnMode = false;
  let leftContent: any[] = [];
  let rightContent: any[] = [];

  for (const item of content) {
    const itemType =
      item && typeof item === 'object' && '_type' in item
        ? (item as { _type: string })._type
        : null;

    if (itemType === 'ptPageBreak') {
      // Starting or continuing two-column mode
      if (!inTwoColumnMode) {
        // Flush any single-column content first
        if (currentContent.length > 0) {
          sections.push({ type: 'single', content: currentContent });
          currentContent = [];
        }
        inTwoColumnMode = true;
        leftContent = [];
        rightContent = [];
      } else {
        // Already in two-column mode - this starts right column
        // Content before this goes to left, content after goes to right
        // (handled naturally by the loop)
      }
    } else if (itemType === 'ptColumnEnd') {
      // Ending two-column mode
      if (inTwoColumnMode) {
        sections.push({
          type: 'two-column',
          content: [...leftContent, ...rightContent],
          leftContent,
          rightContent,
        });
        leftContent = [];
        rightContent = [];
        inTwoColumnMode = false;
      }
      // If not in two-column mode, ignore
    } else {
      // Regular content
      if (inTwoColumnMode) {
        // Check if we've hit a page break already in this section
        const hasHitBreak = leftContent.length > 0;
        if (!hasHitBreak) {
          leftContent.push(item);
        } else {
          rightContent.push(item);
        }
      } else {
        currentContent.push(item);
      }
    }
  }

  // Flush remaining content
  if (inTwoColumnMode) {
    sections.push({
      type: 'two-column',
      content: [...leftContent, ...rightContent],
      leftContent,
      rightContent,
    });
  } else if (currentContent.length > 0) {
    sections.push({ type: 'single', content: currentContent });
  }

  return sections;
}

export default function UnifiedContentBlocks({
  content,
  className,
}: UnifiedContentBlocksProps) {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return null;
  }

  const sections = splitIntoSections(content);

  return (
    <div className={`${styles.unifiedContent} ${className || ''}`}>
      {sections.map((section, index) => {
        if (section.type === 'single') {
          return (
            <div key={index} className={styles.singleColumn}>
              <PortableText value={section.content} enablePortableTextStyles />
            </div>
          );
        }

        // Two-column section
        return (
          <div key={index} className={styles.twoColumn}>
            <div className={styles.leftColumn}>
              <PortableText
                value={section.leftContent}
                enablePortableTextStyles
              />
            </div>
            <div className={styles.rightColumn}>
              <PortableText
                value={section.rightContent}
                enablePortableTextStyles
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

#### Step 2.4: Update query fragment

**File:** `apps/web/src/global/sanity/query.ts`

Add new fragment for unified content:

```groq
const brandDetailContentFragment = (name: string = 'brandDetailContent') => /* groq */ `
  ${name}[]{
    ...,
    _type == "ptReviewEmbed" => {
      ...,
      review->{
        _id,
        ${portableTextFragment('title')},
        "slug": slug.current,
        ${imageFragment('image')},
        ${portableTextFragment('description')},
      }
    },
  }
`;
```

Update brand query to fetch both:

```groq
${brandDetailContentFragment('brandDetailContent')},
${brandContentBlocksFragment('brandContentBlocks')},
```

#### Step 2.5: Update TwoColumnContent with fallback

**File:** `apps/web/src/components/ui/TwoColumnContent/index.tsx`

Add support for new unified content format:

```tsx
export interface TwoColumnContentProps {
  // New unified portable text format
  unifiedContent?: PortableTextProps;
  // Legacy content blocks format
  contentBlocks?: ContentBlock[] | null;
  // etc...
}

export default function TwoColumnContent({
  unifiedContent,
  contentBlocks,
  // ...
}) {
  const hasUnifiedContent =
    unifiedContent &&
    Array.isArray(unifiedContent) &&
    unifiedContent.length > 0;
  const hasContentBlocks =
    contentBlocks && Array.isArray(contentBlocks) && contentBlocks.length > 0;

  // Prefer new format, fallback to legacy
  if (hasUnifiedContent) {
    return <UnifiedContentBlocks content={unifiedContent} />;
  }

  if (hasContentBlocks) {
    return <ContentBlocks blocks={contentBlocks} />;
  }

  return null;
}
```

#### Step 2.6: Update brand page

**File:** `apps/web/src/app/marki/[slug]/page.tsx`

```tsx
<TwoColumnContent
  unifiedContent={brand.brandDetailContent} // NEW - try first
  contentBlocks={brand.brandContentBlocks as ContentBlock[]} // FALLBACK
  customId='o-marce'
  distributionYear={brand.distributionYear}
  gallery={brand.imageGallery as SanityRawImage[]}
/>
```

---

### Phase 3: Testing

**Goal:** Verify the new structure works correctly before migration.

#### Test Cases:

1. **Empty new field** → Should render old content blocks
2. **New field populated** → Should render new unified content
3. **Single column content** → Renders as single column
4. **Content with ptPageBreak** → Renders as two columns from break to end
5. **Content with ptPageBreak + ptColumnEnd** → Two columns section, then single column
6. **Multiple column sections** → Multiple two-column sections with single-column between
7. **YouTube/Vimeo in unified content** → Videos render correctly
8. **Horizontal lines** → Render correctly
9. **Review embeds** → Render correctly

---

### Phase 4: Data Migration (Brand)

**Goal:** Migrate existing brandContentBlocks to brandDetailContent.

#### Step 4.1: Create migration script

**File:** `apps/studio/scripts/migration/brands/migrate-to-unified-content.ts`

```typescript
/**
 * Migration script: Brand content blocks → Unified portable text
 *
 * Transforms array of contentBlockText/youtube/vimeo/hr
 * into single portable text array with proper column markers
 */

// Logic:
// 1. For each brand with brandContentBlocks
// 2. Flatten all contentBlockText.content into single array
// 3. Insert ptColumnEnd after each contentBlockText that has a ptPageBreak
//    (because the next block was on single column)
// 4. Convert contentBlockYoutube → ptYoutubeVideo
// 5. Convert contentBlockVimeo → ptVimeoVideo
// 6. Convert contentBlockHorizontalLine → ptHorizontalLine
// 7. Save to brandDetailContent
```

#### Step 4.2: Run migration in dry-run mode

```bash
cd apps/studio
npx ts-node scripts/migration/brands/migrate-to-unified-content.ts --dry-run
```

#### Step 4.3: Review and execute migration

```bash
npx ts-node scripts/migration/brands/migrate-to-unified-content.ts
```

#### Step 4.4: Verify migration

- Check several brands in Studio
- Compare frontend rendering before/after

---

### Phase 5: Cleanup (Brand)

**Goal:** Remove old field after successful migration.

1. Remove `brandContentBlocks` field from schema
2. Remove fallback logic from frontend
3. Update queries to only fetch `brandDetailContent`
4. Remove `ContentBlocks` component if no longer needed

---

### Phase 6: Product Schema (Future)

Repeat phases 1-5 for product schema:

- Add `productDetailContent` unified portable text field
- Update product page frontend
- Migrate `details.content` data
- Cleanup

---

## File Changes Summary

### New Files

| File                                                                 | Description            |
| -------------------------------------------------------------------- | ---------------------- |
| `apps/studio/schemaTypes/portableText/column-end.ts`                 | New ptColumnEnd schema |
| `apps/web/src/components/portableText/ColumnEnd/index.tsx`           | Frontend component     |
| `apps/web/src/components/portableText/ColumnEnd/styles.module.scss`  | Styles                 |
| `apps/web/src/components/ui/UnifiedContentBlocks/index.tsx`          | New unified renderer   |
| `apps/web/src/components/ui/UnifiedContentBlocks/styles.module.scss` | Styles                 |
| `apps/studio/scripts/migration/brands/migrate-to-unified-content.ts` | Migration script       |

### Modified Files

| File                                                     | Changes                      |
| -------------------------------------------------------- | ---------------------------- |
| `apps/studio/schemaTypes/portableText/index.ts`          | Register ptColumnEnd         |
| `apps/studio/schemaTypes/documents/collections/brand.ts` | Add brandDetailContent field |
| `apps/web/src/global/sanity/query.ts`                    | Add new query fragment       |
| `apps/web/src/components/ui/TwoColumnContent/index.tsx`  | Add fallback logic           |
| `apps/web/src/components/portableText/index.tsx`         | Register ColumnEnd component |
| `apps/web/src/app/marki/[slug]/page.tsx`                 | Pass new prop                |

---

## Rollback Plan

If issues are discovered:

1. Frontend automatically falls back to old field
2. New field can be cleared via Sanity Studio
3. Schema field can be hidden/removed
4. No data loss - old field remains intact until Phase 5

---

## Timeline Estimate

| Phase   | Effort    | Dependencies     |
| ------- | --------- | ---------------- |
| Phase 1 | 1 hour    | None             |
| Phase 2 | 2-3 hours | Phase 1          |
| Phase 3 | 1 hour    | Phase 2          |
| Phase 4 | 2 hours   | Phase 3 approved |
| Phase 5 | 30 min    | Phase 4 verified |
| Phase 6 | 3-4 hours | Phase 5 complete |

**Total: ~10-12 hours**
