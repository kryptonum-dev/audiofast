import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import CustomerPanelShell from '@/src/components/b2c/CustomerPanel/CustomerPanelShell';
import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

type CustomerPanelLayoutProps = {
  children: ReactNode;
};

function maskCustomerEmail(email: string): string {
  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) {
    return 'Klient Audiofast';
  }

  return `${localPart.slice(0, 1)}***@${domain}`;
}

function resolveCustomerDisplayName(
  session: Extract<
    Awaited<ReturnType<typeof loadCustomerAuthSession>>,
    { isAuthenticated: true }
  >,
): string {
  const profileName = [session.profile?.first_name, session.profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return profileName || maskCustomerEmail(session.normalizedEmail);
}

export default async function CustomerPanelLayout({
  children,
}: CustomerPanelLayoutProps) {
  const session = await loadCustomerAuthSession();

  if (!session.isAuthenticated) {
    redirect(buildCustomerAccountGatewayHref('/konto-klienta/zamowienia/'));
  }

  return (
    <CustomerPanelShell
      customerDisplayName={resolveCustomerDisplayName(session)}
    >
      {children}
    </CustomerPanelShell>
  );
}
