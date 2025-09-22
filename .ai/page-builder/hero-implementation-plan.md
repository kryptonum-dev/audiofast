## Hero Carousel + Brands Marquee — Implementation Plan

### Goal

- **Accurately recreate** the Figma hero section across desktop, tablet, and mobile.
- Implement a **rotating carousel** (1–6 slides) with background image, overlaid text, CTA, arrows, and pagination.
- Implement a **brands marquee** that scrolls logos seamlessly (duplicated set, no visible gap).
- Use the existing Sanity schema, queries, and shared components. Keep performance, accessibility, and code quality high.

### Acceptance criteria

- **Carousel**: auto-rotates on an interval; allows prev/next and pagination click; snaps precisely; pauses on hover and when offscreen; respects prefers-reduced-motion.
- **Autoplay interval**: controlled by a constant `HERO_AUTOPLAY_INTERVAL_MS` defaulting to **10,000 ms**; any manual navigation (arrows/pagination) resets the timer.
- **Wrap-around navigation**: prev on first slide goes to last; next on last goes to first. Arrows remain enabled (no disabled state at ends).
- **Reusable UI**: arrows and pagination dots live in `components/ui/` and are reusable; pagination dots accept a configurable `count`.
- **Images**: supports `image` (desktop) and optional `mobileImage`; uses a `<picture>` element to swap sources at tablet breakpoint; dark gradient overlay on top.
- **Text & CTA**: renders title and description from Portable Text; CTA uses shared `Button`.
- **Brands marquee**: duplicates input list 2×; smooth infinite scroll; no visible jump; pauses on hover; respects reduced motion.
- **Fluid responsiveness**: minimize media queries; prefer fluid sizing via `clamp()`; use `rem` for sizes and spacing; use `em` for `letter-spacing`; media queries (when needed) use `em` units (e.g., `48em`).
- **A11y**: WAI-ARIA carousel semantics, keyboard navigation, sufficient color contrast over background.
- **Perf**: optimized images, LCP-friendly first slide, minimal client JS in server-first layout.

---

## Data, types, and queries

- Sanity schema `apps/studio/schemaTypes/blocks/hero.ts` exposes:
  - `slides[]` with: `title` (portable text—heading), `description` (portable text), `image` (required), `mobileImage` (optional), `button` (custom button object).
  - `brands[]->` references to brand docs.
- GROQ projection `apps/web/src/global/sanity/query.ts` already provides:
  - `imageFragment('image')`, `imageFragment('mobileImage')` with `imageFields` (id, preview, alt, hotspot, crop, natural dims).
  - `portableTextFragment('title' | 'description')` and `buttonFragment('button')`.
  - `brands[]->{ logo, name, slug }`.
- Types: consume generated types from `apps/web/src/global/sanity/sanity.types.ts` via `BlockOf<'hero'>` (already used by `Hero.tsx`).
- If we change schema fields later, run typegen:
  - `bunx sanity schema extract && bunx sanity typegen generate --enforce-required-fields`

---

## Rendering strategy (Server + Client split)

- Keep layout and data mapping in a **Server Component** for SEO/LCP.
- Isolate interactivity (auto-rotation, arrow/pagination handlers) in a **Client Component**.
- Image URLs are built on the server for stable markup; timers and event listeners live on the client.

Proposed files:

- In `components/pageBuilder/Hero/`:
  - `Hero.tsx` (Server): Receives `BlockOf<'hero'>`, renders section shell and mounts subcomponents.
  - `HeroCarousel.tsx` (Client): Full carousel (background `<picture>`, text, button, arrows, pagination, timers).
  - `BrandMarquee.tsx` (Client): Seamless brands marquee.
  - `styles.module.scss`: All styles for layout, overlay, transitions, marquee animation.

- In `components/ui/` (reusable across the app):
  - `ArrowButton/ArrowButton.tsx` (+ `index.ts`): Generic arrow button.
  - `PaginationDots/PaginationDots.tsx` (+ `index.ts`): Generic dots control with configurable `count`.

Note: We’ll keep the existing `Hero.tsx` as the entry and refactor content into the new structure as needed.

---

## Component responsibilities and APIs

### `Hero.tsx` (Server)

- Props: `BlockOf<'hero'>`.
- Renders markup shell:
  - Background `<picture>` is implemented inside `HeroCarousel`.
  - Foreground content: `PortableText` title/description + shared `Button`.
  - Controls: injected from client components.
  - Brands marquee below the hero.
- Determines first visible slide (for image priority and LCP hints).

### Background image handling (within HeroCarousel)

