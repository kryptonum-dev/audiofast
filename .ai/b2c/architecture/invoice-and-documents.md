# Invoice And Documents

Status: in progress
Owner: planning
Last updated: 2026-04-09
Depends on: `commerce-data-model.md`
Related files: `admin-panel-sanity.md`, `email-flow.md`, `commerce-table-model.md`

## Purpose

This file defines how invoice PDFs and related customer documents are handled in v1.

## Current Known Inputs

- invoices are handled manually by the business
- the business generates the PDF outside the app
- the operator later uploads the PDF through the internal admin workflow
- invoice access must fit both customer panel and admin panel flows

## Accepted V1 Direction

### Storage Strategy

Invoice PDFs should live in:

- private `Supabase Storage`

They should not live:

- inside the relational order tables
- as public CMS assets

### Order Linkage

The order should keep only metadata and a file reference in:

- `orders.invoice_data`

The accepted `invoice_data` shape is:

- `recipientType`
- `companyName` nullable
- `taxId` nullable
- `invoiceAddress` nullable
- `storagePath` nullable
- `attachedAt` nullable

Rules:

- `recipientType` can be `private` or `company`
- `invoiceAddress`, when present, should use `street`, `postalCode`, `city`, and `country`
- `storagePath` is enough because the bucket can stay globally fixed for the invoice storage flow
- `attachedAt` is the single v1 attachment timestamp

### Admin Upload Flow

The admin upload UI may still live in:

- the `Sanity App SDK` admin panel

But the upload destination should be:

- `Supabase Storage`

This means:

- `Sanity` is the admin surface
- `Supabase Storage` is the actual invoice file store
- `Supabase` order data is the source of truth for whether an order has an invoice

### Customer Access Rules

Customer invoice access must not rely on exposing a raw unrestricted file URL.

Instead:

- customer opens order detail
- application verifies the customer may access that order
- application returns or generates authorized file access

This can be implemented through:

- signed URLs
- or application-mediated download/proxy behavior

### Email Attachment Rules

The current planning direction still allows invoice PDFs to be attached to email notifications when appropriate, but:

- the existence of a stored invoice file should not depend on email delivery
- the customer panel remains the long-term access path

## Why Supabase Storage Wins In V1

Compared with using `Sanity` assets, `Supabase Storage` is the better fit because invoices are:

- private
- order-bound
- operational
- customer-access-controlled

They are not editorial CMS content.

## Open Questions To Carry Forward

- exact storage path convention
- exact signed-URL vs proxy-download approach

## Notes

The v1 goal is to keep invoice handling practical:

- business generates PDF manually
- operator uploads PDF once
- order stores reference
- customer can access it securely later
