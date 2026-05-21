# Client Feedback - Order Workflow Issues

Status: discovery draft
Owner: Oliwier / B2C follow-up
Last updated: 2026-05-21
Related files: `README.md`, `architecture/order-lifecycle.md`, `architecture/email-flow.md`, `business/returns-and-cancellations-rules.md`

## Purpose

This document summarizes the client's first review feedback for the B2C branch and maps it against the implementation that currently exists on the `b2c` branch.

The goal is not to solve every item in full detail yet. The goal is to capture the six issues clearly, document what the branch already does, and identify the deeper questions that should be handled issue-by-issue.

## Current Branch Context

The `b2c` branch is a large B2C implementation branch. Compared with `origin/main`, it adds the core storefront, checkout, payment, customer panel, admin operations, and supporting planning documentation.

Implemented or substantially implemented areas include:

- buyable PDP and cart flows in `apps/web`
- checkout and Przelewy24 payment confirmation
- customer OTP access and customer order panel
- customer cancellation and return request entry points
- Sanity App SDK admin app in `apps/b2c-admin`
- admin order list/detail, status changes, shipment metadata, invoice upload, coupons, and analytics
- Supabase commerce tables, migrations, RLS hardening, and server-side B2C domain logic
- transactional email templates and Microsoft Graph email sending
- B2C planning/spec documentation under `.ai/b2c`

The current order status model is:

- `awaiting_payment`
- `paid`
- `processing`
- `shipped`
- `completed`
- `cancelled`
- `returned`

The current admin happy path is effectively:

`awaiting_payment` -> `paid` -> `processing` -> `shipped` -> `completed`

Return and cancellation handling exists, but it is intentionally simplified for v1 and still needs policy-flow hardening. Apaczka is not a true API integration today. Delivery estimates are not a structured field. Email copies to Audiofast are not implemented.

There are also uncommitted working-tree changes in `apps/b2c-admin` related to admin thumbnails/images, plus many unrelated `.cursor/skills` deletions. Those unrelated deletions should not be treated as part of the B2C workflow feedback.

## Issue 1 - Missing "Oczekiwanie na potwierdzenie" Status

Client feedback:

> Brakuje statusu "Oczekiwanie na potwierdzenie" - sklep musi potwierdzic ze realizacja jest mozliwa, ewentualnie uzgodnic termin dostawy z dostawca i klientem, a dopiero potem albo anulowac albo zmienic na "W realizacji".

### What Exists Today

The current model has `paid` after payment confirmation and `processing` when Audiofast starts handling the paid order internally.

In practice, `paid` partially represents "paid but not yet being processed", but it is not named or presented as an explicit shop-confirmation stage.

Current transition rules allow:

- `paid` -> `processing`
- `paid` -> `shipped`
- `paid` -> `completed`
- `paid` -> `cancelled`

### Gap

The client expects an explicit operational stage after payment and before fulfillment:

`Oczekiwanie na potwierdzenie`

This stage means Audiofast has received the order/payment but has not yet confirmed that fulfillment is possible. During this stage the shop may need to:

- confirm availability
- contact the supplier
- agree on delivery timing
- communicate the proposed delivery date to the customer
- cancel the order if fulfillment is not possible
- move the order to `W realizacji` only after confirmation

The existing `paid` status is technically close, but likely not sufficient for client/operator/customer clarity.

### Initial Direction

Decide whether this should be a new internal status or a relabeling of `paid`.

Recommended direction for clarity:

- keep `paid` as a technical/payment event only if needed internally
- introduce a customer/operator-facing status such as `awaiting_confirmation`
- map it to Polish label `Oczekiwanie na potwierdzenie`
- make it the normal post-payment operational state
- allow admin transitions from it to `processing` or `cancelled`

Open design questions:

- Should `paid` remain visible to customers, or should customers see only `Oczekiwanie na potwierdzenie` after payment?
- Should payment webhook set `paid` and immediately also set `awaiting_confirmation`, or should `paid` be replaced by `awaiting_confirmation` in the main order lifecycle?
- Should an email be sent for this status, or should the payment confirmation email explain that the order is awaiting shop confirmation?
- Should direct jumps from this status to `shipped` or `completed` remain allowed?

