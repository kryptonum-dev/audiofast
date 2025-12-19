# Microsoft Graph API Email Migration Plan

**Goal:** Replace Resend with Microsoft Graph API for sending contact form emails, leveraging Audiofast's existing Microsoft 365/Outlook infrastructure.

**Current State:** Contact forms use Resend SDK to send transactional emails (internal notifications + user confirmations).

**Target State:** Contact forms use Microsoft Graph API to send emails from an Outlook shared mailbox.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites & Microsoft Entra Setup](#prerequisites--microsoft-entra-setup)
3. [Phase 1: Microsoft Entra ID App Registration](#phase-1-microsoft-entra-id-app-registration)
4. [Phase 2: Shared Mailbox Setup](#phase-2-shared-mailbox-setup)
5. [Phase 3: Application Access Control (RBAC)](#phase-3-application-access-control-rbac)
6. [Phase 4: Code Implementation](#phase-4-code-implementation)
7. [Phase 5: Environment & Deployment](#phase-5-environment--deployment)
8. [Phase 6: Testing & Rollout](#phase-6-testing--rollout)
9. [Troubleshooting](#troubleshooting)
10. [Security Considerations](#security-considerations)

---

## Architecture Overview

### Current Flow (Resend)

```
User submits form
       ↓
/api/contact (Next.js Route Handler)
       ↓
Resend SDK → Resend API
       ↓
┌─────────────────────────────────┐
│ Email 1: Internal notification  │ → supportEmails (team)
│ Email 2: Confirmation email     │ → user's email
└─────────────────────────────────┘
```

### Target Flow (Microsoft Graph)

```
User submits form
       ↓
/api/contact (Next.js Route Handler)
       ↓
@azure/identity (ClientSecretCredential)
       ↓
Microsoft Graph API (/users/{mailbox}/sendMail)
       ↓
┌─────────────────────────────────┐
│ Email 1: Internal notification  │ → supportEmails (team)
│ Email 2: Confirmation email     │ → user's email
└─────────────────────────────────┘
       ↓
Emails appear in shared mailbox "Sent Items"
```

### Key Benefits

- ✅ Emails sent from actual `@audiofast.pl` Outlook mailbox
- ✅ Full audit trail in "Sent Items" folder
- ✅ No third-party service costs
- ✅ Native Microsoft authentication (better deliverability)
- ✅ Works with existing Microsoft 365 infrastructure

---

## Prerequisites & Microsoft Entra Setup

> **Note:** Microsoft renamed Azure Active Directory (Azure AD) to **Microsoft Entra ID** in July 2023. The functionality remains the same, but the admin portal and terminology have changed. [Learn more](https://www.microsoft.com/en-us/security/business/identity-access/microsoft-entra-id)

### Requirements Checklist

Before starting, ensure the following:

| Requirement                         | Description                                  | Who       |
| ----------------------------------- | -------------------------------------------- | --------- |
| Microsoft 365 Business subscription | Any plan with Exchange Online                | IT Admin  |
| Microsoft Entra admin center access | Global Admin or Cloud Application Admin role | IT Admin  |
| Exchange Admin Center access        | To create shared mailbox and configure RBAC  | IT Admin  |
| Exchange Online PowerShell          | For RBAC application access setup            | IT Admin  |
| Developer environment               | Node.js, access to codebase                  | Developer |

### Information to Gather

Before starting, collect:

1. **Tenant ID** - Found in [Microsoft Entra admin center](https://entra.microsoft.com) → Identity → Overview
2. **Shared mailbox email** - e.g., `www@audiofast.pl` or `kontakt@audiofast.pl` (create if doesn't exist)
3. **Support team emails** - Already configured in Sanity CMS

---

## Phase 1: Microsoft Entra ID App Registration

**Who:** IT Admin with Microsoft Entra admin center access (Cloud Application Admin or Global Admin role)  
**Time:** ~15 minutes

### Step 1.1: Register New Application

1. Go to [Microsoft Entra admin center](https://entra.microsoft.com)
2. Sign in with an admin account
3. Navigate to **Identity** → **Applications** → **App registrations**
4. Click **+ New registration**
5. Configure:
   - **Name:** `Audiofast Contact Form Email Service`
   - **Supported account types:** `Accounts in this organizational directory only (Single tenant)`
   - **Redirect URI:** Leave blank (not needed for client credentials flow)
6. Click **Register**

### Step 1.2: Note Application Details

After registration, copy these values (needed for `.env`):

| Field                   | Where to find | Env Variable      |
| ----------------------- | ------------- | ----------------- |
| Application (client) ID | Overview page | `AZURE_CLIENT_ID` |
| Directory (tenant) ID   | Overview page | `AZURE_TENANT_ID` |

### Step 1.3: Create Client Secret

1. In the app registration, go to **Certificates & secrets**
2. Click **+ New client secret**
3. Configure:
   - **Description:** `Contact Form API Key`
   - **Expires:** `24 months` (recommended) or `Custom` for longer
4. Click **Add**
5. **⚠️ IMPORTANT:** Copy the **Value** immediately (shown only once)
   - This becomes `AZURE_CLIENT_SECRET`

### Step 1.4: Configure API Permissions

1. Go to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Application permissions** (NOT Delegated)
5. Search and select:
   - `Mail.Send` - Send mail as any user
6. Click **Add permissions**
7. Click **Grant admin consent for [Organization]**
8. Verify status shows ✅ "Granted for [Organization]"

### Expected Result

```
Application registered with:
- Client ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
- Tenant ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
- Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
- Permission: Mail.Send (Application) - Admin consented ✅
```

---

## Phase 2: Shared Mailbox Setup

**Who:** IT Admin with Exchange Admin permissions  
**Time:** ~10 minutes

### Why Shared Mailbox?

- ✅ No license cost (under 50GB)
- ✅ Purpose-built for automated/transactional email
- ✅ Multiple team members can access if needed
- ✅ Separates automated emails from personal mailboxes

### Step 2.1: Create Shared Mailbox (or use existing)

1. Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
2. Navigate to **Teams & Groups** → **Shared mailboxes**
3. Click **+ Add a shared mailbox**
4. Configure:
   - **Name:** `WWW Audiofast` (or similar)
   - **Email:** `www@audiofast.pl`
5. Click **Create**

> **Note:** If `www@audiofast.pl` already exists as a shared mailbox (which it does for Audiofast), skip this step and use the existing one.

### Step 2.2: Configure Mailbox Settings (Optional)

1. In Exchange Admin Center, find the shared mailbox
2. Configure as needed:
   - **Automatic replies:** Can set out-of-office if desired
   - **Mailbox delegation:** Add team members who should see sent/received emails
   - **Message size limits:** Default is usually fine (35MB)

### Expected Result

```
Shared mailbox available:
- Email: www@audiofast.pl
- Type: Shared Mailbox
- License: None required
```

---

## Phase 3: Application Access Control (RBAC)

**Who:** IT Admin with Exchange Online PowerShell access  
**Time:** ~20 minutes

### Why Restrict Access?

By default, an app with `Mail.Send` permission can send email **from any mailbox** in the organization. We need to restrict this to specific mailboxes only.

**Security principle:** Least privilege - app can only send from `www@audiofast.pl`.

> **Note:** Microsoft is transitioning from Application Access Policies to **Role-Based Access Control (RBAC) for Applications**. This guide covers both methods. RBAC is recommended for new setups. [Learn more](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-access-policies)

### Option A: RBAC for Applications (Recommended)

This is Microsoft's recommended approach as of 2024.

#### Step 3.1: Create Mail-Enabled Security Group

1. Go to [Exchange Admin Center](https://admin.exchange.microsoft.com)
2. Navigate to **Recipients** → **Groups**
3. Click **+ Add a group**
4. Select **Mail-enabled security**
5. Configure:
   - **Name:** `Audiofast Email Automation`
   - **Email:** `email-automation@audiofast.pl` (or auto-generated)
   - **Members:** Add `www@audiofast.pl` (the shared mailbox)
6. Create the group

#### Step 3.2: Configure RBAC via PowerShell

1. Connect to Exchange Online PowerShell:

```powershell
# Install module if not already installed
Install-Module -Name ExchangeOnlineManagement

# Connect (will prompt for admin credentials)
Connect-ExchangeOnline -UserPrincipalName admin@audiofast.pl
```

2. Get the security group's Distinguished Name:

```powershell
Get-Group "Audiofast Email Automation" | Select-Object -Property DistinguishedName
```

3. Create a management scope for the security group:

```powershell
# Replace the DN with the one from the previous command
New-ManagementScope -Name "AudiofastEmailScope" `
  -RecipientRestrictionFilter "MemberOfGroup -eq 'CN=Audiofast Email Automation,OU=...,DC=audiofast,DC=pl'"
```

4. Create a service principal for your app:

```powershell
# Get the Object ID from Microsoft Entra admin center → App registrations → Your app → Overview
# AppId is the Application (client) ID, ObjectId is the Object ID

New-ServicePrincipal -AppId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" `
  -ObjectId "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy" `
  -DisplayName "Audiofast Contact Form"
```

5. Assign the Mail.Send role with restricted scope:

```powershell
New-ManagementRoleAssignment -Name "AudiofastMailSend" `
  -Role "Application Mail.Send" `
  -App "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" `
  -CustomRecipientWriteScope "AudiofastEmailScope"
```

6. Test the configuration:

```powershell
Test-ServicePrincipalAuthorization -Identity "Audiofast Contact Form" `
  -Resource www@audiofast.pl | Format-Table
```

7. Disconnect:

```powershell
Disconnect-ExchangeOnline -Confirm:$false
```

---

### Option B: Application Access Policy (Legacy)

This approach still works but Microsoft recommends migrating to RBAC.

#### Step 3.1: Create Mail-Enabled Security Group

Same as Option A, Step 3.1.

#### Step 3.2: Apply Access Policy via PowerShell

1. Connect to Exchange Online PowerShell (same as above)

2. Create the Application Access Policy:

```powershell
# Replace <AppId> with the Application (client) ID from Phase 1
# Replace <GroupEmail> with the security group email from Step 3.1

New-ApplicationAccessPolicy `
  -AppId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" `
  -PolicyScopeGroupId "email-automation@audiofast.pl" `
  -AccessRight RestrictAccess `
  -Description "Restrict contact form app to www@audiofast.pl mailbox only"
```

3. Verify the policy:

```powershell
# Test access to the shared mailbox (should return "Granted")
Test-ApplicationAccessPolicy `
  -AppId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" `
  -Identity "www@audiofast.pl"

# Test access to another mailbox (should return "Denied")
Test-ApplicationAccessPolicy `
  -AppId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" `
  -Identity "some-other-user@audiofast.pl"
```

4. Disconnect:

```powershell
Disconnect-ExchangeOnline -Confirm:$false
```

---

### Expected Result

```
Application Access restricted:
- App can send from: www@audiofast.pl ✅
- App cannot send from: Any other mailbox ❌
```

> **Note:** Policy/RBAC propagation may take up to 30 minutes.

---

## Phase 4: Code Implementation

**Who:** Developer  
**Time:** ~2 hours

### Step 4.1: Install Dependencies

```bash
cd apps/web
bun add @azure/identity @microsoft/microsoft-graph-client
```

### Step 4.2: Create Graph Client Helper

Create `apps/web/src/global/microsoft-graph/client.ts`:

```typescript
/**
 * Microsoft Graph API Client - Email Service
 *
 * Uses client credentials flow for server-to-server authentication.
 * Sends emails from the configured shared mailbox.
 */

import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import type { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

// Environment variables
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const MS_GRAPH_SENDER_EMAIL = process.env.MS_GRAPH_SENDER_EMAIL;

// Validate configuration
export function isGraphConfigured(): boolean {
  return !!(
    AZURE_TENANT_ID &&
    AZURE_CLIENT_ID &&
    AZURE_CLIENT_SECRET &&
    MS_GRAPH_SENDER_EMAIL
  );
}

// Lazy-initialized client (singleton pattern)
let graphClient: Client | null = null;

/**
 * Get or create the Microsoft Graph client
 */
function getGraphClient(): Client {
  if (graphClient) {
    return graphClient;
  }

  if (!isGraphConfigured()) {
    throw new Error(
      '[MS Graph] Missing required environment variables. ' +
        'Required: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, MS_GRAPH_SENDER_EMAIL'
    );
  }

  // Create credential using client secret
  const credential = new ClientSecretCredential(
    AZURE_TENANT_ID!,
    AZURE_CLIENT_ID!,
    AZURE_CLIENT_SECRET!
  );

  // Initialize Graph client with custom auth provider
  graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const tokenResponse = await credential.getToken(
          'https://graph.microsoft.com/.default'
        );
        return tokenResponse.token;
      },
    },
  });

  return graphClient;
}

// Email types
export type EmailRecipient = {
  email: string;
  name?: string;
};

export type SendEmailOptions = {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  htmlBody: string;
  replyTo?: string;
  saveToSentItems?: boolean;
};

export type SendEmailResult = {
  success: boolean;
  error?: string;
};

/**
 * Send an email using Microsoft Graph API
 *
 * @param options - Email options (to, subject, htmlBody, etc.)
 * @returns Promise with success status
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  try {
    const client = getGraphClient();
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    // Build the email message object
    const message: Record<string, unknown> = {
      subject: options.subject,
      body: {
        contentType: 'HTML',
        content: options.htmlBody,
      },
      toRecipients: recipients.map((r) => ({
        emailAddress: {
          address: r.email,
          name: r.name,
        },
      })),
    };

    // Add reply-to if specified
    if (options.replyTo) {
      message.replyTo = [
        {
          emailAddress: {
            address: options.replyTo,
          },
        },
      ];
    }

    // Send the email
    await client.api(`/users/${MS_GRAPH_SENDER_EMAIL}/sendMail`).post({
      message,
      saveToSentItems: options.saveToSentItems ?? true,
    });

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('[MS Graph] Failed to send email:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send multiple emails concurrently
 *
 * @param emails - Array of email options
 * @returns Promise with array of results
 */
export async function sendEmails(
  emails: SendEmailOptions[]
): Promise<SendEmailResult[]> {
  const results = await Promise.allSettled(
    emails.map((email) => sendEmail(email))
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      success: false,
      error: result.reason?.message || 'Unknown error',
    };
  });
}
```

### Step 4.3: Update API Route

Replace `apps/web/src/app/api/contact/route.ts`:

```typescript
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  FALLBACK_EMAIL_BODY,
  FALLBACK_EMAIL_SUBJECT,
  FALLBACK_SUPPORT_EMAIL,
} from '@/global/constants';
import {
  isGraphConfigured,
  sendEmails,
  type SendEmailOptions,
} from '@/global/microsoft-graph/client';
import { sanityFetch } from '@/global/sanity/fetch';
import { queryContactSettings } from '@/global/sanity/query';
import type { QueryContactSettingsResult } from '@/global/sanity/sanity.types';
import type { PortableTextProps } from '@/global/types';
import { portableTextToHtml } from '@/global/utils';

// Reply-to address for confirmation emails (optional)
const REPLY_TO_EMAIL =
  process.env.MS_GRAPH_REPLY_TO || process.env.MS_GRAPH_SENDER_EMAIL;

type FormSubmission = {
  name?: string;
  email: string;
  message?: string;
  consent: boolean;
};

type ContactSettingsType = {
  supportEmails: string[];
  confirmationEmail: {
    subject: string;
    content: string;
  };
};

// Get contact settings with fallbacks
function getContactConfig(
  contactSettings: NonNullable<QueryContactSettingsResult>
): ContactSettingsType {
  const supportEmails = contactSettings.supportEmails || [
    FALLBACK_SUPPORT_EMAIL,
  ];

  const subject =
    contactSettings.confirmationEmail?.subject || FALLBACK_EMAIL_SUBJECT;
  const content =
    portableTextToHtml(
      contactSettings.confirmationEmail?.content as PortableTextProps
    ) || FALLBACK_EMAIL_BODY;

  return {
    supportEmails,
    confirmationEmail: {
      subject,
      content,
    },
  };
}

// Escape HTML to prevent injection
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

// Replace placeholders in text
function replacePlaceholders(
  text: string,
  variables: { name?: string; email?: string; message?: string }
): string {
  return text
    .replace(/\{\{name\}\}/g, escapeHtml(variables.name || ''))
    .replace(/\{\{email\}\}/g, escapeHtml(variables.email || ''))
    .replace(/\{\{message\}\}/g, escapeHtml(variables.message || ''));
}

// Create email HTML wrapper
function createEmailHTML(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${body}
</body>
</html>
  `.trim();
}

export async function POST(request: NextRequest) {
  // Validate Microsoft Graph is configured
  if (!isGraphConfigured()) {
    console.error('[Contact API] Microsoft Graph not configured');
    return NextResponse.json(
      { success: false, message: 'Email service not configured' },
      { status: 500 }
    );
  }

  // Parse request body
  let body: FormSubmission;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON' },
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

  // Fetch contact settings from Sanity
  let contactSettings;
  try {
    contactSettings = await sanityFetch<QueryContactSettingsResult>({
      query: queryContactSettings,
      tags: ['settings'],
    });
  } catch (error) {
    console.error('[Contact API] Failed to fetch contact settings', error);
  }

  const emailConfig = getContactConfig(contactSettings!);

  // Prepare variables for template replacement
  const variables = {
    name: body.name || '',
    email: body.email,
    message: body.message || '',
  };

  // Render confirmation email content
  const confirmationSubject = replacePlaceholders(
    emailConfig.confirmationEmail.subject,
    variables
  );
  const confirmationBody = replacePlaceholders(
    emailConfig.confirmationEmail.content,
    variables
  );

  // Build internal notification email
  const internalSubject = `Nowe zgłoszenie z formularza kontaktowego`;
  const internalBody = `
    <h2>Nowe zgłoszenie z formularza</h2>
    ${body.name ? `<p><strong>Imię i nazwisko:</strong> ${escapeHtml(body.name)}</p>` : ''}
    <p><strong>E-mail:</strong> ${escapeHtml(body.email)}</p>
    ${body.message ? `<p><strong>Wiadomość:</strong><br>${escapeHtml(body.message).replace(/\n/g, '<br>')}</p>` : ''}
  `;

  // Prepare email payloads
  const emails: SendEmailOptions[] = [
    // Internal notification email (to support team)
    {
      to: emailConfig.supportEmails.map((email) => ({ email })),
      subject: internalSubject,
      htmlBody: createEmailHTML(internalBody),
      replyTo: body.email, // Reply goes to the person who submitted the form
      saveToSentItems: true,
    },
    // Confirmation email (to the user)
    {
      to: { email: body.email, name: body.name },
      subject: confirmationSubject,
      htmlBody: createEmailHTML(confirmationBody),
      replyTo: REPLY_TO_EMAIL,
      saveToSentItems: true,
    },
  ];

  // Send emails concurrently
  try {
    const results = await sendEmails(emails);
    const [internalResult, confirmationResult] = results;

    // Check if internal email succeeded (required)
    if (!internalResult?.success) {
      console.error(
        '[Contact API] Internal email failed:',
        internalResult?.error
      );
      return NextResponse.json(
        { success: false, message: 'Failed to send notification email' },
        { status: 500 }
      );
    }

    // Log confirmation email result (optional, don't fail if it fails)
    if (!confirmationResult?.success) {
      console.error(
        '[Contact API] Confirmation email failed:',
        confirmationResult?.error
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Contact API] Email sending failed', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send emails' },
      { status: 500 }
    );
  }
}
```

### Step 4.4: Update Client Helper (Optional)

Update `apps/web/src/global/resend/send-contact.ts` filename to something more generic:

Rename to `apps/web/src/global/email/send-contact.ts`:

```typescript
/**
 * Email API Client - Contact Form Submission
 */

type ContactFormData = {
  name: string;
  email: string;
  message: string;
  consent: boolean;
};

type ContactFormResponse = {
  success: boolean;
  message?: string;
};

/**
 * Sends contact form data to the email API endpoint
 *
 * @param data - Contact form data (name, email, message, consent)
 * @returns Promise with success status and optional error message
 */
export async function sendContactForm(
  data: ContactFormData
): Promise<ContactFormResponse> {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        message: data.message,
        consent: data.consent,
      }),
    });

    const result = await response.json();

    return {
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    console.error('[Email] Contact form submission failed', error);
    return {
      success: false,
      message: 'Failed to send message',
    };
  }
}
```

### Step 4.5: Update Imports in Components

Update imports in:

- `apps/web/src/components/pageBuilder/ContactForm/ContactForm.tsx`
- `apps/web/src/components/pageBuilder/FaqSection/ContactForm.tsx`

```typescript
// Change from:
import { sendContactForm } from '@/src/global/resend/send-contact';

// Change to:
import { sendContactForm } from '@/src/global/email/send-contact';
```

### Step 4.6: Update Constants

Update `apps/web/src/global/constants.ts`:

```typescript
// Change from:
export const FALLBACK_SUPPORT_EMAIL: string =
  process.env.RESEND_FROM_EMAIL || 'noreply@audiofast.pl';

// Change to:
export const FALLBACK_SUPPORT_EMAIL: string =
  process.env.MS_GRAPH_SENDER_EMAIL || 'www@audiofast.pl';
```

### Step 4.7: Clean Up

Remove Resend dependency:

```bash
cd apps/web
bun remove resend
```

Delete old files:

- `apps/web/src/global/resend/` directory (if only contains send-contact.ts)

---

## Phase 5: Environment & Deployment

**Who:** Developer + DevOps  
**Time:** ~30 minutes

### Step 5.1: Update .env.example

```env
# Microsoft Graph API (Contact Form Emails)
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
MS_GRAPH_SENDER_EMAIL=www@audiofast.pl
MS_GRAPH_REPLY_TO=www@audiofast.pl

# Remove these (no longer needed):
# RESEND_API_KEY=
# RESEND_FROM_EMAIL=
# RESEND_REPLY_TO=
```

### Step 5.2: Local Development (.env.local)

```env
# Microsoft Graph API
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-client-secret-value
MS_GRAPH_SENDER_EMAIL=www@audiofast.pl
MS_GRAPH_REPLY_TO=www@audiofast.pl
```

### Step 5.3: Update Vercel Environment Variables

In Vercel Dashboard:

1. Go to Project Settings → Environment Variables
2. Remove old variables:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `RESEND_REPLY_TO`
3. Add new variables:
   - `AZURE_TENANT_ID`
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `MS_GRAPH_SENDER_EMAIL`
   - `MS_GRAPH_REPLY_TO` (optional)

### Step 5.4: Environment-Specific Notes

| Environment | Configuration                                         |
| ----------- | ----------------------------------------------------- |
| Development | Use production Entra app (or create separate dev app) |
| Preview     | Same as production (Vercel preview deployments)       |
| Production  | Production Microsoft Entra app credentials            |

> **Tip:** You can use the same Microsoft Entra app for all environments since it's restricted to a specific mailbox via RBAC/Application Access Policy.

---

## Phase 6: Testing & Rollout

**Who:** Developer + QA  
**Time:** ~1 hour

### Step 6.1: Local Testing Checklist

- [ ] Contact form (main) submits successfully
- [ ] FAQ contact form submits successfully
- [ ] Internal notification email received by support team
- [ ] Confirmation email received by user
- [ ] Emails appear in shared mailbox "Sent Items"
- [ ] Reply-to works correctly (replying goes to correct address)
- [ ] Error states display correctly when Graph API fails
- [ ] Loading states work during submission

### Step 6.2: Test Cases

| Test                      | Expected Result                            |
| ------------------------- | ------------------------------------------ |
| Submit valid form         | Success, both emails sent                  |
| Submit without consent    | Error: "Email and consent are required"    |
| Submit with invalid email | Client-side validation prevents submission |
| Azure credentials missing | Error: "Email service not configured"      |
| Graph API rate limited    | Error: "Failed to send emails"             |

### Step 6.3: Preview Deployment Testing

1. Push changes to a feature branch
2. Test on Vercel preview deployment
3. Verify emails work in preview environment

### Step 6.4: Production Rollout

1. Merge to main branch
2. Monitor Vercel deployment logs
3. Test contact form on production
4. Monitor shared mailbox for sent emails
5. Verify team receives notifications

---

## Troubleshooting

### Common Issues

#### "Insufficient privileges" Error

**Cause:** Application doesn't have `Mail.Send` permission or admin consent not granted.

**Solution:**

1. Go to [Microsoft Entra admin center](https://entra.microsoft.com) → Identity → Applications → App registrations → Your app → API permissions
2. Verify `Mail.Send` shows "Granted for [Organization]"
3. If not, click "Grant admin consent"

#### "Access denied" or "Mailbox not found" Error

**Cause:** RBAC/Application Access Policy restricting access, or mailbox doesn't exist.

**Solution:**

1. Verify shared mailbox exists in Exchange Admin Center
2. Test access in PowerShell:

   ```powershell
   # For RBAC
   Test-ServicePrincipalAuthorization -Identity "Audiofast Contact Form" -Resource www@audiofast.pl

   # For Application Access Policy (legacy)
   Test-ApplicationAccessPolicy -AppId "<AppId>" -Identity "www@audiofast.pl"
   ```

3. Wait 30 minutes for policy propagation

#### "Invalid client secret" Error

**Cause:** Client secret expired or incorrect.

**Solution:**

1. Go to [Microsoft Entra admin center](https://entra.microsoft.com) → Identity → Applications → App registrations → Your app → Certificates & secrets
2. Check if secret is expired
3. Create new secret if needed
4. Update environment variables

#### Emails Not Appearing in Sent Items

**Cause:** `saveToSentItems` set to `false` or email failed silently.

**Solution:**

1. Check `saveToSentItems: true` in email options
2. Check Vercel logs for errors
3. Verify Application Access Policy allows mailbox access

### Logging & Debugging

Add detailed logging in development:

```typescript
// In client.ts, add debug logging
if (process.env.NODE_ENV === 'development') {
  console.log('[MS Graph] Sending email to:', recipients);
  console.log('[MS Graph] Subject:', options.subject);
}
```

---

## Security Considerations

### Credential Storage

- ✅ **Never commit secrets** - Use environment variables only
- ✅ **Rotate client secrets** - Set calendar reminder for expiration (max 24 months)
- ✅ **Use RBAC/Access Policy** - Restrict to specific mailbox only

### Rate Limits

Microsoft Graph API limits:

- 10,000 emails per day per mailbox
- 30 requests per second per app

For contact forms, these limits are more than sufficient.

### Data Handling

- ✅ **Escape HTML** - Prevent XSS in email bodies
- ✅ **Validate consent** - Only send if user consented
- ✅ **Don't log sensitive data** - Avoid logging email content in production

### Monitoring

Consider adding:

- Error tracking (Sentry, etc.)
- Email delivery monitoring
- Alert on high failure rates

---

## File Changes Summary

| File                                                              | Action                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/web/package.json`                                           | Add `@azure/identity`, `@microsoft/microsoft-graph-client`; Remove `resend` |
| `apps/web/src/global/microsoft-graph/client.ts`                   | **NEW** - Graph API client                                                  |
| `apps/web/src/app/api/contact/route.ts`                           | Update to use Graph API                                                     |
| `apps/web/src/global/resend/send-contact.ts`                      | Rename to `email/send-contact.ts`                                           |
| `apps/web/src/global/constants.ts`                                | Update fallback email reference                                             |
| `apps/web/src/components/pageBuilder/ContactForm/ContactForm.tsx` | Update import path                                                          |
| `apps/web/src/components/pageBuilder/FaqSection/ContactForm.tsx`  | Update import path                                                          |
| `.env.example`                                                    | Update environment variables                                                |

---

## Timeline Estimate

| Phase                                        | Time         | Who            |
| -------------------------------------------- | ------------ | -------------- |
| Phase 1: Microsoft Entra ID App Registration | 15 min       | IT Admin       |
| Phase 2: Shared Mailbox Setup                | 10 min       | IT Admin       |
| Phase 3: Application Access Control (RBAC)   | 20 min       | IT Admin       |
| Phase 4: Code Implementation                 | 2 hours      | Developer      |
| Phase 5: Environment & Deployment            | 30 min       | Developer      |
| Phase 6: Testing & Rollout                   | 1 hour       | Developer + QA |
| **Total**                                    | **~4 hours** |                |

---

## Next Steps After This Migration

1. ✅ Contact forms working with Microsoft Graph
2. 🔄 Consider migrating newsletter confirmation emails (if any use Resend)
3. 🔄 Add email delivery monitoring/analytics
4. 🔄 Set up client secret rotation reminders
