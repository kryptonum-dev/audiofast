# Page Builder Section Creation Guide

A comprehensive, step-by-step guide for creating new page builder sections in the Audiofast project.

## Overview

This guide documents the complete process of creating a page builder section from initial Sanity schema to final React component implementation. Use this as a template for creating any new page builder section.

## Prerequisites

- Understanding of Sanity schema structure
- Familiarity with React/Next.js components
- Knowledge of SCSS/CSS modules
- Access to the Audiofast codebase

## Step-by-Step Process

### 1. Plan the Section Structure

**Before coding, define:**

- Section purpose and functionality
- Required fields (headings, descriptions, buttons, content arrays)
- Data relationships (references to other document types)
- UI layout and components needed

**Example (FeaturedProducts):**

- Purpose: Display new products and bestsellers in a carousel with tab switching
- Fields: heading, description, button, newProducts array, bestsellers array
- References: product documents
- UI: Tab switcher, dual carousels, shared navigation

### 2. Create Sanity Schema File

**Location:** `apps/studio/schemaTypes/blocks/[section-name].ts`

**Structure template:**

```typescript
import { [IconName] } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from '../definitions/portable-text';

const title = '[Section Display Name]';

export const [sectionName] = defineType({
  name: '[sectionName]',
  icon: [IconName],
  type: 'object',
  description: '[Description for CMS users]',
  fields: [
    // Standard fields pattern:
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description: '[Field description]',
      type: 'heading', // or 'default'
    }),
    customPortableText({
      name: 'description',
      title: 'Opis sekcji',
      description: '[Field description]',
      include: {
        styles: ['normal'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
    }),
    defineField({
      name: 'button',
      title: 'Przycisk CTA',
      type: 'button',
      description: '[Button description]',
      validation: (Rule) => Rule.required().error('[Error message]'),
    }),
    // Content arrays with references:
    defineField({
      name: '[contentArray]',
      title: '[Array Title]',
      type: 'array',
      description: '[Array description with min/max counts]',
      of: [
        {
          type: 'reference',
          to: [{ type: '[referencedDocumentType]' }],
          options: {
            disableNew: true,
            filter: ({ parent, document }) => {
              // Prevent duplicate selections
              const selectedIds = (parent as { _ref?: string }[])
                ?.filter((item) => item._ref)
                .map((item) => item._ref) || [];

              return {
                filter: '!(_id in $selectedIds) && !(_id in path("drafts.**"))',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) => [
        Rule.min([min]).error('[Min error]'),
        Rule.max([max]).error('[Max error]'),
        Rule.required().error('[Required error]'),
        Rule.unique().error('[Unique error]'),
      ],
    }),
  ],
  preview: {
    select: {
      heading: 'heading',
      description: 'description',
    },
    prepare: ({ heading, description }) => {
      return {
        title,
        subtitle: toPlainText(heading) || toPlainText(description) || '[Fallback]',
        media: [IconName],
      };
    },
  },
});
```

**Key Patterns:**

- Always use `defineField` and `defineType`
- Include meaningful descriptions for CMS users
- Use Polish language for titles and descriptions
- Implement validation rules
- Add preview configuration
- Use consistent icon from lucide-react

### 3. Register Schema in Index

**File:** `apps/studio/schemaTypes/blocks/index.ts`

```typescript
import { [sectionName] } from './[section-name]';
// ... other imports

export const pageBuilderBlocks = [
  // ... existing blocks
  [sectionName],
];
```

### 4. Create GROQ Query Fragment

**File:** `apps/web/src/global/sanity/query.ts`

**If new content type, create fragment:**

```typescript
// Reusable [contentType] fragment
const [contentType]Fragment = /* groq */ `
  _id,
  _createdAt,
  "slug": slug.current,
  [fieldName],
  [otherFields],
  ${imageFragment('[imageFieldName]')},
  ${portableTextFragment('[portableTextField]')},
`;
```

**Create block fragment:**

```typescript
const [sectionName]Block = /* groq */ `
  _type == "[sectionName]" => {
    ...,
    ${portableTextFragment('heading')},
    ${portableTextFragment('description')},
    ${buttonFragment('button')},
    [contentArray][]->{
      ${[contentType]Fragment}
    }
  }
`;
```

**Add to pageBuilderFragment:**

```typescript
export const pageBuilderFragment = /* groq */ `
  pageBuilder[]{
    ...,
    _type,
      ${existingBlocks},
      ${[sectionName]Block}
  }
`;
```

### 5. Generate Types

**Command:**

```bash
cd apps/studio && bun run type
```

This generates TypeScript types in `apps/web/src/global/sanity/sanity.types.ts`

### 6. Create UI Components (if needed)

**For content cards, create:** `apps/web/src/components/ui/[ContentType]Card/`

**Files needed:**

- `[ContentType]Card.tsx` - Main component
- `styles.module.scss` - Component styles
- `index.ts` - Export file

**Component template:**

```typescript
import type { QueryHomePageResult } from '../../../global/sanity/sanity.types';

import Image from '../../shared/Image';
import Button from '../Button';
import styles from './styles.module.scss';

// Extract type from section
type [SectionName]Type = Extract<
  NonNullable<NonNullable<QueryHomePageResult>['pageBuilder']>[number],
  { _type: '[sectionName]' }
>;

export type [ContentType]Type = [SectionName]Type['[contentArray]'][number];

interface [ContentType]CardProps {
  [contentItem]: [ContentType]Type;
  layout?: 'vertical' | 'horizontal';
  headingLevel?: 'h3' | 'h4';
  imageSizes?: string;
  showButton?: boolean;
}

export default function [ContentType]Card({
  [contentItem],
  layout = 'vertical',
  imageSizes = '400px',
  headingLevel = 'h3',
  showButton = true,
}: [ContentType]CardProps) {
  // Component implementation
}
```

### 7. Create Page Builder Section Component

**Location:** `apps/web/src/components/pageBuilder/[SectionName]/`

**Files needed:**

- `index.tsx` - Main section component
- `styles.module.scss` - Section styles

**Main component template:**

```typescript
import type { PageBuilderBlock } from '../../shared/PageBuilder';
import PortableText from '../../shared/PortableText';
import Button from '../../ui/Button';
import [ComponentName] from './[ComponentName]';
import styles from './styles.module.scss';

type [SectionName]Props = Extract<
  PageBuilderBlock,
  { _type: '[sectionName]' }
>;

export default function [SectionName]({
  heading,
  description,
  button,
  [contentArray],
}: [SectionName]Props) {
  return (
    <section className={styles.[sectionName]}>
     // Leave this empty for me to add manually
    </section>
  );
}
```

### 8. Add to PageBuilder

**File:** `apps/web/src/components/shared/PageBuilder.tsx`

**Add import:**

```typescript
import [SectionName] from '../pageBuilder/[SectionName]';
```

**Add case to switch statement:**

```typescript
case '[sectionName]':
  return (
    <[SectionName]
      key={block._key}
      {...(block as BlockByType<'[sectionName]'>)}
    />
  );
```

### 9. Styling Guidelines

**File:** `apps/web/src/components/pageBuilder/[SectionName]/styles.module.scss`

**Standard patterns:**

```scss
.[sectionName] {
  // Leave this for me to fill in manually
}
```
