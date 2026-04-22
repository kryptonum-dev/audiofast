import { buildCheckoutDraftFromProfile } from '../profile';
import { createEmptyCheckoutDraft } from '../validation';
import { loadCheckoutAuthContext } from './auth-context';
import type { CheckoutAuthContext, LoadCheckoutPageData } from './types';

function createFallbackCheckoutPageData(): LoadCheckoutPageData {
  return {
    initialDraft: createEmptyCheckoutDraft(),
    isEmailLocked: false,
    sessionContext: {
      isAuthenticated: false,
      authUserId: null,
      authenticatedEmail: null,
      customerProfileId: null,
    },
    customerProfile: null,
    canPrefillFromProfile: false,
  };
}

function buildCheckoutPageData(
  authContext: CheckoutAuthContext,
): LoadCheckoutPageData {
  return {
    initialDraft:
      authContext.canPrefillFromProfile && authContext.customerProfile
        ? buildCheckoutDraftFromProfile(authContext.customerProfile)
        : createEmptyCheckoutDraft(),
    isEmailLocked: authContext.isEmailLocked,
    sessionContext: authContext.sessionContext,
    customerProfile: authContext.customerProfile,
    canPrefillFromProfile: authContext.canPrefillFromProfile,
  };
}

export async function loadCheckoutPageData(): Promise<LoadCheckoutPageData> {
  try {
    const authContext = await loadCheckoutAuthContext();

    return buildCheckoutPageData(authContext);
  } catch (error) {
    console.error('Failed to load checkout page data.', error);

    return createFallbackCheckoutPageData();
  }
}
