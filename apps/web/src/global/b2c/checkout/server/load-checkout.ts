import {
  createCheckoutFailure,
  createCheckoutInternalError,
  createCheckoutSuccess,
} from '../errors';
import { buildCheckoutDraftFromProfile } from '../profile';
import { createEmptyCheckoutDraft } from '../validation';

import { loadCheckoutAuthContext } from './auth-context';
import type { LoadCheckoutPageResult } from './types';

export async function loadCheckoutPageData(): Promise<LoadCheckoutPageResult> {
  try {
    const authContext = await loadCheckoutAuthContext();

    return createCheckoutSuccess({
      initialDraft:
        authContext.canPrefillFromProfile && authContext.customerProfile
          ? buildCheckoutDraftFromProfile(authContext.customerProfile)
          : createEmptyCheckoutDraft(),
      isEmailLocked: authContext.isEmailLocked,
      sessionContext: authContext.sessionContext,
      customerProfile: authContext.customerProfile,
      canPrefillFromProfile: authContext.canPrefillFromProfile,
    });
  } catch (error) {
    console.error('Failed to load checkout page data.', error);

    return createCheckoutFailure(createCheckoutInternalError());
  }
}
