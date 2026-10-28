# Preflight — 2026-10-27

Facts gathered before run 1. Not a run: no scenario verdicts live here. Run 1 re-freezes everything into its own `evidence/freeze.json`.

- **HEAD:** `fe6f351` (Phase 10), production READY at that SHA.
- **CORS with credentials:** all four origins answer `access-control-allow-credentials: true` ([cors.txt](cors.txt)).
- **Share access:** `count(*[_id=="sanity-preview-url-secret.share-access"]) == 1`.
- **Pending drafts:** 133 (raw count; read-only fixtures listed in the brief §1.2).
- **QA fixture:** `qa-presentation` seeded in production; applier rerun reports `0 new, 0 changed` ([seed-idempotency.txt](seed-idempotency.txt)). The first seed used the dotted lsse id and rendered 404 on production; see [qa-id-dot.txt](qa-id-dot.txt).
- **Published gates on production:** `/`, `/o-nas/`, `/qa-presentation/` have 0 `data-sanity`; the QA page is `noindex, nofollow` and absent from the sitemap ([P1-production-html.txt](P1-production-html.txt)). Published stega crawl: 1,117 URLs, 0 findings, exit 0 ([P2-production-crawler.txt](P2-production-crawler.txt), full report [P2-production-crawler-report.md](P2-production-crawler-report.md)).
- **Browser:** Claude in Chrome reported "not connected" and `list_connected_browsers` returned `[]` throughout the preflight (Brave was running with the native host, but no extension instance was paired). No browser row could start.