- Input: current slide’s `image`, optional `mobileImage` and `alt`.
- Output: a `<picture>` element with `<source media="(max-width: 768px)">` for `mobileImage` when present and a fallback for desktop.
- Uses `urlFor` from `global/sanity/client.ts` to generate optimized URLs respecting crop/hotspot.
- Adds an absolutely positioned gradient overlay layer on top.
- We intentionally use a native `<img>` in `<picture>` for exact source switching; visible text content provides accessibility, so `alt` on background is empty.

### `HeroCarousel.tsx` (Client)

- Props: `{ slides, autoPlayMs = 10000, pauseOnHover = true, initialIndex = 0, onIndexChange? }`.
- State: `activeIndex`, `isHovered`, `isReducedMotion`.
- Behavior:
  - Auto-advance with `setInterval` or `requestAnimationFrame`-driven ticker (paused when hovered, tab inactive, or reduced motion).
  - Interval duration sourced from `HERO_AUTOPLAY_INTERVAL_MS` by default; any user action (prev/next/goTo) resets the timer so the next change happens after a full interval.
  - Infinite wrap-around: compute next/prev indices with modulo, e.g. `(index - 1 + count) % count` and `(index + 1) % count`. Arrows are never disabled at the ends.
  - Keyboard nav: ArrowLeft/ArrowRight.
  - A11y attributes: container `role="region"` with `aria-roledescription="carousel"`, `aria-label="Hero"`; each slide `role="group"` with `aria-label="Slide i of N"`.
  - Announces slide changes only if user-triggered (`aria-live="polite"`).
  - Optional guard against rapid spamming: throttle/debounce navigation clicks (~250–300ms) to keep animations coherent.
- Renders: background `<picture>` (with optional mobile source), gradient overlay, title/description via `PortableText`, CTA via `Button`, and controls using `@ui/CarouselArrow` and `@ui/PaginationDots`.

### `BrandMarquee.tsx` (Client)

- Input: `brands[]` from query (`{ logo, name, slug }`).
- Duplicates array: `const items = [...brands, ...brands];`.
- Renders in a single horizontal track with CSS animation.
- A11y: duplicate set marked `aria-hidden` to avoid verbosity; focusable elements are avoided inside marquee.
- Reduced motion: animation disabled; show a static grid instead.
- Logo treatment: apply a consistent darkening style (e.g., grayscale + opacity and/or CSS filter) to ensure visual harmony over backgrounds; ensure adequate contrast against the overlay.

### UI components (reusable)

#### `@ui/ArrowButton`

- Props:
  - `direction: 'prev' | 'next'`
  - `onClick: () => void`
  - `ariaLabel?: string`
  - `className?: string`
  - `size?: 'sm' | 'md' | 'lg'` (optional)
  - `variant?: 'ghost' | 'filled'` (optional)
  - `disabled?: boolean` (optional; not used by wrap-around hero but available generically)
- Behavior: renders a button with an SVG arrow icon; icon flipped for `prev`.

#### `@ui/PaginationDots`

- Props:
  - `count: number` (number of dots)
  - `activeIndex: number`
  - `onSelect: (index: number) => void`
  - `ariaLabel?: string` (base label for SR)
  - `className?: string`
  - `size?: 'sm' | 'md' | 'lg'` (optional)
- Behavior: renders focusable buttons; each has `aria-label="Go to slide X"` and `aria-current` on the active dot.

---

## Styling and layout (`styles.module.scss`)

- `.hero`: relative container, overflow hidden.
  - Height guidelines (adjust to Figma):
    - Use fluid heights with `clamp()` rather than fixed px. Example: `min-height: clamp(32rem, calc(60vw / 0.48), 52rem);`.
  - Spacing tokens map to Figma paddings and content region.
- `.bg`: absolute, inset: 0; child `<picture>` and `<img>` fill container with `object-fit: cover`.
- `.overlay`: absolute, inset: 0; gradient:
  - `linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.35) 35%, rgba(0,0,0,.70) 100%)`.
- `.content`: relative layer; text styles per Figma; ensure contrast over overlay.
- `.controls`: positions arrows and pagination per Figma; use safe tap targets (≥44px).
- `.slide`/`.slideActive`: crossfade via `opacity` transitions (no layout jank). Inactive slides `pointer-events: none`.
- Marquee:
  - `.brands`, `.track`, `.item`.
  - Keyframes:
    - `@keyframes marqueeX { from { transform: translateX(0) } to { transform: translateX(-50%) } }`
  - `.track` uses `animation: marqueeX 30s linear infinite; will-change: transform;` duration tuned to Figma.
  - Pause on hover: `.track:hover { animation-play-state: paused; }`.
  - Reduced motion: `@media (prefers-reduced-motion: reduce) { .track { animation: none; } }` with graceful static layout.