Likely affected areas:

- status constants and transition logic in `apps/web/src/global/b2c/utils/statuses.ts`
- payment status update flow in `apps/web/src/global/b2c/checkout/server/payment-status.ts`
- admin status update logic in `apps/web/src/global/b2c/admin/server/order-status.ts`
- admin UI status labels and select options in `apps/b2c-admin`
- customer panel timeline/status labels
- email copy in confirmation/status templates
- Supabase data migration and existing order compatibility

## Issue 2 - Missing Expected Delivery Date Field

Client feedback:

> Brakuje oczekiwanego terminu dostawy, ktory to termin mozna wpisac w panelu CMS przed lub po zmianie statusu na "w realizacji".

### What Exists Today

The email-flow spec already mentions that the `processing` email may include a fulfillment estimate or note if Audiofast provides one.

However, the implementation does not have a structured expected delivery date field:

- no `expected_delivery_date` or similar order column exists in Supabase types
- no admin field exists in the order detail view
- no typed value is included in the processing email template
- no customer panel display exists for a delivery estimate

The processing email currently uses generic text:

`Zespol Audiofast rozpoczal obsluge zamowienia. Poinformujemy Cie, gdy przesylka zostanie nadana.`

### Gap

The client expects Audiofast to record an expected delivery date in the admin/CMS panel, before or after setting the order to `W realizacji`.

This is broader than email copy. It is a data-model and workflow requirement.

### Initial Direction

Add a structured fulfillment/delivery estimate to the order.

Possible data model:

- `expected_delivery_date` for a single date
- or `expected_delivery_from` / `expected_delivery_to` if ranges are needed
- optional `delivery_note` for free-text explanation
- audit metadata if needed: who set it and when

Expected behavior:

- admin can set or edit the date while order is in `Oczekiwanie na potwierdzenie`, `W realizacji`, and possibly `Wyslane`
- changing the order to `W realizacji` should make it easy to include the date in the email
- customer should probably see the date in the order detail page
- date changes after the first processing email need a decision: silent update, resend, or dedicated delivery-date update email

Open design questions:

- Is a single date enough, or does Audiofast need a delivery window?
- Should the date be required before moving to `W realizacji`?
- Should the date be shown in customer panel even before `W realizacji`?
- Should the customer receive a separate email if the date changes later?
- What happens when the customer disagrees with the proposed delivery date?

Likely affected areas:

- Supabase migration and generated types
- admin order detail UI and admin API payloads
- order read model in `apps/web/src/global/b2c/admin/server/orders.ts`
- status email content/template for `processing`
- customer order detail read model and UI
- tests around status changes and email content

### Recommended Solution

Use a **date range model** with optional end date:

- `expected_delivery_from date null`
- `expected_delivery_to date null`

A single expected date is `from` only. A range is `from` + `to`. Use `date`, not timestamp, because this is a business delivery day/window, not an exact time.

Skip `delivery_note` for the first pass unless Audiofast explicitly wants free-text explanations. The current ask is date/window only.

### Behavior

Admin should be able to set/edit the estimate while the order is operationally active:

- current branch: `paid`, `processing`, `shipped`
- after issue 1 lands: also `awaiting_confirmation`
- block edits for `awaiting_payment`, `cancelled`, `returned`

Customer behavior:

- show `Przewidywana dostawa` in order details whenever `expected_delivery_from` exists
- single date: `20 maja 2026`
- range: `20-27 maja 2026`
- omit entirely when empty
- no customer email when only the date changes

Email behavior:

- include the estimate in status-change emails when present, especially `processing`
- optionally include it in `shipped` too, but tracking should remain primary
- do not include it in `cancelled` / `returned`
- no separate delivery-date update email

### Implementation Plan

