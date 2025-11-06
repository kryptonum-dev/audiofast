# Portable Text Custom Component Creation Guide

A comprehensive, step-by-step guide for creating new portable text custom components in the Audiofast project.

## Overview

This guide documents the complete process of creating a portable text custom component from initial Sanity schema to final React component implementation. Portable text components are custom blocks that can be embedded within portable text fields (like rich text editors) to add specialized functionality beyond standard text formatting.

## Prerequisites

- Understanding of Sanity schema structure
- Familiarity with React/Next.js components
- Knowledge of SCSS/CSS modules and the project's SCSS guidelines
- Access to the Audiofast codebase
- Understanding of Portable Text structure

## Step-by-Step Process

### 1. Plan the Component Structure

**Before coding, define:**

- Component purpose and functionality
- Required fields (text, images, references, etc.)
- Optional fields and their defaults
- UI/UX behavior (modals, interactions, etc.)
- Where the component will be used (which document types)

**Example (YouTube Video):**

- Purpose: Embed YouTube videos with thumbnail and play button that opens modal
- Fields: `youtubeId` (required), `thumbnail` (optional)
- UI: Thumbnail display, play button overlay, modal with YouTube embed
- Usage: Product details, blog posts, page content

### 2. Create Sanity Schema File

**Location:** `apps/studio/schemaTypes/portableText/[component-name].ts`

**Structure template:**

```typescript
import { [IconName] } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const pt[ComponentName] = defineType({
  name: 'pt[ComponentName]',
  type: 'object',
  title: '[Display Name]',
  icon: [IconName],
  description: '[Description for CMS users]',
  fields: [
    defineField({
      name: '[fieldName]',
      title: '[Field Title]',
      type: '[fieldType]', // 'string', 'image', 'number', 'boolean', etc.
      description: '[Field description]',
      validation: (Rule) =>
        Rule.required().error('[Error message]'),
    }),
    defineField({
      name: '[optionalField]',
      title: '[Optional Field Title]',
      type: '[fieldType]',
      description: '[Field description]',
      // No validation = optional field
    }),
    // For image fields:
    defineField({
      name: 'image',
      title: 'Zdjęcie',
      type: 'image',
      options: { hotspot: true },
      validation: (Rule) =>
        Rule.required().error('Zdjęcie jest wymagane'),
    }),
    // For portable text fields within component:
    customPortableText({
      name: 'content',
      title: 'Treść',
      description: '[Field description]',
      include: {
        styles: ['normal'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
    }),
  ],
  preview: {
    select: {
      [field1]: '[field1]',
      [field2]: '[field2]',
      [imageField]: '[imageField]',
    },
    prepare: ({ [field1], [field2], [imageField] }) => ({
      title: '[Component Display Name]',
      subtitle: [field1] || [field2] || '[Fallback text]',
      media: [imageField] || [IconName],
    }),
  },
});
```

**Key Patterns:**

- Always use `defineField` and `defineType`
- Component name must start with `pt` prefix (e.g., `ptYoutubeVideo`)
- Type name matches component name exactly
- Include meaningful descriptions in Polish for CMS users
- Implement validation rules for required fields
- Add preview configuration for better CMS UX
- Use consistent icon from `@sanity/icons` or `lucide-react`

**Example (YouTube Video):**

```typescript
import { VideoIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const ptYoutubeVideo = defineType({
  name: 'ptYoutubeVideo',
  type: 'object',
  title: 'Wideo YouTube',
  icon: VideoIcon,
  description: 'Osadź wideo YouTube z miniaturą i przyciskiem odtwarzania',
  fields: [
    defineField({
      name: 'youtubeId',
      title: 'ID wideo YouTube',
      type: 'string',
      description:
        'Wprowadź ID wideo YouTube (np. dla https://www.youtube.com/watch?v=dQw4w9WgXcQ, ID to: dQw4w9WgXcQ)',
      validation: (Rule) =>
        Rule.required().error('ID wideo YouTube jest wymagane'),
    }),
    defineField({
      name: 'thumbnail',
      title: 'Miniatura wideo',
      type: 'image',
      description:
        'Opcjonalna miniatura wideo. Jeśli nie zostanie wybrana, zostanie użyta domyślna miniatura YouTube.',
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      youtubeId: 'youtubeId',
      thumbnail: 'thumbnail',
    },
    prepare: ({ youtubeId, thumbnail }) => ({
      title: 'Wideo YouTube',
      subtitle: youtubeId ? `ID: ${youtubeId}` : 'Brak ID',
      media: thumbnail || VideoIcon,
    }),
  },
});
```

