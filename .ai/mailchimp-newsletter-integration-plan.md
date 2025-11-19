# Mailchimp Newsletter Integration Plan

**Goal**: Implement a minimal, production-ready newsletter signup flow using Mailchimp Marketing API for the Footer `NewsletterForm` component, with proper error handling, analytics tracking, and GDPR compliance.

---

## Phase 0 – Prerequisites & Setup

### 1. Mailchimp Account Configuration

**Before any coding:**
- Create or access Mailchimp account at https://mailchimp.com
- Create an **Audience** (List) for newsletter subscribers
  - Navigate to: Audience → All contacts → Settings
  - Note the **List ID** (format: `abc123def4`)
- Generate an **API Key**
  - Navigate to: Account → Extras → API keys → Create A Key
  - Note the API key (format: `abc123...xyz-us6`) and **server prefix** (e.g., `us6`, `us19`)
- Configure **Double Opt-In** settings (recommended for GDPR compliance)
  - Audience → Settings → Audience name and defaults → Enable double opt-in

### 2. Environment Variables

Add to `apps/web/.env.local` and documentation:

```bash
# Mailchimp Configuration
# Get API key from https://mailchimp.com/account/api/
MAILCHIMP_API_KEY=abc123...xyz-us6
MAILCHIMP_SERVER_PREFIX=us6
MAILCHIMP_AUDIENCE_ID=abc123def4
```

### 3. Package Installation

```bash
cd apps/web
npm install @mailchimp/mailchimp_marketing
```

---

## Phase 1 – Mailchimp Client Setup

### 1. Create Mailchimp Client Module

**File**: `apps/web/src/global/mailchimp/client.ts`

```typescript
import mailchimp from '@mailchimp/mailchimp_marketing';

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX;

if (!MAILCHIMP_API_KEY || !MAILCHIMP_SERVER_PREFIX) {
  console.warn('[Mailchimp] Missing API credentials. Newsletter signup will be disabled.');
}

// Configure client once
mailchimp.setConfig({
  apiKey: MAILCHIMP_API_KEY,
  server: MAILCHIMP_SERVER_PREFIX,
});

export const mailchimpClient = mailchimp;

export const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID || '';
```

### 2. Create Helper Functions

**File**: `apps/web/src/global/mailchimp/subscribe.ts`

```typescript
import crypto from 'crypto';
import { mailchimpClient, MAILCHIMP_AUDIENCE_ID } from './client';

export type SubscribeResult = {
  success: boolean;
  message?: string;
  needsConfirmation?: boolean; // True if double opt-in is enabled
};

/**
 * Subscribe an email to the newsletter list
 * Uses setListMember (PUT) for idempotency - safe to call multiple times
 */
export async function subscribeToNewsletter(
  email: string,
  metadata?: {
    source?: string; // e.g., 'footer', 'popup', 'blog'
    tags?: string[]; // e.g., ['website', 'footer-signup']
  }
): Promise<SubscribeResult> {
  if (!mailchimpClient || !MAILCHIMP_AUDIENCE_ID) {
    console.error('[Mailchimp] Client not configured');
    return {
      success: false,
      message: 'Newsletter service not available',
    };
  }

  try {
    // Generate subscriber hash for idempotent operations
    const subscriberHash = crypto
      .createHash('md5')
      .update(email.toLowerCase())
      .digest('hex');

    // Use setListMember (PUT) instead of addListMember (POST)
    // This is idempotent and won't fail if email already exists
    const response = await mailchimpClient.lists.setListMember(
      MAILCHIMP_AUDIENCE_ID,
      subscriberHash,
      {
        email_address: email,
        status_if_new: 'pending', // 'pending' for double opt-in, 'subscribed' for single opt-in
        merge_fields: {
          SOURCE: metadata?.source || 'website',
        },
        tags: metadata?.tags || ['website'],
      }
    );

    // Check if user needs to confirm (double opt-in)
    const needsConfirmation = response.status === 'pending';

    return {
      success: true,
      needsConfirmation,
      message: needsConfirmation
        ? 'Please check your email to confirm subscription'
        : 'Successfully subscribed to newsletter',
    };
  } catch (error: any) {
    console.error('[Mailchimp] Subscribe error:', error);

    // Handle specific Mailchimp errors
    if (error.status === 400) {
      const errorDetail = error.response?.body?.title || '';
      
      if (errorDetail.includes('already a list member')) {
        return {
          success: true,
          message: 'You are already subscribed',
        };
      }
      
      if (errorDetail.includes('Invalid Resource')) {
        return {
          success: false,
          message: 'Invalid email address',
        };
      }
    }

    if (error.status === 403) {
      return {
        success: false,
        message: 'Newsletter signup is temporarily unavailable',
      };
    }

    return {
      success: false,
      message: 'Failed to subscribe. Please try again later.',
    };
  }
}
```

