# Audiofast B2C Production Readiness Runbook

Date: 2026-06-01
Branch reviewed: `b2c`
Vercel project checked: `kryptonum/audiofast`

## Current Vercel Env Check

Checked with:

```bash
vercel env ls production --format=json --cwd /Users/oliwiersellig/Kryptonum/audiofast
```

Result by variable name and production scope: pass.

Production-scoped variables currently present:

- `P24_MODE`
- `P24_MERCHANT_ID`
- `P24_POS_ID`
- `P24_API_KEY`
- `P24_CRC`
- `P24_STATUS_CALLBACK_BASE_URL`
- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `NEXT_PUBLIC_SANITY_API_VERSION`
- `NEXT_PUBLIC_SANITY_STUDIO_URL`
- `NEXT_PUBLIC_SANITY_API_READ_TOKEN`
- `SANITY_API_WRITE_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_REVALIDATE_TOKEN`
- `MAILCHIMP_API_KEY`
- `MAILCHIMP_SERVER_PREFIX`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `MS_GRAPH_SENDER_EMAIL`
- `MS_GRAPH_REPLY_TO`
- `B2C_ADMIN_SANITY_ORGANIZATION_ID`
- `B2C_ADMIN_SANITY_API_VERSION`
- `B2C_ADMIN_ALLOWED_ORIGINS`
- at least one admin allowlist variable: `B2C_ADMIN_ALLOWED_EMAILS` or `B2C_ADMIN_ALLOWED_USER_IDS`

`SUPABASE_ORDER_INVOICES_BUCKET` is not production-scoped. This is acceptable only if the production Supabase bucket is named exactly `order-invoices`, because the code defaults to that value.

Important limitation: Vercel marks P24 and `SUPABASE_SERVICE_ROLE_KEY` as sensitive. The CLI confirms that the variable names exist and are scoped to production, but it does not expose their values through `vercel env pull` or `vercel env run`. The P24 values must still be checked manually in the Vercel dashboard.

## Go/No-Go Summary

Do not publish B2C to production until every item in this runbook is complete.

The environment variable names are now in place, but production readiness still depends on:

1. Merging latest `origin/main` into `b2c`.
2. Patching known launch blockers in the code.
3. Confirming sensitive Vercel values manually.
4. Applying Supabase migrations and storage setup.
5. Preparing Sanity content and webhooks.
6. Deploying the web app and Sanity App SDK admin app in the right order.
7. Running production smoke tests.

## 1. Merge Main Into B2C

Before promoting `b2c`, bring in the current `origin/main`.

Required because `b2c` was behind `origin/main` during review, including:

- `1565b37 fix(comparison): refresh compare page after client updates`
- `7bd9f88 fix(seo): prefer brand plus product name on product pages`

Suggested flow:

```bash
git fetch origin
git checkout b2c
git merge origin/main
```

After resolving conflicts, verify the comparison widget still includes the main-branch cache-busting behavior in:

- `apps/web/src/components/comparison/FloatingComparisonBox/index.tsx`

## 2. Patch Launch Blockers

These are not just configuration tasks. They should be fixed before production.

### 2.1 Prevent Production P24 Mock Mode

Current risk:

- `P24_MODE` falls back to `mock` when missing or mistyped.
- `P24_FORCE_MOCK=1` overrides live mode.
- Mock mode can auto-confirm checkout payment.

Relevant files:

- `apps/web/src/global/b2c/checkout/server/p24-config.ts`
- `apps/web/src/global/b2c/checkout/server/payment-provider.ts`
- `apps/web/src/global/b2c/checkout/server/payment-mock.ts`
- `apps/web/src/global/b2c/checkout/server/start-payment.ts`
- `apps/web/src/global/b2c/checkout/server/p24-notification.ts`

Production-safe behavior should be:

- Production runtime must reject missing `P24_MODE`.
- Production runtime must reject `P24_FORCE_MOCK=1`.
- Production runtime must reject any value other than `P24_MODE=production`.

### 2.2 Protect Newsletter Generation API

Current risk:

- `/api/newsletter/generate` allows `Access-Control-Allow-Origin: *`.
- It does not verify a bearer/admin token.
- It can create Mailchimp campaign drafts.

Relevant file:

- `apps/web/src/app/api/newsletter/generate/route.ts`

Required fix:

- Add server-side authorization before any Mailchimp draft creation.
- Restrict CORS to the Studio origin, or remove permissive CORS if not needed.
- Use a dedicated secret rather than reusing unrelated tokens.

