import mailchimp from "@mailchimp/mailchimp_marketing";

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX;
const E2E_MOCK_MAILCHIMP = process.env.E2E_MOCK_MAILCHIMP === "1";

if (!E2E_MOCK_MAILCHIMP && (!MAILCHIMP_API_KEY || !MAILCHIMP_SERVER_PREFIX)) {
  console.warn(
    "[Mailchimp] Missing API credentials. Newsletter signup will be disabled.",
  );
}

// Configure client once
if (MAILCHIMP_API_KEY && MAILCHIMP_SERVER_PREFIX) {
  mailchimp.setConfig({
    apiKey: MAILCHIMP_API_KEY,
    server: MAILCHIMP_SERVER_PREFIX,
  });
}

export const mailchimpClient = mailchimp;
