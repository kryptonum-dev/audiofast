import 'server-only';

import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';

import { loadCustomerAuthSession } from './session';

const CUSTOMER_ORDERS_RETURN_TO = '/konto-klienta/zamowienia/';

export type CustomerOrdersPageData =
  | {
      kind: 'authenticated';
      normalizedEmail: string;
    }
  | {
      kind: 'unauthenticated';
      redirectTo: string;
    };

export async function loadCustomerOrdersPageData(): Promise<CustomerOrdersPageData> {
  const session = await loadCustomerAuthSession();

  if (!session.isAuthenticated) {
    return {
      kind: 'unauthenticated',
      redirectTo: buildCustomerAccountGatewayHref(CUSTOMER_ORDERS_RETURN_TO),
    };
  }

  return {
    kind: 'authenticated',
    normalizedEmail: session.normalizedEmail,
  };
}
