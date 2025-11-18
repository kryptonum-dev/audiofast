# Resend Email Automation Plan

Goal: deliver a reusable Resend-powered emailing pipeline for every lead-generation touchpoint (Contact Form block, FAQ contact form, footer newsletter) plus a CMS-managed configuration surface that content editors can use to change recipients and confirmation copy without code changes.

---

## Phase 0 – Prerequisites & Audit

1. **Form inventory** – confirm the three `react-hook-form` instances (`pageBuilder/ContactForm`, `pageBuilder/FaqSection/ContactForm`, `ui/Footer/NewsletterForm`) are the only places that currently simulate API calls.
2. **Environment contract** – add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_REPLY_TO` (optional) to `apps/web/.env.example` and documentation. Validate that marketing has a verified sending domain inside Resend before deploying.
3. **Package needs** – install `resend` for the API client and `@portabletext/to-html` (or reuse an existing helper) for turning Sanity Portable Text into HTML emails.
4. **Error logging** – plan to reuse `apps/web/src/global/logger.ts` inside the route handler so we get structured logs when Resend fails.

---

## Phase 1 – Sanity CMS Configuration

1. **New singleton** – create `apps/studio/schemaTypes/documents/singletons/newsletter-settings.ts` (type `newsletterSettings`, title "Konfiguracja Newslettera", icon `MailCheck`). Fields:
   - `supportEmails` (array of strings with email validation, minimum one recipient).
   - `fromAddress` (string, fallback to env `RESEND_FROM_EMAIL`).
   - `replyToAddress` (string, optional).
   - `confirmationEmail` (single object, required) with:
     - `subject` (string, required) – email subject line.
     - `content` (portableText, required) – email body content. Supports placeholders: `{{name}}`, `{{email}}`, `{{message}}`.
   - **Note**: The same confirmation email template is used for all contact forms (contact, faq, newsletter). Confirmation emails are always sent (no toggle needed).
2. **Structure entry** – inside `apps/studio/structure.ts`, add a new "Newsletter" list item that opens the singleton document (`newsletterSettings`).
3. **Schema exports** – append the new schema to `schemaTypes/index.ts` and `documents/index.ts` so Sanity registers it.
4. **Editorial guidance** – follow the project's `portable-text-component-creation-guide.md` for describing how placeholders like `{{name}}` or `{{message}}` can be referenced inside confirmation copy (plan to replace these tokens before sending).

---

## Phase 2 – Query & Types Layer

1. **GROQ query** – add `queryNewsletterSettings` to `apps/web/src/global/sanity/query.ts`. The projection should return the base fields plus the `confirmationEmail` object with `subject` (string) and `content` (portableText array).
2. **TypeScript** – extend `apps/web/src/global/sanity/sanity.types.ts` with the new `NewsletterSettingsResult` type. Export a trimmed `EmailTemplateConfig` type for the server route to import without pulling the entire generated file.
3. **Data accessor** – create `apps/web/src/global/sanity/email-config.ts` that fetches + caches (using `cache` or `unstable_cache` if needed later) the newsletter config so `app/api/forms/submit/route.ts` can reuse it without duplicating GROQ strings.

---

## Phase 3 – Server Email Service

1. **Route handler** – build `apps/web/src/app/api/forms/submit/route.ts` using the [Next.js Route Handler guidelines](https://nextjs.org/docs/app/getting-started/route-handlers). Responsibilities:
   - Accept `POST` JSON `{ formKey: 'contact' | 'faq' | 'newsletter', payload: { name?, email, message?, consent:boolean }, metadata?: { pageTitle, source } }`.
   - Validate with `zod` (or a lightweight custom validator) and guard against missing consent / invalid email.
   - Fetch `newsletterSettings` config and use the single `confirmationEmail` template for all forms.
   - Build two email payloads:
     - **Internal notification** – HTML summarizing the submission (name, email, message, page, formKey, etc.) sent to `supportEmails`.
     - **Confirmation email** – convert `confirmationEmail.content` Portable Text to HTML using `portableTextToHtml` from `utils.ts`, interpolate tokens (e.g., `{{name}}`, `{{email}}`, `{{message}}`), use `confirmationEmail.subject` as the subject line. Always send this email.
   - Use a helper `sendEmailPair({ internal, confirmation })` that instantiates the Resend client once (memoized in `src/server/email/resend-client.ts`) and dispatches both calls concurrently with `Promise.allSettled`.
   - Return `{ success: true }` only if the internal email succeeds; log + surface structured errors otherwise so the client can show the error FormState.
2. **HTML helpers** – create `src/server/email/renderers.ts` with:
   - `compilePortableText(body, variables)` using `portableTextToHtml` from `apps/web/src/global/utils.ts` (not `@portabletext/to-html`).
   - Token interpolation function to replace `{{name}}`, `{{email}}`, `{{message}}` placeholders.
   - A minimal inline-styled layout (logo optional) so Resend renders consistently.
3. **Rate limiting hooks (optional)** – leave hooks for future middleware (e.g., `@upstash/ratelimit`) but keep this iteration minimal as requested.
4. **Security** – strip HTML from user-provided strings to avoid injection, ensure consent flags are honored, and never echo the user email body into the confirmation template unless sanitized.

---

## Phase 4 – Client Integration

1. **Shared client helper** – add `apps/web/src/lib/forms/send-form-submission.ts` exporting `sendFormSubmission(formKey, payload)`. This wrapper should:
   - POST to `/api/forms/submit`.
   - Throw a descriptive error when the response is not OK, so each form can set `formState` to `'error'`.
   - Optionally accept a `signal` for aborting duplicate submissions.
2. **Page Builder Contact Form** (`pageBuilder/ContactForm/ContactForm.tsx`)
   - Replace the fake timeout with `await sendFormSubmission('contact', data)`.
   - Keep analytics tracking in place before awaiting the API (per existing logic).
   - Reset form & show success only when the API succeeds.
3. **FAQ Contact Form** (`pageBuilder/FaqSection/ContactForm.tsx`)
   - Same API call but pass `message` + `name` + `email` after step 2.
   - Ensure step transitions remain unaffected (loading state should lock both steps).
4. **Footer Newsletter Form** (`ui/Footer/NewsletterForm.tsx`)
   - Submit only the `email` (and track consent). The API route will use the same `confirmationEmail` template to send a confirmation mail and forward the lead to support.
5. **Optional future callsites** – document how other builders could call `sendFormSubmission` with new `formKey`s once additional templates are defined in Sanity.

---

## Phase 5 – Observability & QA

1. **Logging** – extend `global/logger.ts` (or use `console.error` with consistent prefixes) when Resend rejects. Include the `formKey` and Resend request ID to help support triage issues quickly.
2. **Preview mode** – if `process.env.NODE_ENV === 'development'`, skip actual Resend calls and log payloads instead so designers can test without sending real emails.
3. **Unit coverage** – add Jest/Vitest tests around `renderPortableTextToHtml` and the request validator to make sure future schema changes don’t break runtime expectations.
4. **Manual QA checklist**
   - Each form toggles loading/error/success states correctly.
   - Confirmation emails display the Portable Text copy editors configured.
   - Internal notifications include the correct context (page title, message, etc.).

---

## Phase 6 – Rollout & Documentation

1. **Docs** – update `.ai/page-builder-section-creation-guide.md` (or create a short note in `.ai/product-pricing...` if more appropriate) to explain how editors can manage Newsletter Settings and what placeholders are available.
2. **Env propagation** – share Resend credentials with DevOps, update Vercel / hosting secrets, and ensure preview/staging projects have a sandbox key.
3. **Sanity content seeding** – populate the new singleton with default copy + recipients so the API route has data before merging the code.
4. **Metrics** – optional: emit an analytics event upon successful submission to track lead volume per formKey.

---

Following this plan keeps the implementation minimal yet reusable, meets the user’s requirement for a CMS-driven confirmation email, and aligns with Next.js App Router best practices for API work per the official Route Handlers guidance.