---

## Phase 2 – API Route Handler

### Create Newsletter API Endpoint

**File**: `apps/web/src/app/api/newsletter/route.ts`

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { subscribeToNewsletter } from '@/global/mailchimp/subscribe';
import { REGEX } from '@/global/constants';

type NewsletterSubmission = {
  email: string;
  consent: boolean;
  source?: string; // Optional: track where signup came from
};

export async function POST(request: NextRequest) {
  // Parse request body
  let body: NewsletterSubmission;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request' },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.email || !body.consent) {
    return NextResponse.json(
      { success: false, message: 'Email and consent are required' },
      { status: 400 }
    );
  }

  // Validate email format
  if (!REGEX.email.test(body.email)) {
    return NextResponse.json(
      { success: false, message: 'Invalid email address' },
      { status: 400 }
    );
  }

  // Subscribe to Mailchimp
  try {
    const result = await subscribeToNewsletter(body.email, {
      source: body.source || 'footer',
      tags: ['website', body.source || 'footer'],
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        needsConfirmation: result.needsConfirmation,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Newsletter API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process subscription' },
      { status: 500 }
    );
  }
}
```

---

## Phase 3 – Frontend Integration

### 1. Update NewsletterForm Component

**File**: `apps/web/src/components/ui/Footer/NewsletterForm.tsx`

**Changes:**
- Replace mock `setTimeout` with actual API call to `/api/newsletter`
- Add analytics tracking (similar to contact forms)
- Handle double opt-in messaging
- Improve error messaging

```typescript
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import Button from '@/src/components/ui/Button';
import Checkbox from '@/src/components/ui/Checkbox';
import FormStates, { type FormState } from '@/src/components/ui/FormStates';
import Input from '@/src/components/ui/Input';
import { saveAnalyticsUser } from '@/src/global/analytics/analytics-user-storage';
import { trackEvent } from '@/src/global/analytics/track-event';
import { REGEX } from '@/src/global/constants';
import type { QueryFooterResult } from '@/src/global/sanity/sanity.types';

import styles from './styles.module.scss';

type FormStateData = NonNullable<
  NonNullable<QueryFooterResult>['newsletter']
>['formState'];

type NewsletterFormData = {
  email: string;
  consent: boolean;
};

