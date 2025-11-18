# Resend Email Integration Setup

## Environment Variables

Create a `.env.local` file in `apps/web/` (or add to your existing environment configuration) with the following variables:

```bash
# Resend Email Configuration
# Get your API key from https://resend.com/api-keys
# Ensure your sending domain is verified in Resend dashboard before production use
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO=support@yourdomain.com
```

### Required Variables

- **RESEND_API_KEY**: Your Resend API key (starts with `re_`)
- **RESEND_FROM_EMAIL**: The verified sender email address (must match a verified domain in Resend)
- **RESEND_REPLY_TO**: (Optional) Reply-to address for emails

### Setup Steps

1. Sign up for a Resend account at https://resend.com
2. Verify your sending domain in the Resend dashboard
3. Generate an API key from the Resend dashboard
4. Add the environment variables to your `.env.local` file
5. For production deployments (Vercel), add these as environment variables in your project settings

### Domain Verification

Before sending emails in production, ensure your domain is verified in Resend:
- Add DNS records (SPF, DKIM, DMARC) as instructed by Resend
- Wait for verification to complete (usually takes a few minutes)
- Test with a small batch before full rollout

