# Product Inquiry Modal Implementation Plan

## Overview

This document outlines the implementation strategy for adding a product inquiry modal to the Audiofast website. Instead of redirecting users to the `/kontakt/` page when they click "Zapytaj o produkt" (Ask about product), a modal dialog will open directly on the product page, preserving the full product context (name, selected options, calculated price).

---

## Problem Statement

**Current behavior:**
1. User visits a product page (e.g., `/produkty/some-product/`)
2. User configures product options (selects variants, adjusts quantities)
3. User clicks "Zapytaj o produkt" button
4. User is **redirected** to `/kontakt/` page
5. User loses all context: product name, selected options, calculated price
6. User must manually type product information in the message

**Proposed behavior:**
1. User visits a product page
2. User configures product options
3. User clicks "Zapytaj o produkt" button
4. **Modal opens** with pre-filled product context
5. User enters contact details and message
6. Email is sent with full product context (name, options, price)
7. User **never leaves** the product page

---

## Implementation Strategy

### Phase 1: Create ProductInquiryModal Component

**Location:** `apps/web/src/components/products/ProductInquiryModal/`

**Files to create:**
- `index.tsx` - Main modal component
- `styles.module.scss` - Modal styles
- `ProductInquiryForm.tsx` - Form component (client-side)

**Modal Features:**
- Overlay with backdrop blur (matching existing modal patterns)
- Escape key to close (with unsaved changes check)
- Click outside to close (with unsaved changes check)
- Responsive design (full-screen on mobile)
- Z-index: 2000 (consistent with other modals)
- Smooth open/close animations
- **Unsaved changes warning:** If form has content, show confirmation before closing
- **Stays open after success:** User manually closes modal after seeing success state

**Form Fields (identical to ContactForm):**
- `name` - "Imię i nazwisko" (required, min 2 chars)
- `email` - "Adres e-mail" (required, email regex validation)
- `message` - "Twoja wiadomość" (required, min 10 chars, textarea)
- `consent` - Privacy policy checkbox (required)

**Form States (using existing FormStates component):**
- `idle` - Default form state
- `loading` - During submission (all fields disabled)
- `success` - After successful submission (show success message, allow user to close)
- `error` - After failed submission (show error message with retry option)

**Product Context Display (above the form):**
- Product name and brand
- Selected configuration summary
- Calculated price
- Product image thumbnail

**Modal Close Behavior:**
- Modal stays open after successful submission - user closes manually
- Unsaved changes warning: If any form field has content and user tries to close, show confirmation dialog
- Use existing `ConfirmationModal` pattern for the unsaved changes warning

---

### Phase 2: Update ProductHero Component

**File:** `apps/web/src/components/products/ProductHero/index.tsx`

**Changes:**
1. Convert to client component OR lift modal state to a client wrapper
2. Add modal state: `const [isModalOpen, setIsModalOpen] = useState(false)`
3. Replace `href="/kontakt/"` with `onClick={() => setIsModalOpen(true)}`
4. Pass product context to modal:
   - Product name
   - Product brand
   - Selected options (from PricingConfigurator state)
   - Calculated price
   - Product image

**State Lifting Strategy:**

Option A: **Client wrapper approach** (recommended)
- Keep `ProductHero` as server component for SEO
- Create `ProductHeroClient` wrapper that handles modal state
- PricingConfigurator already client-side, share state via context or props

Option B: **Convert ProductHero to client**
- Simpler but loses server component benefits
- Not recommended

---

### Phase 3: Create Product Context Provider (Optional)

**Location:** `apps/web/src/components/products/ProductContext/`

If we need to share product configuration state between components:

```tsx
interface ProductContextValue {
  product: {
    name: string;
    brand: string;
    image: SanityImageObject;
    id: string;
  };
  configuration: {
    variantId: string | null;
    selectedOptions: Map<string, string | number>;
    calculatedPrice: number;
  };
  setConfiguration: (config: Partial<Configuration>) => void;
}
```

This allows the modal to access the exact configuration the user selected.

---

### Phase 4: Update API Endpoint

**File:** `apps/web/src/app/api/contact/route.ts`

**Changes:**
1. Add new endpoint or extend existing: `/api/contact/product-inquiry`
2. Accept additional fields:
   - `productId` - Sanity product ID
   - `productName` - Product name
   - `productBrand` - Brand name
   - `selectedOptions` - Array of selected option labels
   - `calculatedPrice` - Final price in cents
   - `productUrl` - URL of the product page

**Request body schema:**
```typescript
interface ProductInquiryRequest {
  // Standard contact fields
  name: string;
  email: string;
  phone?: string;
  message: string;
  consent: boolean;
  
  // Product context
  product: {
    id: string;
    name: string;
    brand: string;
    url: string;
    price: number; // in cents
    configuration: string; // formatted summary
  };
}
```

---

### Phase 5: Update Email Templates