export default function NewsletterForm({
  buttonLabel = 'Zapisz się',
  formStateResult,
}: {
  buttonLabel?: string;
  formStateResult?: FormStateData;
}) {
  const [formState, setFormState] = useState<FormState>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterFormData>({ mode: 'onTouched' });

  const onSubmit = async (data: NewsletterFormData) => {
    setFormState('loading');

    try {
      // Track analytics before API call
      saveAnalyticsUser({
        email: data.email,
      });

      trackEvent({
        user: {
          email: data.email,
        },
        meta: {
          eventName: 'Lead',
          params: {
            content_name: 'newsletter_signup',
            form_location: 'footer',
          },
        },
        ga4: {
          eventName: 'generate_lead',
          params: {
            form_name: 'newsletter_signup',
            form_location: 'footer',
          },
        },
      });

      // Call newsletter API
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          consent: data.consent,
          source: 'footer',
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setFormState('success');
        reset();
      } else {
        setFormState('error');
      }
    } catch (error) {
      console.error('[Newsletter Form] Submission error:', error);
      setFormState('error');
    }
  };

  const handleRefresh = () => {
    setFormState('idle');
    reset();
  };

  const isDisabled = formState !== 'idle';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.newsletterForm}>
      <Input
        label="Adres e-mail"
        mode="dark"
        name="email"
        disabled={isDisabled}
        register={register('email', {
          required: { value: true, message: 'E-mail jest wymagany' },
          pattern: {
            value: REGEX.email,
            message: 'Niepoprawny adres e-mail',
          },
        })}
        errors={errors}
      />

      <Checkbox
        mode="dark"
        disabled={isDisabled}
        label={
          <>
            Akceptuję{' '}
            <Link
              data-dark
              href="/polityka-prywatnosci"
              target="_blank"
              className="link"
              tabIndex={isDisabled ? -1 : 0}
            >
              politykę prywatności
            </Link>
          </>
        }
        register={register('consent', {
          required: {
            value: true,
            message: 'Zgoda jest wymagana',
          },
        })}
        errors={errors}
      />

      <Button
        type="submit"
        variant="secondary"
        className={styles.submitButton}
        disabled={isDisabled}
      >
        {buttonLabel}
      </Button>

      <FormStates
        formState={formState}
        formStateData={formStateResult}
        onRefresh={handleRefresh}
        mode="dark"
        className={styles.formStates}
      />
    </form>
  );
}
```

---

## Phase 4 – Sanity CMS Configuration (Optional but Recommended)

### Option A: Add to existing Settings singleton

**File**: `apps/studio/schemaTypes/documents/singletons/settings.ts`

Add newsletter configuration fields:

```typescript
defineField({
  name: 'mailchimp',
  title: 'Mailchimp Newsletter',
  type: 'object',
  fields: [
    {
      name: 'listId',
      title: 'List/Audience ID',
      type: 'string',
      description: 'Find this in Mailchimp: Audience → Settings',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'tags',
      title: 'Default Tags',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Tags to apply to new subscribers',
    },
    {
      name: 'doubleOptIn',
      title: 'Double Opt-In Enabled',
      type: 'boolean',
      description: 'If enabled, users must confirm email before subscribing',
      initialValue: true,
    },
  ],
}),
```

### Option B: Keep configuration in environment variables only

**Simpler approach** - No CMS needed. Use only environment variables.

**Recommended for minimal setup**: Use Option B.

---

## Phase 5 – Testing & QA

### 1. Local Testing Checklist

- [ ] API route responds correctly to valid submissions
- [ ] Email validation works (reject invalid formats)
- [ ] Consent validation works (reject if not checked)
- [ ] Duplicate email handling (should not error)
- [ ] Loading state displays during submission
- [ ] Success state displays after successful signup
- [ ] Error state displays on failure
- [ ] Form resets after success
- [ ] Analytics events fire correctly

### 2. Mailchimp Dashboard Verification

- [ ] New subscribers appear in audience
- [ ] Tags are applied correctly
- [ ] Source merge field is populated
- [ ] Double opt-in emails are sent (if enabled)
- [ ] Confirmed subscriptions show as "subscribed" status

### 3. Error Scenarios to Test

- [ ] Invalid email format
- [ ] Missing consent checkbox
- [ ] Already subscribed email
- [ ] Invalid API credentials (should fail gracefully)
- [ ] Network timeout (should show error)

---

## Phase 6 – Documentation & Deployment

### 1. Update Environment Documentation

**File**: `apps/web/.env.example`

```bash
# Mailchimp Newsletter Configuration
# Get your API key from https://mailchimp.com/account/api/
# The server prefix is the last part of your API key (e.g., us6)
# The audience ID is found in Audience → Settings
MAILCHIMP_API_KEY=your_api_key_here
MAILCHIMP_SERVER_PREFIX=us6
MAILCHIMP_AUDIENCE_ID=your_audience_id_here
```

### 2. Create Setup Guide

**File**: `apps/web/MAILCHIMP_SETUP.md`

```markdown
# Mailchimp Newsletter Setup

## Prerequisites

1. Mailchimp account (free tier works)
2. Created Audience (List)
3. API key generated

## Configuration Steps

### 1. Create Mailchimp Audience

1. Log in to Mailchimp
2. Navigate to: Audience → All contacts
3. Create new audience or use existing
4. Note the Audience ID:
   - Settings → Audience name and defaults
   - Copy the "Audience ID" (e.g., `abc123def4`)

### 2. Generate API Key

1. Navigate to: Account → Extras → API keys
2. Click "Create A Key"
3. Copy the full API key (e.g., `abc123...xyz-us6`)
4. Note the server prefix (last part after dash, e.g., `us6`)

### 3. Configure Double Opt-In (Recommended)

1. Navigate to: Audience → Settings → Audience name and defaults
2. Enable "Enable double opt-in"
3. Customize confirmation email if needed

### 4. Add Environment Variables

