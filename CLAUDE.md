# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development (runs both web and studio in parallel)
bun run dev

# Individual apps
cd apps/web && bun run next dev --turbopack
cd apps/studio && bun run sanity dev

# Build (includes redirects generation)
bun run build

# Type checking
bun run check-types

# Linting
bun run lint

# Formatting
bun run format

# Sanity type generation
bun run typegen
```

## Architecture Overview

**Monorepo Structure (Turbo + Bun):**
- `apps/web` - Next.js 16 frontend with React 19 (App Router)
- `apps/studio` - Sanity CMS headless content management
- `packages/eslint-config` - Shared ESLint rules
- `packages/typescript-config` - Shared TypeScript configs

**Data Sources:**
- **Sanity** - Primary CMS with GROQ queries, portable text, and AI embeddings for search
- **Supabase** - PostgreSQL for public data access (no auth, anonymous access)

**Key Integrations:**
- Microsoft Graph API for email sending
- Mailchimp for newsletter subscriptions
- Sanity Embeddings Index for AI-powered semantic search
- Vercel Edge Config for feature flags

## TypeScript Paths

```
@/src/* → ./src/*
@/global/* → ./src/global/*
@/components/* → ./src/components/*
```

## Code Patterns

**Data Fetching:**
- Use `sanityFetch()` with cache tags for static content
- Use `sanityFetchDynamic()` for draft/preview content
- Supabase clients: `createBrowserClient()` for client components, `createClient()` for server

**Server Actions:** Located in `src/app/actions/` with `"use server"` directive

**State Management:** Cookie-based for comparison feature (`src/global/comparison/cookie-manager.ts`), no global state library

## SCSS Guidelines

- **File pattern:** `styles.module.scss` per component
- **Units:** Always rem (1rem = 16px), em for letter-spacing only
- **Breakpoints:**
  - Tablet: `max-width: 56.1875rem` (899px)
  - Mobile: `max-width: 47.9375rem` (767px)
  - Small mobile: `max-width: 35.9375rem` (575px)
- **Media queries:** Nest inside parent class, not at file level
- **Transitions:** Specific properties (never `transition: all`), use milliseconds
- **Z-index scale:** Modal 1000, Sticky header 100, Dropdown 50, Tooltip 200

## Next.js Configuration

- React Compiler enabled (`reactCompiler: true`)
- Component caching enabled
- CSS inlining enabled
- Trailing slashes on URLs
- Turbopack for development

## Sanity Studio

Custom tools available:
- Newsletter Tool - Newsletter generation/testing
- Comparator Tool - Product comparison parameter management

Schema types in `apps/studio/schemaTypes/`:
- `documents/` - Singleton types (settings, seo, contact)
- `definitions/` - Content types (Product, Blog, Brand)
- `blocks/` - Page builder components (24+ types)
- `portableText/` - Rich text components

## Environment Variables

Key variables needed (see turbo.json for full list):
- `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_READ_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `EMBEDDINGS_INDEX_BEARER_TOKEN`
- `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
- `MS_GRAPH_SENDER_EMAIL`, `MS_GRAPH_REPLY_TO`
