# 09. Problem z cennikiem i skryptem (Stromtank S-4000 / S-6000)

## Client context (mail)

> "Skrypt wykonuje sie bardzo dlugo albo wisi. Dodatkowo widac stare opcje, ktorych juz nie ma. Dotyczy m.in. Stromtank S-4000 i S-6000."  
> "Jesli model jest pominiety, konfigurator opcji ma dzialac dla wszystkich modeli."

## Root diagnosis

## Confirmed technical findings

1. **Office Script mismatch for model-agnostic options**
   - In `.ai/office-scripts/SyncPricingToSupabase.ts`, options are attached by exact key:
     - `variantKey(product, model || null)`.
   - If option row has empty model, it matches only null-model variant key, not all model variants.
   - This conflicts with expected business rule: "empty model applies to all models".

2. **VBA script already allows one-empty model match**
   - In `.ai/vba-scripts/AudiofastPricingSync.bas` (`MatchesProductModel`), empty-on-one-side is treated as match.
   - This means behavior differs between Office Script and VBA pipeline.

3. **Perceived hanging is plausibly real**
   - Deployed Edge Function `pricing-ingest` awaits `sync-related-products` with up to 120s timeout.
   - That can make Excel publish appear "stuck" from operator perspective.

4. **Schema contract risk: `position` required by backend**
   - Deployed `pricing-ingest` validates that every variant has numeric `position`.
   - Office Script variant payload currently does not show `position` assignment in `readProdukty` object.
   - If this script is used directly, it can fail validation and leave stale data.

5. **Live DB check (Supabase MCP)**
   - Stromtank variant rows exist and were last updated on `2026-02-09` in current sample query.
   - If client has newer Excel changes after that, production data lag is consistent with failed/interrupted sync.

## What this means for client symptom

- "Old options remain" can happen when ingest does not complete successfully or option assignment logic is wrong for model-agnostic rows.
- "Script hangs" can be:
  - real long-running wait for related-product sync,
  - retry/network delays,
  - or operator waiting without progress feedback.

## Fix plan (step-by-step)

1. **Unify business rule across pipelines**
   - Implement explicit rule in Office Script:
     - if option row model is empty -> apply option to all variants of given product.
   - Keep VBA behavior aligned (already close).

2. **Enforce payload contract**
   - Ensure Office Script includes `position` for each variant to satisfy deployed `pricing-ingest` validation.
   - Add pre-flight check before POST:
     - abort with clear message if any variant lacks required fields.

3. **Improve operator feedback (anti-"hang")**
   - Add progress logging:
     - read phase done,
     - payload built,
     - POST started,
     - HTTP status,
     - sync summary.
   - Add client-side timeout/elapsed timer message in script output.

4. **Backend optimization**
   - In pricing ingest flow, avoid blocking user-facing response on long follow-up sync where possible.
   - Return fast success for ingest, run heavy sync asynchronously with status polling/logging.

5. **Data cleanup pass for Stromtank**
   - Run targeted SQL verification for S-4000/S-6000 option groups and values.
   - If stale groups exist, run one-time cleanup in replace mode after corrected script deployment.

6. **Regression checks**
   - Test three scenarios:
     - model-specific option row,
     - model-empty option row (must propagate to all models),
     - removed option row (must be removed from DB after replace).

## Immediate recovery runbook

1. Confirm which tool client used last (VBA vs Office Script).
2. Run dry-run payload print for Stromtank rows.
3. Push corrected script.
4. Execute one controlled `replace` sync.
5. Query Supabase for Stromtank groups/values and confirm matches Excel.
6. Verify frontend configurator reflects updated options.

## Acceptance criteria

- Empty-model option rows apply to all intended models.
- No stale Stromtank options after replace sync.
- Publish no longer appears hung to operator (clear progress + bounded wait).
- Latest Excel change date is reflected in Supabase `updated_at`.

## Risks / rollback

- **Risk:** aggressive replace cleanup can remove valid nested options if mapping is wrong.
- **Mitigation:** backup snapshot + targeted subset test before full run.
- **Rollback:** restore from latest `pricing_snapshots` / rerun last known-good payload.

