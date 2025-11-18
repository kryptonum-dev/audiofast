# Phase 0 - Prerequisites & Audit Summary

## ✅ Completed Tasks

### 1. Form Inventory Audit

**Confirmed 3 forms with simulated API calls:**

1. **`apps/web/src/components/pageBuilder/ContactForm/ContactForm.tsx`**
   - Uses `setTimeout` to simulate 2s API call (line 81)
   - Currently hardcoded to `success = false` (line 84)
   - Form fields: `name`, `email`, `message`, `consent`
   - Includes analytics tracking via `trackLead()`

2. **`apps/web/src/components/pageBuilder/FaqSection/ContactForm.tsx`**
   - Uses `setTimeout` to simulate 2s API call (line 112)
   - Currently hardcoded to `success = false` (line 115)
   - Multi-step form (step 1: message, step 2: contact details)
   - Form fields: `message`, `email`, `name`, `consent`
   - Includes analytics tracking via `trackLead()`

3. **`apps/web/src/components/ui/Footer/NewsletterForm.tsx`**
   - Uses `setTimeout` to simulate 2s API call (line 42)
   - Currently hardcoded to `success = true` (line 45)
   - Form fields: `email`, `consent`
   - No analytics tracking currently

**No other forms found** - These are the only three forms requiring integration.

### 2. Environment Contract

**Created:** `apps/web/RESEND_SETUP.md` with complete environment variable documentation.

**Required Variables:**
- `RESEND_API_KEY` - Resend API key (starts with `re_`)
- `RESEND_FROM_EMAIL` - Verified sender email address
- `RESEND_REPLY_TO` - (Optional) Reply-to address

**Action Required:** 
- Create `.env.local` file in `apps/web/` with these variables
- Add to Vercel environment variables for production deployments
- Verify sending domain in Resend dashboard before production use

### 3. Package Installation

**Installed packages:**
- ✅ `resend@6.4.2` - Resend API client
- ✅ `@portabletext/to-html@4.0.1` - Portable Text to HTML converter

**Package.json updated** - Dependencies are now available for use.

### 4. Error Logging Strategy

**Existing logger:** `apps/web/src/global/logger.ts`

**Available functions:**
- `logInfo(message, context?)` - Info logs (suppressed in production)
- `logWarn(message, context?)` - Warning logs
- `logError(message, error?, context?)` - Error logs with structured context
- `withErrorLogging(label, operation, context?)` - Async operation wrapper

**Implementation plan:**
- Use `logError()` in route handler when Resend API calls fail
- Include `formKey` and Resend request ID in context for debugging
- Use structured context objects for better log parsing
- Example: `logError('Resend email failed', error, { formKey, resendId, recipient })`

## 📋 Next Steps

Phase 0 is complete. Ready to proceed with:
- **Phase 1**: Sanity CMS Configuration (newsletter settings singleton)
- **Phase 2**: Query & Types Layer (GROQ queries and TypeScript types)
- **Phase 3**: Server Email Service (route handler and email rendering)
- **Phase 4**: Client Integration (update all three forms)

## 🔍 Notes

- All forms use `react-hook-form` with consistent patterns
- Form state management is already implemented (`idle`, `loading`, `success`, `error`)
- Analytics tracking is in place for ContactForm and FaqSection forms
- NewsletterForm does not currently track analytics (may want to add in Phase 4)

