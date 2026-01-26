/**
 * Email API Client - Contact Form Submission
 */

export type ProductInquiryData = {
  name: string;
  brandName: string;
  configuration: Array<{
    label: string;
    value: string;
    priceDelta: number;
  }>;
  basePrice: number;
  totalPrice: number;
};

type ContactFormData = {
  name: string;
  email: string;
  message: string;
  consent: boolean;
  /** Optional product data for product inquiry forms */
  product?: ProductInquiryData;
};

type ContactFormResponse = {
  success: boolean;
  message?: string;
};

/**
 * Sends contact form data to the email API endpoint
 *
 * @param data - Contact form data (name, email, message, consent, optional product)
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
        product: data.product,
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