### 2.3 Remove Product Inquiry Test Recipient

Current risk:

- Product inquiry notifications are hardcoded to `oliwier@kryptonum.eu`.
- Production product inquiries should go to configured Audiofast support/sales recipients.

Relevant file:

- `apps/web/src/app/api/contact/route.ts`

Required fix:

- Remove `PRODUCT_INQUIRY_TEST_RECIPIENT`.
- Use Sanity `supportEmails` for product inquiries as well.
- Confirm fallback recipient is appropriate: `MS_GRAPH_SENDER_EMAIL` or `www@audiofast.pl`.

### 2.4 CPO Reservation Policy

Implemented policy:

- CPO checkout remains enabled.
- Checkout-time Sanity product reads use a fresh non-CDN path instead of cached page data.
- When an order is persisted, the app reserves each CPO specimen by moving Sanity `availabilityStatus` from `available` to `on_hold`.
- The reservation writes `holdUntil`, `holdOrderNumber`, and `holdPaymentSessionId`.
- Reservation uses Sanity revision checks so two checkout attempts cannot both reserve the same fetched revision.
- If reservation fails, the just-created order is cleaned up and checkout returns a cart-invalid result.
- If payment registration fails after reservation, the CPO hold is released back to `available`.
- When payment is confirmed, held CPO items move to `sold_out`.
- Expired `on_hold` states can be lazily released during fresh CPO cart/checkout revalidation.

Relevant files:

- `apps/web/src/global/b2c/cart/server/revalidation.ts`
- `apps/web/src/global/b2c/utils/buyability.ts`
- `apps/web/src/global/b2c/checkout/server/submit-checkout.ts`
- `apps/web/src/global/b2c/checkout/server/persistence.ts`
- `apps/web/src/global/b2c/checkout/server/cpo-availability.ts`
- `apps/web/src/global/b2c/checkout/server/payment-update.ts`
- `apps/studio/schemaTypes/documents/collections/cpo-product.tsx`

Production requirement:

- `SANITY_API_WRITE_TOKEN` must be configured in production with permission to patch `cpoProduct` documents.
- Sanity webhooks should still target `/api/revalidate/` so public CPO PDP/listing cache updates after availability changes.

## 3. Confirm Vercel Production Values Manually

Because sensitive values are not exposed by CLI, check these in Vercel dashboard before the production deployment.

### 3.1 P24 Values

Required values:

```env
P24_MODE=production
P24_MERCHANT_ID=<numeric production merchant/account id>
P24_POS_ID=<numeric production POS/shop id>
P24_API_KEY=<production Klucz API>
P24_CRC=<production Klucz do zamowien / CRC key>
P24_STATUS_CALLBACK_BASE_URL=https://audiofast.pl
```

Must be absent or empty:

```env
P24_FORCE_MOCK
P24_API_BASE_URL
P24_PANEL_BASE_URL
```

Leave `P24_API_BASE_URL` and `P24_PANEL_BASE_URL` unset unless intentionally overriding the defaults:

- production API default: `https://secure.przelewy24.pl/api/v1`
- production panel default: `https://secure.przelewy24.pl`

### 3.2 Supabase Values

Confirm:

```env
NEXT_PUBLIC_SUPABASE_URL=<production project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
SUPABASE_SERVICE_ROLE_KEY=<production service role key>
```

If the invoice bucket is not named `order-invoices`, add:

```env
SUPABASE_ORDER_INVOICES_BUCKET=<actual bucket name>
```

### 3.3 Sanity Values

Confirm:

```env
NEXT_PUBLIC_SANITY_PROJECT_ID=<production project id>
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=<pinned API version>
NEXT_PUBLIC_SANITY_STUDIO_URL=<production Studio URL>
NEXT_PUBLIC_SANITY_API_READ_TOKEN=<read token>
SANITY_API_WRITE_TOKEN=<write token used by B2C CPO availability and denormalization writes>
SANITY_AUTH_TOKEN=<token used by Studio deployment if needed>
```

### 3.4 Admin App Values

Confirm:

```env
B2C_ADMIN_SANITY_ORGANIZATION_ID=<Sanity organization id>
B2C_ADMIN_SANITY_API_VERSION=<pinned API version>
B2C_ADMIN_ALLOWED_ORIGINS=<exact deployed Sanity App origin list>
B2C_ADMIN_ALLOWED_EMAILS=<comma-separated operator emails>
```

