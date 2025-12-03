import { type NextRequest, NextResponse } from "next/server";

import { REGEX } from "@/global/constants";
import { subscribeToNewsletter } from "@/global/mailchimp/subscribe";

type NewsletterSubmission = {
  email: string;
  consent: boolean;
};

export async function POST(request: NextRequest) {
  // Parse request body
  let body: NewsletterSubmission;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request" },
      { status: 400 },
    );
  }

  // Validate required fields
  if (!body.email || !body.consent) {
    return NextResponse.json(
      { success: false, message: "Email and consent are required" },
      { status: 400 },
    );
  }

  // Validate email format
  if (!REGEX.email.test(body.email)) {
    return NextResponse.json(
      { success: false, message: "Invalid email address" },
      { status: 400 },
    );
  }

  // Subscribe to Mailchimp
  try {
    const result = await subscribeToNewsletter(body.email);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        needsConfirmation: result.needsConfirmation,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Newsletter API] Unexpected error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to process subscription" },
      { status: 500 },
    );
  }
}