1. Add Supabase migration:
   `supabase/migrations/<timestamp>_add_expected_delivery_to_orders.sql`

   Add a constraint like: `expected_delivery_to is null OR expected_delivery_from is not null AND expected_delivery_to >= expected_delivery_from`.

2. Regenerate/update `apps/web/src/global/supabase/database.types.ts`.

3. Add shared parsing/formatting:
   - `apps/web/src/global/b2c/utils/orders.ts`
   - `apps/web/src/global/b2c/utils/orders.test.ts`
   - customer formatting in `apps/web/src/global/b2c/customer-auth/orders-formatting.ts`
   - admin formatting in `apps/b2c-admin/src/admin/formatters.ts`

4. Add admin backend save endpoint:
   - new `apps/web/src/global/b2c/admin/server/order-delivery-estimate.ts`
   - new `apps/web/src/app/api/admin/orders/[orderNumber]/delivery-estimate/route.ts`

   This should mirror `order-shipment.ts`: validate input, update only the delivery estimate, no email.

5. Extend admin order detail read model:
   - `apps/web/src/global/b2c/admin/server/orders.ts`
   - `apps/b2c-admin/src/admin/types.ts`

   Add `expectedDelivery: { from: string; to: string | null } | null` and `actions.canEditDeliveryEstimate`.

6. Extend admin UI:
   - `apps/b2c-admin/src/admin/api.ts`
   - `apps/b2c-admin/src/admin/components/OrderDetailView.tsx`

   Add a `DeliveryEstimateSection` near `Status i akcje`, before shipment/invoice. Use two native `type="date"` inputs: `Od` and `Do`. Do not reuse `DateRangePicker`, because it is built for past filters.

7. Make processing status email reliable:
   - extend `apps/web/src/global/b2c/admin/server/order-status.ts` so status-update rows select the delivery columns
   - let status transition optionally carry delivery fields, or make the UI save the estimate before changing status
   - safest backend design: allow delivery fields in the status transition payload so the update and email source row are consistent

8. Extend email rendering:
   - `apps/web/src/global/b2c/admin/server/order-status-email.ts`
   - `apps/web/src/global/b2c/admin/order-status-email-content.ts`
   - `apps/web/src/emails/order-status-update-template.tsx`
   - `apps/web/src/app/podglad/email/_preview/status-preview.ts`

9. Extend customer order detail:
   - `apps/web/src/global/b2c/customer-auth/server/order-detail.ts`
   - `apps/web/src/components/b2c/CustomerPanel/OrderDetails/OrderDataSection/index.tsx`
   - possibly its SCSS module if spacing needs adjustment

### Tests To Add

- `order-delivery-estimate.test.ts`: validation, clearing date, range order, blocked terminal statuses
- `order-status-email.test.ts`: processing email includes estimate when present, omits when absent
- `orders.test.ts`: admin detail maps delivery estimate
- `order-detail.test.ts`: customer detail maps delivery estimate
- `api.test.ts`: admin client calls `/delivery-estimate/`
- `formatters.test.ts`: single date/range formatting

Core risk: if the admin changes status to `processing` before the estimate is saved, the email will not include it. Solve that either with an atomic status payload that includes the estimate, or with UI flow that saves the estimate first and only then posts the status change.

## Issue 3 - Customer Emails Must Be Copied To Audiofast

Client feedback:

> Maile wysylane do klienta musza byc w kopii wysylane do nas. Musimy miec kopie wszystkich mail wysylanych do klientow, z potwierdzeniami, itp.

### What Exists Today

Transactional emails are sent via the Microsoft Graph email service.

Current B2C email types include:

- payment/order confirmation email
- order status update emails for `processing`, `shipped`, `cancelled`, `returned`
- invoice-available email with PDF attachment
- OTP login email

The current email abstraction supports:

- `to`
- `subject`
- `htmlBody`
- `attachments`
- `replyTo`
- `saveToSentItems`

It does not support `cc` or `bcc`.

The current email-flow spec explicitly says lifecycle emails are customer-facing only and internal operator notification emails are out of scope for v1. That conflicts with the client's review feedback.

