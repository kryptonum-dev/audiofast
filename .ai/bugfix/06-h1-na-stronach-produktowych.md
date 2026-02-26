# 06. Problem z wyszukiwaniem po H1 na stronach produktowych

## Client context (mail)

> "H1 jest nieprawidlowo skonstruowane, tresc wyglada na ukryta... strony nie sa wyszukiwane po marka + model."

## Root diagnosis

## What code currently does

- Product H1 is rendered as:
  - `<h1><span class='brandName'>MARKA</span> <span class='productName'>PRODUKT</span></h1>`
- In CSS, both spans are `display: block`, so text is split into two visual lines.

## Technical interpretation

- This is not literal hidden text cloaking (no `display:none`, no offscreen hacks).
- However, some SEO scanners heuristically flag complex/nested heading structures, especially when heading text is fragmented and heavily styled.
- So this is a **scanner compatibility + semantics robustness** issue, not an intentional cloaking issue.

## Fix plan (step-by-step)

1. **Simplify H1 text semantics**
   - Keep one clean H1 text stream: `"{brand} {product}"`.
   - Recommended:
     - render full string directly in H1 for crawl clarity.
     - if split styling is needed, keep nested spans but use inline semantics

2. **Adjust CSS**
   - Remove `display: block` from `.brandName` and `.productName` in heading.
   - Use inline styling and spacing via margin/padding/font-weight, not block splitting.

3. **Preserve visual design**
   - If two-line layout is mandatory, handle line break with controlled wrapper/container styling while maintaining straightforward text parsing.

4. **SEO validation**
   - Re-run:
     - Lighthouse SEO,
     - Google Rich Results / URL inspection,
     - external crawler used by client.
   - Confirm "hidden H1 text" warning is gone.

5. **Search expectation management**
   - Ranking for "brand + product" also depends on:
     - indexation state,
     - internal links,
     - authority/signals.
   - H1 fix is necessary but not solely sufficient.

## Acceptance criteria

- Product pages expose a clear, readable H1 text node (`brand + product`).
- SEO scanner no longer flags H1 as hidden/suspicious.
- No visual regression in product hero.

## Risks / rollback

- **Risk:** visual typography regression in hero heading.
- **Mitigation:** CSS-only rollback path is easy; keep change isolated to `ProductHero`.
