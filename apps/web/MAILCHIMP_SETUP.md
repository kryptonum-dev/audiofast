# Mailchimp Newsletter Setup

## Prerequisites

1. Mailchimp account (free tier works)
2. Created Audience (List)
3. API key generated

## Configuration Steps

### 1. Create Mailchimp Audience

1. Log in to [Mailchimp](https://mailchimp.com)
2. Navigate to: **Audience → All contacts**
3. Create new audience or use existing
4. Note the **Audience ID**:
   - Go to **Settings → Audience name and defaults**
   - Copy the "Audience ID" (e.g., `abc123def4`)

### 2. Generate API Key

1. Navigate to: **Account → Extras → API keys**
2. Click **"Create A Key"**
3. Copy the full API key (e.g., `abc123...xyz-us6`)
4. Note the **server prefix** (last part after dash, e.g., `us6`)

### 3. Configure Double Opt-In (Recommended for GDPR)

1. Navigate to: **Audience → Settings → Audience name and defaults**
2. Enable **"Enable double opt-in"**
3. Customize confirmation email if needed
4. Save settings

### 4. Add Environment Variables

Create a `.env.local` file in `apps/web/` with the following variables:

```bash
# Mailchimp Newsletter Configuration
MAILCHIMP_API_KEY=your_full_api_key_here
MAILCHIMP_SERVER_PREFIX=us6
```

**How to find your server prefix:**
- Look at the end of your API key: `abc123...xyz-us6`
- The server prefix is the part after the last dash: `us6`

**Example configuration:**

```bash
MAILCHIMP_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p-us6
MAILCHIMP_SERVER_PREFIX=us6
```

**Note:** The Audience ID is now configured in Sanity CMS (see next step), not in environment variables.

### 5. Configure Mailchimp in Sanity Studio

1. Open your Sanity Studio (usually at `http://localhost:3333`)
2. Navigate to **"Ustawienia globalne" (Global Settings)**
3. Go to the **"Dane kontaktowe" (Contact Data)** tab
4. Find the **"Mailchimp Audience ID"** field
5. Enter your Mailchimp Audience ID (e.g., `abc123def4`)
6. Click **"Publish"** to save changes

**Finding your Audience ID:**
- Log in to Mailchimp
- Navigate to: **Audience → Settings → Audience name and defaults**
- Copy the "Audience ID" value

**Note:** Double opt-in is always enabled for GDPR compliance. Subscribers will automatically receive a confirmation email and must click the link to be added to your list.

### 6. Deploy to Production

1. Add environment variables to your hosting platform (Vercel, etc.):
   - `MAILCHIMP_API_KEY`
   - `MAILCHIMP_SERVER_PREFIX`

2. Configure Mailchimp settings in production Sanity Studio (same as step 5)

3. Deploy your application

4. Test with a real email address

5. Verify subscriber appears in Mailchimp dashboard

## Testing

### Local Testing

1. Start your development server:
   ```bash
   cd apps/web
   bun run dev
   ```

2. Navigate to your site's footer

3. Enter a test email address

4. Submit the newsletter form

5. Check Mailchimp dashboard for new subscriber

### Double Opt-In Testing

If double opt-in is enabled:

1. Check your test email inbox
2. Look for confirmation email from Mailchimp
3. Click the confirmation link
4. Verify status changes to "subscribed" in Mailchimp dashboard

## Troubleshooting

### "Newsletter service not available"

**Cause:** Missing or incorrect environment variables

**Solution:**
- Verify all three environment variables are set in `.env.local`
- Restart your development server after adding variables
- Check that API key is not expired

### "Invalid email address"

**Cause:** Email format validation failed or Mailchimp rejected the email

**Solution:**
- Check that email passes regex validation
- Verify email domain is not blocked in Mailchimp
- Check Mailchimp API response in server logs

### Subscribers not appearing in Mailchimp

**Possible causes:**

1. **Wrong Audience ID**
   - Verify Audience ID in Sanity matches your target audience in Mailchimp
   - Check Sanity: Settings → Dane kontaktowe → Newsletter - Mailchimp
   - Check Mailchimp dashboard → Audience → Settings

2. **Double opt-in pending**
   - Check spam folder for confirmation email
   - Look for "pending" status in Mailchimp dashboard

3. **Previously unsubscribed**
   - Check "Unsubscribed" tab in Mailchimp
   - User may need to manually resubscribe through Mailchimp

4. **API rate limits**
   - Check server logs for 429 errors
   - Implement rate limiting if needed

### "Already subscribed" message

This is **not an error** - it means the email is already in your audience. The system handles this gracefully and returns a success message.

### Network or API errors

**Check server logs:**

```bash
# Development
cd apps/web
bun run dev

# Check terminal output for [Mailchimp] errors
```

**Common API errors:**
- `400`: Bad request (invalid email, already subscribed)
- `403`: Forbidden (API key permissions issue)
- `404`: Audience not found (check Audience ID in Sanity)
- `500`: Mailchimp server error (try again later)

## Advanced Configuration

### Tags and Source Tracking

All subscribers are automatically tagged with:
- `website` - Base tag for all website signups
- Source tag (e.g., `footer`, `blog`, `popup`) - Indicates signup location

Tags are automatically applied based on the `source` parameter passed to the API.

### Merge Fields

The system tracks signup source using a `SOURCE` merge field. You can add more merge fields in `subscribe.ts`:

```typescript
merge_fields: {
  SOURCE: metadata?.source || 'website',
  FNAME: firstName,
  LNAME: lastName,
  SIGNUP_DATE: new Date().toISOString(),
},
```

**Note:** Merge fields must be created in Mailchimp first:
1. Audience → Settings → Audience fields and *|MERGE|* tags
2. Add new merge field (e.g., `SOURCE`, `FNAME`)
3. Update code to use new fields

### Double Opt-In (Always Enabled)

Double opt-in is **always enabled** for GDPR compliance and cannot be disabled. This means:

1. When a user submits their email, they receive a confirmation email from Mailchimp
2. They must click the confirmation link to be added to your audience
3. Until confirmed, their status in Mailchimp is "pending"
4. After confirmation, their status changes to "subscribed"

**Why always enabled:**
- ✅ GDPR compliance requirement
- ✅ Ensures email addresses are valid
- ✅ Reduces spam complaints
- ✅ Improves list quality
- ✅ Protects sender reputation

### Unsubscribe Handling

Users can unsubscribe via Mailchimp's built-in unsubscribe links in emails. To handle unsubscribes programmatically, create a new API route:

```typescript
// app/api/newsletter/unsubscribe/route.ts
// Fetch audience ID from Sanity settings first
const settings = await sanityFetch({ query: queryMailchimpSettings });
await mailchimpClient.lists.updateListMember(
  settings.audienceId,
  subscriberHash,
  { status: 'unsubscribed' }
);
```

## API Reference

### Key Mailchimp API Methods

```typescript
// Add or update list member (idempotent)
mailchimpClient.lists.setListMember(
  listId,         // Audience ID
  subscriberHash, // MD5 hash of lowercase email
  {
    email_address: 'user@example.com',
    status_if_new: 'pending', // or 'subscribed'
    merge_fields: { SOURCE: 'footer' },
    tags: ['website'],
  }
);

// Check member status
mailchimpClient.lists.getListMember(
  listId,
  subscriberHash
);

// Update member tags
mailchimpClient.lists.updateListMemberTags(
  listId,
  subscriberHash,
  {
    tags: [
      { name: 'vip', status: 'active' },
      { name: 'promo', status: 'inactive' },
    ],
  }
);
```

### Useful Documentation Links

- **Mailchimp Marketing API**: https://mailchimp.com/developer/marketing/docs/fundamentals/
- **Lists API**: https://mailchimp.com/developer/marketing/api/lists/
- **Add/Update Member**: https://mailchimp.com/developer/marketing/api/list-members/add-or-update-list-member/
- **Node.js Client**: https://github.com/mailchimp/mailchimp-marketing-node

## Security Best Practices

1. **Never expose API keys** in client-side code
2. **Use environment variables** for all sensitive data
3. **Enable double opt-in** for GDPR compliance
4. **Implement rate limiting** to prevent abuse
5. **Validate email format** before calling Mailchimp API
6. **Log errors securely** without exposing sensitive data
7. **Rotate API keys** periodically

## GDPR Compliance

To comply with GDPR:

1. ✅ **Enable double opt-in** (user must confirm email)
2. ✅ **Link to privacy policy** on signup form (already implemented)
3. ✅ **Require explicit consent** checkbox (already implemented)
4. ✅ **Provide unsubscribe link** in all emails (Mailchimp default)
5. ⚠️ **Add "how we use your data" text** near signup form
6. ⚠️ **Store consent timestamp** (optional, can add to merge fields)

## Next Steps

After setup is complete:

1. **Test thoroughly** with multiple email addresses
2. **Set up welcome email** in Mailchimp (Automations → Welcome new subscribers)
3. **Monitor signup rates** in Mailchimp dashboard
4. **Create segments** for targeted campaigns
5. **Consider adding analytics** tracking for signup conversions
6. **Implement rate limiting** if expecting high traffic
7. **Add honeypot field** to prevent bot signups

---

For questions or issues, refer to the [Mailchimp Help Center](https://mailchimp.com/help/) or check server logs for detailed error messages.