### Gap

Audiofast wants copies of all customer-facing transactional emails.

This includes at least:

- payment/order confirmation
- status change emails
- invoice emails
- cancellation emails
- return emails
- probably delivery-date update emails if added

It is unclear whether OTP login emails should also be copied. From a privacy/security perspective, OTP emails should probably not be copied unless the client explicitly requires that and accepts the risk.

### Initial Direction

Keep `www@audiofast.pl` as the sender configured by `MS_GRAPH_SENDER_EMAIL`. Because Microsoft Graph sends with `saveToSentItems: true`, the shared mailbox already has a sent-mail record of customer emails and attachments.

Add optional Sanity-managed BCC recipients for additional operational copies.

Recommended direction:

- keep sender/reply-to addresses in environment variables
- keep `saveToSentItems: true` as the default mailbox audit trail
- use BCC by default, not CC, so customers do not see internal recipients
- configure optional extra copy recipients in the Sanity global settings singleton
- allow zero recipients and cap the list at five recipients
- support multiple recipients, for example `zamowienia@audiofast.pl`
- exclude OTP emails unless explicitly approved
- if Sanity settings cannot be loaded, still send the customer email and log the missing copy-recipient lookup

Open design questions:

- Should copies use CC or BCC? BCC is safer for customer privacy.
- Which Audiofast mailbox or mailboxes should receive copies?
- Should OTP emails be excluded?
- Should failed copy delivery fail the whole customer email send, or should customer delivery be primary?
- Do they need copies only for production, or also staging/preview?

Likely affected areas:

- `apps/web/src/global/microsoft-graph/client.ts`
- `apps/web/src/global/email/service.ts`
- `apps/studio/schemaTypes/documents/singletons/settings.ts`
- dedicated Sanity query for B2C transactional email copy recipients
- B2C customer transactional email wrapper
- every B2C transactional email sender
- email tests and previews
- Sanity generated types

## Issue 4 - Invoice Email Should Include Withdrawal Form When Return Is Available

Client feedback:

> Przydalby sie automatyczny mail do klienta z kopia faktury oraz formularzem odstapienia od umowy zakupu, gdy zwrot przysluguje - taki formularz powinien byc mozliwy do dodania w CMS. Jezeli nie automatyczny mail to wywolywany z pozycji CMS po zapisaniu faktury.

### What Exists Today

Invoice upload is implemented in the admin order detail.

Current behavior:

- admin uploads a PDF invoice
- file is stored in Supabase Storage bucket `order-invoices`
- order `invoice_data` is updated
- customer receives a dedicated invoice email
- invoice PDF is attached to that email
- customer can also download the invoice from the customer panel

The upload is currently invoice-only:

- PDF only
- one fixed invoice storage path
- no additional document attachment support
- no CMS-managed withdrawal form
- no conditional attachment based on return eligibility

Return eligibility exists at the order level, but the invoice email does not use it to attach legal documents.

### Gap

When a return/withdrawal right applies, the customer should receive a withdrawal form together with the invoice email, or via an admin-triggered action after saving the invoice.

The form should be manageable from CMS/admin, not hardcoded into the codebase.

Refined gaps from code research:

- no global withdrawal-form asset exists in Sanity/settings
- no shared `evaluateOrderWithdrawalFormEligibility()` or equivalent exists for invoice emails
- return eligibility is duplicated across customer return, admin return case, customer order detail, and admin order detail logic
- `apps/web/src/global/b2c/admin/server/order-invoice.ts` currently loads only invoice/email fields and sends exactly one attachment
- `apps/web/src/emails/order-invoice-available-template.tsx` says only that a single PDF is attached
- admin upload UI does not surface whether the customer email was sent, failed, or sent with extra documents
- planning docs `architecture/invoice-and-documents.md` and `architecture/email-flow.md` describe invoice PDFs only, not conditional legal-document attachments

### Recommended Product Decision