`B2C_ADMIN_ALLOWED_EMAILS` format:

```env
first@example.com,second@example.com,third@example.com
```

At least one of these must be configured:

- `B2C_ADMIN_ALLOWED_EMAILS`
- `B2C_ADMIN_ALLOWED_USER_IDS`

### 3.5 Test Flags

Confirm these are absent or empty in production:

```env
E2E_AUTH_HELPER
E2E_AUTH_HELPER_SECRET
E2E_MOCK_EMAILS
E2E_MOCK_MAILCHIMP
E2E_DISABLE_ANALYTICS
```

## 4. Supabase Production Preparation

Apply all B2C migrations to production before deploying web code that depends on them.

Migrations added on the branch:

- `supabase/migrations/20260506110000_admin_order_case_transactions.sql`
- `supabase/migrations/20260507084500_add_coupon_archived_at.sql`
- `supabase/migrations/20260508092856_harden_b2c_rls_policies_and_grants.sql`
- `supabase/migrations/20260508093000_optimize_b2c_rls_auth_email_initplan.sql`
- `supabase/migrations/20260521075500_add_awaiting_confirmation_order_status.sql`
- `supabase/migrations/20260521081500_add_order_payment_session_id.sql`
- `supabase/migrations/20260521084300_add_order_expected_delivery_estimate.sql`
- `supabase/migrations/20260521101500_add_return_case_awaiting_goods.sql`

Required checks:

1. Confirm migrations are applied to the production Supabase project.
2. Confirm RLS is enabled and policies match the intended customer/admin access model.
3. Confirm the invoice storage bucket exists.
4. Confirm the invoice bucket is private.
5. Confirm admin upload/download and customer invoice download work through app routes, not public bucket URLs.
6. Confirm service-role key is present only in server-side Vercel env.

## 5. Sanity CMS Preparation

### 5.1 Backfill Sellable Product Fields

Existing product documents may not have the new B2C fields. Missing values default to not buyable.

Backfill intended sellable standard products:

- `isSellableOnline=true`
- `isReturnable=true` or explicit false where needed
- pricing data exists in Supabase

Backfill intended sellable CPO items:

- `isSellableOnline=true`
- `isReturnable=true` or explicit false where needed
- `availabilityStatus=available`
- `priceCents` set

Relevant schemas:

- `apps/studio/schemaTypes/documents/collections/product.ts`
- `apps/studio/schemaTypes/documents/collections/cpo-product.tsx`

### 5.2 Confirm Required Settings Content

Confirm the production `settings` singleton has all fields required by the B2C storefront and emails:

- company registration data
- contact/support emails
- cart empty state
- cart support card
- `mailchimpAudienceId`
- B2C transactional email copy recipients if needed
- B2C withdrawal form PDF if launch requires it
- B2C return instructions email content
- analytics IDs and Meta CAPI token if enabled

Relevant schema:

- `apps/studio/schemaTypes/documents/singletons/settings.ts`

### 5.3 Configure Sanity Revalidation Webhook

Production freshness depends on the revalidation endpoint because Next cache profiles are long-lived.

Configure a Sanity webhook:

- URL: `https://audiofast.pl/api/revalidate/`
- Method: `POST`
- Authorization: `Bearer <NEXT_REVALIDATE_TOKEN>`
- Dataset: `production`
- Projection must include `_type`, `_id`, `operation`, and string slug where available.

Example payload shape:

```json
{
  "_type": "product",
  "_id": "product-id",
  "operation": "update",
  "slug": "/produkty/example/"
}
```

Important follow-up: `NEXT_REVALIDATE_TOKEN` currently also acts as the Sanity write token for denormalization in `apps/web/src/app/api/revalidate/route.ts`. Split this into separate secrets before final hardening, or knowingly use a least-privilege Sanity token and rotate it.

## 6. Admin App SDK Preparation

The Sanity App SDK admin app has its own build-time API base.

Before deploying the admin app, set:

```env
VITE_B2C_ADMIN_API_BASE_URL=https://audiofast.pl/
```

Without this, the app code defaults to the old b2c preview deployment:

- `apps/b2c-admin/src/config.ts`

Deploy command from `apps/b2c-admin`:

```bash
bun run deploy
```

After deployment:

1. Open the admin app in Sanity.
2. Inspect the browser request `Origin`.
3. Ensure that exact origin is included in `B2C_ADMIN_ALLOWED_ORIGINS`.
4. Confirm the signed-in operator is included in `B2C_ADMIN_ALLOWED_EMAILS` or `B2C_ADMIN_ALLOWED_USER_IDS`.
5. Test `/api/admin/b2c/me` from the app.