### 3. Register Component in Portable Text Index

**File:** `apps/studio/schemaTypes/portableText/index.ts`

**Add to `ALL_CUSTOM_COMPONENTS` array:**

```typescript
const ALL_CUSTOM_COMPONENTS = [
  { name: 'ptImage', type: 'ptImage' },
  { name: 'ptMinimalImage', type: 'ptMinimalImage' },
  // ... existing components
  { name: 'pt[ComponentName]', type: 'pt[ComponentName]' },
] as const;
```

**Example:**

```typescript
const ALL_CUSTOM_COMPONENTS = [
  // ... existing components
  { name: 'ptYoutubeVideo', type: 'ptYoutubeVideo' },
] as const;
```

### 4. Export Schema from Definitions Index

**File:** `apps/studio/schemaTypes/definitions/index.ts`

**Add import:**

```typescript
import { pt[ComponentName] } from '../portableText/[component-name]';
```

**Add to definitions array:**

```typescript
export const definitions = [
  // ... existing definitions
  pt[ComponentName],
];
```

**Example:**

```typescript
import { ptYoutubeVideo } from '../portableText/youtube-video';

export const definitions = [
  // ... existing definitions
  ptYoutubeVideo,
];
```

### 5. Create React Component

**Location:** `apps/web/src/components/portableText/[ComponentName]/`

**Files needed:**

- `index.tsx` - Main component file
- `styles.module.scss` - Component styles (if needed)
- `[SubComponent].tsx` - Sub-components (modals, etc.) if needed

**Main component template:**

```typescript
import type { PortableTextTypeComponentProps } from 'next-sanity';

import type { PortableTextProps } from '@/src/global/types';

import styles from './styles.module.scss';

type [ComponentName]Value = NonNullable<PortableTextProps>[number] & {
  _type: 'pt[ComponentName]';
};

export function [ComponentName]Component({
  value,
}: PortableTextTypeComponentProps<[ComponentName]Value>) {
  const { [field1], [field2] } = value;

  // Validation/early return
  if (![requiredField]) {
    return null;
  }

  return (
    <div className={styles.[componentName]}>
      {/* Component JSX */}
    </div>
  );
}
```

**Key Patterns:**

- Use `PortableTextTypeComponentProps` from `next-sanity`
- Type the value with `_type: 'pt[ComponentName]'`
- Extract fields from `value` prop
- Return `null` if required fields are missing
- Use CSS modules for styling
- Follow project SCSS guidelines (nesting, rem units, etc.)

**Example (YouTube Video):**

```typescript
import type { PortableTextTypeComponentProps } from 'next-sanity';

import type { PortableTextProps } from '@/src/global/types';

import Image from '../../shared/Image';
import VideoModal from './VideoModal';
import styles from './styles.module.scss';

type YoutubeVideoValue = NonNullable<PortableTextProps>[number] & {
  _type: 'ptYoutubeVideo';
};

export function YoutubeVideoComponent({
  value,
}: PortableTextTypeComponentProps<YoutubeVideoValue>) {
  const { youtubeId, thumbnail } = value;

  if (!youtubeId) {
    return null;
  }

  const thumbnailUrl = thumbnail
    ? undefined
    : `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;

  const imageSizes =
    '(max-width: 37.4375rem) 96vw, (max-width: 56.125rem) 83vw, (max-width: 69.3125rem) 768px, 704px';

  return (
    <div className={styles.youtubeVideo}>
      <div className={styles.thumbnailContainer}>
        {thumbnail ? (
          <Image
            image={thumbnail}
            className={styles.thumbnail}
            sizes={imageSizes}
            loading="lazy"
            fill
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className={styles.thumbnail}
            loading="lazy"
          />
        )}
        <VideoModal youtubeId={youtubeId} />
      </div>
    </div>
  );
}
```

### 6. Create Sub-Components (if needed)

**For complex components with modals, popups, etc.:**

**Example (VideoModal):**

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './styles.module.scss';

interface VideoModalProps {
  youtubeId: string;
}

export default function VideoModal({ youtubeId }: VideoModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  const handleClose = () => setIsOpen(false);
  const handleOpen = () => setIsOpen(true);

  const modal = (
    <div
      className={styles.modalOverlay}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Video modal"
    >
      {/* Modal content */}
    </div>
  );

  return (
    <>
      <button
        type="button"
        className={styles.playButton}
        onClick={handleOpen}
        aria-label="Odtwórz wideo"
      >
        {/* Play button content */}
      </button>
      {isOpen && createPortal(modal, document.body)}
    </>
  );
}
```