Treat this as an **order documents + transactional email** enhancement, not as an order-status change.

Recommended behavior:

- attach the CMS-managed `formularz odstapienia od umowy` to the existing invoice availability email
- keep invoice delivery separate from status emails such as `processing` or `shipped`
- attach the invoice PDF always
- attach the withdrawal form only when the order is eligible for return/withdrawal under the agreed v1 rules
- if the form is not attached, still send the invoice email and expose the skip reason in admin
- store the withdrawal form as one global PDF in Sanity `settings`, not in per-order Supabase invoice storage
- keep per-order invoices in private Supabase Storage, because they are order-bound and customer-specific
- send through `sendB2cCustomerTransactionalEmail` so Issue 3 BCC/copy behavior applies to both attachments

Recommended v1 eligibility should mirror the current self-service return rules:

- order status is `shipped` or `completed`
- order is within the 14-day return window from `shipped_at`
- every `order_items.is_returnable` value is true, because v1 uses whole-order returns
- `invoice_data.recipientType` is not `company`
- missing `shipped_at` means the form is not attached

Open policy decision:

- decide whether an existing open return case should suppress the attachment. For invoice-time legal documents, it probably should **not** suppress the form by itself; for self-service return creation, it should continue to block duplicate cases.

### Timing Note

The client appears to expect invoices to be sent when goods are dispatched. Current code allows invoice upload after payment and before shipment:

- invoice upload is blocked only for `awaiting_payment`
- upload from `paid`, `awaiting_confirmation`, or `processing` currently sends the invoice email immediately
- return eligibility currently starts only at `shipped` / `completed`

This creates the main workflow risk: if the operator uploads the invoice before shipment, the withdrawal form will be skipped under the recommended v1 rules.

Recommended handling:

- evaluate the form attachment at email-send time
- show the admin why the form was omitted
- consider restricting invoice upload to `shipped` / `completed` later if Audiofast confirms invoices are only issued at dispatch
- optionally add a manual "send documents again" action so the admin can send invoice + withdrawal form after shipment without re-uploading the invoice

### CMS / Storage Direction

Best fit: Sanity `settings`.

Reasoning:

- the withdrawal form is a global legal/customer document, not an order-specific private document
- Sanity already has a `Formularze i komunikacja` settings group and B2C transactional email copy recipients
- product schemas already use Sanity file assets for PDF downloads
- legal/ops staff can update the form without a deploy
- Issue 6 can later store return-instruction content in the same settings area

Suggested Sanity fields:

- `b2cWithdrawalForm.file` as PDF file asset
- optional `b2cWithdrawalForm.enabled`
- optional `b2cWithdrawalForm.attachmentFilename`, defaulting to `formularz-odstapienia-od-umowy.pdf`
- optional internal label or notes for editors

Avoid for v1:

- static project PDF, because updates would require deploys
- order invoice bucket for the global form, because that bucket is for private per-order invoice PDFs
- per-order copies of the form, unless legal requires versioned evidence of exactly which form was sent

### Implementation Plan

1. Add the global withdrawal form to Sanity settings:
   - `apps/studio/schemaTypes/documents/singletons/settings.ts`
   - add PDF validation and editor-facing copy in the existing forms/communication group

2. Add Sanity query and server loader:
   - `apps/web/src/global/sanity/query.ts`
   - return asset URL, original filename, and configured attachment filename
   - fetch bytes server-side when the invoice email is being built
   - use dynamic or explicitly revalidated settings fetches so legal-document updates are not stale for too long

3. Extract shared eligibility logic:
   - create a focused helper such as `evaluateOrderWithdrawalFormEligibility()`
   - base it on existing `isReturnEligibleOrderStatus`, `isWithinReturnWindow`, `getOrderInvoiceRecipientType`, and `order_items.is_returnable`
   - reuse or refactor the current admin/customer return eligibility logic to avoid future drift
   - keep self-service duplicate-return-case checks separate from legal-document attachment policy