## 7. Build And Test Gates

Run these before merging to main:

```bash
bun run check-types
bun run lint
bun run build
```

Run focused B2C tests:

```bash
cd apps/web
bun run test:run
bun run test:e2e
```

Run admin app checks:

```bash
cd apps/b2c-admin
bun run check-types
bun run test
bun run build
```

Also run:

```bash
git diff --check origin/main...HEAD
```

Known previous issue: whitespace errors existed in `.ai/b2c/audiofast-wymagania-b2c.txt` and `apps/b2c-admin/src/admin/components/OrderDetailView.tsx`.

## 8. Production Deployment Order

Recommended order:

1. Merge `origin/main` into `b2c`.
2. Patch launch blockers.
3. Run local build/test gates.
4. Apply Supabase migrations to production.
5. Prepare Sanity production content.
6. Confirm Vercel production env values manually.
7. Deploy the web app to production.
8. Configure or verify the Sanity production revalidation webhook.
9. Deploy the Sanity Studio if schema changes need publication.
10. Deploy the B2C admin Sanity App SDK with `VITE_B2C_ADMIN_API_BASE_URL=https://audiofast.pl/`.
11. Run production smoke tests.
12. Monitor first real P24 payment and order lifecycle.

## 9. Production Smoke Test Checklist

### Storefront

1. Homepage loads.
2. Product listing loads.
3. Product detail page loads.
4. Buyable standard product shows add-to-cart controls.
5. Cart persists after refresh.
6. Coupon validation works.
7. Checkout form validates required fields.
8. Newsletter consent path does not block checkout if Mailchimp fails.

### P24

1. Submit checkout for a low-value real test order.
2. Confirm redirect goes to `secure.przelewy24.pl`, not sandbox.
3. Confirm return URL is under `https://audiofast.pl`.
4. Confirm `urlStatus` callback reaches `https://audiofast.pl/api/payment/status/`.
5. Confirm P24 panel shows the transaction.
6. Confirm Supabase order is paid only after real provider verification.
7. Confirm order confirmation email sends.

### Customer Account

1. Request OTP for an email with a paid order.
2. Verify OTP.
3. Open customer panel.
4. Open order details.
5. Download invoice if attached.
6. Submit cancellation request where eligible.
7. Submit return request where eligible.

### Admin App

1. Open Sanity App SDK admin panel.
2. Confirm current user endpoint passes.
3. Load orders list.
4. Open order detail.
5. Update shipment data.
6. Update expected delivery estimate.
7. Upload invoice PDF below production upload limit.
8. Resolve cancellation or return case.
9. Load coupons.
10. Create/edit/archive coupon.
11. Load analytics.

### CMS/Revalidation

1. Edit a product in Sanity.
2. Publish it.
3. Confirm the production page updates after webhook revalidation.
4. Confirm no webhook auth failures in logs.
5. Confirm denormalization writes still work for brand/category changes.

## 10. Monitoring During First Launch Window

Monitor:

- Vercel function logs for `/api/payment/status/`
- Vercel function logs for `/api/admin/*`
- Vercel function logs for `/api/revalidate/`
- Supabase orders table
- Supabase auth activity
- Supabase storage invoice bucket
- P24 transaction panel
- Microsoft Graph email send failures
- Mailchimp API failures
- Sanity webhook delivery logs

Roll back or disable B2C checkout if:

- P24 registration fails for real customers.
- P24 callbacks are not reaching production.
- Orders are marked paid without verified P24 payment.
- Admin operators cannot access order management.
- Product inquiries do not reach Audiofast recipients.
- CPO items can be purchased twice.

## 11. Remaining Hardening After Launch

These are strongly recommended even if launch proceeds after the blocker fixes:

1. Split `NEXT_REVALIDATE_TOKEN` from the Sanity write token used for denormalization.
2. Add P24 webhook IP allowlist enforcement if Vercel source IP handling can be made reliable.
3. Add CI for web/admin typecheck, lint, tests, and build.
4. Update stale GitHub workflow runtime from Node 18 to Node 20+.
5. Lower invoice upload size below Vercel request limits or switch to direct signed Supabase uploads.
6. Add operational indexing review for admin analytics and order filters.
7. Add automated CPO reservation/sold-state handling if CPO checkout remains enabled.
