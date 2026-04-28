import AccountDetailsSkeleton from '@/src/components/b2c/CustomerPanel/AccountDetails/AccountDetailsSkeleton';
import { CustomerAccountDetailsHeader } from '@/src/components/b2c/CustomerPanel/AccountDetails';
import styles from '@/src/components/b2c/CustomerPanel/AccountDetails/styles.module.scss';

export default function CustomerAccountDetailsLoading() {
  return (
    <section className={styles.accountDetailsPage}>
      <CustomerAccountDetailsHeader />
      <AccountDetailsSkeleton />
    </section>
  );
}