4. Extend invoice email pipeline:
   - update `loadOrderInvoiceRow()` in `order-invoice.ts` to include `shipped_at`
   - load order item returnability for the invoice order
   - evaluate eligibility after the invoice metadata is saved
   - build attachments as invoice first, withdrawal form second when eligible and present
   - keep email failures non-blocking for invoice storage, matching current behavior

5. Extend email template:
   - add `includesWithdrawalForm` prop to `OrderInvoiceAvailableTemplate`
   - mention one attachment when only the invoice is attached
   - mention invoice + withdrawal form when both PDFs are attached

6. Extend API result and admin UI:
   - add `withdrawalFormAttached: boolean`
   - add `withdrawalFormSkipReason` for status, company invoice, non-returnable item, expired window, missing `shipped_at`, missing CMS form, or fetch failure
   - show the result in `InvoiceSection` after upload
   - optionally add a separate resend endpoint/action later: `POST .../invoice/resend`

7. Update planning docs:
   - `architecture/invoice-and-documents.md`: per-order invoice vs global legal form storage
   - `architecture/email-flow.md`: conditional second invoice-email attachment
   - cross-link Issue 6 so withdrawal form and return shipping instructions stay separate

### Legal / Operational Distinction From Issue 6

Issue 4 and Issue 6 should share CMS/legal-document infrastructure but remain separate customer communications.

- Issue 4: withdrawal form sent proactively with invoice when return/withdrawal applies
- Issue 6: practical return instructions sent when a return case enters `Oczekiwanie na zwrot towaru`

The withdrawal form is not the same as return shipping instructions. It should not replace the later email that tells the customer where to send goods, how to protect them, and by when.

### Open Design Questions

Updated decisions still needed:

- Confirm that the withdrawal-form attachment should use the same rules as self-service returns.
- Confirm whether company-invoice orders should never receive the form under v1 rules.
- Confirm whether one non-returnable product suppresses the form for the whole order, matching the current whole-order return model.
- Decide whether invoice upload should remain allowed before shipment or be restricted to `shipped` / `completed`.
- Decide what happens if the order is eligible but the Sanity form is missing: send invoice only with warning, or block upload/email.
- Decide whether replacing an invoice should always resend invoice + form, or whether resend should become explicit.
- Decide whether customers should also see a download link for the withdrawal form in the customer panel.
- Decide whether legal requires versioning/audit of which form version was sent.

### Acceptance Criteria

CMS:

- operator can upload or replace the global withdrawal-form PDF in Sanity settings
- invalid or non-PDF form uploads are rejected by Studio validation
- server can load the current form and attachment filename for invoice emails

Eligibility:

- shipped/completed private-customer orders within the return window and with all returnable items get the form attached
- company-invoice orders do not get the form
- orders with any non-returnable item do not get the form
- orders outside the return window do not get the form
- pre-shipment orders do not get the form unless the policy is intentionally changed
- invoice email still sends with invoice only when the form is skipped

Email:

- invoice PDF is always attached
- withdrawal form PDF is attached only when eligible and available
- email copy reflects one vs two attachments
- email continues through `sendB2cCustomerTransactionalEmail`
- internal BCC/copy recipients receive the same attachments once Issue 3 behavior is active

Admin:

- invoice upload result shows whether customer email was sent
- invoice upload result shows whether withdrawal form was attached or why it was skipped
- replacing an invoice re-evaluates eligibility at send time
- removing an invoice does not send a customer email

Docs:

- `invoice-and-documents.md` explains per-order invoice storage versus global withdrawal-form storage
- `email-flow.md` explains conditional invoice-email attachments
- Issue 6 remains documented as a separate return-instructions workflow

### Tests To Add

- eligibility helper tests for status, window edge, missing `shipped_at`, company invoice, all-returnable items, and mixed/non-returnable items
- `order-invoice.test.ts` cases for eligible order sending two attachments
- `order-invoice.test.ts` cases for ineligible orders sending invoice only with a skip reason
- missing-CMS-form test based on the chosen fallback policy
- template render/snapshot tests for invoice-only versus invoice + withdrawal form copy
- admin API/client tests for the extended `customerEmail` / withdrawal-form status payload
- regression test that invoice storage succeeds even if customer email fails, matching current behavior