### 7. Create Styles

**File:** `apps/web/src/components/portableText/[ComponentName]/styles.module.scss`

**Follow project SCSS guidelines:**

- Nest child classes inside parent classes
- Nest media queries inside main parent class
- Use rem units (not px, except for letter-spacing in em)
- Use `clamp()` for fluid sizing
- Transitions in milliseconds with cubic-bezier easing
- Include focus states for interactive elements

**Template:**

```scss
.[componentName] {
  margin: 2rem 0;
  width: 100%;

  .childElement {
    // Styles

    .grandchildElement {
      // Styles
    }
  }

  @media (max-width: 56.1875rem) {
    // Mobile overrides

    .childElement {
      // Mobile child overrides
    }
  }
}
```

**Example structure:**

```scss
.youtubeVideo {
  margin: 2rem 0;
  width: 100%;

  .thumbnailContainer {
    position: relative;
    width: 100%;
    border-radius: 0.5rem;
    overflow: hidden;
    aspect-ratio: 16 / 9;

    .thumbnail {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .playButton {
      position: absolute;
      z-index: 10;
      // ... button styles

      &:hover {
        // Hover styles
      }

      &:focus-visible {
        outline: 2px solid var(--primary-red, #fe0140);
        outline-offset: 4px;
      }
    }
  }

  @media (max-width: 43.6875rem) {
    .thumbnailContainer .playButton {
      // Mobile overrides
    }
  }
}
```

### 8. Register Component in Portable Text Renderer

**File:** `apps/web/src/components/portableText/index.tsx`

**Add import:**

```typescript
import { [ComponentName]Component } from './[ComponentName]';
```

**Add to types object:**

```typescript
types: {
  ...{
    ptImage: ImageComponent,
    ptMinimalImage: MinimalImageComponent,
    // ... existing components
    pt[ComponentName]: [ComponentName]Component,
  },
  ...customComponentTypes,
},
```

**Example:**

```typescript
import { YoutubeVideoComponent } from './YouTubeVideo';

// ... in components object:
types: {
  ...{
    // ... existing components
    ptYoutubeVideo: YoutubeVideoComponent,
  },
  ...customComponentTypes,
},
```

### 9. Add Component to Document Schemas

**To make the component available in specific document types, add it to their portable text field configuration.**

**File:** `apps/studio/schemaTypes/documents/collections/[document-type].ts`

**Find the portable text field and add component name to `components` array:**

```typescript
customPortableText({
  name: '[fieldName]',
  title: '[Field Title]',
  description: '[Description]',
  include: {
    styles: ['normal', 'h3'],
    lists: ['bullet', 'number'],
    decorators: ['strong', 'em'],
    annotations: ['customLink'],
  },
  components: [
    'ptMinimalImage',
    'ptHeading',
    'pt[ComponentName]', // Add here
  ],
}),
```

**Example (Product details):**

```typescript
customPortableText({
  name: 'content',
  title: 'Treść szczegółów',
  description: 'Szczegółowy opis produktu, specyfikacja i inne informacje.',
  include: {
    styles: ['normal', 'h3'],
    lists: ['bullet', 'number'],
    decorators: ['strong', 'em'],
    annotations: ['customLink'],
  },
  components: ['ptMinimalImage', 'ptHeading', 'ptYoutubeVideo'],
}),
```