Add to `.env.local`:

```bash
MAILCHIMP_API_KEY=your_full_api_key
MAILCHIMP_SERVER_PREFIX=us6
MAILCHIMP_AUDIENCE_ID=your_audience_id
```

### 5. Deploy to Production

- Add environment variables to Vercel/hosting platform
- Test with a real email address
- Verify subscriber appears in Mailchimp dashboard

## Troubleshooting

### "Newsletter service not available"
- Check that all environment variables are set
- Verify API key is correct and not expired

### "Invalid email address"
- Check Mailchimp API response in server logs
- Verify email format passes REGEX validation

### Subscribers not appearing in Mailchimp
- Check spam folder for confirmation email (double opt-in)
- Verify MAILCHIMP_AUDIENCE_ID is correct
- Check Mailchimp dashboard for archived/unsubscribed contacts
```

### 3. Production Deployment

1. **Add environment variables** to Vercel/hosting dashboard:
   - `MAILCHIMP_API_KEY`
   - `MAILCHIMP_SERVER_PREFIX`
   - `MAILCHIMP_AUDIENCE_ID`

2. **Deploy** and test with real email address

3. **Monitor** first few signups in Mailchimp dashboard

---

## Phase 7 – Future Enhancements (Optional)

### Potential Additions

1. **Welcome Email Automation**
   - Set up Mailchimp automation for welcome series
   - No code changes needed - configure in Mailchimp dashboard

2. **Signup Source Tracking**
   - Add different sources: `footer`, `popup`, `blog_sidebar`
   - Useful for tracking which signup forms perform best

3. **Tag-based Segmentation**
   - Add tags based on where user signed up
   - Enable targeted campaigns in Mailchimp

4. **Rate Limiting**
   - Add rate limiting to prevent abuse
   - Use `@upstash/ratelimit` or similar

5. **Unsubscribe Handler**
   - Create API route for unsubscribe
   - Use `mailchimpClient.lists.updateListMember()` with `status: 'unsubscribed'`

6. **Admin Dashboard**
   - View recent signups
   - Export subscriber lists
   - Monitor signup trends

---

## Minimal Implementation Summary

### What to Build (Core - Phase 1-3)

1. ✅ Mailchimp client configuration (`global/mailchimp/client.ts`)
2. ✅ Subscribe helper function (`global/mailchimp/subscribe.ts`)
3. ✅ Newsletter API route (`app/api/newsletter/route.ts`)
4. ✅ Updated NewsletterForm with real API call

### What to Skip (Optional - Phase 4, 7)

1. ❌ Sanity CMS configuration (use env vars only)
2. ❌ Advanced features (welcome emails, segmentation, etc.)
3. ❌ Rate limiting (add later if needed)

### Files to Create/Modify

**New files:**
- `apps/web/src/global/mailchimp/client.ts`
- `apps/web/src/global/mailchimp/subscribe.ts`
- `apps/web/src/app/api/newsletter/route.ts`
- `apps/web/MAILCHIMP_SETUP.md`

**Modified files:**
- `apps/web/src/components/ui/Footer/NewsletterForm.tsx`
- `apps/web/.env.example`
- `apps/web/package.json` (add `@mailchimp/mailchimp_marketing`)

**Total Implementation Time**: ~2-3 hours including testing

---

## API Reference

### Mailchimp Documentation Links

- **Marketing API**: https://mailchimp.com/developer/marketing/docs/fundamentals/
- **Lists API**: https://mailchimp.com/developer/marketing/api/lists/
- **Add/Update Member**: https://mailchimp.com/developer/marketing/api/list-members/add-or-update-list-member/
- **Node.js Client**: https://github.com/mailchimp/mailchimp-marketing-node

### Key API Methods Used

```typescript
// Add or update list member (idempotent)
mailchimpClient.lists.setListMember(
  listId,        // Audience ID
  subscriberHash, // MD5 hash of lowercase email
  {
    email_address: 'user@example.com',
    status_if_new: 'pending', // or 'subscribed'
    merge_fields: { SOURCE: 'footer' },
    tags: ['website'],
  }
);

// Alternative: Add member (not idempotent, errors if exists)
mailchimpClient.lists.addListMember(listId, {
  email_address: 'user@example.com',
  status: 'pending',
});
```

---

This plan provides a **minimal, production-ready** implementation that can be extended later with additional features as needed.