Likely affected areas:

- invoice upload/email logic in `apps/web/src/global/b2c/admin/server/order-invoice.ts`
- invoice email template in `apps/web/src/emails`
- return eligibility helpers and order read model
- Sanity settings schema and GROQ query
- admin invoice UI status messages
- planning docs for invoices, emails, and returns

## Issue 5 - Apaczka Integration Is Unclear / Not Really Implemented

Client feedback:

> Na czym polega integracja z Apaczka? ... Na razie nie widze integracji z Apaczka...

### What Exists Today

There is no Apaczka API integration in the current branch.

What exists is a manual shipment metadata workflow:

- admin enters carrier and tracking number
- the system stores shipment data on the order
- the system builds an Apaczka tracking URL from the tracking number
- shipped email and customer panel can show tracking details

The code currently builds:

`https://www.apaczka.pl/sledz-przesylke/?trackingNumber=...`

There is no evidence of:

- creating Apaczka orders
- generating labels
- storing Apaczka order IDs
- synchronizing shipment status from Apaczka
- using Apaczka API tracking results inside the customer panel
- mapping Apaczka order number versus carrier tracking number

The `.ai/b2c` scope docs treated Apaczka as future scope, while the client's feedback shows they expected a clearer answer or actual integration.

### Gap

The current branch should not be described as having Apaczka integration. At most, it has manual Apaczka-style tracking links.

The client is asking an important domain question: in Apaczka there may be both order numbers and parcel/tracking numbers, and tracking may ultimately need to happen on carrier websites unless Apaczka API is used as the source.

### Initial Direction

Clarify the v1 scope and decide whether to implement actual Apaczka integration now.

If kept as manual v1:

- rename/copy should say "manual shipment tracking" rather than "Apaczka integration"
- allow entering carrier tracking URL manually, not only a generated Apaczka URL
- make customer-facing tracking reliable for DHL/InPost/Pocztex/etc.

If implementing real integration:

- store Apaczka order ID and carrier shipment/tracking number separately
- decide whether the customer panel uses Apaczka API results or carrier deep links
- add API credentials and secure backend calls
- add admin actions for creating/refreshing shipment data
- define webhook or polling model if shipment status synchronization is needed

Open design questions:

- Does Audiofast need label/order creation from the admin panel, or only tracking?
- Which identifier is available first: Apaczka order number, carrier tracking number, or both?
- Can Apaczka expose public tracking through API without customer login?
- Should customer panel display live tracking status, or simply link to external tracking?
- Should different carriers have different tracking URLs?
- Is Apaczka required for launch, or can it remain a post-launch enhancement?

Likely affected areas:

- shipment server logic in `apps/web/src/global/b2c/admin/server/order-shipment.ts`
- shipment UI in `apps/b2c-admin`
- shipped email template/content
- customer panel shipment display
- new backend integration module if Apaczka API is added
- environment variables and secrets

## Issue 6 - Return Workflow Needs "Oczekiwanie Na Zwrot Towaru" And Instruction Email

Client feedback:

> Jezeli klient zaznaczy zwrot, to kolejnosc statusow jest: Oczekiwanie na potwierdzenie, Oczekiwanie na zwrot towaru (tego brakuje), Towar zwrocony. W mailu potwierdzajacym po zmianie statusu na "Oczekiwanie na zwrot towaru" klient powinien otrzymac informacje: gdzie wyslac, jak towar zabezpieczyc, do kiedy musi wyslac.

### What Exists Today

The current implementation separates main order status from return-case status.

Main order statuses include only final `returned`, not "waiting for returned goods".

Return case statuses are:

- `open`
- `closed_without_return`
- `completed`

Current return behavior:

- customer can request a return only from `shipped` or `completed`
- customer return request creates a return case
- main order status remains `shipped` or `completed`
- admin handles the return manually
- admin completes the case and sets the main order to `returned` only when return processing is finished

