# 🎧 Audiofast

## Project Overview

The official website for Audiofast – a premium audio equipment distributor in Poland, representing world-renowned brands. The platform showcases an extensive product catalog, detailed technical specifications, expert reviews, and a comprehensive blog. Built for exceptional performance, intuitive content management, and seamless user experience across all devices.

## Tech Stack

- **[Next.js 16](https://nextjs.org)**: React framework with App Router and Turbopack
- **[React 19](https://react.dev)**: UI library with React Compiler optimization
- **[Sanity.io](https://sanity.io)**: Headless CMS with AI-powered semantic search
- **[Supabase](https://supabase.com)**: PostgreSQL database for public data access
- **[TurboPack](https://turbo.build)**: High-performance build system in monorepo architecture
- **[TypeScript](https://www.typescriptlang.org)**: End-to-end type safety
- **[SCSS](https://sass-lang.com)**: Advanced styling with CSS Modules
- **[Bun](https://bun.sh)**: Modern JavaScript runtime and package manager
- **[Microsoft Graph API](https://learn.microsoft.com/en-us/graph/)**: Enterprise email sending
- **[Mailchimp](https://mailchimp.com)**: Newsletter management and subscriptions

## Project Structure

- `apps/web`: Main Next.js website application
- `apps/studio`: Sanity CMS content management system
- `packages/eslint-config`: Shared ESLint configuration
- `packages/typescript-config`: Shared TypeScript configuration

## Features

### 🎨 Rich Component Library

22+ custom-built page sections with multiple variants, easily managed through Sanity Studio. Drag-and-drop functionality allows quick reorganization of content without touching code. Additional 19+ portable text components for rich content editing.

### 🔍 AI-Powered Semantic Search

Leverages Sanity Embeddings Index for intelligent product and blog search. Users can find content by meaning, not just keywords – making discovery natural and intuitive.

### ⚖️ Product Comparison Tool

Advanced cookie-based product comparison system allowing users to compare technical specifications side-by-side. Supports complex technical data tables with grouped parameters and variants.

### 📊 Dynamic Product Filtering

Server-side filtering with customizable filter configurations per category. Each product category can have unique filter parameters tailored to its product type.

### 📱 Certified Pre-Owned (CPO) Section

Dedicated section for certified used equipment with specialized page and product management.

### 📝 Comprehensive Reviews System

Expert reviews with PDF generation, author management, and product linking. Reviews can be embedded directly in product pages for seamless content integration.

### 🎯 Performance Focused

Optimized with React Compiler, CSS inlining, and minimal JavaScript. Lazy loading and automated image optimization ensure exceptional Core Web Vitals scores.

### ♿ Accessibility First

Built with ARIA compliance, semantic HTML, and thoughtful keyboard navigation to ensure a great experience for all users.

### 🔍 SEO Optimized

Comprehensive structured data (JSON-LD) for products, brands, articles, and FAQs. Auto-generated sitemaps and meta tags for maximum visibility.

### 📧 Enterprise Email Integration

Microsoft Graph API integration for reliable transactional emails with custom React Email templates.

## Why This Approach

### Performance & User Experience

Our stack is carefully chosen to deliver blazing-fast performance. Next.js 16 with React Compiler ensures optimal JavaScript execution, while Turbopack provides instant development feedback. The combination of static generation and server components delivers sub-second page loads.

### Developer Experience

TurboPack monorepo architecture provides consistent tooling and faster builds. TypeScript ensures type safety across the entire codebase, while Sanity Studio enables flexible content management with real-time previews and AI assistance.

### Business Benefits

- Scalable architecture that's easy to maintain and extend
- Content team independence through intuitive CMS
- Consistently high performance metrics
- Built-in SEO best practices
- AI-powered search for better product discovery

## Authors

- [@oliwiersellig](https://github.com/OliwierSellig)
