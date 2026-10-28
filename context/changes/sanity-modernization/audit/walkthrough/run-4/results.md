# Presentation walkthrough — run 4

Environment: lane `D`; Studio origin `https://audiofast.sanity.studio` (deployed at 3de7859 with Podgląd hidden, P11; not used by any row); Studio build `deployed app dlwt2zhgkk7rjx6dj8rdyjfz at 3de7859cfb12855dbcbae02b7172cd9b4e244a0f`; previewed origin `https://audiofast.pl`; previewed SHA `3de7859cfb12855dbcbae02b7172cd9b4e244a0f` (Vercel `dpl_Aq1yc7vCMMu8DR2GScDYtdbvUQ9t` READY, aliased to audiofast.pl); browser `headless Playwright (repo @playwright/test) + curl` (Claude in Chrome not connected); instrumentation `clean headless draft/published tabs / curl / CLI + GROQ (raw perspective)`; started `2026-10-28T07:21:47Z`; ended `2026-10-28T07:24:56Z`. These are the [D] rows of test-plan §5 phase 9, run after the [L] lane came back clean in run 3. Rows that need the deployed Presentation tool are BLOCKED, because Podgląd is hidden in the deployed Studio (P11).

| ID | Result | Evidence | Notes |
| --- | --- | --- | --- |
| P1 | PASS | evidence/P1-production-html.txt | `grep -c data-sanity` `0`, `0`, `0` on `/`, `/o-nas/`, `/qa-presentation/`; QA robots `noindex, nofollow`; `sitemap.xml` `0` `qa-presentation` |
| P2 | PASS | evidence/P2-production-crawler.txt | `pages: 1117`, `published: 0 page(s) with findings`, `result: CLEAN (exit 0)` |
| A4 | PASS | evidence/A4-share.txt | share tab (enable 307) body contains `QA11R4A4`, `[data-sanity]` `72`; plain tab token `false`, `[data-sanity]` `0` |
| A6 | BLOCKED | — | SKIPPED: Podgląd hidden in deployed Studio (P11). The deployed Presentation iframe cannot be opened |
| I1 | PASS | evidence/I1-suppression.txt | draft tab on `/` and `/qa-presentation/`: `[role="dialog"][aria-label="Ustawienia cookie"]` `null`, googletagmanager/facebook resources `0` (published control shows the dialog). Iframe half skipped (P11) |
| I4 | BLOCKED | — | SKIPPED: Podgląd hidden in deployed Studio (P11). No deployed Presentation URL bar to test |
| A2 | BLOCKED | — | [D] re-check SKIPPED: Podgląd hidden in deployed Studio (P11). A2 passed on lane L in run 2 |