The email-flow spec says a return request acknowledgment should be sent when the customer initiates a return request. The code research found this is not implemented yet.

The current status email for `returned` only says the return handling has been completed. It does not provide send-back instructions.

### Gap

The client expects a customer-visible stage between requesting/accepting a return and completing it:

`Oczekiwanie na zwrot towaru`

The client also expects an email at that stage with practical/legal instructions:

- return address
- how to package/protect the item
- deadline for sending the goods back
- deadline based on law

This is stronger and more specific than the current generic `open` return case.

### Initial Direction

Add an explicit customer-visible return-waiting state. This could be implemented either as a new main order status or as a richer return-case status.

Recommended direction:

- keep the main order status focused on fulfillment lifecycle
- enrich return case status to represent `awaiting_goods`
- expose that state clearly in customer panel and admin
- trigger a return-instructions email when the case enters `awaiting_goods`
- keep final order status `returned` for after Audiofast receives goods and completes refund/return handling

Possible return case flow:

1. customer submits return request
2. admin reviews/accepts if needed
3. case becomes `awaiting_goods` / `Oczekiwanie na zwrot towaru`
4. customer receives return instructions email
5. Audiofast receives goods
6. admin completes case
7. order becomes `returned` / `Towar zwrocony`

Open design questions:

- Is customer return request automatically accepted, or does admin need to approve it first?
- Should `Oczekiwanie na zwrot towaru` be a main order status or return-case status?
- What is the exact return address and packaging instruction content?
- Should the return instruction content be CMS-editable?
- How should the statutory deadline be calculated and displayed?
- Does the deadline count from withdrawal notice or from delivery/receipt?
- Should the admin record "goods received" separately before marking the return completed?
- How does refund confirmation fit into the final `returned` email?

Likely affected areas:

- return case data model and migrations
- `apps/web/src/global/b2c/customer-auth/server/order-return.ts`
- `apps/web/src/global/b2c/admin/server/order-cases.ts`
- admin return/cancellation section in `apps/b2c-admin`
- customer panel return status copy
- new return-instructions email template and sender
- CMS/admin settings for return address/instructions
- tests for return eligibility, return email, and status display

## Cross-Issue Observations

Several feedback points are connected and should probably be designed together:

- `Oczekiwanie na potwierdzenie` and expected delivery date belong to the same pre-fulfillment confirmation workflow.
- Email BCC/CC applies to all new emails added for delivery estimates, invoice/forms, and returns.
- The withdrawal form, return instructions, and return eligibility rules should use one consistent source of truth.
- Issue 4's withdrawal form should be bundled with the invoice email, while Issue 6's return instructions should remain a separate return-case email.
- Issue 4 should inherit Issue 3's BCC/copy path so internal copies include both invoice and withdrawal-form attachments.
- Apaczka affects shipment tracking, shipped email content, and customer panel display.
- Returns need both operational state and legal/customer communication state; the existing simplified return case model is the right foundation but needs more detail.

## Suggested Follow-Up Order

1. Finalize the revised order lifecycle: add or relabel `Oczekiwanie na potwierdzenie`, define transitions, and decide what customers see.
2. Add expected delivery date/notes to the order model and processing workflow.
3. Add email copy/BCC support centrally so all subsequent email work inherits it.
4. Extend invoice/document sending with return-form attachment rules.
5. Clarify Apaczka scope: manual tracking link versus real API integration.
6. Extend return cases with `Oczekiwanie na zwrot towaru` and instruction email.

## Implementation Risk Notes

- Status changes touch database values, admin UI, customer UI, emails, tests, and existing order migration/compatibility.
- Email-copy behavior must be implemented carefully to avoid exposing internal addresses to customers.
- Legal document and return instruction content should be reviewed by Audiofast before launch.
- Apaczka should not be represented as completed integration unless API-backed behavior is actually implemented.
- Return deadlines require legal/business confirmation before being encoded.

