# 07. Grafiki na blogu sa poobcinane

## Client context (mail)

> "Dlaczego grafiki na blogu sie obcinaja, prosze o sprawdzenie i porade."

## Root diagnosis

## Confirmed rendering behavior

- `PublicationCard` styles use:
  - `img { max-height: 280px; object-fit: cover; }`
- Shared image builder uses Sanity URL transform with `.fit("crop")`.

This creates a double-crop tendency:

1. server-side crop from image URL transform,
2. client-side crop via CSS `object-fit: cover` + fixed height limit.

So client complaint is valid and expected from current config.

## Fix plan (step-by-step)

1. **Normalize card media box geometry**
   - Replace `max-height` cropping pattern with explicit aspect ratio in card image container.
   - Example approach:
     - `.imageBox { aspect-ratio: 16 / 9; }`
     - `img { width: 100%; height: 100%; object-fit: cover; object-position: center; }`

2. **Choose product decision: "contain" vs "cover"**
   - If "never crop important subject" is priority:
     - use `object-fit: contain` (with background fill).
   - If "uniform card grid" is priority:
     - keep `cover` but use stable aspect ratio and hotspot-aware composition.

3. **Align Sanity transform strategy**
   - For cards where full image is desired, avoid aggressive crop transform.
   - For uniform thumbnails, keep crop but rely on Sanity hotspot and fixed aspect ratio.

4. **Editorial control (optional)**
   - Add guideline in CMS:
     - set hotspot focal point on blog images.
   - This improves crop quality with `cover`.

5. **Responsive QA**
   - Validate desktop/tablet/mobile card grids.
   - Ensure no layout shift and no image stretching.

## Recommended implementation choice

- Start with **consistent aspect-ratio + centered cover** to keep layout quality.
- If client still rejects any crop, switch blog cards only to `contain`.

## Acceptance criteria

- Blog list cards no longer crop unpredictably.
- Important subject area remains visible.
- Card grid remains visually consistent across breakpoints.

## Risks / rollback

- **Risk:** switching to `contain` may produce letterboxing.
- **Mitigation:** apply only for blog cards or use neutral background color.
- **Rollback:** single-style rollback in `PublicationCard` styles.

