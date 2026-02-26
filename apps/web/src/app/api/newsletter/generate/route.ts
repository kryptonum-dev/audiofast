import { render } from "@react-email/render";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type {
  HeroConfig,
  NewsletterContent,
  SectionKey,
} from "@/src/emails/newsletter-template";
import NewsletterTemplate from "@/src/emails/newsletter-template";
import { mailchimpClient } from "@/src/global/mailchimp/client";
import { client } from "@/src/global/sanity/client";
import { queryMailchimpSettings } from "@/src/global/sanity/query";

// Define the expected payload structure
interface GeneratePayload {
  action: "download-html" | "create-mailchimp-draft";
  startDate?: string;
  endDate?: string;
  content: NewsletterContent;
  hero: HeroConfig;
  sectionOrder?: SectionKey[];
  subject?: string; // Optional custom subject line
}

// Helper type for Mailchimp campaign response since the types are loose
interface MailchimpCampaignResponse {
  id: string;
  web_id: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// CORS headers for Sanity Studio
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GeneratePayload;
    const { action, content, startDate, endDate, hero, sectionOrder, subject } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Missing content data" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!hero?.imageUrl) {
      return NextResponse.json(
        { error: "Hero image is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Generate the HTML email
    const emailHtml = await render(
      NewsletterTemplate({
        content,
        hero,
        sectionOrder,
      }),
    );

    // -------------------------------------------------------------------------
    // ACTION: Download HTML File
    // -------------------------------------------------------------------------
    if (action === "download-html") {
      // Return the HTML file as a downloadable attachment
      const filename = `newsletter-audiofast-${new Date().toISOString().split("T")[0]}.html`;

      return new NextResponse(emailHtml, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // -------------------------------------------------------------------------
    // ACTION: Create Mailchimp Draft
    // -------------------------------------------------------------------------
    if (action === "create-mailchimp-draft") {
      if (!process.env.MAILCHIMP_API_KEY) {
        return NextResponse.json(
          { error: "Mailchimp API key not configured" },
          { status: 500, headers: corsHeaders },
        );
      }

      // Fetch Audience ID from Sanity Settings
      const mailchimpAudienceId = await client.fetch(queryMailchimpSettings);

      if (!mailchimpAudienceId) {
        return NextResponse.json(
          {
            error:
              "Mailchimp Audience ID not found in Sanity Settings. Please configure it in global settings.",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      // 1. Determine Campaign Defaults
      const campaignSubject =
        subject ||
        `Nowości Audiofast: ${new Date().toLocaleDateString("pl-PL")}`;
      const fromName = "Audiofast";
      const replyTo = "info@audiofast.pl"; // Should be configured in env or passed in

      // 2. Create the Campaign
      // Note: 'type: regular' is a standard email campaign
      const campaign = (await mailchimpClient.campaigns.create({
        type: "regular",
        recipients: {
          list_id: mailchimpAudienceId,
        },
        settings: {
          subject_line: campaignSubject,
          from_name: fromName,
          reply_to: replyTo,
          title: `Audiofast Digest ${new Date().toISOString().split("T")[0]}`, // Internal title
        },
      })) as unknown as MailchimpCampaignResponse;

      if (!campaign.id) {
        throw new Error("Failed to create Mailchimp campaign");
      }

      // 3. Set the Campaign Content (HTML)
      await mailchimpClient.campaigns.setContent(campaign.id, {
        html: emailHtml,
      });

      return NextResponse.json(
        {
          success: true,
          campaignId: campaign.id,
          webUrl: campaign.web_id,
          message: "Draft campaign created successfully",
        },
        { headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400, headers: corsHeaders },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("[Newsletter API] Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal Server Error",
        details: error.response?.body || undefined,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