- Units & scales:
  - Prefer `rem` for font-size, spacing, border-radius, and layout; prefer `em` for `letter-spacing`.
  - Prefer `clamp()` for fluid sizes, e.g., `font-size: clamp(1rem, calc(1.5vw / 0.48), 2rem);`.
  - Where media queries are unavoidable, use `em` breakpoints (e.g., `@media (min-width: 48em)`).

---

## Image URL generation

- Use `urlFor` with `fit('crop').auto('format')` and pass crop/hotspot from projected data.
- Compute widths per breakpoint to keep source sizes meaningful and avoid overfetching.
- First visible image can be marked with high priority via `<link rel="preload" as="image" href="…" imagesrcset="…" imagesizes="…" />` from the server component if needed.

---

## Accessibility details

- Carousel region:
  - `role="region"` + `aria-roledescription="carousel"` + `aria-label="Hero"`.
  - `aria-live="off"` for auto-rotation; only user actions announce changes (`aria-live="polite"` on slide title region).
- Slides:
  - Each `role="group"` with `aria-label="Slide {i} of {n}"`.
  - Pagination buttons have `aria-current={active}`.
  - Arrow buttons use descriptive labels and include SVG icons with `aria-hidden`.
- Keyboard:
  - Left/Right arrows navigate; Home/End jump to first/last; Tab order predictable.
- Logos in marquee:
  - Duplicate sequence `aria-hidden` to avoid repetition.
  - Informative alt text for brand logos (brand name).

---

## Performance considerations

- Server-render the first slide with critical text and CTA for LCP.
- Defer timers to client; pause auto-rotate when not visible (IntersectionObserver) and when tab is hidden.
- Minimize re-renders: memoize derived arrays (`useMemo` for duplicated brands), stable callbacks (`useCallback`).
- Avoid heavy transforms on the hero content; restrict animations to `opacity` or `transform` for GPU acceleration.
- Use `sizes="100vw"` and tailored source widths to reduce bytes.

---

## Integration with Page Builder

- Ensure `PageBuilder.tsx` maps `_type === 'hero'` to `Hero` component (already present; verify).
- The block shape is already provided in `queryHomePage` → `pageBuilder[]` → `heroBlock`.
- No schema changes required; if design introduces new fields (e.g., multiple buttons), update schema + `query.ts` and regenerate types.

---

## Step-by-step checklist

1. Create files:
   - In `pageBuilder/Hero/`: `Hero.tsx` (adjust/refactor existing), `HeroCarousel.tsx`, `BrandMarquee.tsx`, update `styles.module.scss`.
   - In `ui/`: `CarouselArrow/CarouselArrow.tsx` (+ `index.ts`), `PaginationDots/PaginationDots.tsx` (+ `index.ts`).
2. Implement background image handling inside `HeroCarousel.tsx`:
   - Generate desktop and mobile URLs with `urlFor`; output `<picture>` with `<source>` and `<img>` fallback; add gradient overlay element.
3. Implement `HeroCarousel.tsx`:
   - State, timers (default 10s via in-file constant), reduced motion, keyboard nav, pause on hover, expose `prev/next/goTo`, wrap-around indexing (modulo), and timer reset after manual navigation. Use `@ui/CarouselArrow` and `@ui/PaginationDots`.
4. Implement `BrandMarquee.tsx`:
   - Duplicate logos, build track, tune animation duration to Figma, pause on hover, reduced motion fallback.
5. Wire `Hero.tsx`:
   - Render first slide’s background; render content (title, description via `PortableText`, CTA via `Button`); mount controls; mount marquee below.
6. Styling in `styles.module.scss`:
   - Layout, overlay gradient, crossfade transition, controls positioning, marquee keyframes.
7. QA across breakpoints:
   - Desktop/Tablet/Mobile parity with Figma; ensure mobile image source swaps at ≤768px.
8. A11y pass:
   - Keyboard flow, screen reader labels, color contrast over gradient.
9. Performance pass:

- LCP check, bundle size sanity, animation smoothness, offscreen pause verified.

10. Cross-browser smoke: Chromium, Safari, Firefox (desktop + iOS Safari).

---

## Open questions (confirm with design/PM)

- Exact auto-rotate interval from Figma (using 10,000ms by default).
- Pagination style (dots vs numbers) and positions across breakpoints.
- Arrow iconography and hover/active states.
- Marquee speed per breakpoint; spacing between logos; behavior on very small screens.

---

## Notes on existing shared components

- `Button` (`components/ui/Button/Button.tsx`): use for CTA. Set `href`, `openInNewTab`, and variant per content.
- `PortableText` (`components/shared/PortableText.tsx`): already renders blocks; pass `headingLevel="h1"` for the top heading on home if per design.
- `Image` (`components/shared/Image.tsx`): keep for inline images elsewhere; for background we use a native `<picture>` to precisely control sources and avoid wrapper markup.
