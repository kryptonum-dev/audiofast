import type { ReactNode } from 'react';

import CustomerPanelNav from '@/src/components/b2c/CustomerPanel/CustomerPanelNav/CustomerPanelNav';

import styles from './CustomerPanelShell.module.scss';

type CustomerPanelShellProps = {
  customerDisplayName: string;
  children: ReactNode;
};

export default function CustomerPanelShell({
  customerDisplayName,
  children,
}: CustomerPanelShellProps) {
  return (
    <main
      id="main"
      className={`${styles.customerPanelShell} page-transition max-width`}
    >
      <CustomerPanelNav customerDisplayName={customerDisplayName} />
      <div className={styles.panelContent}>{children}</div>
    </main>
  );
}
