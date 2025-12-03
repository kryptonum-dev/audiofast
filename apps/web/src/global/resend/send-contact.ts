/**
 * Resend API Client - Contact Form Submission
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
 * Sends contact form data to the Resend API endpoint
 *
 * @param data - Contact form data (name, email, message, consent)
 * @param metadata - Optional tracking metadata
 * @returns Promise with success status and optional error message
 */
export async function sendContactForm(
  data: ContactFormData,
): Promise<ContactFormResponse> {
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    console.error("[Resend] Contact form submission failed", error);
    return {
      success: false,
      message: "Failed to send message",
    };
  }
}