### 10. Generate Types

**Command:**

```bash
cd apps/studio && bun run type
```

This generates TypeScript types in `apps/web/src/global/sanity/sanity.types.ts` and ensures your component types are available.

### 11. Testing Checklist

**Before considering the component complete:**

- [ ] Component renders correctly in Sanity Studio preview
- [ ] Component displays correctly on the frontend
- [ ] Required field validation works
- [ ] Optional fields handle missing values gracefully
- [ ] Component is responsive on mobile devices
- [ ] Accessibility features work (keyboard navigation, screen readers)
- [ ] Interactive elements (modals, buttons) function correctly
- [ ] Styles match project design system
- [ ] No console errors or warnings
- [ ] Component works in all document types where it's enabled

## Common Patterns

### Image Handling

**Using Sanity Image component:**

```typescript
import Image from '../../shared/Image';

<Image
  image={imageField}
  className={styles.image}
  sizes="(max-width: 37.4375rem) 96vw, 704px"
  loading="lazy"
  fill
  style={{ objectFit: 'cover' }}
/>
```

**Using external image URL:**

```typescript
<img
  src={externalUrl}
  alt="Description"
  className={styles.image}
  loading="lazy"
/>
```

### Modal Patterns

**For modals that open on click:**

```typescript
'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

export default function ModalTrigger({ content }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Open Modal
      </button>
      {isOpen && createPortal(
        <div className={styles.modalOverlay} onClick={() => setIsOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {content}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
```

### Portable Text Within Component

**If your component needs to render portable text:**

```typescript
import PortableText from '../../portableText';

<PortableText
  value={portableTextField}
  className={styles.content}
  enablePortableTextStyles
/>
```

## File Structure Summary

```
apps/
├── studio/
│   └── schemaTypes/
│       ├── portableText/
│       │   ├── index.ts                    # Register component here
│       │   └── [component-name].ts         # Schema definition
│       └── definitions/
│           └── index.ts                    # Export schema here
└── web/
    └── src/
        └── components/
            └── portableText/
                ├── index.tsx                # Register React component here
                └── [ComponentName]/
                    ├── index.tsx            # Main component
                    ├── styles.module.scss   # Component styles
                    └── [SubComponent].tsx   # Sub-components (if needed)
```

## Example: Complete YouTube Video Component

This guide was created based on the implementation of the `ptYoutubeVideo` component. Refer to these files as a complete example:

- **Schema:** `apps/studio/schemaTypes/portableText/youtube-video.ts`
- **React Component:** `apps/web/src/components/portableText/YouTubeVideo/index.tsx`
- **Modal Component:** `apps/web/src/components/portableText/YouTubeVideo/VideoModal.tsx`
- **Styles:** `apps/web/src/components/portableText/YouTubeVideo/styles.module.scss`

## Troubleshooting

### Component not appearing in Sanity Studio

- Verify component is in `ALL_CUSTOM_COMPONENTS` array
- Check that schema is exported from `definitions/index.ts`
- Restart Sanity Studio dev server
- Clear browser cache

### Component not rendering on frontend

- Verify component is registered in `portableText/index.tsx` types object
- Check that component name matches exactly (case-sensitive)
- Ensure component is added to document schema's `components` array
- Check browser console for errors

### Type errors

- Run `bun run type` in `apps/studio` directory
- Verify TypeScript types were generated correctly
- Check that `_type` matches schema name exactly

### Styling issues

- Verify SCSS follows project guidelines (nesting, rem units)
- Check that CSS modules are imported correctly
- Ensure media queries are nested inside parent class
- Verify responsive breakpoints match project standards

## Additional Resources

- [Sanity Portable Text Documentation](https://www.sanity.io/docs/portable-text)
- [Next.js Image Component](https://nextjs.org/docs/pages/api-reference/components/image)
- Project SCSS Guidelines (see repo-specific rules)
- Existing portable text components for reference