**File:** `apps/web/src/emails/`

**New email template:** `ProductInquiryEmail.tsx`

The email should include:
- Clear "Zapytanie o produkt" subject line
- Product name and brand (prominent)
- Selected configuration table
- Price (formatted in PLN)
- Direct link to product page
- Customer contact information
- Customer message

**Example email structure:**
```
Subject: Zapytanie o produkt: [Product Name]

Nowe zapytanie o produkt

PRODUKT:
- Nazwa: [Product Name]
- Marka: [Brand]
- Link: [Product URL]

KONFIGURACJA:
- [Option Group 1]: [Selected Value]
- [Option Group 2]: [Selected Value]
- Cena: [Calculated Price] PLN

DANE KONTAKTOWE:
- Imię i nazwisko: [Name]
- Email: [Email]
- Telefon: [Phone]

WIADOMOŚĆ:
[Customer message]
```

---

### Phase 6: Analytics Integration

**File:** `apps/web/src/global/analytics/track-event.ts`

Add new event types:
- `product_inquiry_modal_opened` - When modal opens
- `product_inquiry_submitted` - When form is submitted successfully
- `product_inquiry_error` - When submission fails

Include product context in analytics:
- Product ID
- Product name
- Brand
- Category
- Selected price

---

## File Structure

```
apps/web/src/components/products/
├── ProductHero/
│   ├── index.tsx                    # [MODIFY] Add modal trigger
│   ├── PricingConfigurator.tsx      # [MODIFY] Export configuration state
│   └── styles.module.scss
├── ProductInquiryModal/             # [NEW]
│   ├── index.tsx                    # Modal wrapper with overlay + unsaved warning
│   ├── ProductInquiryForm.tsx       # Form (copied from ContactForm, adapted)
│   ├── ProductSummary.tsx           # Product context display
│   └── styles.module.scss
└── ProductContext/                  # [NEW - Optional]
    └── index.tsx                    # Context provider for config state

apps/web/src/app/api/contact/
└── route.ts                         # [MODIFY] Accept product context in request

apps/web/src/global/email/
└── send-contact.ts                  # [MODIFY] Add product inquiry variant

apps/web/src/emails/
└── ProductInquiryEmail.tsx          # [NEW] Email template with product details
```

---

## Detailed Component Specifications

### ProductInquiryModal/index.tsx

```tsx
interface ProductInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    brand: string;
    image: SanityImageObject;
    url: string;
  };
  configuration: {
    summary: string; // Formatted configuration summary
    price: number;   // Price in cents
  };
}
```

**Key behaviors:**
- Portal rendering to document.body
- Focus trap for accessibility
- Prevent body scroll when open
- Animate in/out with CSS transitions
- **Unsaved changes warning:** Track form dirty state, show ConfirmationModal before closing if fields have content
- **Stay open after success:** Modal remains open after form submission success

### ProductInquiryForm.tsx

```tsx
interface ProductInquiryFormProps {
  product: ProductInfo;
  configuration: ConfigurationInfo;
  onFormDirtyChange: (isDirty: boolean) => void; // Notify parent of dirty state
  formStateData: FormStateData; // Success/error messages from Sanity
}
```

**Key behaviors:**
- Reuse logic from `ContactForm.tsx` (copy and adapt)
- react-hook-form with identical validation rules
- Use existing `FormStates` component for success/error states
- Loading state during submission (all fields disabled)
- Track dirty state via `formState.isDirty` from react-hook-form
- Notify parent modal when form becomes dirty/clean
- Reset form after success but keep modal open

### Unsaved Changes Warning Flow

```tsx
// In ProductInquiryModal
const [isFormDirty, setIsFormDirty] = useState(false);
const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

const handleCloseAttempt = () => {
  if (isFormDirty) {
    setShowUnsavedWarning(true); // Show ConfirmationModal
  } else {
    onClose(); // Close immediately
  }
};

const handleConfirmClose = () => {
  setShowUnsavedWarning(false);
  onClose();
};

const handleCancelClose = () => {
  setShowUnsavedWarning(false);
};
```

**Warning modal text:**
- Title: "Niezapisane zmiany"
- Message: "Masz niewysłaną wiadomość. Czy na pewno chcesz zamknąć formularz? Wprowadzone dane zostaną utracone."
- Confirm button: "Zamknij formularz"
- Cancel button: "Wróć do formularza"

---

## Implementation Order

### Step 1: Create Modal Component Structure
1. Create `ProductInquiryModal/` folder
2. Create base modal with overlay (no form yet)
3. Add styles matching existing modal patterns
4. Test open/close functionality

### Step 2: Build the Form (Copy from ContactForm)
1. Create `ProductInquiryForm.tsx`
2. Copy logic from `ContactForm.tsx`
3. Same fields: name, email, message (textarea), consent (checkbox)
4. Same validation rules (minLength, required, email regex)
5. Use existing `FormStates` component for success/error states
6. Add `onFormDirtyChange` callback to notify parent of dirty state

