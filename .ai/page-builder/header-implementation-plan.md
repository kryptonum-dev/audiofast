## Header (Navbar) — End‑to‑End Implementation Plan

### Goal

- **Build the global header** that matches the Figma design on desktop, tablet, and mobile.
- **Data‑driven navigation** sourced from Sanity singleton `navbar` (max 5 links).
- **Sticky, translucent black bar** with subtle top shadow/halo, rounded corners, and responsive behavior:
  - Desktop: logo left, links right.
  - Tablet: logo left, a single “Menu” trigger right that opens a panel.
  - Mobile: compact bar with the same “Menu” trigger.
- **Accessible**, **performant**, and **server‑first** with minimal client code.

---

### References and constraints

- Sanity schema: `apps/studio/schemaTypes/documents/singletons/navbar.ts` (array of `button` objects, up to 5).
- Shared button shape from `apps/studio/schemaTypes/definitions/button.ts`.
- Generated types: `Navbar` and `Button` in `apps/web/src/global/sanity/sanity.types.ts`.
- Query utilities and fragments already live in `apps/web/src/global/sanity/query.ts`.
- Styling uses **SCSS Modules**; global scales in `apps/web/src/global/global.scss`.
- Fonts: `poppins` and `switzer` in `apps/web/src/global/fonts.ts`.
- Logo: use the provided inline SVG (white on dark background).

---

## Data, queries, and types

1. Add a small query to fetch the singleton navbar reusing the existing shared button projection.

   File: `apps/web/src/global/sanity/query.ts`
   - Reuse `buttonFragment('button')` (already defined for the hero block) so the projection remains consistent across the app.

```ts
export const queryNavbar = defineQuery(`*[_type == "navbar"][0]{
  buttons[]{ ${/* reuse shared fragment to project text, variant, href, openInNewTab */ ''} ${buttonFragment('button')} }
}`);
```

2. Types are already generated for `Navbar` and `Button` in `sanity.types.ts`.
   - Ensure TypeGen stays in sync after any schema changes: `bunx sanity schema extract && bunx sanity typegen generate --enforce-required-fields`.

3. Fetching strategy
   - Server component fetch with `client.fetch(queryNavbar)`.
   - Optional revalidation: `{ next: { revalidate: 60 } }` for low‑frequency config updates.

---

## Component architecture

Create a small layout module in `apps/web/src/layouts/Header/`:

```
apps/web/src/layouts/Header/
  index.tsx               // Server: fetches data and renders structure (main file)
  styles.module.scss      // Styles for the header
  HeaderClient.tsx        // Client: handles tablet/mobile menu toggle
  MobileMenuFile.tsx      // Client: focus-trapped overlay/panel
```

Notes:

- `index.tsx` remains a **Server Component** that fetches data and renders the static shell (logo, nav container, trigger mount point). It imports `HeaderClient` for the interactive bits only.
- `HeaderClient.tsx` is **Client** with lightweight state for opening/closing the menu on tablet/mobile. Keyboard support and ARIA attributes live here.
- The logo SVG is inlined directly in `index.tsx` (no separate file needed).

---

## Visual specification (from Figma)

- Header height: ~76px; horizontal padding: `var(--pageMargin)` outside, 32px inside container per design.
- Background: near‑black with subtle gradient; rounded corners `12px`.
- Shadow/halo: centered, soft top shadow spanning the bar’s width.
- Typography: Poppins (300/400). Link size ~16px, tracking −0.48px, color `var(--neutral-300)`/white.
- Desktop: links laid out right with even spacing; hover state lightens text.
- Tablet: links collapse to a single underlined “Menu”.
- Mobile: same “Menu”, tighter paddings.

---

## Styling strategy (SCSS Modules)

File: `apps/web/src/layouts/Header/styles.module.scss`

- `.header` (wrapper): sticky top, `z-index` above content, uses the `.max-width` container pattern already defined in `global.scss`.
- `.container`: flex row, center‑aligned, height clamp to maintain 76px feel across breakpoints.
- Background and halo:
  - Background: solid black base `#000` with subtle vertical gradient using CSS `linear-gradient(180deg, rgba(20,20,20,.95) 0%, rgba(10,10,10,.95) 100%)`.
  - Halo: pseudo‑element `::before` absolutely positioned, inset wider than the container, with a **radial‑gradient** and **blur** to mimic the Figma “Shadow”. Non‑interactive (`pointer-events: none`).
