import crypto from 'crypto';

import { sanityFetch } from '@/global/sanity/fetch';
import { queryMailchimpSettings } from '@/global/sanity/query';

import { mailchimpClient } from './client';

export type SubscribeResult = {
  success: boolean;
  message?: string;
  needsConfirmation?: boolean; // True if double opt-in is enabled
};

/**
 * Subscribe an email to the newsletter list
 * Uses setListMember (PUT) for idempotency - safe to call multiple times
 * Always uses double opt-in for GDPR compliance
 *
 * @param email - Email address to subscribe
 * @returns Result object with success status and message
 */
export async function subscribeToNewsletter(
  email: string
): Promise<SubscribeResult> {
  if (!mailchimpClient) {
    console.error('[Mailchimp] Client not configured');
    return {
      success: false,
      message: 'Newsletter service not available',
    };
  }

  // Fetch Mailchimp Audience ID from Sanity
  let audienceId: string | null;
  try {
    audienceId = await sanityFetch<string | null>({
      query: queryMailchimpSettings,
      tags: ['mailchimp-settings'],
    });
  } catch (error) {
    console.error('[Mailchimp] Failed to fetch settings', error);
    return {
      success: false,
      message: 'Newsletter service not available',
    };
  }

  if (!audienceId) {
    console.error('[Mailchimp] Audience ID not configured in Sanity');
    return {
      success: false,
      message: 'Newsletter service not available',
    };
  }

  try {
    // Generate subscriber hash for idempotent operations
    // Mailchimp requires MD5 hash of lowercase email
    const subscriberHash = crypto
      .createHash('md5')
      .update(email.toLowerCase())
      .digest('hex');

    // Use setListMember (PUT) instead of addListMember (POST)
    // This is idempotent and won't fail if email already exists
    const response = await mailchimpClient.lists.setListMember(
      audienceId,
      subscriberHash,
      {
        email_address: email,
        // Always use 'pending' for double opt-in (GDPR compliance)
        status_if_new: 'pending',
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
  } catch (error: unknown) {
    console.error('[Mailchimp] Subscribe error:', error);

    // Handle specific Mailchimp errors
    if ((error as { status?: number }).status === 400) {
      const errorDetail =
        (error as { response?: { body?: { title?: string } } }).response?.body
          ?.title || '';

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

      if (errorDetail.includes('forgotten email not subscribed')) {
        // User previously unsubscribed and can't be re-added automatically
        return {
          success: false,
          message:
            'This email was previously unsubscribed. Please contact support to resubscribe.',
        };
      }
    }

    if ((error as { status?: number }).status === 403) {
      return {
        success: false,
        message: 'Newsletter signup is temporarily unavailable',
      };
    }

    // Generic error for unexpected cases
    return {
      success: false,
      message: 'Failed to subscribe. Please try again later.',
    };
  }
}