### Step 3: Add Product Summary Component
1. Create `ProductSummary.tsx`
2. Display product image, name, brand
3. Display configuration summary
4. Display calculated price

### Step 4: Implement Unsaved Changes Warning
1. Track form dirty state in modal via callback from form
2. On close attempt (X button, click outside, Escape key), check if dirty
3. If dirty, show `ConfirmationModal` with warning
4. "Zamknij formularz" confirms close, "Wróć do formularza" cancels

### Step 5: Integrate with ProductHero
1. Create client wrapper for ProductHero (if needed)
2. Add modal state management
3. Connect PricingConfigurator state to modal
4. Replace button href with onClick handler

### Step 6: Update Backend
1. Create/update API endpoint to accept product context
2. Add product context handling
3. Create email template with product details
4. Test email sending

### Step 7: Polish & Testing
1. Add analytics events
2. Responsive design testing
3. Accessibility testing (keyboard nav, screen readers)
4. Cross-browser testing
5. Test unsaved changes warning in all close scenarios

---

## Technical Considerations

### State Management
The PricingConfigurator component already manages configuration state. We need to:
1. Lift this state up to a shared parent, OR
2. Use a ref/callback to access current configuration when modal opens

**Recommended approach:** Use a ref in PricingConfigurator that holds current configuration, accessible by parent.

### Server/Client Component Split
ProductHero is currently a server component. Options:
1. Keep it server-side, add a small client wrapper just for the modal
2. Use a "use client" boundary at the minimum required level

**Recommended:** Create `ProductHeroClient.tsx` that wraps the modal logic.

### Form Reusability
Consider extracting common form components (inputs, validation) from existing ContactForm for reuse.

### Mobile Experience
Modal should be:
- Full-screen on mobile (< 768px)
- Scrollable if content exceeds viewport
- Touch-friendly close button
- Proper keyboard on mobile for inputs

---

## Success Metrics

1. **Reduced friction:** Users no longer leave product page to inquire
2. **Complete context:** Every inquiry includes full product configuration
3. **Better conversion:** Track modal open → submission conversion rate
4. **User satisfaction:** No more manual typing of product information

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Modal blocks content | Proper z-index, click-outside close |
| Form submission fails | Clear error messages, retry option |
| Mobile usability | Full-screen modal, large touch targets |
| SEO impact | Keep ProductHero SSR, only modal is client |
| Email deliverability | Use existing MS Graph infrastructure |

---

## Estimated Effort

| Phase | Complexity | Notes |
|-------|------------|-------|
| Phase 1: Modal Component | Medium | Reuse existing modal patterns |
| Phase 2: Form (from ContactForm) | Low | Copy and adapt existing form |
| Phase 3: Product Summary | Low | Simple display component |
| Phase 4: Unsaved Changes Warning | Low | Use existing ConfirmationModal |
| Phase 5: ProductHero Update | Medium | State management consideration |
| Phase 6: API Update | Low | Extend existing endpoint |
| Phase 7: Email Templates | Low | Similar to existing templates |
| Phase 8: Analytics | Low | Add event tracking |

---

## Dependencies & Reuse Strategy

### Components to Reuse Directly
| Component | Location | Usage |
|-----------|----------|-------|
| `FormStates` | `ui/FormStates` | Success/error state display |
| `Input` | `ui/Input` | Form input fields |
| `Checkbox` | `ui/Checkbox` | Consent checkbox |
| `Button` | `ui/Button` | Submit button |
| `ConfirmationModal` | `ui/ConfirmationModal` | Unsaved changes warning |

### Code to Copy & Adapt
| Source | Target | What to Copy |
|--------|--------|--------------|
| `ContactForm.tsx` | `ProductInquiryForm.tsx` | Form logic, validation rules, react-hook-form setup |
| `ConfirmationModal` | `ProductInquiryModal` | Modal structure, overlay, close handlers |
| `ProductSelector` | `ProductInquiryModal` | Escape key handling, click-outside logic |

### Infrastructure to Use
- Existing email infrastructure (Microsoft Graph API)
- Existing analytics setup (`track-event.ts`)
- Existing `REGEX.email` constant for validation
- Existing `sendContactForm` function (extend or create similar)

---

## Decisions (Confirmed)

| Question | Decision |
|----------|----------|
| Form fields | Identical to ContactForm: name, email, message, consent |
| Success behavior | Show success state in modal, user closes manually |
| Product info display | Show separately above the form (not pre-filled in message) |
| Unsaved changes | Show warning if any field has content when user tries to close |
| Post-success | Keep modal open with success state, user closes when ready |

---

## Next Steps

After approval of this plan:
1. Create the ProductInquiryModal component
2. Integrate with ProductHero
3. Update API and email templates
4. Test end-to-end flow
5. Deploy and monitor analytics
