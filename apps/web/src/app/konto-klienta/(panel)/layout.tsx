import { redirect } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

import CustomerPanelShell from '@/src/components/b2c/CustomerPanel/CustomerPanelShell';
import { buildCustomerAccountGatewayHref } from '@/src/global/b2c/customer-auth/return-to';
import { loadCustomerAuthSession } from '@/src/global/b2c/customer-auth/server/session';

import CustomerPanelLoading from './loading';

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

export default function CustomerPanelLayout({
  children,
}: CustomerPanelLayoutProps) {
  return (
    <Suspense fallback={<CustomerPanelLoading />}>
      <AuthenticatedCustomerPanelLayout>
        {children}
      </AuthenticatedCustomerPanelLayout>
    </Suspense>
  );
}

async function AuthenticatedCustomerPanelLayout({
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
