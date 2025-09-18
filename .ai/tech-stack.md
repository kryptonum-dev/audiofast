# Tech Stack - Audiofast

## Hosting & Deployment

- **Vercel** - Primary hosting platform

## Package Management & Build Tools

- **Bun** (v1.1.42) - Package manager and runtime
- **Turbo** (v2.5.6) - Monorepo build system
- **Node.js** (>=20) - Runtime environment

## Frontend Framework & Libraries

- **Next.js** (v15.4.6) - React framework with Turbopack
- **React** (v19.1.1) - UI library
- **React DOM** (v19.1.1) - DOM rendering
- **React Compiler** (Babel plugin) - Optimization
- **Next Themes** (v0.4.6) - Theme management

## Content Management

- **Sanity** (v3.99.0) - Headless CMS
- **Sanity Client** (v7.8.2) - API client
- **Next Sanity** (v9.12.3) - Next.js integration
- **Sanity Visual Editing** (v2.15.0) - Live preview
- **Sanity Image URL** - Image optimization
- **Sanity Asset Utils** - Asset handling

## Sanity Studio & Plugins

- **Sanity Studio** - Content management interface
- **Sanity Assist** (v4.3.2) - AI assistance
- **Sanity Vision** (v3.99.0) - GROQ query tool
- **Sanity UI** (v2.16.12) - Studio UI components
- **Sanity Icons** (v3.7.4) - Icon library
- **Sanity Plugin Icon Picker** (v4.0.0) - Icon selection
- **Sanity Plugin Media** (v3.0.3) - Media management
- **Sanity Orderable Document List** (v1.3.4) - Drag & drop ordering

## UI & Styling

- **Lucide React** (v0.539.0) - Icon library
- **Sass** (v1.90.0) - CSS preprocessor

## Development Tools

- **TypeScript** (v5.7.3) - Type system
- **ESLint** (v9.33.0) - Code linting
- **Prettier** (v3.6.0) - Code formatting
- **TypeScript ESLint** (v8.34.1) - TypeScript linting

## Workspace Configuration

- **Monorepo Structure**: Apps (`studio`, `web`) + Packages (`eslint-config`, `typescript-config`)
- **Shared Configs**: TypeScript and ESLint configurations across workspace
- **Workspace Dependencies**: Internal package references