- `.logo`: fixed width ~169px, height ~35px on desktop, scales via `clamp()` for smaller screens.
- `.nav`: desktop inline list. Spacing via gap; at tablet breakpoint it hides.
- `.menuTrigger`: hidden on desktop; visible on tablet/mobile. Visually underlined label “Menu”.
- Responsiveness via fluid units and `@media (max-width: 56.25em)` (≈900px) to switch desktop → tablet mode.
- Respect `prefers-reduced-motion` for any subtle fades.

---

## Behavior and accessibility

### Desktop

- Render `<nav aria-label="Główna nawigacja">` with `ul > li > Link`.
- Active link styling is optional initially; can be added via `usePathname()` and a simple equality check on `href`.

### Tablet/Mobile

- Keep the same list of links for SEO and accessibility. On small screens, the links are visually moved/hidden and shown inside the menu panel on open.
- Use a **Menu** button that toggles visibility of that same list rendered inside an overlay/panel (not a different data set).
  - Button: `<button aria-expanded={open} aria-controls="mobile-menu">Menu</button>`.
  - Panel: focus‑trapped overlay or slide‑down panel. Close via ESC, backdrop click, or selecting a link. Restore focus to trigger.

### General A11y

- Ensure link text is descriptive (Polish labels come from Sanity `text`).
- For external links (`openInNewTab`), include `rel="noreferrer"` and visually indicate with an icon if desired (optional).
- Color contrast: text over black background meets WCAG.

---

## Server vs client split

- `index.tsx` (Server):
  - Fetches navbar data with `client.fetch(queryNavbar)`.
  - Renders: wrapper, logo, desktop nav list, and a mount for client trigger.
  - Decides whether to render an empty list gracefully if `buttons` is missing.

- `HeaderClient.tsx` (Client):
  - Manages `open` state for the menu.
  - Renders `Menu` trigger and the `MobileMenu` overlay with list of links.
  - Handles key events, focus locking, and scroll locking of the body when open.

---

## Routing and link resolution

- Use `next/link` for in‑app navigation.
- Use the projected `href` from GROQ (already follows the project’s custom URL rules):
  - `internal` → `slug.current` (e.g., `"/produkty"`).
  - `external` → `https://…`.
- When `openInNewTab` is true, pass `target="_blank"` and `rel="noreferrer"`.

---

## Integration steps

1. Add `queryNavbar` to `apps/web/src/global/sanity/query.ts` (see above) reusing `buttonFragment('button')`.
2. Create the header folder structure under `apps/web/src/layouts/Header/` with `index.tsx`, `styles.module.scss`, `HeaderClient.tsx`, and `MobileMenuFile.tsx`.
3. Implement styles in `apps/web/src/layouts/Header/styles.module.scss`.
4. Implement `HeaderClient.tsx` and `MobileMenuFile.tsx` for mobile menu handling using the same link list.
5. Implement `apps/web/src/layouts/Header/index.tsx` (server): fetch navbar data; render logo SVG inline + desktop nav + mount client.
6. Hook into the app layout: update `apps/web/src/app/layout.tsx` to render `<Header />` (from `layouts/Header`) above `{children}`.
7. QA across breakpoints: desktop/tablet/mobile parity with Figma; confirm the halo/shadow and rounded corners; verify link targets.

---

## Performance considerations

- Keep the header server‑rendered; only menu toggle is client JS.
- Use CSS for transitions; avoid heavy box‑shadow (prefer gradients + blur in a pseudo‑element).
- Cache the navbar fetch with revalidation to cut TTFB variance for the header.
- Avoid large runtime libraries; leverage existing SCSS tooling.

---

## Acceptance criteria

- **Visual parity**: Desktop/tablet/mobile match the provided screenshots (spacing, sizes, colors).
- **Data‑driven**: Links render from Sanity `navbar.buttons` (1–5 items).
- **Responsive behavior**: Links visible on desktop; “Menu” trigger on tablet/mobile that opens an accessible panel.
- **A11y**: Proper `nav` semantics, keyboard operable, focus management in the mobile menu, adequate contrast.
- **Performance**: Minimal client bundle for the header; no layout shifts; smooth interactions.

---

## Nice‑to‑have (post‑MVP)

- Active route styling and focus ring enhancements.
- Subtle on‑scroll style change (e.g., increased backdrop/opacity after 8–16px of scroll).
- Hover underline animation for links.
- Optional secondary row (breadcrumbs or promo) if required later.

---

## Sanity notes (Context7 docs)

- Keep `defineQuery` usage consistent with `next-sanity` best practices.
- Prefer projections for button URLs (using `select()`), matching the existing patterns in `hero`.
- Use the Studio singleton flow already set up in `structure.ts` (document id = type name) to ensure editors modify a single `navbar` instance.
